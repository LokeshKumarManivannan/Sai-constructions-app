/** Local date as YYYY-MM-DD (toISOString would give the UTC date). */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Typed date -> YYYY-MM-DD. Accepts DD/MM/YYYY (also with - or .) and YYYY-MM-DD. null if invalid. */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let iso: string | null = null;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  return iso && isIsoDate(iso) ? iso : null;
}

/** YYYY-MM-DD -> DD/MM/YYYY for editing. */
export function toDMY(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** 2026-12-10 -> 10 Dec 2026 */
export function showDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}
