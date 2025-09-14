import { DAYS, BLOCKS_PER_DAY, timeToBlockIndex } from "./scheduleHelpers";


const BLOCKS_PER_HOUR = Math.floor(BLOCKS_PER_DAY / 24); // 15-min blocks per hour (4)
const TOTAL_BLOCKS = BLOCKS_PER_DAY * DAYS.length;



export interface MeetingTime {
    day: string;
    start: number;
    end: number;
}

export interface Obligation {
    id: string;
    name: string;
    relativePriority: number;
    maxStretch: number;
    preferredTimeBlocks: string[];
    dependencyIds: string[];
    meetingTimes?: MeetingTime[];

    // computed
    blocksRequired?: number;
    __frac?: number;
}

export interface Category {
    id: string;
    name: string;
    priority: number;
    children: Obligation[];
}

export interface Schedule {
    [day: string]: (string | null)[];
}



const isNightIdx = (idx: number) => {
    const h = Math.floor(idx / BLOCKS_PER_HOUR);
    return h >= 22 || h < 6; // 22:00–24:00 and 00:00–06:00
};

function idxToBucketTag(idx: number): "morning" | "afternoon" | "evening" | "night" {
    const h = Math.floor(idx / BLOCKS_PER_HOUR);
    if (h >= 6 && h < 12)  return "morning";
    if (h >= 12 && h < 17) return "afternoon";
    if (h >= 17 && h < 22) return "evening";
    return "night";
}

const BUCKET_PRED: Record<"morning"|"afternoon"|"evening"|"night", (i: number) => boolean> = {
    morning:   (i) => { const h = Math.floor(i / BLOCKS_PER_HOUR); return h >= 6  && h < 12; },
    afternoon: (i) => { const h = Math.floor(i / BLOCKS_PER_HOUR); return h >= 12 && h < 17; },
    evening:   (i) => { const h = Math.floor(i / BLOCKS_PER_HOUR); return h >= 17 && h < 22; },
    night:     (i) => isNightIdx(i),
};



function cloneSchedule(s: Schedule): Schedule {
    const out: Schedule = {} as Schedule;
    for (const d of DAYS) out[d] = s[d].slice();
    return out;
}
const prefersNight = (t: Obligation) => t.preferredTimeBlocks?.includes("night");
const looksLikeSleep = (o: Obligation) => /sleep/i.test(o.name) || prefersNight(o);
const isCourse = (t: Obligation) => Array.isArray(t.meetingTimes) && t.meetingTimes.length > 0;

const BREAK_BLOCKS = 4;


function cellBelongsTo(task: Obligation, v: string | null): boolean {
    return typeof v === "string" && v.startsWith(task.name);
}


function isSchoolCell(v: string | null): boolean {
    if (typeof v !== "string") return false;
    return v.includes("(Class Meeting)") || v.includes("(Studying)");
}


function canUse(task: Obligation, day: string, i: number, blocked: Set<string>, s: Schedule) {
    if (blocked.has(`${day}:${i}`)) return false;
    if (s[day][i] !== null) return false;

    const h = Math.floor(i / BLOCKS_PER_HOUR);
    const night = h >= 22 || h < 6;
    const isSleep = looksLikeSleep(task);

    if (isSleep) return night;

    if (h >= 20 && h < 22) {
        return task.preferredTimeBlocks?.includes("evening") === true;
    }

    return !night && h >= 6 && h < 20;
}

function chunkSizeFor(task: Obligation): number {
    const cap = Math.max(1, Math.round(task.maxStretch * BLOCKS_PER_HOUR)); // hours → blocks
    return Math.min(cap, 4);
}

function runLengthAround(
    s: Schedule, day: string, start: number, len: number, task: Obligation
): { left: number; right: number } {
    let L = 0, R = 0;
    for (let i = start - 1; i >= 0; i--) {
        if (cellBelongsTo(task, s[day][i])) L++; else break;
    }
    for (let i = start + len; i < BLOCKS_PER_DAY; i++) {
        if (cellBelongsTo(task, s[day][i])) R++; else break;
    }
    return { left: L, right: R };
}

type PlaceMode = "study" | "general" | "sleep" | "meeting";


