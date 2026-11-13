/**
 * Round the session's cumulative duration, not each heartbeat. With 30s heartbeats,
 * rounding every interval independently would consume the daily allowance twice as fast.
 * A session still uses whole minute units; short calls consume at most one partial minute.
 */
export function voiceMinuteUnits(minutesUsed: number, minutesDelta: number): number {
  return Math.max(0, Math.ceil(minutesUsed + minutesDelta) - Math.ceil(minutesUsed));
}
