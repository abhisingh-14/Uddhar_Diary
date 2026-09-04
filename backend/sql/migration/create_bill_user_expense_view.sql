CREATE OR REPLACE VIEW bill_user_expense AS
SELECT
    bills.id AS bill_id,
    bills.user_id,
    bills.category_id,
    bills.bill_date,
    (bills.total_amount * 100) - COALESCE(SUM(debts.amount_paise), 0) AS user_share_paise
FROM bills
LEFT JOIN debts ON debts.bill_id = bills.id
GROUP BY bills.id, bills.user_id, bills.category_id, bills.bill_date, bills.total_amount;