function placeChunk(
    s: Schedule,
    task: Obligation,
    day: string,
    start: number,
    len: number,
    blocked: Set<string>,
    mode: PlaceMode
): boolean {

    for (let k = 0; k < len; k++) {
        const idx = start + k;
        if (idx >= BLOCKS_PER_DAY) return false;
        if (!canUse(task, day, idx, blocked, s)) return false;
        if (s[day][idx] !== null) return false;
    }


    if (mode === "study") {
        const maxBlocks = Math.max(1, Math.round(task.maxStretch * BLOCKS_PER_HOUR));
        const { left, right } = runLengthAround(s, day, start, len, task);

        // Contiguous run cannot exceed maxStretch
        if (left + len + right > maxBlocks) return false;


        for (let i = start - 1; i >= Math.max(0, start - BREAK_BLOCKS); i--) {
            if (cellBelongsTo(task, s[day][i])) return false;
        }
        for (let i = start + len; i < Math.min(BLOCKS_PER_DAY, start + len + BREAK_BLOCKS); i++) {
            if (cellBelongsTo(task, s[day][i])) return false;
        }
    }

    const label =
        mode === "meeting" ? `${task.name} (Class Meeting)` :
            mode === "sleep"   ? task.name :
                mode === "study"   ? `${task.name} (Studying)` :
                    task.name;

    for (let k = 0; k < len; k++) s[day][start + k] = label;
    return true;
}

function removeChunkIfMatches(
    s: Schedule, name: string, day: string, start: number, len: number, blocked: Set<string>
): number {
    let removed = 0;
    for (let k = 0; k < len; k++) {
        const idx = start + k;
        if (idx >= BLOCKS_PER_DAY) break;
        const key = `${day}:${idx}`;
        if (blocked.has(key)) break;
        const v = s[day][idx];
        if (!(typeof v === "string" && v.startsWith(name))) break;
        s[day][idx] = null;
        removed++;
    }
    return removed;
}

function scanRuns(s: Schedule, taskName: string, blocked: Set<string>) {
    const runs: Array<[string, number, number]> = [];
    for (const day of DAYS) {
        let start = -1, len = 0;
        for (let i = 0; i < BLOCKS_PER_DAY; i++) {
            const key = `${day}:${i}`;
            const v = s[day][i];
            const isTask = typeof v === "string" && v.startsWith(taskName) && !blocked.has(key);
            if (isTask) {
                if (start === -1) start = i;
                len++;
            } else if (len > 0) {
                runs.push([day, start, len]);
                start = -1; len = 0;
            }
        }
        if (len > 0) runs.push([day, start, len]);
    }
    return runs;
}



function apportionTargets(categories: Category[]): Obligation[] {
    const obligations: Obligation[] = [];

    for (const cat of categories) {
        const catExact = TOTAL_BLOCKS * cat.priority;

        for (const child of cat.children) {
            const exact = catExact * child.relativePriority;
            const floored = Math.floor(exact);
            child.blocksRequired = floored;
            child.__frac = exact - floored;
            obligations.push(child);
        }


        const assigned = cat.children.reduce((s, c) => s + (c.blocksRequired ?? 0), 0);
        let leftover = Math.round(catExact - assigned);
        if (leftover > 0) {
            cat.children
                .slice()
                .sort((a, b) => (b.__frac ?? 0) - (a.__frac ?? 0))
                .forEach((c) => {
                    if (leftover > 0) {
                        c.blocksRequired = (c.blocksRequired ?? 0) + 1;
                        leftover--;
                    }
                });
        }
    }

    return obligations;
}


function seedMeetings(schedule: Schedule, obligations: Obligation[]) {
    const blocked = new Set<string>();
    for (const task of obligations) {
        if (!task.meetingTimes?.length) continue;
        for (const mt of task.meetingTimes) {
            const startIdx = timeToBlockIndex(mt.start);
            const endIdx = timeToBlockIndex(mt.end);
            const span = Math.max(0, endIdx - startIdx);
            for (let i = startIdx; i < endIdx; i++) {
                schedule[mt.day][i] = `${task.name} (Class Meeting)`;
                blocked.add(`${mt.day}:${i}`);
            }
            task.blocksRequired = Math.max(0, (task.blocksRequired ?? 0) - span);
        }
    }
    return blocked;
}


