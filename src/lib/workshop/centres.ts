export const PILOT_CENTRES = [
  { code: 'brisbane', name: 'Brisbane' },
  { code: 'sydney', name: 'Sydney' },
  { code: 'melbourne', name: 'Melbourne' },
] as const;

export function inferCentreCode(location: string): string {
  const n = location.trim().toLowerCase();
  if (n.includes('sydney') || n.includes('nsw')) return 'sydney';
  if (n.includes('melbourne') || n.includes('vic')) return 'melbourne';
  if (n.includes('brisbane') || n.includes('qld')) return 'brisbane';
  return 'brisbane';
}
