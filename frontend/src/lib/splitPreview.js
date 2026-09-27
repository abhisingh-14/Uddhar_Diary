/**
 * Client-side mirror of the backend even-split math (see
 * backend/src/services/splitCalculator.js). Preview only — the backend
 * recalculates authoritatively when the bill is saved.
 *
 * Amounts are converted to integer paise before dividing so the shares always
 * sum exactly to the bill total; any leftover paise goes to you first (index 0),
 * then participants in array order.
 */
export function calculateSplit({ totalAmount, participantIds, payer, alreadyPaid = {} }) {
  if (!participantIds.length) {
    return { userShare: 0, debts: [] }
  }

  const totalPaise = Math.round(totalAmount * 100)
  const headcount = participantIds.length + 1 // you + participants
  const baseSharePaise = Math.floor(totalPaise / headcount)
  const remainderPaise = totalPaise % headcount

  // Calculate shares: you get index 0, participants get indices 1..n
  const shares = [baseSharePaise + (remainderPaise > 0 ? 1 : 0)]
  for (let i = 1; i < headcount; i++) {
    shares.push(baseSharePaise + (i < remainderPaise ? 1 : 0))
  }

  const userSharePaise = shares[0]
  const userShare = userSharePaise / 100

  if (payer === 'you') {
    // Each participant's debt is their share minus what they already paid
    const debts = []
    for (let i = 0; i < participantIds.length; i++) {
      const personId = participantIds[i]
      const theirSharePaise = shares[i + 1]
      const paidPaise = Math.round((alreadyPaid[personId] ?? 0) * 100)
      const debtPaise = theirSharePaise - paidPaise

      if (debtPaise !== 0) {
        debts.push({
          personId,
          direction: 'they_owe_you',
          amount: debtPaise / 100,
        })
      }
    }
    return { userShare, debts }
  } else {
    // Payer is a participant: exactly ONE debt for the payer, equal to your share
    const debts = [
      {
        personId: payer,
        direction: 'you_owe_them',
        amount: userShare,
      },
    ]
    return { userShare, debts }
  }
}