function seedSleepEvenlyPerNight(
    schedule: Schedule,
    blocked: Set<string>,
    obligations: Obligation[],
    targetHoursPerNight = 8
) {
    const sleepTasks = obligations.filter(looksLikeSleep);
    if (!sleepTasks.length) return;

    const BPH = BLOCKS_PER_HOUR;
    const NIGHTLY = targetHoursPerNight * BPH;
    const EVE_22 = 22 * BPH; // 22:00 index on day d
    const MOR_06 =  6 * BPH; // 06:00 index on day d+1
    const nextDay = (di: number) => DAYS[(di + 1) % DAYS.length];

    for (const task of sleepTasks) {
        for (let di = 0; di < 7; di++) {
            const dayE = DAYS[di];
            const dayM = nextDay(di);

            let placed = 0;
            const setCell = (day: string, i: number) => {
                const key = `${day}:${i}`;
                if (!blocked.has(key) && schedule[day][i] === null) {
                    schedule[day][i] = task.name;
                    blocked.add(key);
                    placed++;
                    return true;
                }
                return false;
            };

            // 22:00–24:00 (day d)
            for (let i = EVE_22; i < BLOCKS_PER_DAY && placed < NIGHTLY; i++) setCell(dayE, i);
            // 00:00–06:00 (day d+1)
            for (let i = 0; i < MOR_06 && placed < NIGHTLY; i++) setCell(dayM, i);


            if (placed < NIGHTLY) {
                for (let i = EVE_22 - 1; i >= 21 * BPH && placed < NIGHTLY; i--) setCell(dayE, i);
            }
            if (placed < NIGHTLY) {
                for (let i = MOR_06; i < 7 * BPH && placed < NIGHTLY; i++) setCell(dayM, i);
            }
        }
        task.blocksRequired = 0; // sleep fully handled
    }
}



function greedyFill(schedule: Schedule, blocked: Set<string>, obligations: Obligation[]) {
    // preferred buckets first
    for (const task of obligations) {
        let need = task.blocksRequired ?? 0;
        if (need <= 0) continue;

        const prefs = (task.preferredTimeBlocks?.length
            ? task.preferredTimeBlocks
            : ["morning", "afternoon", "evening", "night"]) as Array<keyof typeof BUCKET_PRED>;

        const chunk = chunkSizeFor(task);
        const mode: PlaceMode = looksLikeSleep(task) ? "sleep" : (isCourse(task) ? "study" : "general");

        for (const pref of prefs) {
            if (need <= 0) break;
            const want = BUCKET_PRED[pref];

            outer: for (const day of DAYS) {
                for (let i = 0; i < BLOCKS_PER_DAY && need > 0; i++) {
                    if (!want(i)) continue;
                    const take = Math.min(chunk, need);
                    if (placeChunk(schedule, task, day, i, take, blocked, mode)) {
                        need -= take;
                    }
                }
                if (need <= 0) break outer;
            }
        }
        task.blocksRequired = need;
    }

    // daytime fallback only
    for (const task of obligations) {
        let need = task.blocksRequired ?? 0;
        if (need <= 0) continue;

        const chunk = chunkSizeFor(task);
        const mode: PlaceMode = looksLikeSleep(task) ? "sleep" : (isCourse(task) ? "study" : "general");

        outer2: for (const day of DAYS) {
            for (let i = 0; i < BLOCKS_PER_DAY && need > 0; i++) {
                if (isNightIdx(i) && !prefersNight(task)) continue; // daytime only for non-night tasks
                const take = Math.min(chunk, need);
                if (placeChunk(schedule, task, day, i, take, blocked, mode)) {
                    need -= take;
                }
            }
            if (need <= 0) break outer2;
        }
        task.blocksRequired = need;
    }
}

function buildTargetMap(obligations: Obligation[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const o of obligations) m.set(o.id, Math.max(0, o.blocksRequired ?? 0));
    return m;
}



