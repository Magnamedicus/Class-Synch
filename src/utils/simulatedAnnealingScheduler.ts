/* --------------------------------------------------------------------
   simulatedAnnealingScheduler.ts
   Core scheduling algorithm with greedy seed + simulated annealing.
   Fixes:
   - Sleep across midnight: correct wrap and split
   - Daytime deficit fill now uses 1h chunks with "moat" and maxStretch cap
   - Restores/ensures study-break moat and run-length enforcement
--------------------------------------------------------------------- */

import {
    DAYS,
    BLOCKS_PER_DAY,
    BLOCKS_PER_WEEK,
    BLOCKS_PER_HOUR,
    hhmmToBlock,
    meetingLabel,
    studyLabel,
    inBucket,
    isNight,
    withinFlexibleDayWindow,
    clamp,
} from "./scheduleHelpers";
import type { DayName } from "./scheduleHelpers";

/* ===== Types exposed to UI (unchanged) ===== */

export interface MeetingTime {
    day: DayName | string;
    start: number; // HHMM
    end: number;   // HHMM
}

export interface ObligationChild {
    id: string;
    name: string;
    relativePriority: number; // 0..1
    maxStretch?: number;      // hours
    preferredTimeBlocks?: Array<"morning" | "afternoon" | "evening" | "night">;
    dependencyIds?: string[];
    meetingTimes?: MeetingTime[];
    // NEW: Explicit weekly hours (for study/activities) if provided by questionnaire
    weeklyHours?: number;
    // NEW: Sleep preferences
    desiredNightlyHours?: number;        // hours per night
    earliestBedtimeHHMM?: number;        // HHMM
    latestWakeHHMM?: number;             // HHMM
    // NEW: Session constraints
    timesPerWeek?: number;               // target sessions per week (for fixed-duration activities)
    timesPerDay?: number;                // max sessions per day
    durationMinutes?: number;            // minutes per session
    // Study no-go days for school tasks
    noGoDays?: string[];
    // Post-session rest (minutes) for exercise
    restMinutes?: number;
}

export interface Category {
    id: string;
    name: string;    // "School Work", "Sleep", etc.
    priority: number; // 0..1
    children: ObligationChild[];
}

export type Schedule = Record<DayName, (string | null)[]>;

/* ===== Internal shapes ===== */

type TaskId = string;

interface Task {
    id: TaskId;
    courseName: string;
    category: string;
    blocksRequired: number;
    maxStretchBlocks: number;
    preferred?: Array<"morning" | "afternoon" | "evening" | "night">;
    meetings?: { day: DayName; startIdx: number; endIdx: number }[];
    anchors?: { day: DayName; idx: number; kind: "pre" | "post" }[];
    labelFor: (kind: "meeting" | "study" | "other") => string;
    isSleep: boolean;
    // Sleep hints
    desiredNightlyBlocks?: number;
    earliestBedtimeBlock?: number;
    latestWakeBlock?: number;
    // Session constraints
    timesPerWeek?: number;
    timesPerDay?: number;
    durationBlocks?: number;
    // Study no-go days
    noGoDays?: string[];
    // Category discriminator: School tasks
    isSchool?: boolean;
    // Category discriminator: Exercise tasks
    isExercise?: boolean;
    // Rest blocks to place immediately after exercise session
    restBlocks?: number;
}

/* ===== Helpers ===== */

function makeEmptySchedule(): Schedule {
    const s: Partial<Schedule> = {};
    for (const d of DAYS) s[d] = Array.from({ length: BLOCKS_PER_DAY }, () => null);
    return s as Schedule;
}

function normalizeDay(day: string): DayName {
    const d = day.toLowerCase() as DayName;
    return (DAYS.includes(d) ? d : "monday") as DayName;
}

function asBlocks(startHHMM: number, endHHMM: number): [number, number] {
    const a = hhmmToBlock(startHHMM), b = hhmmToBlock(endHHMM);
    return [a, b];
}

function isFree(schedule: Schedule, day: DayName, start: number, len: number): boolean {
    if (start < 0 || start + len > BLOCKS_PER_DAY) return false;
    const row = schedule[day];
    for (let i = 0; i < len; i++) if (row[start + i] !== null) return false;
    return true;
}

function fillLabel(
    schedule: Schedule,
    day: DayName,
    start: number,
    len: number,
    label: string
) {
    const row = schedule[day];
    for (let i = 0; i < len; i++) row[start + i] = label;
}

function hasSameLabelNeighbor(s: Schedule, d: DayName, i: number, label: string): boolean {
    const row = s[d];
    return (i > 0 && row[i - 1] === label) || (i + 1 < BLOCKS_PER_DAY && row[i + 1] === label);
}

/* ===== Target apportion ===== */

function hoursToBlocks(h: number) {
    return Math.round(h * BLOCKS_PER_HOUR);
}

