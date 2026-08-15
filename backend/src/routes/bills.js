const express = require("express");
const multer = require("multer");

const { supabase } = require("../lib/supabaseClient");
const { extractBillFromImage } = require("../services/billExtraction");

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

function uploadErrorResponse(err) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return { status: 413, body: { error: "Image must be 10MB or smaller" } };
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return {
        status: 400,
        body: { error: "Only a single image file is accepted" },
      };
    }
    return { status: 400, body: { error: err.message } };
  }
  if (err instanceof InvalidMimetypeError) {
    return { status: 415, body: { error: "Only image uploads are accepted" } };
  }
  return { status: 500, body: { error: "Failed to read uploaded file" } };
}

function validateRequest(req) {
  const userId = (req.body || {}).userId;
  if (typeof userId !== "string" || userId.trim() === "") {
    return { status: 400, body: { error: "userId is required" } };
  }
  const trimmedUserId = userId.trim();
  if (
    trimmedUserId.length > MAX_USER_ID_LENGTH ||
    !USER_ID_PATTERN.test(trimmedUserId)
  ) {
    return { status: 400, body: { error: "userId is invalid" } };
  }
  if (!req.file) {
    return { status: 400, body: { error: "image file is required" } };
  }
  if (req.file.size > MAX_FILE_SIZE_BYTES) {
    return { status: 413, body: { error: "Image must be 10MB or smaller" } };
  }
  return { userId: trimmedUserId };
}

async function storeBillImage(userId, file) {
  const storagePath = `${userId}/${Date.now()}-${sanitizeFilename(
    file.originalname
  )}`;

  const { error } = await supabase.storage
    .from(BILL_IMAGES_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  return { storagePath, error };
}

// Runs multer, validates input, and uploads to Storage. Returns null when a
// response has already been sent, otherwise the accepted upload's details.
async function handleImageUpload(req, res) {
  const uploadError = await new Promise((resolve) => {
    upload.single("image")(req, res, resolve);
  });

  if (uploadError) {
    const { status, body } = uploadErrorResponse(uploadError);
    res.status(status).json(body);
    return null;
  }

  const validation = validateRequest(req);
  if (validation.status) {
    res.status(validation.status).json(validation.body);
    return null;
  }

  const { storagePath, error } = await storeBillImage(
    validation.userId,
    req.file
  );
  if (error) {
    res.status(502).json({ error: "Failed to upload image" });
    return null;
  }

  return { storagePath, file: req.file };
}

router.post("/upload-image", async (req, res, next) => {
  try {
    const uploaded = await handleImageUpload(req, res);
    if (!uploaded) return;
    return res.status(201).json({ storagePath: uploaded.storagePath });
  } catch (handlerError) {
    return next(handlerError);
  }
});

router.post("/extract", async (req, res, next) => {
  try {
    const uploaded = await handleImageUpload(req, res);
    if (!uploaded) return;

    try {
      const extracted = await extractBillFromImage(
        uploaded.file.buffer,
        uploaded.file.mimetype
      );
      return res
        .status(201)
        .json({ storagePath: uploaded.storagePath, extracted });
    } catch (extractionError) {
      console.error("Bill extraction failed:", extractionError);
      return res.status(201).json({
        storagePath: uploaded.storagePath,
        extractionFailed: true,
        extracted: { items: [] },
      });
    }
  } catch (handlerError) {
    return next(handlerError);
  }
});

module.exports = router;