function scoreSchedule(
    s: Schedule,
    obligations: Obligation[],
    targets: Map<string, number>,
    blocked: Set<string>
): number {
    let val = 0;

    for (const task of obligations) {
        const target = targets.get(task.id) ?? 0;
        let count = 0;
        let prefHits = 0;
        let transitions = 0;
        let totalRunBonus = 0;

        for (const day of DAYS) {
            let prevTaskCell = false;
            let run = 0;

            for (let i = 0; i < BLOCKS_PER_DAY; i++) {
                const isTaskCell = cellBelongsTo(task, s[day][i]);

                if (isTaskCell) {
                    count++;
                    run++;
                    const tag = idxToBucketTag(i);
                    if (task.preferredTimeBlocks?.includes(tag)) prefHits++;
                }

                if (isTaskCell !== prevTaskCell) {
                    if (prevTaskCell || isTaskCell) transitions++;
                    if (prevTaskCell && run > 0) {
                        const maxRun = Math.max(1, Math.round(task.maxStretch * BLOCKS_PER_HOUR));
                        totalRunBonus += Math.min(run, maxRun);
                        run = 0;
                    }
                    prevTaskCell = isTaskCell;
                }
            }
            if (prevTaskCell && run > 0) {
                const maxRun = Math.max(1, Math.round(task.maxStretch * BLOCKS_PER_HOUR));
                totalRunBonus += Math.min(run, maxRun);
            }
        }

        val -= Math.abs(count - target) * 3; // hit per-task targets
        val += prefHits * 0.5;               // align with preferred windows
        val -= transitions * 0.15;           // discourage fragmentation
        val += totalRunBonus * 0.08;         // reward longer runs (capped by maxStretch)
    }

    // Global: filled slots good; non-sleep at night heavily penalized
    for (const day of DAYS) {
        for (let i = 0; i < BLOCKS_PER_DAY; i++) {
            const v = s[day][i];
            if (v !== null) {
                val += 0.05;
                if (!/sleep/i.test(String(v)) && isNightIdx(i)) val -= 0.6;
            }
        }
    }

    return val;
}

function mutate(base: Schedule, obligations: Obligation[], blocked: Set<string>): Schedule {
    const s = cloneSchedule(base);
    const task = obligations[Math.floor(Math.random() * obligations.length)];
    const csize = chunkSizeFor(task);
    const isSleepTask = looksLikeSleep(task);
    const mode: PlaceMode = isSleepTask ? "sleep" : (isCourse(task) ? "study" : "general");

    const freeByDay: Record<string, number[]> = {};
    const takenRuns = scanRuns(s, task.name, blocked);

    for (const day of DAYS) {
        freeByDay[day] = [];
        for (let i = 0; i < BLOCKS_PER_DAY; i++) {
            if (canUse(task, day, i, blocked, s)) freeByDay[day].push(i);
        }
    }

    const action = Math.random();
    if (action < 0.4) {
        // ADD chunk
        const day = DAYS[Math.floor(Math.random() * DAYS.length)];
        const starts = freeByDay[day];
        if (starts.length) {
            for (let t = 0; t < 8; t++) {
                const i = starts[Math.floor(Math.random() * starts.length)];
                if (placeChunk(s, task, day, i, csize, blocked, mode)) break;
            }
        }
    } else if (action < 0.8) {

        if (!isSleepTask && takenRuns.length) {
            const [day, start, len] = takenRuns[Math.floor(Math.random() * takenRuns.length)];
            const removeLen = Math.min(len, csize);
            removeChunkIfMatches(s, task.name, day, start, removeLen, blocked);
        }
    } else {

        if (!isSleepTask && takenRuns.length) {
            const [d1, start, len] = takenRuns[Math.floor(Math.random() * takenRuns.length)];
            const moveLen = Math.min(len, csize);
            const removed = removeChunkIfMatches(s, task.name, d1, start, moveLen, blocked);
            if (removed > 0) {
                const day = DAYS[Math.floor(Math.random() * DAYS.length)];
                const starts = freeByDay[day];
                if (starts.length) {
                    for (let t = 0; t < 8; t++) {
                        const i = starts[Math.floor(Math.random() * starts.length)];
                        if (placeChunk(s, task, day, i, removed, blocked, mode)) break;
                    }
                }
            }
        }
    }

    return s;
}