function apportionTargets(categories: Category[]): Task[] {
    const tasks: Task[] = [];

    for (const cat of categories) {
        const catBlocks = Math.round(cat.priority * BLOCKS_PER_WEEK);
        const children = cat.children;
        if (!children.length) continue;

        // 1) Fixed-block children (explicit weekly hours)
        const fixedBlocksPerChild = new Map<number, number>();
        let fixedTotal = 0;
        children.forEach((c, idx) => {
            if (typeof c.weeklyHours === 'number' && isFinite(c.weeklyHours) && c.weeklyHours > 0) {
                const blocks = hoursToBlocks(c.weeklyHours);
                fixedBlocksPerChild.set(idx, blocks);
                fixedTotal += blocks;
            }
        });

        // 2) Remaining blocks distributed by relativePriority among slack children
        const remaining = Math.max(0, catBlocks - fixedTotal);
        const slackIndices = children
            .map((c, i) => ({ c, i }))
            .filter(({ c, i }) => {
                if (fixedBlocksPerChild.has(i)) return false;
                // Exclude non-academic, meeting-only obligations from slack apportioning
                const meetingOnlyNonAcademic = !!(c.meetingTimes && c.meetingTimes.length) &&
                    !/school/i.test(cat.name) && !(typeof c.weeklyHours === 'number' && isFinite(c.weeklyHours) && c.weeklyHours > 0);
                return !meetingOnlyNonAcademic;
            })
            .map(({ i }) => i);

        const sumRel = slackIndices
            .map(i => Math.max(0, children[i].relativePriority || 0))
            .reduce((a, b) => a + b, 0) || 1; // avoid div-by-zero

        const exacts = slackIndices.map(i => remaining * (Math.max(0, children[i].relativePriority || 0) / sumRel));
        const floors = exacts.map(x => Math.floor(x));
        const used = floors.reduce((a, b) => a + b, 0);
        let leftovers = Math.max(0, remaining - used);

        const fractionalOrder = exacts
            .map((x, j) => ({ j, frac: x - Math.floor(x) }))
            .sort((a, b) => b.frac - a.frac);

        for (let k = 0; k < leftovers && k < fractionalOrder.length; k++) {
            const j = fractionalOrder[k].j;
            floors[j]++;
        }

        // Build per-child required blocks
        const blocksPerChild: number[] = children.map(() => 0);
        // fixed
        for (const [idx, blocks] of fixedBlocksPerChild.entries()) {
            blocksPerChild[idx] = blocks;
        }
        // slack
        slackIndices.forEach((i, j) => {
            blocksPerChild[i] = (blocksPerChild[i] || 0) + floors[j];
        });

        children.forEach((child, idx) => {
            // Only treat the dedicated nightly sleep task as "isSleep".
            // Naps and other daytime rest should be scheduled as flexible tasks, not seeded like night sleep.
            const isSleep = /night\s*sleep/i.test(child.name) ||
                (!!child.preferredTimeBlocks?.includes("night") && /sleep/i.test(child.name));

            const blocksRequired = Math.max(0, blocksPerChild[idx] || 0);

            tasks.push({
                id: `${cat.id}:${child.id}`,
                courseName: child.name,
                category: cat.name,
                blocksRequired,
                maxStretchBlocks: Math.max(1, Math.round((child.maxStretch || 1) * BLOCKS_PER_HOUR)),
                preferred: child.preferredTimeBlocks,
                meetings: child.meetingTimes?.map(mt => {
                    const d = normalizeDay(mt.day as string);
                    const [a, b] = asBlocks(mt.start, mt.end);
                    return { day: d, startIdx: a, endIdx: b };
                }),
                anchors: [],
                labelFor: (kind) => {
                    const isSchoolCat = /school/i.test(cat.name);
                    if (kind === "meeting") return isSchoolCat ? meetingLabel(child.name) : child.name;
                    // Only academic (school) items get a Studying label for their flexible time
                    if (isSchoolCat) return studyLabel(child.name);
                    return child.name;
                },
                isSleep,
                desiredNightlyBlocks: typeof child.desiredNightlyHours === 'number' && child.desiredNightlyHours > 0
                    ? hoursToBlocks(child.desiredNightlyHours) : undefined,
                earliestBedtimeBlock: typeof child.earliestBedtimeHHMM === 'number' ? hhmmToBlock(child.earliestBedtimeHHMM) : undefined,
                latestWakeBlock: typeof child.latestWakeHHMM === 'number' ? hhmmToBlock(child.latestWakeHHMM) : undefined,
                timesPerWeek: typeof child.timesPerWeek === 'number' && child.timesPerWeek > 0 ? Math.floor(child.timesPerWeek) : undefined,
                timesPerDay: typeof child.timesPerDay === 'number' && child.timesPerDay > 0 ? Math.floor(child.timesPerDay) : undefined,
                durationBlocks: typeof child.durationMinutes === 'number' && child.durationMinutes > 0 ? hoursToBlocks(child.durationMinutes / 60) : undefined,
                noGoDays: Array.isArray(child.noGoDays) ? child.noGoDays : undefined,
                isSchool: /school/i.test(cat.name),
                isExercise: /exercise/i.test(cat.name),
                restBlocks: (() => {
                    if (typeof child.restMinutes !== 'number' || child.restMinutes <= 0) return undefined;
                    const minMinutes = Math.max(30, child.restMinutes); // at least 30 minutes
                    const blocks = Math.ceil(minMinutes / 15); // round up to next 15-min block
                    return blocks;
                })(),
            });
        });
    }

    return tasks;
}

/* ===== Sleep nightly plan (correct cross-midnight math) ===== */

const DEFAULT_SLEEP_START_MIN = hhmmToBlock(20 * 100); // 20:00
const DEFAULT_SLEEP_START_MAX = hhmmToBlock(22 * 100); // 22:00
const DEFAULT_WAKE_MIN       = hhmmToBlock( 6 * 100); // 06:00
const DEFAULT_WAKE_MAX       = hhmmToBlock( 9 * 100); // 09:00
const MIN_NIGHTLY_SLEEP = hoursToBlocks(6);   // 6h
const MAX_NIGHTLY_SLEEP = hoursToBlocks(9);   // 9h

function planNightFor(start: number, desiredLen: number, wakeMaxBlock: number) {
    // Compute length so wake on next day <= wakeMaxBlock
    // If desired length pushes wake beyond allowed, reduce length.
    let len = desiredLen;
    const wakeBlocksAfterMidnight = start + len - BLOCKS_PER_DAY; // may be <=0 if no wrap
    if (wakeBlocksAfterMidnight > 0 && wakeBlocksAfterMidnight > wakeMaxBlock) {
        const over = wakeBlocksAfterMidnight - wakeMaxBlock;
        len = Math.max(MIN_NIGHTLY_SLEEP, len - over);
    }
    len = clamp(len, MIN_NIGHTLY_SLEEP, MAX_NIGHTLY_SLEEP);
    const wake = Math.max(0, start + len - BLOCKS_PER_DAY);
    return { wake, len };
}

