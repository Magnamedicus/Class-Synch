export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export const BLOCKS_PER_HOUR = 4; // 15-min blocks
export const BLOCKS_PER_DAY = 24 * BLOCKS_PER_HOUR; // 96
export const TOTAL_BLOCKS = 7 * BLOCKS_PER_DAY; // 672

// Time block utilities
export function timeToBlockIndex(time: number): number {

    const hours = Math.floor(time / 100);
    const minutes = time % 100;
    return hours * BLOCKS_PER_HOUR + Math.floor(minutes / 15);
}