function enforceStudyBreaks(
    schedule: Schedule,
    blocked: Set<string>,
    obligations: Obligation[]
) {

    const threshold = obligations
        .filter(isCourse)
        .reduce((m, o) => Math.max(m, Math.max(1, Math.round(o.maxStretch * BLOCKS_PER_HOUR))), 0);

    if (threshold <= 0) return;

    const FORWARD_LOOK_LIMIT = 32; // break drift limit


    const placeBreakForward = (day: string, startIdx: number, needBlocks: number) => {
        let need = needBlocks;
        let j = startIdx;
        let placed = 0;
        let steps = 0;

        while (need > 0 && j < BLOCKS_PER_DAY && steps < FORWARD_LOOK_LIMIT) {
            const key = `${day}:${j}`;
            if (!isNightIdx(j) && !blocked.has(key)) {
                // overwrite anything non-frozen (study/social/etc.), but keep meetings/sleep intact
                schedule[day][j] = "Break";
                need--;
                placed++;
            }
            j++;
            steps++;
        }
        return { placed, lastIndex: j - 1 };
    };


    const backfillBreakIntoRun = (day: string, endIdxInclusive: number, needBlocks: number) => {
        let need = needBlocks;
        for (let j = endIdxInclusive; j >= 0 && need > 0; j--) {
            const key = `${day}:${j}`;
            const v = schedule[day][j];
            if (isNightIdx(j)) break;                 // no backfilling across night
            if (blocked.has(key)) continue;           // no overwriting frozen slots
            if (typeof v === "string" && v.includes("(Studying)")) {
                schedule[day][j] = "Break";
                need--;
            } else if (v === null) {

                schedule[day][j] = "Break";
                need--;
            } else if (v && v.includes("(Class Meeting)")) {

                break;
            }
        }
    };

    for (const day of DAYS) {
        let run = 0;
        let runStart = -1;

        for (let i = 0; i < BLOCKS_PER_DAY; i++) {
            const v = schedule[day][i];
            const school = isSchoolCell(v);

            if (school) {
                if (runStart === -1) runStart = i;
                run++;

                if (run >= threshold) {

                    const after = i + 1;


                    const { placed, lastIndex } = placeBreakForward(day, after, BREAK_BLOCKS);

                    if (placed < BREAK_BLOCKS) {

                        const remaining = BREAK_BLOCKS - placed;

                        backfillBreakIntoRun(day, i, remaining);
                    }


                    run = 0;
                    runStart = -1;
                    i = Math.max(i, lastIndex);
                }
            } else {

                run = 0;
                runStart = -1;
            }
        }
    }
}



function proofreadStudyingRuns(
    schedule: Schedule,
    obligations: Obligation[],
    {
        breakBlocks = 4, // 1 hour (4 × 15m)
        thresholdBlocks, // if omitted, use max course maxStretch
    }: { breakBlocks?: number; thresholdBlocks?: number } = {}
): void {
    const BPH = BLOCKS_PER_HOUR;

    const defaultThreshold =
        obligations
            .filter(o => Array.isArray(o.meetingTimes) && o.meetingTimes.length > 0)
            .reduce(
                (m, o) => Math.max(m, Math.max(1, Math.round(o.maxStretch * BPH))),
                0
            ) || 8;

    const THRESH = Math.max(1, thresholdBlocks ?? defaultThreshold);

    const isStudyingCell = (v: string | null) =>
        typeof v === "string" && v.endsWith("(Studying)");

    // Pass 1: enforce breaks after long runs
    for (const day of DAYS) {
        let run = 0;
        let runStart = -1;

        for (let i = 0; i < BLOCKS_PER_DAY; i++) {
            const v = schedule[day][i];

            if (isStudyingCell(v) && !isNightIdx(i)) {
                if (run === 0) runStart = i;
                run++;

                if (run > THRESH) {
                    let converted = 0;
                    let j = i;
                    while (j < BLOCKS_PER_DAY && converted < breakBlocks) {
                        if (!isStudyingCell(schedule[day][j]) || isNightIdx(j)) break;
                        schedule[day][j] = "Break";
                        converted++;
                        j++;
                    }
                    run = 0;
                    runStart = -1;
                    i = j - 1;
                }

                // end of run → check its length
                if (i === BLOCKS_PER_DAY - 1 || !isStudyingCell(schedule[day][i + 1])) {
                    if (run > 0 && run < 2 && runStart >= 0) {
                        // nuke any study run < 30m (2 slots)
                        for (let k = runStart; k <= i; k++) {
                            schedule[day][k] = null;
                        }
                    }
                    run = 0;
                    runStart = -1;
                }
            } else {
                run = 0;
                runStart = -1;
            }
        }
    }
}