function planPriorityAwareSleep(tasks: Task[]): {
    sleepTask?: Task;
    nightlyPlan?: { day: DayName; start: number; len: number }[];
} {
    const sleepTask = tasks.find(t => t.isSleep);
    if (!sleepTask) return {};

    // Choose per-night target blocks either from explicit hint or from weekly requirement
    const total = sleepTask.blocksRequired;
    const hintedPerNight = sleepTask.desiredNightlyBlocks;
    const perNight = clamp(
        hintedPerNight != null ? hintedPerNight : Math.round(total / 7),
        MIN_NIGHTLY_SLEEP,
        MAX_NIGHTLY_SLEEP
    );

    const nightlyPlan: { day: DayName; start: number; len: number }[] = [];
    // Decide start/wake limits
    const earliestStartDefault = DEFAULT_SLEEP_START_MIN; // 20:00
    const wakeLatestDefault = DEFAULT_WAKE_MAX; // 09:00

    const earliestStart = sleepTask.earliestBedtimeBlock ?? earliestStartDefault;
    const wakeLatest = sleepTask.latestWakeBlock ?? wakeLatestDefault;

    // Choose a start that wakes as close as possible to the latest acceptable wake,
    // while not starting earlier than the earliest acceptable bedtime.
    // Base candidate that would wake exactly at wakeLatest:
    const alignToLatestWake = (wakeLatest - perNight + BLOCKS_PER_DAY) % BLOCKS_PER_DAY;
    const startBlock = Math.max(earliestStart, alignToLatestWake);

    for (const day of DAYS) {
        const { len } = planNightFor(startBlock, perNight, wakeLatest);
        nightlyPlan.push({ day, start: startBlock, len });
    }

    // consume total (we'll seed sleep; no additional sleep scheduling)
    sleepTask.blocksRequired = 0;

    return { sleepTask, nightlyPlan };
}

/* ===== Build context and seed fixed things ===== */

interface BuildCtx {
    tasks: Task[];
    fixedMask: Record<DayName, boolean[]>;
    schedule: Schedule;
    deficits: Record<TaskId, number>;
}

function initializeContext(tasks: Task[]): BuildCtx {
    const fixedMask: Record<DayName, boolean[]> = {} as any;
    const schedule: Schedule = makeEmptySchedule();
    for (const d of DAYS) fixedMask[d] = Array.from({ length: BLOCKS_PER_DAY }, () => false);
    return { tasks, fixedMask, schedule, deficits: {} };
}

function seedMeetings(ctx: BuildCtx) {
    for (const t of ctx.tasks) {
        if (!t.meetings?.length) continue;
        for (const m of t.meetings) {
            const len = m.endIdx - m.startIdx;
            if (len <= 0) continue;
            if (isFree(ctx.schedule, m.day, m.startIdx, len)) {
                fillLabel(ctx.schedule, m.day, m.startIdx, len, t.labelFor("meeting"));
                for (let i = 0; i < len; i++) ctx.fixedMask[m.day][m.startIdx + i] = true;

                // anchors ~45m before and ~15m after
                const pre  = Math.max(0, m.startIdx - Math.round(3 * BLOCKS_PER_HOUR / 4));
                const post = Math.min(BLOCKS_PER_DAY - 1, m.endIdx + Math.round(1 * BLOCKS_PER_HOUR / 4));
                t.anchors?.push({ day: m.day, idx: pre,  kind: "pre"  });
                t.anchors?.push({ day: m.day, idx: post, kind: "post" });
            }
        }
    }
}

function seedSleep(ctx: BuildCtx, nightly?: { day: DayName; start: number; len: number }[]) {
    if (!nightly?.length) return;
    const sleeper = ctx.tasks.find(t => t.isSleep);
    if (!sleeper) return;

    const canPlaceAcrossMidnight = (day: DayName, start: number, len: number): boolean => {
        const headLen = Math.min(len, BLOCKS_PER_DAY - start);
        const tail = len - headLen;
        if (headLen > 0 && !isFree(ctx.schedule, day, start, headLen)) return false;
        if (tail > 0) {
            const d2 = DAYS[(DAYS.indexOf(day) + 1) % 7];
            if (!isFree(ctx.schedule, d2, 0, tail)) return false;
        }
        return true;
    };

    const placeAcrossMidnight = (day: DayName, start: number, len: number, label: string) => {
        const headLen = Math.min(len, BLOCKS_PER_DAY - start);
        if (headLen > 0) {
            fillLabel(ctx.schedule, day, start, headLen, label);
            for (let i = 0; i < headLen; i++) ctx.fixedMask[day][start + i] = true;
        }
        const tail = len - headLen;
        if (tail > 0) {
            const d2 = DAYS[(DAYS.indexOf(day) + 1) % 7];
            fillLabel(ctx.schedule, d2, 0, tail, label);
            for (let i = 0; i < tail; i++) ctx.fixedMask[d2][i] = true;
        }
    };

    for (const n of nightly) {
        const baseStart = n.start;
        const len = n.len;

        // Respect latest wake: cap how far we can push start forward
        const wakeMax = sleeper.latestWakeBlock ?? 0;
        const maxStart = Math.min(BLOCKS_PER_DAY - 1, BLOCKS_PER_DAY + wakeMax - len);

        // Slide start later to accommodate late-evening fixed meetings
        let placed = false;
        for (let s = baseStart; s <= maxStart; s++) {
            if (canPlaceAcrossMidnight(n.day, s, len)) {
                placeAcrossMidnight(n.day, s, len, sleeper.courseName);
                placed = true;
                break;
            }
        }
        if (!placed) {
            // Fallback: try original (may partially fill head or tail next day)
            if (canPlaceAcrossMidnight(n.day, baseStart, len)) {
                placeAcrossMidnight(n.day, baseStart, len, sleeper.courseName);
            }
            // else leave as gap — better than overwriting meetings
        }
    }
}

