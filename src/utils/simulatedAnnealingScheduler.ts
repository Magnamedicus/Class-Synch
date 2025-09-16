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

        const exacts = children.map(c => catBlocks * (c.relativePriority || 0));
        const floors = exacts.map(x => Math.floor(x));
        const used = floors.reduce((a, b) => a + b, 0);
        let leftovers = catBlocks - used;

        const fractionalOrder = exacts
            .map((x, i) => ({ i, frac: x - Math.floor(x) }))
            .sort((a, b) => b.frac - a.frac);

        for (let k = 0; k < leftovers; k++) floors[fractionalOrder[k].i]++;

        children.forEach((child, idx) => {
            const isSleep =
                /sleep/i.test(child.name) ||
                child.preferredTimeBlocks?.includes("night") ||
                /sleep/i.test(cat.name);

            tasks.push({
                id: `${cat.id}:${child.id}`,
                courseName: child.name,
                category: cat.name,
                blocksRequired: floors[idx],
                maxStretchBlocks: Math.max(1, Math.round((child.maxStretch || 1) * BLOCKS_PER_HOUR)),
                preferred: child.preferredTimeBlocks,
                meetings: child.meetingTimes?.map(mt => {
                    const d = normalizeDay(mt.day as string);
                    const [a, b] = asBlocks(mt.start, mt.end);
                    return { day: d, startIdx: a, endIdx: b };
                }),
                anchors: [],
                labelFor: (kind) =>
                    kind === "meeting"
                        ? meetingLabel(child.name)
                        : child.meetingTimes && child.meetingTimes.length
                            ? studyLabel(child.name)
                            : child.name,
                isSleep,
            });
        });
    }

    return tasks;
}

/* ===== Sleep nightly plan (correct cross-midnight math) ===== */

const SLEEP_START_MIN = hhmmToBlock(20 * 100); // 20:00
const SLEEP_START_MAX = hhmmToBlock(22 * 100); // 22:00
const WAKE_MIN       = hhmmToBlock( 6 * 100); // 06:00
const WAKE_MAX       = hhmmToBlock( 9 * 100); // 09:00
const MIN_NIGHTLY_SLEEP = hoursToBlocks(6);   // 6h
const MAX_NIGHTLY_SLEEP = hoursToBlocks(9);   // 9h

function planNightFor(start: number, desiredLen: number) {
    // force a wake that yields ~desiredLen; then clamp to 06–09
    let wake = desiredLen - (BLOCKS_PER_DAY - start); // blocks after midnight
    wake = clamp(wake, WAKE_MIN, WAKE_MAX);
    let len  = (BLOCKS_PER_DAY - start) + wake;
    len = clamp(len, MIN_NIGHTLY_SLEEP, MAX_NIGHTLY_SLEEP);
    return { wake, len };
}

