const express = require("express");
const { supabase } = require("../lib/supabaseClient");
const { validateUserIdField } = require("../lib/validators");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const userValidation = validateUserIdField(req.query.userId);
    if (userValidation.status) {
      return res.status(userValidation.status).json(userValidation.body);
    }
    const trimmedUserId = userValidation.userId;

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
    
    const userValidation = validateUserIdField((req.body || {}).userId);
    if (userValidation.status) {
      return res.status(userValidation.status).json(userValidation.body);
    }
    const trimmedUserId = userValidation.userId;

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "name is required" });
    }
    const trimmedName = name.trim();

    let trimmedEmail = null;
    if (email !== undefined && email !== null) {
      if (typeof email !== "string" || email.trim() === "") {
        return res.status(400).json({ error: "email must be a valid string if provided" });
      }
      trimmedEmail = email.trim();
    }

    const { data, error } = await supabase
      .from("people")
      .insert({
        user_id: trimmedUserId,
        name: trimmedName,
        email: trimmedEmail,
      })
      .select("id, name, email")
      .single();

    if (error) {
      console.error("Error creating person:", error);
      return res.status(500).json({ error: "Failed to create person" });
    }

    return res.status(201).json(data);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