function enforceWakeBuffers(ctx: BuildCtx) {
  const s = ctx.schedule;
  const sleepNames = new Set<string>(ctx.tasks.filter(t => t.isSleep).map(t => t.courseName));
  for (const d of DAYS) {
    const row = s[d];
    // Find wake index (first non-sleep at day start)
    let wake = 0;
    while (wake < BLOCKS_PER_DAY && row[wake] && sleepNames.has(String(row[wake]))) wake++;
    // Find earliest fixed meeting (non-sleep) on this day
    let firstFixed = -1;
    for (let i = 0; i < BLOCKS_PER_DAY; i++) {
      if (ctx.fixedMask[d][i]) {
        const lab = row[i];
        if (!lab || !sleepNames.has(String(lab))) { firstFixed = i; break; }
      }
    }
    if (firstFixed >= 0) {
      const requiredWake = Math.max(0, firstFixed - 4); // 4 blocks = 1 hour
      if (wake > requiredWake) {
        // Shorten morning sleep tail to ensure at least 1h buffer
        for (let i = requiredWake; i < wake; i++) {
          if (row[i] && sleepNames.has(String(row[i]))) {
            row[i] = null;
            ctx.fixedMask[d][i] = false;
          }
        }
      }
    }
  }
}


/* ===== Greedy flexible placement (moat + stretch) ===== */

function taskPrefers(block: number, t: Task): boolean {
    if (!t.preferred?.length) return true;
    const allowed: Array<"morning" | "afternoon" | "evening" | "night"> = [
        "morning", "afternoon", "evening", "night",
    ];
    const prefs = t.preferred.filter((p: any) => allowed.includes(p as any));
    if (prefs.length === 0) return true;
    return prefs.some(b => inBucket(block, b));
}

function canPlaceFlexibleAt(block: number, t: Task): boolean {
    if (t.isSleep) return false;
    // Special handling for naps: respect preferred buckets strictly; default forbid morning/night
    const isNap = /\bnap\b/i.test(t.courseName);
    if (isNap) {
        const prefs = (t.preferred && t.preferred.length > 0)
            ? t.preferred
            : (["afternoon", "evening"] as const);
        return prefs.some((b: any) => inBucket(block, b));
    }
    // Socializing: disallow Morning unless explicitly preferred
    const isSocial = /social/i.test(t.category) || /social/i.test(t.courseName) || /socializing/i.test(t.courseName);
    if (isSocial) {
        const inMorning = inBucket(block, 'morning');
        if (inMorning) return !!(t.preferred && t.preferred.includes('morning'));
        return withinFlexibleDayWindow(block);
    }
    // For others, keep the flexible day window and allow soft preference scoring elsewhere
    return withinFlexibleDayWindow(block);
}

function freeRunLen(s: Schedule, d: DayName, i: number): number {
    const row = s[d];
    let k = i;
    while (k < BLOCKS_PER_DAY && row[k] === null) k++;
    return k - i;
}

function moatClear(s: Schedule, d: DayName, start: number, len: number, label: string): boolean {
    // 1 slot moat before & after if in bounds
    if (start > 0 && s[d][start - 1] === label) return false;
    if (start + len < BLOCKS_PER_DAY && s[d][start + len] === label) return false;
    return true;
}

function placeChunkWithMoat(s: Schedule, d: DayName, i: number, len: number, label: string): boolean {
    if (i < 0 || i + len > BLOCKS_PER_DAY) return false;
    if (!moatClear(s, d, i, len, label)) return false;
    for (let k = 0; k < len; k++) if (s[d][i + k] !== null) return false;
    fillLabel(s, d, i, len, label);
    return true;
}

function restLabel(_name: string) {
    return `Rest`;
}

function canEvict(ctx: BuildCtx, d: DayName, idx: number): boolean {
    // We may evict any non-fixed flexible block (not in fixedMask)
    return !ctx.fixedMask[d][idx];
}

function placeExerciseWithRest(
    ctx: BuildCtx,
    t: Task,
    d: DayName,
    start: number,
    len: number
): boolean {
    const s = ctx.schedule;
    if (t.restBlocks == null || t.restBlocks <= 0) return false;
    if (!withinFlexibleDayWindow(start)) return false;
    // exercise segment must be fully free and moat-clear
    if (start < 0 || start + len > BLOCKS_PER_DAY) return false;
    if (!moatClear(s, d, start, len, t.labelFor("study"))) return false;
    for (let k = 0; k < len; k++) if (s[d][start + k] !== null) return false;

    const restStart = start + len;
    const restLen = t.restBlocks;
    if (restStart + restLen > BLOCKS_PER_DAY) return false; // do not wrap rest across days

    // rest region must either be free or evictable (non-fixed)
    for (let k = 0; k < restLen; k++) {
        const pos = restStart + k;
        if (s[d][pos] !== null && !canEvict(ctx, d, pos)) return false;
    }

    // Evict flexible blocks in rest segment (if any)
    for (let k = 0; k < restLen; k++) {
        const pos = restStart + k;
        if (s[d][pos] !== null && canEvict(ctx, d, pos)) s[d][pos] = null;
    }

    // Place exercise then rest
    if (!placeChunkWithMoat(s, d, start, len, t.labelFor("study"))) return false;
    fillLabel(s, d, restStart, restLen, restLabel(t.courseName));
    // Immediately add mandatory hygiene (30 minutes) after rest, evicting non-fixed if needed
    const hygBlocks = 2; // 30 minutes
    const hygStart = restStart + restLen;
    if (hygStart + hygBlocks <= BLOCKS_PER_DAY) {
        let can = true;
        for (let k = 0; k < hygBlocks; k++) {
            const pos = hygStart + k;
            if (s[d][pos] !== null && !canEvict(ctx, d, pos)) { can = false; break; }
        }
        if (can) {
            for (let k = 0; k < hygBlocks; k++) {
                const pos = hygStart + k;
                if (s[d][pos] !== null && canEvict(ctx, d, pos)) s[d][pos] = null;
            }
            fillLabel(s, d, hygStart, hygBlocks, 'Hygiene');
        }
    }
    return true;
}

