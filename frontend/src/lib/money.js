export function formatPaise(paise) {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rupees);
}

export function rupeesToPaise(rupeesStr) {
  if (rupeesStr === '' || rupeesStr === null || rupeesStr === undefined) {
    return null;
  }

  const trimmed = rupeesStr.trim();
  if (trimmed === '') {
    return null;
  }

  const rupees = Number(trimmed);
  if (isNaN(rupees) || rupees < 0) {
    return null;
  }

  // Check if it has more than 2 decimal places
  const decimalPlaces = (trimmed.split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return null;
  }

  const paise = Math.round(rupees * 100);
  if (paise <= 0) {
    return null;
  }

  return paise;
}
