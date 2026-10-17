/** Date-only helpers — avoid UTC midnight shifting the calendar day in TR. */

export function toDateInputValue(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    // already YYYY-MM-DD
    const m = String(isoOrDate).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Send noon local so Prisma/JSON ISO doesn't flip the day in UTC+3 */
export function fromDateInputValue(yyyyMmDd: string): string | null {
  const v = yyyyMmDd.trim();
  if (!v) return null;
  return `${v}T12:00:00`;
}