function countLabelOccurrences(s: Schedule, d: DayName, label: string): number {
    const row = s[d];
    let count = 0;
    let i = 0;
    while (i < BLOCKS_PER_DAY) {
        if (row[i] !== label) { i++; continue; }
        let j = i + 1;
        while (j < BLOCKS_PER_DAY && row[j] === label) j++;
        count++;
        i = j;
    }
    return count;
}

function greedyFill(ctx: BuildCtx) {
    const chunkFor = (t: Task) => {
        if (t.durationBlocks && t.durationBlocks > 0) return clamp(t.durationBlocks, 1, Math.max(1, t.maxStretchBlocks || BLOCKS_PER_HOUR));
        return clamp(Math.min(t.maxStretchBlocks || BLOCKS_PER_HOUR, BLOCKS_PER_HOUR), 2, 6);
    };

    for (const t of ctx.tasks) {
        if (t.isSleep) continue;
        let remain = t.blocksRequired;
        if (remain <= 0) continue;

        for (const d of DAYS) {
            if (remain <= 0) break;
            if (t.isSchool && t.noGoDays && t.noGoDays.includes(d)) continue;

            for (let i = hhmmToBlock(6 * 100); i < hhmmToBlock(22 * 100); i++) {
                if (remain <= 0) break;
                if (!canPlaceFlexibleAt(i, t)) continue;
                const free = freeRunLen(ctx.schedule, d, i);
                const isSocial = /social/i.test(t.category) || /social/i.test(t.courseName) || /socializing/i.test(t.courseName);
                if (free < (isSocial ? 4 : 2)) continue;

                let len = Math.min(chunkFor(t), remain, free);
                // For naps, never place shorter than 45 minutes (3 blocks)
                if (/\bnap\b/i.test(t.courseName) && len < 3) { continue; }
                // Socializing 1h..4h
                if (isSocial) {
                    if (len < 4) { continue; }
                    if (len > 16) { len = 16; }
                }
                // enforce per-day session cap if provided
                if (t.timesPerDay != null) {
                    const label = t.labelFor("study");
                    const occ = countLabelOccurrences(ctx.schedule, d, label);
                    if (occ >= t.timesPerDay) { continue; }
                }
                if (t.isExercise && (t.restBlocks || 0) > 0) {
                    if (placeExerciseWithRest(ctx, t, d, i, len)) {
                        remain -= len;
                        i += len; // skip past exercise segment
                    }
                } else if (placeChunkWithMoat(ctx.schedule, d, i, len, t.labelFor("study"))) {
                    remain -= len;
                    // skip past the chunk + moat
                    i += len;
                }
            }
        }

        ctx.deficits[t.id] = remain;
        t.blocksRequired = remain;
    }
}

/* ===== Scoring & Annealing ===== */

function scoreSchedule(ctx: BuildCtx): number {
    const s = ctx.schedule;

    const placed: Record<TaskId, number> = {};
    let prefHits = 0;
    let transitions = 0;
    let nightPenalty = 0;
    let anchorBonus = 0;

    for (const day of DAYS) {
        const row = s[day];
        for (let i = 0; i < BLOCKS_PER_DAY; i++) {
            const here = row[i];

            if (i > 0 && here !== row[i - 1]) transitions++;

            if (here) {
                if (isNight(i) && !/sleep/i.test(here)) nightPenalty += 0.6;

                const owner = ctx.tasks.find(t =>
                    here === t.labelFor("study") || here === t.labelFor("other") || here === t.labelFor("meeting") || here === t.courseName
                );
                if (owner) {
                    placed[owner.id] = (placed[owner.id] || 0) + 1;
                    if (taskPrefers(i, owner)) prefHits += 0.5;

                    if (owner.anchors?.length) {
                        for (const a of owner.anchors.filter(a => a.day === day)) {
                            const dist = Math.abs(i - a.idx);
                            if (dist <= 4) anchorBonus += (a.kind === "pre" ? 0.35 : 0.4) * (1 - dist / 4);
                        }
                    }
                }
            }
        }
    }

    let targetScore = 0;
    for (const t of ctx.tasks) {
        const have = placed[t.id] || 0;
        const want = (t.blocksRequired || 0) + have;
        const fit = want === 0 ? 1 : 1 - Math.abs(want - have) / want;
        targetScore += fit * 2.0;
    }

    return targetScore + prefHits + anchorBonus - 0.15 * transitions - nightPenalty;
}

function deepCopySchedule(s: Schedule): Schedule {
    const out: any = {};
    for (const d of DAYS) out[d] = s[d].slice();
    return out;
}

