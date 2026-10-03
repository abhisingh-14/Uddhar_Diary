export function formatPaise(paise) {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rupees);
}

export function rupeesToPaise(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  s = s.replace(/^₹\s*/, '');   // optional leading rupee sign
  s = s.replace(/,/g, '');      // thousands separators (1,50,000 or 150,000)
  // digits with an optional dot and at most 2 decimals, or ".5" style
  if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(s)) return null;
  const [whole = '', frac = ''] = s.split('.');
  const paise = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > 2147483647) {
    return null;
  }
  return paise;
}
