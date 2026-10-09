export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.trunc(Number(totalMinutes) || 0));
  if (minutes < 60) return `${minutes} menit`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} jam ${remainder} menit` : `${hours} jam`;
}
