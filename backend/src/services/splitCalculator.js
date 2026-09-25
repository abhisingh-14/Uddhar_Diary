class SplitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SplitError';
  }
}

function calculateSplit(args) {
  const { totalPaise, participantIds, payer, alreadyPaid = {} } = args;

  // Validate totalPaise
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
    throw new SplitError('totalPaise must be a positive safe integer');
  }

  // Validate participantIds
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new SplitError('participantIds must be a non-empty array');
  }

  // Check for duplicate participantIds
  const uniqueParticipants = new Set(participantIds);
  if (uniqueParticipants.size !== participantIds.length) {
    throw new SplitError('participantIds must not contain duplicates');
  }

  // Validate payer
  const validPayers = new Set(['you', ...participantIds]);
  if (!validPayers.has(payer)) {
    throw new SplitError('payer must be "you" or one of the participantIds');
  }

  // Validate alreadyPaid if payer is not 'you'
  if (payer !== 'you' && Object.keys(alreadyPaid).length > 0) {
    throw new SplitError('alreadyPaid is only allowed when payer is "you"');
  }

  // Calculate shares
  const headcount = participantIds.length + 1; // You + participants
  const baseShare = Math.floor(totalPaise / headcount);
  const remainder = totalPaise % headcount;

  // Distribute shares: You gets remainder first, then participants in order
  const shares = new Map();
  
  // You are index 0
  const userShare = baseShare + remainder;
  shares.set('you', userShare);

  // Participants get baseShare
  for (const participantId of participantIds) {
    shares.set(participantId, baseShare);
  }

  // Validate alreadyPaid entries
  for (const [personId, amount] of Object.entries(alreadyPaid)) {
    if (!uniqueParticipants.has(personId)) {
      throw new SplitError(`alreadyPaid references non-participant: ${personId}`);
    }
    if (!Number.isSafeInteger(amount)) {
      throw new SplitError(`alreadyPaid amount for ${personId} must be a safe integer`);
    }
    if (amount < 0 || amount > shares.get(personId)) {
      throw new SplitError(`alreadyPaid amount for ${personId} must be between 0 and their share`);
    }
  }

  // Calculate debts
  const debts = [];

  if (payer === 'you') {
    // You paid: each participant owes you their share minus what they already paid
    for (const participantId of participantIds) {
      const share = shares.get(participantId);
      const paid = alreadyPaid[participantId] || 0;
      const remaining = share - paid;

      if (remaining > 0) {
        debts.push({
          personId: participantId,
          direction: 'they_owe_you',
          amountPaise: remaining
        });
      }
      // Skip if remaining is 0 (fully paid)
    }
  } else {
    // Someone else paid: you owe them your share
    // In this case, the payer already covered the user's share, so the debt
    // represents what the user needs to pay back
    debts.push({
      personId: payer,
      direction: 'you_owe_them',
      amountPaise: userShare
    });
  }

  return {
    userSharePaise: userShare,
    debts
  };
}

module.exports = { calculateSplit, SplitError };
