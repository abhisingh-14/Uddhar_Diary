const express = require("express");
const multer = require("multer");

const { supabase } = require("../lib/supabaseClient");
const { extractBillFromImage } = require("../services/billExtraction");
const { calculateEvenSplit } = require("../services/splitCalculator");

const BILL_IMAGES_BUCKET = "bill-images";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  const userValidation = validateUserIdField((req.body || {}).userId);
  if (userValidation.status) {
    return userValidation;
  }
  if (!req.file) {
    return { status: 400, body: { error: "image file is required" } };
  }
  if (req.file.size > MAX_FILE_SIZE_BYTES) {
    return { status: 413, body: { error: "Image must be 10MB or smaller" } };
  }
  return { userId: userValidation.userId };
}

function validateUserIdField(userId) {
  if (typeof userId !== "string" || userId.trim() === "") {
    return { status: 400, body: { error: "userId is required" } };
  }
  const trimmedUserId = userId.trim();
  if (!UUID_PATTERN.test(trimmedUserId)) {
    return { status: 400, body: { error: "userId must be a valid UUID" } };
  }
  return { userId: trimmedUserId };
}

function validateCreateBillBody(body) {
  const userValidation = validateUserIdField(body?.userId);
  if (userValidation.status) {
    return userValidation;
  }
  const { userId } = userValidation;

  const storagePath = body?.storagePath;
  if (typeof storagePath !== "string" || storagePath.trim() === "") {
    return { status: 400, body: { error: "storagePath is required" } };
  }

  const merchantName = body?.merchantName;
  if (typeof merchantName !== "string" || merchantName.trim() === "") {
    return { status: 400, body: { error: "merchantName is required" } };
  }

  const total = body?.total;
  if (typeof total !== "number" || !Number.isFinite(total) || total <= 0) {
    return { status: 400, body: { error: "total must be a positive number" } };
  }

  const categoryId = body?.categoryId;
  if (typeof categoryId !== "string" || !UUID_PATTERN.test(categoryId)) {
    return { status: 400, body: { error: "categoryId is invalid" } };
  }

  const billDate = body?.billDate;
  if (billDate !== null && billDate !== undefined) {
    if (typeof billDate !== "string" || !ISO_DATE_PATTERN.test(billDate)) {
      return {
        status: 400,
        body: { error: "billDate must be YYYY-MM-DD or null" },
      };
    }
  }

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return { status: 400, body: { error: "items must be a non-empty array" } };
  }

  const normalizedItems = [];
  for (const item of items) {
    if (typeof item?.name !== "string" || item.name.trim() === "") {
      return { status: 400, body: { error: "each item must have a name" } };
    }
    if (typeof item?.price !== "number" || !Number.isFinite(item.price)) {
      return {
        status: 400,
        body: { error: "each item must have a numeric price" },
      };
    }
    const quantity = item?.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1) {
      return {
        status: 400,
        body: { error: "each item quantity must be a positive integer" },
      };
    }
    normalizedItems.push({
      name: item.name.trim(),
      price: item.price,
      quantity,
    });
  }

  const people = body?.people;
  if (!Array.isArray(people) || people.length === 0) {
    return { status: 400, body: { error: "people must be a non-empty array" } };
  }

  const personIds = [];
  const amountsPaid = {};
  for (const person of people) {
    if (typeof person?.personId !== "string" || !UUID_PATTERN.test(person.personId)) {
      return { status: 400, body: { error: "each person must have a valid personId" } };
    }
    if (person.personId === userId) {
      return {
        status: 400,
        body: {
          error:
            "people must not include userId; the bill owner is tracked separately",
        },
      };
    }
    if (
      typeof person?.amountPaid !== "number" ||
      !Number.isFinite(person.amountPaid) ||
      person.amountPaid < 0
    ) {
      return {
        status: 400,
        body: { error: "each person must have a non-negative amountPaid" },
      };
    }
    if (Object.hasOwn(amountsPaid, person.personId)) {
      return {
        status: 400,
        body: { error: "people must not contain duplicate personId values" },
      };
    }
    personIds.push(person.personId);
    amountsPaid[person.personId] = person.amountPaid;
  }

  return {
    userId,
    storagePath: storagePath.trim(),
    merchantName: merchantName.trim(),
    total,
    categoryId,
    billDate: billDate ?? null,
    items: normalizedItems,
    personIds,
    amountsPaid,
  };
}

function mapDebtRow(row) {
  const amount = Number(row.amount);
  return {
    id: row.id,
    personId: row.person_id,
    owedAmount: row.direction === "they_owe_you" ? amount : -amount,
    direction: row.direction,
  };
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

router.post("/", async (req, res, next) => {
  try {
    const validation = validateCreateBillBody(req.body);
    if (validation.status) {
      return res.status(validation.status).json(validation.body);
    }

    const splitEntries = calculateEvenSplit(
      validation.total,
      validation.personIds,
      validation.amountsPaid
    );

    const { data: billId, error: rpcError } = await supabase.rpc(
      "create_bill_with_split",
      {
        p_user_id: validation.userId,
        p_image_url: validation.storagePath,
        p_merchant_name: validation.merchantName,
        p_total_amount: validation.total,
        p_category_id: validation.categoryId,
        p_bill_date: validation.billDate,
        p_items: validation.items,
        p_split_entries: splitEntries,
      }
    );

    if (rpcError) {
      console.error("create_bill_with_split failed:", rpcError);
      return res.status(502).json({ error: "Failed to save bill" });
    }

    const { data: debtRows, error: debtsError } = await supabase
      .from("debts")
      .select("id, person_id, amount, direction")
      .eq("bill_id", billId);

    if (debtsError) {
      console.error("Failed to load created debts:", debtsError);
      return res.status(502).json({ error: "Bill saved but debts could not be loaded" });
    }

    return res.status(201).json({
      id: billId,
      debts: (debtRows ?? []).map(mapDebtRow),
    });
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
