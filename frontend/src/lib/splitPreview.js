/**
 * Client-side mirror of the backend even-split math (see
 * backend/src/services/splitCalculator.js). Preview only — the backend
 * recalculates authoritatively when the bill is saved.
 *
 * Amounts are converted to integer paise before dividing so the shares always
 * sum exactly to the bill total; any leftover paise goes to the first person.
 */
export function calculateEvenSplit(totalAmount, personIds, amountsPaid = {}) {
  if (!personIds.length) return []

  const totalPaise = Math.round(totalAmount * 100)
  const baseSharePaise = Math.floor(totalPaise / personIds.length)
  const remainderPaise = totalPaise % personIds.length

  return personIds.map((personId, index) => {
    const fairSharePaise = baseSharePaise + (index === 0 ? remainderPaise : 0)
    const paidPaise = Math.round((amountsPaid[personId] ?? 0) * 100)
    const owedPaise = fairSharePaise - paidPaise

    return {
      personId,
      fairShare: fairSharePaise / 100,
      owedAmount: Math.abs(owedPaise) / 100,
      direction: owedPaise >= 0 ? 'they_owe_you' : 'you_owe_them',
      settled: owedPaise === 0,
    }
  })
}
