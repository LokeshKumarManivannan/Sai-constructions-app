// Indian digit grouping: 1250000 rupees -> ₹12,50,000
export function formatINR(paise: number): string {
  const rupees = Math.round(paise) / 100;
  const whole = Math.trunc(rupees);
  const fraction = Math.round(Math.abs(rupees - whole) * 100);
  const s = Math.abs(whole).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${whole < 0 ? '-' : ''}₹${grouped}${fraction ? `.${fraction.toString().padStart(2, '0')}` : ''}`;
}

// "12,50,000" or "1250000.50" -> paise; null if not a valid amount
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}
