function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatDatePart(date: Date, includeYear: boolean) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  }).format(date);
}

export function formatDateRangeLabel(startDate: string, endDate: string) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return `${startDate} – ${endDate}`;

  const currentYear = new Date().getFullYear();
  const includeYear =
    start.getFullYear() !== currentYear || end.getFullYear() !== currentYear;
  const startLabel = formatDatePart(start, includeYear);
  const endLabel = formatDatePart(end, includeYear);

  if (startDate === endDate) return startLabel;
  return `${startLabel} – ${endLabel}`;
}
