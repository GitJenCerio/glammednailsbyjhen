export const SLOT_TIMES = ['08:00', '10:00', '10:30', '13:00', '15:00', '15:30', '19:00', '20:00', '21:00'] as const;

export type SlotTime = (typeof SLOT_TIMES)[number];

export function getNextSlotTime(time: string): string | null {
  const index = SLOT_TIMES.indexOf(time as SlotTime);
  if (index === -1 || index === SLOT_TIMES.length - 1) return null;
  return SLOT_TIMES[index + 1];
}

