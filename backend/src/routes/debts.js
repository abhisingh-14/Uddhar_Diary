const express = require("express");

const { supabase } = require("../lib/supabaseClient");
const { UUID_PATTERN, validateUserIdField } = require("../lib/validators");

const router = express.Router();

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
    merchantName: row.bills?.merchant_name ?? null,
    billDate: row.bills?.bill_date ?? null,
  };
}

router.get("/balances", async (req, res, next) => {
  try {
    const userValidation = validateUserIdField(req.query.userId);
    if (userValidation.status) {
      return res.status(userValidation.status).json(userValidation.body);
    }

    const { data, error } = await supabase
      .from("person_balances")
      .select(
        "person_id, name, they_owe_you_paise, you_owe_them_paise, net_balance_paise"
      )
      .eq("user_id", userValidation.userId);

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

    const userValidation = validateUserIdField(req.query.userId);
    if (userValidation.status) {
      return res.status(userValidation.status).json(userValidation.body);
    }

    // Prevent cross-user debt-history access through a guessed person ID.
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id")
      .eq("id", personId)
      .eq("user_id", userValidation.userId)
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
        "id, bill_id, person_id, direction, amount_paise, amount_paid_paise, created_at, settled_at, bills(merchant_name, bill_date)"
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

router.patch("/:debtId/settle", async (req, res, next) => {
  try {
    const { debtId } = req.params;
    if (typeof debtId !== "string" || !UUID_PATTERN.test(debtId)) {
      return res.status(400).json({ error: "debtId is invalid" });
    }

    const userValidation = validateUserIdField((req.body || {}).userId);
    if (userValidation.status) {
      return res.status(userValidation.status).json(userValidation.body);
    }

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
    if (!debt || debt.people?.user_id !== userValidation.userId) {
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

module.exports = router;
