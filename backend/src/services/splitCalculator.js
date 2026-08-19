/**
 * Evenly split a bill total and compute what each person still owes after
 * prior payments.
 *
 * Rounding remainder: amounts are converted to integer paise before dividing.
 * The total is divided by totalPeopleSharing (friends + 1 for the main user).
 * Any leftover paise from `totalPaise % totalPeopleSharing` is implicitly
 * absorbed by the main user (since they are not in the `people` array) so the
 * per-person shares always sum exactly to `totalAmount`.
 *
 * @param {number} totalAmount - Bill total in rupees (e.g. 100 for ₹100).
 * @param {string[]} people - Person IDs participating in the split (excluding main user).
 * @param {Record<string, number>} amountsPaid - Map of personId → amount already paid (omit or use 0 if none).
 * @returns {{ personId: string, owedAmount: number, direction: "they_owe_you" | "you_owe_them" }[]}
 */
function calculateEvenSplit(totalAmount, people, amountsPaid = {}) {
  if (!people.length) {
    return [];
  }

  // +1 to account for the main user who paid the bill/is participating in the split
  const totalPeopleSharing = people.length + 1;
  const totalPaise = Math.round(totalAmount * 100);
  const baseSharePaise = Math.floor(totalPaise / totalPeopleSharing);
  
  // The remainder is implicitly absorbed by the main user.
  // Their effective share becomes: baseSharePaise + (totalPaise % totalPeopleSharing)
  
  return people
    .map((personId) => {
      const fairSharePaise = baseSharePaise;
      const paidPaise = Math.round((amountsPaid[personId] ?? 0) * 100);
      const owedPaise = fairSharePaise - paidPaise;

      if (owedPaise === 0) {
        return null;
      }

      return {
        personId,
        owedAmount: Math.abs(owedPaise) / 100, // Absolute amount
        direction: owedPaise > 0 ? "they_owe_you" : "you_owe_them",
      };
    })
    .filter(Boolean);
}

module.exports = { calculateEvenSplit };