function anneal(
    ctx: BuildCtx,
    opts?: {
        initialTemp?: number;
        cooling?: number;
        outer?: number;
        inner?: number;
        reheats?: number;
        minTemp?: number;
    }
): void {
    // ~100,800 candidates per pass: 72 * 1400
    const {
        initialTemp = 180,
        cooling = 0.97,
        outer = 10000,
        inner = 10000,
        reheats = 5,      // do 1 light reheat pass (optional)
        minTemp = 0.5,
    } = opts || {};

    let current = deepCopySchedule(ctx.schedule);
    let best = deepCopySchedule(current);
    let bestScore = scoreSchedule(ctx);

    const tryPass = (Tstart: number) => {
        let T = Tstart;

        for (let step = 0; step < outer; step++) {
            for (let it = 0; it < inner; it++) {
                const cand = deepCopySchedule(current);

                // pick a random non-sleep, non-exercise task (exercise handled by greedy with paired rest)
                const pool = ctx.tasks.filter((t) => !t.isSleep && !t.isExercise && (t.blocksRequired || 0) > 0);
                if (!pool.length) break;
                const t = pool[(Math.random() * pool.length) | 0];

                // choose length up to task stretch (2..8 blocks)
                const maxLen = clamp(t.maxStretchBlocks || 4, 2, 8);
                let len = clamp(2 + ((Math.random() * maxLen) | 0), 2, maxLen);

                const d = DAYS[(Math.random() * 7) | 0];
                if (t.isSchool && t.noGoDays && t.noGoDays.includes(d)) continue;
                const start = (Math.random() * (BLOCKS_PER_DAY - len)) | 0;

                // obey placement window + moat + fixed mask (respect nap preferences)
                if (!canPlaceFlexibleAt(start, t)) continue;
                if (!moatClear(cand, d, start, len, t.labelFor("study"))) continue;
                // enforce per-day session cap
                if (t.timesPerDay != null) {
                    const occ = countLabelOccurrences(cand, d, t.labelFor("study"));
                    // placing this chunk would add 1 session
                    if (occ >= t.timesPerDay) continue;
                }

                // Socializing: enforce 1h..4h and disallow morning unless preferred
                const isSocial = /social/i.test(t.category) || /social/i.test(t.courseName) || /socializing/i.test(t.courseName);
                if (isSocial) {
                    if (len < 4) continue;
                    if (len > 16) len = 16;
                    const inMorning = inBucket(start, 'morning');
                    if (inMorning && !(t.preferred && t.preferred.includes('morning'))) continue;
                }

                // For naps, never try shorter than 3 blocks and enforce fixed-event buffer
                if (/\bnap\b/i.test(t.courseName)) {
                    if (len < 3) continue;
                    const before = start - 1;
                    const after = start + len;
                    if ((before >= 0 && ctx.fixedMask[d][before]) || (after < BLOCKS_PER_DAY && ctx.fixedMask[d][after])) {
                        continue;
                    }
                }

                let ok = true;
                for (let k = 0; k < len; k++) {
                    if (cand[d][start + k] !== null || ctx.fixedMask[d][start + k]) {
                        ok = false;
                        break;
                    }
                }
                if (!ok) continue;

                fillLabel(cand, d, start, len, t.labelFor("study"));

                // small random "remove" tweak so we don’t only add
                if (Math.random() < 0.35) {
                    const dd = DAYS[(Math.random() * 7) | 0];
                    const row = cand[dd];
                    for (let tries = 0; tries < 4; tries++) {
                        const pos = (Math.random() * BLOCKS_PER_DAY) | 0;
                        if (row[pos] === t.labelFor("study")) {
                            row[pos] = null;
                            break;
                        }
                    }
                }

                const sPrev = scoreSchedule({ ...ctx, schedule: current } as any);
                const sNext = scoreSchedule({ ...ctx, schedule: cand } as any);
                const delta = sNext - sPrev;

                if (delta >= 0 || Math.random() < Math.exp(delta / T)) {
                    current = cand;
                    if (sNext > bestScore) {
                        bestScore = sNext;
                        best = deepCopySchedule(cand);
                    }
                }
            }
            T *= cooling;
            if (T < minTemp) break;
        }
    };

    // one thorough pass
    tryPass(initialTemp);

    // optional light reheats for extra exploration
    for (let r = 0; r < reheats; r++) {
        tryPass(initialTemp * 0.66);
    }

    ctx.schedule = best;
}


/* ===== Post passes ===== */

function fillDaytimeGapsByDeficit(ctx: BuildCtx) {
    const s = ctx.schedule;

    const tasksByNeed = ctx.tasks
        .filter(t => !t.isSleep && (ctx.deficits[t.id] || 0) > 0)
        .sort((a, b) => (ctx.deficits[b.id] || 0) - (ctx.deficits[a.id] || 0));

    for (const t of tasksByNeed) {
        let need = ctx.deficits[t.id] || 0;
        if (need <= 0) continue;

        const chunk = t.durationBlocks && t.durationBlocks > 0
            ? t.durationBlocks
            : Math.min(t.maxStretchBlocks || BLOCKS_PER_HOUR, BLOCKS_PER_HOUR);

        // Round-robin across days to avoid giant slabs
        outer: for (let round = 0; round < 3; round++) {
            for (const d of DAYS) {
                if (need <= 0) break outer;
                if (t.isSchool && t.noGoDays && t.noGoDays.includes(d)) continue;

                for (let i = hhmmToBlock(8 * 100); i < hhmmToBlock(22 * 100); i++) {
                    if (need <= 0) break;

                    // skip busy
                    if (s[d][i] !== null) continue;
                    // respect placement window rules (e.g., naps)
                    if (!canPlaceFlexibleAt(i, t)) continue;

                    // cap by free run and remaining
                    const free = freeRunLen(s, d, i);
                    // exact length for fixed-duration items; otherwise bounded by stretch
                    let len = t.durationBlocks && t.durationBlocks > 0
                        ? Math.min(chunk, free, need)
                        : clamp(Math.min(chunk, free, need), 2, chunk);

                    // For naps, never place shorter than 45 minutes (3 blocks)
                    if (/\bnap\b/i.test(t.courseName) && len < 3) { continue; }
                    // Socializing 1h..4h
                    const isSocial = /social/i.test(t.category) || /social/i.test(t.courseName) || /socializing/i.test(t.courseName);
                    if (isSocial) {
                        if (len < 4) { continue; }
                        if (len > 16) { len = 16; }
                    }

                    if (len >= 1) {
                        if (t.timesPerDay != null) {
                            const occ = countLabelOccurrences(s, d, t.labelFor("study"));
                            if (occ >= t.timesPerDay) { continue; }
                        }
                    }

                    if (len >= 1 && placeChunkWithMoat(s, d, i, len, t.labelFor("study"))) {
                        need -= len;
                        i += len; // skip past
                    }
                }
            }
        }

        ctx.deficits[t.id] = need;
    }
}