function planPriorityAwareSleep(tasks: Task[]): {
    sleepTask?: Task;
    nightlyPlan?: { day: DayName; start: number; len: number }[];
} {
    const sleepTask = tasks.find(t => t.isSleep);
    if (!sleepTask) return {};

    const total = sleepTask.blocksRequired;
    const perNight = clamp(Math.round(total / 7), MIN_NIGHTLY_SLEEP, MAX_NIGHTLY_SLEEP);

    const nightlyPlan: { day: DayName; start: number; len: number }[] = [];
    // choose a consistent start point around 21:00 if available
    const defaultStart = clamp(Math.round((SLEEP_START_MIN + SLEEP_START_MAX) / 2), SLEEP_START_MIN, SLEEP_START_MAX); // ~21:00

    for (const day of DAYS) {
        const start = defaultStart; // could add small jitter later
        const { len } = planNightFor(start, perNight);
        nightlyPlan.push({ day, start, len });
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

    for (const n of nightly) {
        const start = n.start;
        const endAbs = start + n.len; // may exceed 96

        // head (same day)
        const headLen = Math.min(n.len, BLOCKS_PER_DAY - start);
        if (headLen > 0 && isFree(ctx.schedule, n.day, start, headLen)) {
            fillLabel(ctx.schedule, n.day, start, headLen, sleeper.courseName);
            for (let i = 0; i < headLen; i++) ctx.fixedMask[n.day][start + i] = true;
        }

        // tail (next day)
        const tail = endAbs - BLOCKS_PER_DAY;
        if (tail > 0) {
            const d2 = DAYS[(DAYS.indexOf(n.day) + 1) % 7];
            if (isFree(ctx.schedule, d2, 0, tail)) {
                fillLabel(ctx.schedule, d2, 0, tail, sleeper.courseName);
                for (let i = 0; i < tail; i++) ctx.fixedMask[d2][i] = true;
            }
        }
    }
}

/* ===== Greedy flexible placement (moat + stretch) ===== */

function taskPrefers(block: number, t: Task): boolean {
    if (!t.preferred?.length) return true;
    return t.preferred.some(b => inBucket(block, b));
}

function canPlaceFlexibleAt(block: number, t: Task): boolean {
    if (t.isSleep) return false;
    return withinFlexibleDayWindow(block) && taskPrefers(block, t);
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

function greedyFill(ctx: BuildCtx) {
    const chunkFor = (t: Task) => clamp(Math.min(t.maxStretchBlocks || BLOCKS_PER_HOUR, BLOCKS_PER_HOUR), 2, 6);

    for (const t of ctx.tasks) {
        if (t.isSleep) continue;
        let remain = t.blocksRequired;
        if (remain <= 0) continue;

        for (const d of DAYS) {
            if (remain <= 0) break;

            for (let i = hhmmToBlock(8 * 100); i < hhmmToBlock(22 * 100); i++) {
                if (remain <= 0) break;
                if (!canPlaceFlexibleAt(i, t)) continue;
                const free = freeRunLen(ctx.schedule, d, i);
                if (free < 2) continue;

                const len = Math.min(chunkFor(t), remain, free);
                if (placeChunkWithMoat(ctx.schedule, d, i, len, t.labelFor("study"))) {
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

                // pick a random non-sleep task
                const pool = ctx.tasks.filter((t) => !t.isSleep);
                if (!pool.length) break;
                const t = pool[(Math.random() * pool.length) | 0];

                // choose length up to task stretch (2..8 blocks)
                const maxLen = clamp(t.maxStretchBlocks || 4, 2, 8);
                const len = clamp(2 + ((Math.random() * maxLen) | 0), 2, maxLen);

                const d = DAYS[(Math.random() * 7) | 0];
                const start = (Math.random() * (BLOCKS_PER_DAY - len)) | 0;

                // obey flexible window + moat + fixed mask
                if (!withinFlexibleDayWindow(start)) continue;
                if (!moatClear(cand, d, start, len, t.labelFor("study"))) continue;

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

        const chunk = Math.min(t.maxStretchBlocks || BLOCKS_PER_HOUR, BLOCKS_PER_HOUR);

        // Round-robin across days to avoid giant slabs
        outer: for (let round = 0; round < 3; round++) {
            for (const d of DAYS) {
                if (need <= 0) break outer;

                for (let i = hhmmToBlock(8 * 100); i < hhmmToBlock(22 * 100); i++) {
                    if (need <= 0) break;

                    // skip busy
                    if (s[d][i] !== null) continue;

                    // cap by free run and remaining
                    const free = freeRunLen(s, d, i);
                    const len = clamp(Math.min(chunk, free, need), 2, chunk);

                    if (len >= 2 && placeChunkWithMoat(s, d, i, len, t.labelFor("study"))) {
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

/* ===== Public entry ===== */

export function generateSchedule(categories: Category[]): Schedule {
    const tasks = apportionTargets(categories);
    const ctx = initializeContext(tasks);

    // 1) hard things first
    seedMeetings(ctx);

    // 2) priority-aware nightly sleep (correct wrap)
    const { nightlyPlan } = planPriorityAwareSleep(tasks);
    seedSleep(ctx, nightlyPlan);

    // 3) greedy flexible placement with moat + maxStretch
    greedyFill(ctx);

    // 4) anneal (anchor rewards/penalties already baked into scoring)
    anneal(ctx);

    // 5) deficits fill (chunked, round-robin) + safety passes
    fillDaytimeGapsByDeficit(ctx);
    enforceStudyBreaks(ctx);
    enforceMinRunLengths(ctx, 2);

    return ctx.schedule;
}
