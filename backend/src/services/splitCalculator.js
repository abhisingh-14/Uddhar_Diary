/**
 * Evenly split a bill total and compute what each person still owes after
 * prior payments.
 *
 * Rounding remainder: amounts are converted to integer paise before dividing.
 * Any leftover paise from `totalPaise % people.length` is added to the first
 * person so the per-person shares always sum exactly to `totalAmount`. Silently
 * dropping that remainder would make every split total slightly less than the
 * real bill; over many bills those few paise per transaction compound into
 * noticeable drift between recorded balances and actual money owed.
 *
 * @param {number} totalAmount - Bill total in rupees (e.g. 100 for ₹100).
 * @param {string[]} people - Person IDs participating in the split.
 * @param {Record<string, number>} amountsPaid - Map of personId → amount already paid (omit or use 0 if none).
 * @returns {{ personId: string, owedAmount: number, direction: "they_owe_you" | "you_owe_them" }[]}
 */
function calculateEvenSplit(totalAmount, people, amountsPaid = {}) {
  if (!people.length) {
    return [];
  }

  const totalPaise = Math.round(totalAmount * 100);
  const baseSharePaise = Math.floor(totalPaise / people.length);
  const remainderPaise = totalPaise % people.length;

  return people
    .map((personId, index) => {
      const fairSharePaise =
        baseSharePaise + (index === 0 ? remainderPaise : 0);
      const paidPaise = Math.round((amountsPaid[personId] ?? 0) * 100);
      const owedPaise = fairSharePaise - paidPaise;

      if (owedPaise === 0) {
        return null;
      }

      return {
        personId,
        owedAmount: owedPaise / 100,
        direction: owedPaise > 0 ? "they_owe_you" : "you_owe_them",
      };
    })
    .filter(Boolean);
}

module.exports = { calculateEvenSplit };
