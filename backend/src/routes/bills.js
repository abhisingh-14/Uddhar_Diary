const express = require("express");
const multer = require("multer");

const { supabase } = require("../lib/supabaseClient");
const { extractBillFromImage } = require("../services/billExtraction");
const { calculateSplit, SplitError } = require("../services/splitCalculator");
const { UUID_PATTERN, ISO_DATE_PATTERN } = require("../lib/validators");
const { requireAuth } = require("../middleware/requireAuth");

const BILL_IMAGES_BUCKET = "bill-images";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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
router.use(requireAuth);

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
  if (!req.file) {
    return { status: 400, body: { error: "image file is required" } };
  }
  if (req.file.size > MAX_FILE_SIZE_BYTES) {
    return { status: 413, body: { error: "Image must be 10MB or smaller" } };
  }
  return {};
}

function validateCreateBillBody(body, reqUserId) {
  const userId = reqUserId;

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

  // Check for more than 2 decimal places
  const totalString = total.toString();
  const decimalIndex = totalString.indexOf('.');
  if (decimalIndex !== -1 && totalString.length - decimalIndex - 1 > 2) {
    return { status: 400, body: { error: "total must have at most 2 decimal places" } };
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

  const source = body?.source ?? 'photo';
  if (source !== 'photo' && source !== 'manual') {
    return { status: 400, body: { error: "source must be 'photo' or 'manual'" } };
  }

  const items = body?.items;
  if (source === 'photo') {
    if (!Array.isArray(items) || items.length === 0) {
      return { status: 400, body: { error: "items must be a non-empty array for photo source" } };
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

    let calculatedTotal = 0;
    for (const item of normalizedItems) {
      calculatedTotal += item.price * item.quantity;
    }
    
    if (Math.abs(calculatedTotal - total) > 0.01) {
      return {
        status: 400,
        body: {
          error: `Item totals do not match bill total. Items sum to ${calculatedTotal.toFixed(2)}, but bill total is ${total.toFixed(2)}.`
        }
      };
    }

    return {
      userId,
      storagePath: storagePath.trim(),
      merchantName: merchantName.trim(),
      total,
      categoryId,
      billDate: billDate ?? null,
      items: normalizedItems,
      source,
    };
  } else {
    // Manual source: items should be empty or absent
    if (items !== undefined && items !== null && (!Array.isArray(items) || items.length > 0)) {
      return { status: 400, body: { error: "items must be empty or absent for manual source" } };
    }

    return {
      userId,
      storagePath: storagePath.trim(),
      merchantName: merchantName.trim(),
      total,
      categoryId,
      billDate: billDate ?? null,
      items: [],
      source,
    };
  }
}

function mapDebtRow(row) {
  const amount = Number(row.amount_paise) / 100;
  return {
    id: row.id,
    personId: row.person_id,
    personName: row.people?.name ?? "Unknown person",
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

  const { fileTypeFromBuffer } = await import("file-type");
  const fileType = await fileTypeFromBuffer(req.file.buffer);

  if (!fileType || !fileType.mime.startsWith("image/")) {
    const { status, body } = uploadErrorResponse(new InvalidMimetypeError());
    res.status(status).json(body);
    return null;
  }

  const { storagePath, error } = await storeBillImage(
    req.userId,
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
    const validation = validateCreateBillBody(req.body, req.userId);
    if (validation.status) {
      return res.status(validation.status).json(validation.body);
    }

    // Validate and extract split-related fields
    const paidBy = req.body?.paidBy;
    if (typeof paidBy !== "string" || paidBy.trim() === "") {
      return res.status(400).json({ error: "paidBy is required" });
    }

    const participantIds = req.body?.participantIds;
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: "participantIds must be a non-empty array" });
    }

    // Validate each participantId is a valid UUID
    for (const personId of participantIds) {
      if (typeof personId !== "string" || !UUID_PATTERN.test(personId)) {
        return res.status(400).json({ error: "each participantId must be a valid UUID" });
      }
      if (personId === validation.userId) {
        return res.status(400).json({ error: "participantIds must not include userId" });
      }
    }

    // Validate paidBy is either 'you' or in participantIds
    if (paidBy !== 'you' && !participantIds.includes(paidBy)) {
      return res.status(400).json({ error: "paidBy must be 'you' or one of the participantIds" });
    }

    // Validate alreadyPaid if present
    const alreadyPaidRaw = req.body?.alreadyPaid;
    const alreadyPaid = {};
    if (alreadyPaidRaw !== undefined && alreadyPaidRaw !== null) {
      if (typeof alreadyPaidRaw !== "object" || Array.isArray(alreadyPaidRaw)) {
        return res.status(400).json({ error: "alreadyPaid must be an object" });
      }
      for (const [personId, amount] of Object.entries(alreadyPaidRaw)) {
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
          return res.status(400).json({ error: `alreadyPaid amount for ${personId} must be a non-negative number` });
        }
        // Check for more than 2 decimal places
        const amountString = amount.toString();
        const decimalIndex = amountString.indexOf('.');
        if (decimalIndex !== -1 && amountString.length - decimalIndex - 1 > 2) {
          return res.status(400).json({ error: `alreadyPaid amount for ${personId} must have at most 2 decimal places` });
        }
        alreadyPaid[personId] = amount;
      }
    }

    // Verify all personIds belong to the user
    const allPersonIds = [...participantIds];
    if (paidBy !== 'you') {
      allPersonIds.push(paidBy);
    }
    // Also validate any personIds in alreadyPaid
    for (const personId of Object.keys(alreadyPaid)) {
      if (!allPersonIds.includes(personId)) {
        return res.status(400).json({ error: `alreadyPaid personId ${personId} must be in participantIds or be the paidBy` });
      }
    }

    const uniquePersonIds = [...new Set(allPersonIds)];
    for (const personId of uniquePersonIds) {
      const { data: person, error: personError } = await supabase
        .from("people")
        .select("id")
        .eq("id", personId)
        .eq("user_id", validation.userId)
        .single();

      if (personError || !person) {
        return res.status(400).json({ error: `personId ${personId} does not belong to user` });
      }
    }

    // Convert total to paise
    const totalPaise = Math.round(validation.total * 100);

    // Convert alreadyPaid from rupees to paise
    const alreadyPaidPaise = {};
    for (const [personId, amount] of Object.entries(alreadyPaid)) {
      alreadyPaidPaise[personId] = Math.round(amount * 100);
    }

    // Calculate split using the new calculator
    let splitResult;
    try {
      splitResult = calculateSplit({
        totalPaise,
        participantIds,
        payer: paidBy,
        alreadyPaid: alreadyPaidPaise
      });
    } catch (splitError) {
      if (splitError instanceof SplitError) {
        return res.status(400).json({ error: splitError.message });
      }
      throw splitError;
    }

    // Format split entries for the RPC (convert back to rupees for the old RPC format)
    const splitEntries = splitResult.debts.map(debt => ({
      personId: debt.personId,
      owedAmount: debt.amountPaise / 100,
      direction: debt.direction
    }));

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
        p_user_share_paise: splitResult.userSharePaise,
        p_source: validation.source,
      }
    );

    if (rpcError) {
      console.error("create_bill_with_split failed:", rpcError);
      return res.status(502).json({ error: "Failed to save bill" });
    }

    const { data: debtRows, error: debtsError } = await supabase
      .from("debts")
      .select("id, person_id, amount_paise, direction, people(name)")
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
