const express = require("express");
const multer = require("multer");

const { supabase } = require("../lib/supabaseClient");

const BILL_IMAGES_BUCKET = "bill-images";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_USER_ID_LENGTH = 128;
const USER_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

class InvalidMimetypeError extends Error {}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES + 1, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new InvalidMimetypeError(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

const router = express.Router();

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

router.post("/upload-image", (req, res, next) => {
  upload.single("image")(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(413)
            .json({ error: "Image must be 10MB or smaller" });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res
            .status(400)
            .json({ error: "Only a single image file is accepted" });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err instanceof InvalidMimetypeError) {
        return res
          .status(415)
          .json({ error: "Only image uploads are accepted" });
      }
      if (err) {
        return res.status(500).json({ error: "Failed to read uploaded file" });
      }

      const userId = (req.body || {}).userId;
      if (typeof userId !== "string" || userId.trim() === "") {
        return res.status(400).json({ error: "userId is required" });
      }
      const trimmedUserId = userId.trim();
      if (
        trimmedUserId.length > MAX_USER_ID_LENGTH ||
        !USER_ID_PATTERN.test(trimmedUserId)
      ) {
        return res.status(400).json({ error: "userId is invalid" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "image file is required" });
      }
      if (req.file.size > MAX_FILE_SIZE_BYTES) {
        return res.status(413).json({ error: "Image must be 10MB or smaller" });
      }

      const storagePath = `${trimmedUserId}/${Date.now()}-${sanitizeFilename(
        req.file.originalname
      )}`;

      const { error: uploadError } = await supabase.storage
        .from(BILL_IMAGES_BUCKET)
        .upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        return res.status(502).json({ error: "Failed to upload image" });
      }

      return res.status(201).json({ storagePath });
    } catch (handlerError) {
      return next(handlerError);
    }
  });
});

module.exports = router;
