const express = require("express");
const { supabase } = require("../lib/supabaseClient");
const { requireAuth } = require("../middleware/requireAuth");
const { UUID_PATTERN, EMAIL_PATTERN } = require("../lib/validators");
const { sendReminderEmail } = require("../services/emailService");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const trimmedUserId = req.userId;


    const { data, error } = await supabase
      .from("people")
      .select("id, name, email")
      .eq("user_id", trimmedUserId);

    if (error) {
      console.error("Error fetching people:", error);
      return res.status(500).json({ error: "Failed to fetch people" });
    }

    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, email } = req.body || {};
    
    const trimmedUserId = req.userId;

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required", code: "INVALID_NAME" });
    }
    const trimmedName = name.trim();
    if (trimmedName.length > 60) {
      return res
        .status(400)
        .json({ error: "Name must be 60 characters or fewer", code: "INVALID_NAME" });
    }

    // Email is optional: omitted, null, or empty all mean "no email yet".
    let trimmedEmail = null;
    if (email !== undefined && email !== null) {
      if (typeof email !== "string") {
        return res
          .status(400)
          .json({ error: "Email must be a valid email address", code: "INVALID_EMAIL" });
      }
      const candidateEmail = email.trim();
      if (candidateEmail !== "") {
        // Reuses the same format check as the email-update (PATCH) route.
        if (!EMAIL_PATTERN.test(candidateEmail)) {
          return res
            .status(400)
            .json({ error: "Email must be a valid email address", code: "INVALID_EMAIL" });
        }
        trimmedEmail = candidateEmail;
      }
    }

    const { data, error } = await supabase
      .from("people")
      .insert({
        // Owner always comes from the verified token. A userId in the request
        // body is deliberately ignored, so nobody can create people for another user.
        user_id: trimmedUserId,
        name: trimmedName,
        email: trimmedEmail,
      })
      .select("id, name, email")
      .single();

    if (error) {
      // 23505 = unique_violation raised by the (user_id, lower(name)) index.
      // Map it to a friendly 409 instead of letting it become a 500.
      if (error.code === "23505") {
        return res.status(409).json({
          error: "You already have a person with this name",
          code: "PERSON_EXISTS",
        });
      }
      console.error("Error creating person:", error);
      return res.status(500).json({ error: "Failed to create person" });
    }

    return res.status(201).json(data);
  } catch (err) {
    return next(err);
  }
});

router.patch("/:personId", async (req, res, next) => {
  try {
    const { personId } = req.params;
    if (typeof personId !== "string" || !UUID_PATTERN.test(personId)) {
      return res.status(400).json({ error: "personId is invalid" });
    }

    const { email } = req.body || {};
    const trimmedUserId = req.userId;

    // Validate email input
    if (email === undefined) {
      return res.status(400).json({ error: "email is required" });
    }
    if (email !== null && typeof email !== "string") {
      return res.status(400).json({ error: "email must be a string or null" });
    }

    let trimmedEmail = null;
    if (email !== null) {
      if (email.trim() === "") {
        return res.status(400).json({ error: "email cannot be an empty string" });
      }
      // Same check the person-create route uses, kept in one shared place.
      if (!EMAIL_PATTERN.test(email.trim())) {
        return res.status(400).json({ error: "email must be a valid email address" });
      }
      trimmedEmail = email.trim();
    }

    // Verify person belongs to this user (prevents cross-user access via guessed personId)
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id")
      .eq("id", personId)
      .eq("user_id", trimmedUserId)
      .maybeSingle();

    if (personError) {
      console.error("Failed to verify person ownership:", personError);
      return res.status(500).json({ error: "Failed to update person" });
    }
    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }

    // Update the email
    const { data: updatedPerson, error: updateError } = await supabase
      .from("people")
      .update({ email: trimmedEmail })
      .eq("id", personId)
      .select("id, name, email")
      .single();

    if (updateError) {
      console.error("Failed to update person:", updateError);
      return res.status(500).json({ error: "Failed to update person" });
    }

    return res.json(updatedPerson);
  } catch (err) {
    return next(err);
  }
});

router.post("/:personId/remind", async (req, res, next) => {
  try {
    const { personId } = req.params;
    if (typeof personId !== "string" || !UUID_PATTERN.test(personId)) {
      return res.status(400).json({ error: "personId is invalid" });
    }

    const trimmedUserId = req.userId;

    // Verify person belongs to this user (same pattern as B3)
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id, name, email")
      .eq("id", personId)
      .eq("user_id", trimmedUserId)
      .maybeSingle();

    if (personError) {
      console.error("Failed to verify person ownership:", personError);
      return res.status(500).json({ error: "Failed to send reminder" });
    }
    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }

    // Validate person has a non-null, non-empty email
    if (!person.email || person.email.trim() === "") {
      return res.status(400).json({ error: "no email on file for this person" });
    }

    // Check balance before sending email - we validate the debt exists and is positive
    // This order is important: if we sent the email first and then checked the balance,
    // we might send a reminder for a zero/negative balance or when no debt exists,
    // wasting resources and potentially confusing the recipient. Checking first ensures
    // we only send reminders when there's a genuine positive balance owed.
    const { data: balanceRow, error: balanceError } = await supabase
      .from("person_balances")
      .select("they_owe_you_paise")
      .eq("person_id", personId)
      .maybeSingle();

    if (balanceError) {
      console.error("Failed to check person balance:", balanceError);
      return res.status(500).json({ error: "Failed to send reminder" });
    }
    if (!balanceRow || balanceRow.they_owe_you_paise === null || balanceRow.they_owe_you_paise <= 0) {
      return res.status(400).json({ error: "no positive balance owed by this person" });
    }

    const theyOweYouPaise = balanceRow.they_owe_you_paise;

    // Send the reminder email
    const result = await sendReminderEmail({
      toEmail: person.email,
      personName: person.name,
      amountPaise: theyOweYouPaise,
    });

    if (result.success) {
      return res.status(200).json({ message: "Reminder sent successfully" });
    } else {
      // 502 signals "upstream email provider failed" rather than "our logic broke"
      return res.status(502).json({ error: result.error });
    }
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
