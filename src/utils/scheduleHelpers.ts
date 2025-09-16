/* -------------------------------------------
   scheduleHelpers.ts
   Time/grid helpers & small predicates.
   (Kept API-compatible with previous version.)
-------------------------------------------- */

export type DayName =
    | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export const DAYS: DayName[] = [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

export const BLOCK_MINUTES = 15;
export const BLOCKS_PER_HOUR = 60 / BLOCK_MINUTES;   // 4
export const BLOCKS_PER_DAY = 24 * BLOCKS_PER_HOUR;  // 96
export const BLOCKS_PER_WEEK = BLOCKS_PER_DAY * 7;   // 672

// canonical windows (inclusive start, exclusive end) in block indices
export const HHMM = (h: number, m = 0) => h * 100 + m;

export function hhmmToBlock(hhmm: number): number {
    const h = Math.floor(hhmm / 100);
    const m = hhmm % 100;
    return h * BLOCKS_PER_HOUR + Math.floor(m / BLOCK_MINUTES);
}

export function blockToHHMM(block: number): number {
    const h = Math.floor(block / BLOCKS_PER_HOUR);
    const q = block % BLOCKS_PER_HOUR;
    const m = q * BLOCK_MINUTES;
    return h * 100 + m;
}

export const WINDOW = {
    morning:   [hhmmToBlock(HHMM(6, 0)),  hhmmToBlock(HHMM(12, 0))], // 06–12
    afternoon: [hhmmToBlock(HHMM(12, 0)), hhmmToBlock(HHMM(17, 0))], // 12–17
    evening:   [hhmmToBlock(HHMM(17, 0)), hhmmToBlock(HHMM(22, 0))], // 17–22
    night:     [hhmmToBlock(HHMM(22, 0)), hhmmToBlock(HHMM(24, 0))], // 22–24 (spills to next day)
};

export type TimeBucket = "morning" | "afternoon" | "evening" | "night";

export function inBucket(block: number, bucket: TimeBucket): boolean {
    const [a, b] = WINDOW[bucket];
    return block >= a && block < b;
}

export function isNight(block: number): boolean {
    return inBucket(block, "night") || block < hhmmToBlock(HHMM(6, 0));
}

export function withinFlexibleDayWindow(block: number): boolean {
    // 08:00–22:00 for flexible items
    const start = hhmmToBlock(HHMM(8, 0));
    const end   = hhmmToBlock(HHMM(22, 0));
    return block >= start && block < end;
}

export function dayIndex(day: DayName): number {
    return DAYS.indexOf(day);
}

export function nextDay(d: DayName): DayName {
    return DAYS[(dayIndex(d) + 1) % 7];
}

export function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}

export function range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
}

/* Labels & simple type checks used across files */

export function isSleepName(label: string): boolean {
    const s = label.toLowerCase();
    return s.includes("sleep");
}

export function isMeetingLabel(label: string): boolean {
    return /\(class meeting\)$/i.test(label);
}

export function meetingLabel(course: string) {
    return `${course} (Class Meeting)`;
}

export function studyLabel(course: string) {
    return `${course} (Studying)`;
}
