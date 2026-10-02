const express = require("express");

const { supabase } = require("../lib/supabaseClient");
const { UUID_PATTERN, ISO_DATE_PATTERN } = require("../lib/validators");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

function parseAmountPaise(amountPaise) {
  if (
    !Number.isInteger(amountPaise) ||
    amountPaise <= 0 ||
    amountPaise > 2147483647
  ) {
    return { error: "amountPaise must be a positive integer up to 2147483647" };
  }
  return { value: amountPaise };
}

function parseNote(note) {
  if (note === undefined || note === null) {
    return { value: null };
  }
  if (typeof note !== "string") {
    return { error: "note must be a string" };
  }
  const trimmedNote = note.trim();
  if (trimmedNote === "") {
    return { value: null };
  }
  if (trimmedNote.length > 200) {
    return { error: "note must be 200 characters or less" };
  }
  return { value: trimmedNote };
}

function parseIncurredOn(incurredOn, allowOptional = true) {
  if (incurredOn === undefined || incurredOn === null) {
    if (allowOptional) {
      const today = new Date();
      return { value: today.toISOString().split("T")[0] };
    }
    return { error: "incurredOn is required" };
  }
  if (typeof incurredOn !== "string" || !ISO_DATE_PATTERN.test(incurredOn)) {
    return { error: "incurredOn must be in YYYY-MM-DD format" };
  }
  const parsed = new Date(`${incurredOn}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== incurredOn
  ) {
    return { error: "incurredOn must be a valid calendar date" };
  }

  const limit = new Date();
  limit.setUTCHours(0, 0, 0, 0);
  limit.setUTCDate(limit.getUTCDate() + 1);
  if (parsed > limit) {
    return { error: "incurredOn cannot be in the future" };
  }
  return { value: incurredOn };
}

function mapDebtRow(row) {
  const amountPaise = row.amount_paise;
  const amountPaidPaise = row.amount_paid_paise;

  return {
    id: row.id,
    billId: row.bill_id,
    personId: row.person_id,
    direction: row.direction,
    amountPaise,
    amountPaidPaise,
    remainingPaise: amountPaise - amountPaidPaise,
    createdAt: row.created_at,
    settledAt: row.settled_at,
    kind: row.kind,
    note: row.note,
    incurredOn: row.incurred_on,
    merchantName: row.bills?.merchant_name ?? null,
    billDate: row.bills?.bill_date ?? null,
  };
}

router.get("/balances", async (req, res, next) => {
  try {
    const userId = req.userId;

    const { data, error } = await supabase
      .from("person_balances")
      .select(
        "person_id, name, they_owe_you_paise, you_owe_them_paise, net_balance_paise"
      )
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to fetch balances:", error);
      return res.status(502).json({ error: "Failed to fetch balances" });
    }

    const balances = (data ?? [])
      .filter((row) => row.net_balance_paise !== 0)
      .map((row) => ({
        personId: row.person_id,
        name: row.name,
        theyOweYouPaise: row.they_owe_you_paise,
        youOweThemPaise: row.you_owe_them_paise,
        netBalancePaise: row.net_balance_paise,
      }));

    return res.json({ balances });
  } catch (handlerError) {
    return next(handlerError);
  }
});

router.get("/person/:personId", async (req, res, next) => {
  try {
    const { personId } = req.params;
    if (typeof personId !== "string" || !UUID_PATTERN.test(personId)) {
      return res.status(400).json({ error: "personId is invalid" });
    }

    const userId = req.userId;

    // Prevent cross-user debt-history access through a guessed person ID.
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id")
      .eq("id", personId)
      .eq("user_id", userId)
      .maybeSingle();

    if (personError) {
      console.error("Failed to verify person ownership:", personError);
      return res.status(502).json({ error: "Failed to fetch debt history" });
    }
    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }

    const { data, error } = await supabase
      .from("debts")
      .select(
        "id, bill_id, person_id, direction, amount_paise, amount_paid_paise, created_at, settled_at, kind, note, incurred_on, bills(merchant_name, bill_date)"
      )
      .eq("person_id", personId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch debt history:", error);
      return res.status(502).json({ error: "Failed to fetch debt history" });
    }

    return res.json({ personId, debts: (data ?? []).map(mapDebtRow) });
  } catch (handlerError) {
    return next(handlerError);
  }
});

router.post("/manual", async (req, res, next) => {
  try {
    const { personId, direction, amountPaise, kind, note, incurredOn } =
      req.body || {};

    // 1. Validate personId
    if (
      typeof personId !== "string" ||
      !UUID_PATTERN.test(personId)
    ) {
      return res.status(400).json({ error: "personId is invalid" });
    }

    // 2. Validate direction
    if (direction !== "they_owe_you" && direction !== "you_owe_them") {
      return res.status(400).json({ error: "direction must be 'they_owe_you' or 'you_owe_them'" });
    }

    // 3. Validate kind
    if (kind !== "old_due" && kind !== "loan") {
      return res.status(400).json({ error: "kind must be 'old_due' or 'loan'" });
    }

    // 4. Validate amountPaise
    const amountPaiseResult = parseAmountPaise(amountPaise);
    if (amountPaiseResult.error) {
      return res.status(400).json({ error: amountPaiseResult.error });
    }

    // 5. Validate note
    const noteResult = parseNote(note);
    if (noteResult.error) {
      return res.status(400).json({ error: noteResult.error });
    }

    // 6. Validate incurredOn
    const incurredOnResult = parseIncurredOn(incurredOn);
    if (incurredOnResult.error) {
      return res.status(400).json({ error: incurredOnResult.error });
    }

    const finalNote = noteResult.value;
    const finalIncurredOn = incurredOnResult.value;

    const userId = req.userId;

    // 7. Verify ownership
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id")
      .eq("id", personId)
      .eq("user_id", userId)
      .maybeSingle();

    if (personError) {
      console.error("Failed to verify person ownership:", personError);
      return res.status(502).json({ error: "Failed to create manual debt" });
    }
    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }

    // Insert the debt
    const { data: insertedDebt, error: insertError } = await supabase
      .from("debts")
      .insert({
        person_id: personId,
        direction,
        amount_paise: amountPaise,
        kind,
        note: finalNote,
        incurred_on: finalIncurredOn,
        bill_id: null,
      })
      .select(
        "id, bill_id, person_id, direction, amount_paise, amount_paid_paise, created_at, settled_at, kind, note, incurred_on"
      )
      .single();

    if (insertError) {
      console.error("Failed to create manual debt:", insertError);
      return res.status(500).json({ error: "Failed to create manual debt" });
    }

    return res.status(201).json(mapDebtRow(insertedDebt));
  } catch (handlerError) {
    return next(handlerError);
  }
});

router.patch("/:debtId/settle", async (req, res, next) => {
  try {
    const { debtId } = req.params;
    if (typeof debtId !== "string" || !UUID_PATTERN.test(debtId)) {
      return res.status(400).json({ error: "debtId is invalid" });
    }

    const userId = req.userId;

    const { amountPaise } = req.body || {};
    if (
      amountPaise !== undefined &&
      (!Number.isInteger(amountPaise) || amountPaise <= 0)
    ) {
      return res
        .status(400)
        .json({ error: "amountPaise must be a positive integer" });
    }

    // Prevent cross-user settlement through a guessed debt ID.
    const { data: debt, error: debtError } = await supabase
      .from("debts")
      .select(
        "id, bill_id, person_id, direction, amount_paise, amount_paid_paise, created_at, settled_at, people!inner(user_id)"
      )
      .eq("id", debtId)
      .maybeSingle();

    if (debtError) {
      console.error("Failed to fetch debt:", debtError);
      return res.status(502).json({ error: "Failed to settle debt" });
    }
    if (!debt || debt.people?.user_id !== userId) {
      return res.status(404).json({ error: "Debt not found" });
    }

    if (debt.amount_paid_paise >= debt.amount_paise) {
      return res.status(409).json({ error: "Debt is already settled" });
    }

    const remainingPaise = debt.amount_paise - debt.amount_paid_paise;
    const amountToApply = amountPaise ?? remainingPaise;
    if (amountToApply > remainingPaise) {
      return res
        .status(400)
        .json({ error: "amountPaise cannot exceed the remaining balance" });
    }

    const updatedAmountPaidPaise = debt.amount_paid_paise + amountToApply;
    const { data: updatedDebt, error: updateError } = await supabase
      .from("debts")
      .update({
        amount_paid_paise: updatedAmountPaidPaise,
        settled_at:
          updatedAmountPaidPaise === debt.amount_paise
            ? new Date().toISOString()
            : null,
      })
      .eq("id", debtId)
      .select(
        "id, bill_id, person_id, direction, amount_paise, amount_paid_paise, created_at, settled_at"
      )
      .single();

    if (updateError) {
      console.error("Failed to settle debt:", updateError);
      return res.status(502).json({ error: "Failed to settle debt" });
    }

    return res.json(mapDebtRow(updatedDebt));
  } catch (handlerError) {
    return next(handlerError);
  }
});

router.patch("/:debtId", async (req, res, next) => {
  try {
    const { debtId } = req.params;
    if (typeof debtId !== "string" || !UUID_PATTERN.test(debtId)) {
      return res.status(400).json({ error: "debtId is invalid" });
    }

    const body = req.body || {};
    const allowedFields = ["amountPaise", "direction", "note", "incurredOn"];
    const providedFields = Object.keys(body);

    // Check at least one allowed field is provided
    if (providedFields.length === 0) {
      return res.status(400).json({ error: "At least one field must be provided" });
    }

    // Check for disallowed fields
    for (const field of providedFields) {
      if (!allowedFields.includes(field)) {
        return res.status(400).json({ error: `${field} cannot be edited` });
      }
    }

    // Validate each provided field
    const updateFields = {};

    if (body.amountPaise !== undefined) {
      const result = parseAmountPaise(body.amountPaise);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      updateFields.amount_paise = result.value;
    }

    if (body.direction !== undefined) {
      if (body.direction !== "they_owe_you" && body.direction !== "you_owe_them") {
        return res.status(400).json({ error: "direction must be 'they_owe_you' or 'you_owe_them'" });
      }
      updateFields.direction = body.direction;
    }

    if (body.note !== undefined) {
      const result = parseNote(body.note);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      updateFields.note = result.value;
    }

    if (body.incurredOn !== undefined) {
      const result = parseIncurredOn(body.incurredOn, false);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      updateFields.incurred_on = result.value;
    }

    const userId = req.userId;

    // Ownership check
    const { data: debt, error: debtError } = await supabase
      .from("debts")
      .select(
        "id, bill_id, person_id, direction, amount_paise, amount_paid_paise, created_at, settled_at, kind, note, incurred_on, people!inner(user_id)"
      )
      .eq("id", debtId)
      .maybeSingle();

    if (debtError) {
      console.error("Failed to fetch debt:", debtError);
      return res.status(502).json({ error: "Failed to update debt" });
    }
    if (!debt || debt.people?.user_id !== userId) {
      return res.status(404).json({ error: "Debt not found" });
    }

    // Guards
    if (debt.kind === "bill") {
      return res.status(409).json({ error: "Bill-based debts can't be edited here." });
    }
    if (debt.amount_paid_paise > 0) {
      return res.status(409).json({ error: "This entry has payments recorded and can no longer be edited." });
    }

    // Apply update with guards in the query itself
    const { data: updatedDebt, error: updateError } = await supabase
      .from("debts")
      .update(updateFields)
      .eq("id", debtId)
      .eq("amount_paid_paise", 0)
      .neq("kind", "bill")
      .select(
        "id, bill_id, person_id, direction, amount_paise, amount_paid_paise, created_at, settled_at, kind, note, incurred_on"
      )
      .maybeSingle();

    if (updateError) {
      console.error("Failed to update debt:", updateError);
      return res.status(502).json({ error: "Failed to update debt" });
    }
    if (!updatedDebt) {
      return res.status(409).json({ error: "This entry has payments recorded and can no longer be edited." });
    }

    return res.json(mapDebtRow(updatedDebt));
  } catch (handlerError) {
    return next(handlerError);
  }
});

router.delete("/:debtId", async (req, res, next) => {
  try {
    const { debtId } = req.params;
    if (typeof debtId !== "string" || !UUID_PATTERN.test(debtId)) {
      return res.status(400).json({ error: "debtId is invalid" });
    }

    const userId = req.userId;

    // Ownership check
    const { data: debt, error: debtError } = await supabase
      .from("debts")
      .select(
        "id, bill_id, person_id, direction, amount_paise, amount_paid_paise, created_at, settled_at, kind, note, incurred_on, people!inner(user_id)"
      )
      .eq("id", debtId)
      .maybeSingle();

    if (debtError) {
      console.error("Failed to fetch debt:", debtError);
      return res.status(502).json({ error: "Failed to delete debt" });
    }
    if (!debt || debt.people?.user_id !== userId) {
      return res.status(404).json({ error: "Debt not found" });
    }

    // Guards
    if (debt.kind === "bill") {
      return res.status(409).json({ error: "Bill-based debts can't be deleted here." });
    }
    if (debt.amount_paid_paise > 0) {
      return res.status(409).json({ error: "This entry has payments recorded and can no longer be deleted." });
    }

    // Delete with guards in the query itself
    const { data: deletedDebt, error: deleteError } = await supabase
      .from("debts")
      .delete()
      .eq("id", debtId)
      .eq("amount_paid_paise", 0)
      .neq("kind", "bill")
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error("Failed to delete debt:", deleteError);
      return res.status(502).json({ error: "Failed to delete debt" });
    }
    if (!deletedDebt) {
      return res.status(409).json({ error: "This entry has payments recorded and can no longer be deleted." });
    }

    return res.status(200).json({ id: debtId });
  } catch (handlerError) {
    return next(handlerError);
  }
});

module.exports = router;
