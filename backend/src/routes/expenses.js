const express = require("express");
const { supabase } = require("../lib/supabaseClient");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
router.use(requireAuth);

const formatDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

router.get("/by-category", async (req, res, next) => {
  try {
    const userId = req.userId;


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

router.get("/over-time", async (req, res, next) => {
  try {
    const userId = req.userId;


    const { granularity, from, to } = req.query;

    if (granularity !== "week" && granularity !== "month") {
      return res.status(400).json({ error: "granularity must be 'week' or 'month'" });
    }

    // Set default date range if not provided
    let startDate, endDate;
    const now = new Date();

    if (from) {
      startDate = new Date(from);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ error: "invalid 'from' date format" });
      }
    } else {
      // Default: last 12 weeks or 12 months
      if (granularity === "week") {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - (12 * 7));
      } else {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 12);
      }
    }

    if (to) {
      endDate = new Date(to);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "invalid 'to' date format" });
      }
    } else {
      endDate = now;
    }

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    // Query bill_user_expense using Supabase query builder style (same as debts.js)
    const { data: expenses, error: expensesError } = await supabase
      .from("bill_user_expense")
      .select("bill_date, user_share_paise")
      .eq("user_id", userId)
      .gte("bill_date", startStr)
      .lte("bill_date", endStr);

    if (expensesError) {
      console.error("Failed to fetch expenses:", expensesError);
      return res.status(502).json({ error: "Failed to fetch expenses" });
    }

    // Bucket expenses by period in JS using Map
    const grouped = new Map();
    for (const exp of (expenses || [])) {
      const billDate = new Date(exp.bill_date);
      let periodStart;

      if (granularity === "week") {
        // Truncate to start of week (Sunday) - same approach as by-category
        const day = billDate.getDay();
        periodStart = new Date(billDate);
        periodStart.setDate(periodStart.getDate() - day);
      } else {
        // Truncate to start of month
        periodStart = new Date(billDate.getFullYear(), billDate.getMonth(), 1);
      }

      const periodKey = formatDate(periodStart);
      grouped.set(periodKey, (grouped.get(periodKey) || 0) + exp.user_share_paise);
    }

    // Generate full list of expected period buckets for zero-filling
    const result = [];
    let currentPeriod = new Date(startDate);

    // Align currentPeriod to the start of its period
    if (granularity === "week") {
      const day = currentPeriod.getDay();
      currentPeriod.setDate(currentPeriod.getDate() - day);
    } else {
      currentPeriod = new Date(currentPeriod.getFullYear(), currentPeriod.getMonth(), 1);
    }

    while (currentPeriod <= endDate) {
      const periodKey = formatDate(currentPeriod);
      result.push({
        periodStart: periodKey,
        totalPaise: grouped.get(periodKey) || 0
      });

      // Advance to next period
      if (granularity === "week") {
        currentPeriod.setDate(currentPeriod.getDate() + 7);
      } else {
        currentPeriod.setMonth(currentPeriod.getMonth() + 1);
      }
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
