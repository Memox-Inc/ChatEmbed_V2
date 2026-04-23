export function formatTimeStamp(timestamp: string): string {
  const createdAt = new Date(timestamp);
  return createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
