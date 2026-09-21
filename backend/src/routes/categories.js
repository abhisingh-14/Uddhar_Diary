const express = require("express");
const { supabase } = require("../lib/supabaseClient");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name");

    if (error) {
      console.error("Error fetching categories:", error);
      return res.status(500).json({ error: "Failed to fetch categories" });
    }

    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