function fillDaytimeGapsByDeficit(
    schedule: Schedule,
    blocked: Set<string>,
    obligations: Obligation[],
    targets: Map<string, number>
): void {
    // Helper to find a task that still has remaining deficit
    const pickTask = (): Obligation | null => {
        for (const o of obligations) {
            const remaining = targets.get(o.id) ?? 0;
            if (remaining > 0) return o;
        }
        return null;
    };

    for (const day of DAYS) {
        let i = 0;

        while (i < BLOCKS_PER_DAY) {
            // skip filled or blocked cells
            if (schedule[day][i] !== null || blocked.has(`${day}:${i}`)) {
                i++;
                continue;
            }

            // measure contiguous free gap
            let spanLen = 0;
            let j = i;
            while (
                j < BLOCKS_PER_DAY &&
                schedule[day][j] === null &&
                !blocked.has(`${day}:${j}`)
                ) {
                spanLen++;
                j++;
            }

            // if gap is only 1 slot (15 min), leave it empty
            if (spanLen === 1) {
                i = j; // skip over the gap
                continue;
            }

            // otherwise fill the gap
            let k = i;
            while (k < j) {
                const task = pickTask();
                if (!task) break;

                const remaining = targets.get(task.id) ?? 0;
                if (remaining <= 0) {
                    k++;
                    continue;
                }

                // assign this slot
                schedule[day][k] = isCourse(task)
                    ? `${task.name} (Studying)`
                    : task.name;

                targets.set(task.id, remaining - 1);
                k++;
            }

            // move index to end of gap
            i = j;
        }
    }
}


function enforceMinRunLengths(schedule: Schedule, minSlots = 2): void {
    for (const day of DAYS) {
        let i = 0;
        while (i < BLOCKS_PER_DAY) {
            const label = schedule[day][i];
            if (!label) { i++; continue; }

            // measure run length
            let j = i + 1;
            while (j < BLOCKS_PER_DAY && schedule[day][j] === label) j++;

            const runLen = j - i;
            if (runLen < minSlots) {
                for (let k = i; k < j; k++) {
                    schedule[day][k] = null;
                }
            }

            i = j;
        }
    }
}





export function generateSchedule(categories: Category[]): Schedule {
    // blank schedule
    const schedule: Schedule = Object.fromEntries(
        DAYS.map((d) => [d, Array(BLOCKS_PER_DAY).fill(null)])
    ) as Schedule;


    const obligations = apportionTargets(categories);


    const blocked = seedMeetings(schedule, obligations);


    const targets = buildTargetMap(obligations);


    seedSleepEvenlyPerNight(schedule, blocked, obligations, 8);


    greedyFill(schedule, blocked, obligations);

    //Hyperparameters
    const INITIAL_TEMP = 100;
    const FINAL_TEMP   = 0.02;
    const COOLING      = 0.92;
    const ITERS        = 450;

    let current = schedule;
    let currentScore = scoreSchedule(current, obligations, targets, blocked);
    let best = current;
    let bestScore = currentScore;

    for (let T = INITIAL_TEMP; T > FINAL_TEMP; T *= COOLING) {
        for (let i = 0; i < ITERS; i++) {
            const cand = mutate(current, obligations, blocked);
            const candScore = scoreSchedule(cand, obligations, targets, blocked);
            const delta = candScore - currentScore;
            if (delta > 0 || Math.exp(delta / T) > Math.random()) {
                current = cand;
                currentScore = candScore;
                if (currentScore > bestScore) {
                    best = current;
                    bestScore = currentScore;
                }
            }
        }
    }

    // Enforce study breaks across non-meeting school-work runs
    enforceStudyBreaks(best, blocked, obligations);

    // Final daytime gap-fill by deficit
    fillDaytimeGapsByDeficit(best, blocked, obligations, targets);

    proofreadStudyingRuns(best, obligations);
    enforceMinRunLengths(best, 2);

    return best;
}
