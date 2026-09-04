const express = require("express");
const { supabase } = require("../lib/supabaseClient");
const { validateUserIdField } = require("../lib/validators");

const router = express.Router();

const formatDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

router.get("/by-category", async (req, res, next) => {
  try {
    const userValidation = validateUserIdField(req.query.userId);
    if (userValidation.status) {
      return res.status(userValidation.status).json(userValidation.body);
    }
    const userId = userValidation.userId;

    const { granularity, date } = req.query;

    if (granularity !== "week" && granularity !== "month") {
      return res.status(400).json({ error: "granularity must be 'week' or 'month'" });
    }

    const targetDate = date ? new Date(date) : new Date();
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: "invalid date format" });
    }

    let startDate, endDate;
    if (granularity === "month") {
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    } else {
      const day = targetDate.getDay(); // 0 (Sun) to 6 (Sat)
      startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - day);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    }

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    const { data: expenses, error: expensesError } = await supabase
      .from("bill_user_expense")
      .select("*")
      .eq("user_id", userId)
      .gte("bill_date", startStr)
      .lte("bill_date", endStr);

    if (expensesError) {
      console.error("Failed to fetch expenses:", expensesError);
      return res.status(502).json({ error: "Failed to fetch expenses" });
    }

    const grouped = {};
    for (const exp of (expenses || [])) {
      const catId = exp.category_id;
      if (!grouped[catId]) {
        grouped[catId] = 0;
      }
      grouped[catId] += exp.user_share_paise;
    }

    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id, name");

    if (catError) {
      console.error("Failed to fetch categories:", catError);
      return res.status(502).json({ error: "Failed to fetch categories" });
    }

    const catMap = {};
    for (const cat of (categories || [])) {
      catMap[cat.id] = cat.name;
    }

    const result = Object.keys(grouped).map(catId => ({
      categoryId: catId,
      categoryName: catMap[catId] || "Unknown",
      totalPaise: grouped[catId]
    }));

    result.sort((a, b) => b.totalPaise - a.totalPaise);

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