function enforceStudyBreaks(ctx: BuildCtx) {
    const s = ctx.schedule;

    // build quick lookup: label -> max stretch (only for study labels)
    const stretchByLabel = new Map<string, number>();
    for (const t of ctx.tasks) {
        if (!t.isSleep) stretchByLabel.set(t.labelFor("study"), t.maxStretchBlocks || BLOCKS_PER_HOUR);
    }

    for (const d of DAYS) {
        const row = s[d];
        let i = 0;
        while (i < BLOCKS_PER_DAY) {
            const lab = row[i];
            if (!lab) { i++; continue; }
            let j = i + 1;
            while (j < BLOCKS_PER_DAY && row[j] === lab) j++;
            const len = j - i;

            if (stretchByLabel.has(lab) && len > stretchByLabel.get(lab)! ) {
                // insert a 1-block break roughly in the middle
                const cut = i + Math.floor(len / 2);
                row[cut] = null;
            }
            i = j;
        }
    }
}

function enforceMinRunLengths(ctx: BuildCtx, minBlocks = 2) {
    const s = ctx.schedule;
    for (const day of DAYS) {
        const row = s[day];
        let i = 0;
        while (i < BLOCKS_PER_DAY) {
            const lab = row[i];
            if (!lab) { i++; continue; }
            let j = i + 1;
            while (j < BLOCKS_PER_DAY && row[j] === lab) j++;
            const len = j - i;
            if (len < minBlocks) for (let k = i; k < j; k++) row[k] = null;
            i = j;
        }
    }
}

// Remove too-short flexible Socializing runs (< minBlocks, default 4 blocks = 1h)
function enforceSocialMinRunLengths(ctx: BuildCtx, minBlocks = 4) {
  const s = ctx.schedule;
  const socialFlexLabels = new Set<string>();
  for (const t of ctx.tasks) {
    const isSocial = /social/i.test(t.category) || /social/i.test(t.courseName) || /socializing/i.test(t.courseName);
    if (!isSocial) continue;
    if (t.meetings && t.meetings.length) continue; // skip fixed meeting labels
    socialFlexLabels.add(t.labelFor("study"));
  }
  if (socialFlexLabels.size === 0) return;
  for (const day of DAYS) {
    const row = s[day];
    let i = 0;
    while (i < BLOCKS_PER_DAY) {
      const lab = row[i];
      if (!lab || !socialFlexLabels.has(String(lab))) { i++; continue; }
      let j = i + 1;
      while (j < BLOCKS_PER_DAY && row[j] === lab) j++;
      const len = j - i;
      if (len < minBlocks) {
        for (let k = i; k < j; k++) row[k] = null;
      }
      i = j;
    }
  }
}


/* ===== Public entry ===== */
export type { Category, ObligationChild, MeetingTime };

export function generateSchedule(categories: Category[]): Schedule {
    const tasks = apportionTargets(categories);
    const ctx = initializeContext(tasks);

    // 1) hard things first
    seedMeetings(ctx);

    // 2) priority-aware nightly sleep (correct wrap)
    const { nightlyPlan } = planPriorityAwareSleep(tasks);
    seedSleep(ctx, nightlyPlan);
    // Ensure at least 1h buffer between wake and first fixed meeting; hygiene is added later
    enforceWakeBuffers(ctx);

    // 3) targeted: try placing class study adjacent to class meetings
    placeStudyAdjacentToMeetings(ctx);

    // 4) greedy flexible placement with moat + maxStretch
    greedyFill(ctx);

    // 5) anneal (anchor rewards/penalties already baked into scoring)
    anneal(ctx);

    // 6) deficits fill (chunked, round-robin) + safety passes
    fillDaytimeGapsByDeficit(ctx);
    enforceStudyBreaks(ctx);
    enforceMinRunLengths(ctx, 2);
    enforceSocialMinRunLengths(ctx, 4);

    // Mandatory hygiene after wake and after work shifts
    enforceHygieneAfterSleep(ctx);
    enforceHygieneAfterWork(ctx);

    // Enforce post-exercise rest periods immediately after exercise sessions
    enforceRestPeriods(ctx);

    // 7) smoothing: merge identical blocks with tiny gaps between them
    mergeNearIdenticalBlocks(ctx, 1); // merge when gap <= 1 block (15m)

    return ctx.schedule;
}

function placeStudyAdjacentToMeetings(ctx: BuildCtx) {
    for (const t of ctx.tasks) {
        if (t.isSleep) continue;
        if (!t.isSchool) continue;
        if (!t.meetings || !t.meetings.length) continue;
        let remain = t.blocksRequired;
        if (remain <= 0) continue;

        const label = t.labelFor("study");
        const chunk = clamp(Math.min(t.maxStretchBlocks || BLOCKS_PER_HOUR, BLOCKS_PER_HOUR), 2, Math.max(2, t.maxStretchBlocks || 2));

        for (const m of t.meetings) {
            if (remain <= 0) break;
            const d = m.day;
            if (t.noGoDays && t.noGoDays.includes(d)) continue;

            // After meeting
            if (remain > 0) {
                const start = m.endIdx;
                const free = freeRunLen(ctx.schedule, d, start);
                const len = Math.min(chunk, remain, free);
                if (len >= 2 && withinFlexibleDayWindow(start)) {
                    if (placeChunkWithMoat(ctx.schedule, d, start, len, label)) {
                        remain -= len;
                    }
                }
            }
            if (remain <= 0) break;

            // Before meeting
            if (remain > 0) {
                const len = Math.min(chunk, remain);
                const start = m.startIdx - len;
                if (start >= 0 && withinFlexibleDayWindow(start)) {
                    let ok = true;
                    for (let k = 0; k < len; k++) if (ctx.schedule[d][start + k] !== null) { ok = false; break; }
                    if (ok && moatClear(ctx.schedule, d, start, len, label)) {
                        fillLabel(ctx.schedule, d, start, len, label);
                        remain -= len;
                    }
                }
            }
        }

        t.blocksRequired = remain;
        ctx.deficits[t.id] = remain;
    }
}

function enforceRestPeriods(ctx: BuildCtx) {
    const s = ctx.schedule;
    const exerciseTasks = ctx.tasks.filter(t => t.isExercise && (t.restBlocks || 0) > 0);
    if (!exerciseTasks.length) return;
    for (const t of exerciseTasks) {
        const label = t.labelFor("study"); // for exercise, flexible label is the name
        const rlen = t.restBlocks || 0;
        if (rlen <= 0) continue;

        for (const d of DAYS) {
            const row = s[d];
            let i = 0;
            while (i < BLOCKS_PER_DAY) {
                if (row[i] !== label) { i++; continue; }
                let j = i + 1;
                while (j < BLOCKS_PER_DAY && row[j] === label) j++;
                // attempt to place rest starting at j
                if (j < BLOCKS_PER_DAY) {
                    let free = 0;
                    while (j + free < BLOCKS_PER_DAY && row[j + free] === null) free++;
                    const len = Math.min(rlen, free);
                    if (len > 0) {
                        fillLabel(s, d, j, len, restLabel(t.courseName));
                        // hygiene right after rest
                        const hygStart = j + len;
                        const hygBlocks = 2;
                        if (hygStart + hygBlocks <= BLOCKS_PER_DAY) {
                            let can = true;
                            for (let q = 0; q < hygBlocks; q++) {
                                const pos = hygStart + q;
                                if (s[d][pos] !== null && !canEvict(ctx, d, pos)) { can = false; break; }
                            }
                            if (can) {
                                for (let q = 0; q < hygBlocks; q++) {
                                    const pos = hygStart + q;
                                    if (s[d][pos] !== null && canEvict(ctx, d, pos)) s[d][pos] = null;
                                }
                                fillLabel(s, d, hygStart, hygBlocks, 'Hygiene');
                            }
                        }
                    }
                }
                i = j;
            }
        }
    }
}

function enforceHygieneAfterSleep(ctx: BuildCtx) {
    const s = ctx.schedule;
    const sleepNames = new Set<string>(ctx.tasks.filter(t => t.isSleep).map(t => t.courseName));
    const hygBlocks = 2; // 30 minutes
    for (const d of DAYS) {
        const row = s[d];
        // find wake boundary at start of day: count leading sleep blocks
        let i = 0;
        while (i < BLOCKS_PER_DAY && row[i] && sleepNames.has(String(row[i]))) i++;
        const wake = i;
        if (wake < BLOCKS_PER_DAY && wake > 0) {
            // place hygiene starting at wake if possible, evicting non-fixed
            let can = true;
            for (let k = 0; k < hygBlocks; k++) {
                const pos = wake + k;
                if (pos >= BLOCKS_PER_DAY) { can = false; break; }
                if (row[pos] !== null && !canEvict(ctx, d, pos)) { can = false; break; }
            }
            if (can) {
                for (let k = 0; k < hygBlocks; k++) {
                    const pos = wake + k;
                    if (row[pos] !== null && canEvict(ctx, d, pos)) row[pos] = null;
                }
                fillLabel(s, d, wake, hygBlocks, 'Hygiene');
            }
        }
    }
}

function enforceHygieneAfterWork(ctx: BuildCtx) {
    const s = ctx.schedule;
    const hygBlocks = 2;
    // Find tasks with work meetings
    const workTasks = ctx.tasks.filter(t => /work/i.test(t.courseName) && t.meetings && t.meetings.length);
    for (const t of workTasks) {
        for (const m of t.meetings || []) {
            const d = m.day;
            const start = m.startIdx;
            const end = m.endIdx;
            // verify that meeting label is present there (optional)
            const placeStart = end;
            if (placeStart + hygBlocks > BLOCKS_PER_DAY) continue;
            let can = true;
            for (let k = 0; k < hygBlocks; k++) {
                const pos = placeStart + k;
                if (s[d][pos] !== null && !canEvict(ctx, d, pos)) { can = false; break; }
            }
            if (can) {
                for (let k = 0; k < hygBlocks; k++) {
                    const pos = placeStart + k;
                    if (s[d][pos] !== null && canEvict(ctx, d, pos)) s[d][pos] = null;
                }
                fillLabel(s, d, placeStart, hygBlocks, 'Hygiene');
            }
        }
    }
}

function mergeNearIdenticalBlocks(ctx: BuildCtx, maxGapBlocks = 1) {
    const s = ctx.schedule;
    let changed = true;
    while (changed) {
        changed = false;
        for (const day of DAYS) {
            const row = s[day];
            let i = 0;
            while (i < BLOCKS_PER_DAY) {
                const lab = row[i];
                if (!lab) { i++; continue; }
                let j = i + 1;
                while (j < BLOCKS_PER_DAY && row[j] === lab) j++;
                let g = j;
                while (g < BLOCKS_PER_DAY && row[g] === null) g++;
                if (g < BLOCKS_PER_DAY && (g - j) > 0 && (g - j) <= maxGapBlocks) {
                    let k = g;
                    while (k < BLOCKS_PER_DAY && row[k] === lab) k++;
                    if (k > g) {
                        for (let p = j; p < g; p++) row[p] = lab;
                        changed = true;
                        j = k;
                    }
                }
                i = j;
            }
        }
    }
}


