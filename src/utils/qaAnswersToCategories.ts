import type { Category, ObligationChild, MeetingTime } from "./simulatedAnnealingScheduler";
import type { QAAnswers } from "./qaStorage";

// --- Utilities ---

const normalizePriority = (p: any): number =>
    typeof p === "number" ? Math.min(Math.max(p, 0), 100) / 100 : 0.5;

// Convert a time string like "9:30 AM" or "14:15" into HHMM (e.g., 930, 1415)
const parseTimeToHHMM = (t: string | undefined): number | undefined => {
    if (!t) return undefined;
    const s = t.trim();
    const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m12) {
        let h = parseInt(m12[1], 10);
        const m = parseInt(m12[2], 10);
        const p = m12[3].toUpperCase();
        if (h === 12) h = 0;
        if (p === "PM") h += 12;
        return h * 100 + m;
    }
    const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
        const h = parseInt(m24[1], 10);
        const m = parseInt(m24[2], 10);
        return h * 100 + m;
    }
    const compact = s.match(/^(\d{3,4})$/);
    if (compact) return parseInt(compact[1], 10);
    return undefined;
};

const buildMeetingTimes = (days: string[], start: string, end: string): MeetingTime[] => {
    const s = parseTimeToHHMM(start);
    const e = parseTimeToHHMM(end);
    if (s == null || e == null) return [];
    return days.map(day => ({ day, start: s, end: e }));
};

// Map rich UI time labels to canonical buckets expected by the scheduler
const toBucket = (label: string): "morning" | "afternoon" | "evening" | "night" | null => {
    const s = (label || "").toLowerCase();
    if (s.includes("morning")) return "morning";
    if (s.includes("afternoon")) return "afternoon";
    if (s.includes("evening")) return "evening";
    if (s.includes("night")) return "night";
    return null;
};
const normalizePreferredTimes = (arr: any): Array<"morning" | "afternoon" | "evening" | "night"> | undefined => {
    if (!Array.isArray(arr)) return undefined;
    const out = arr
        .map(toBucket)
        .filter((v): v is "morning" | "afternoon" | "evening" | "night" => v !== null);
    return out.length ? out : undefined;
};

// --- Transformers ---

function transformClasses(answers: QAAnswers): Category | null {
    const classIds = answers["school_classes"];
    if (!Array.isArray(classIds) || classIds.length === 0) return null;

    const children: ObligationChild[] = classIds.map((classCode: string) => {
        const id = `class_${classCode.toLowerCase()}`;
        const alias = (answers[`${id}_alias`] || "").toString().trim();
        const name = alias || classCode;
        const relativePriority = normalizePriority(answers[`${id}_priority`]);
        const studyHours = parseFloat(answers[`${id}_study_hours`] || "0");
        const preferredTimeBlocks = normalizePreferredTimes(answers[`${id}_pref_times`]);

        const meetingDays = answers[`${id}_meeting_days`] || [];
        const meetingTime = answers[`${id}_meeting_time`] || { start: "09:00 AM", end: "10:00 AM" };
        const meetingTimes = buildMeetingTimes(meetingDays, meetingTime.start, meetingTime.end);

        // Interpret max session length: numbers <= 10 mean hours; larger numbers mean minutes
        const sessionRaw = Number(answers["school_max_session_length"]);
        const sessionHours = Number.isFinite(sessionRaw) && sessionRaw > 0
            ? (sessionRaw <= 10 ? sessionRaw : sessionRaw / 60)
            : 2;
        const noGoDays = Array.isArray(answers["school_no_go_times"]) ? answers["school_no_go_times"] : undefined;

        return {
            id,
            name,
            relativePriority,
            maxStretch: sessionHours,
            meetingTimes,
            preferredTimeBlocks,
            // NEW: exact weekly study hours for this class (not including meetings)
            weeklyHours: Number.isFinite(studyHours) && studyHours > 0 ? studyHours : undefined,
            // study no-go days
            noGoDays,
        };
    });

    return {
        id: "school",
        name: "School",
        priority: normalizePriority(answers["school_priority"]),
        children,
    };
}

function transformActivityGroup(
    answers: QAAnswers,
    groupKey: string,
    fieldKey: string
): Category | null {
    const activities = answers[fieldKey];
    if (!Array.isArray(activities)) return null;

    const children: ObligationChild[] = activities.map((act: any, index: number) => ({
        id: `${groupKey}_${index}`,
        name: act.activity,
        relativePriority: normalizePriority(act.priority),
        maxStretch: 2,
        preferredTimeBlocks: normalizePreferredTimes(act.preferredTimes),
        // Session constraints
        timesPerWeek: Number.isFinite(Number(act?.timesPerWeek)) ? Number(act?.timesPerWeek) : undefined,
        timesPerDay: Number.isFinite(Number(act?.timesPerDay)) ? Number(act?.timesPerDay) : 1,
        durationMinutes: Number.isFinite(Number(act?.durationMinutes)) ? Number(act?.durationMinutes) : undefined,
        // Optional post-session rest (only meaningful for exercise)
        ...(groupKey === "exercise" && Number.isFinite(Number(act?.restPeriodMinutes)) && Number(act?.restPeriodMinutes) > 0
            ? { restMinutes: Number(act?.restPeriodMinutes) }
            : {}),
        // Compute weekly hours when possible for apportioning
        weeklyHours: ((): number | undefined => {
            const w = Number(act?.timesPerWeek);
            const dm = Number(act?.durationMinutes);
            if (Number.isFinite(w) && Number.isFinite(dm) && w > 0 && dm > 0) return (w * dm) / 60;
            return undefined;
        })(),
        // Strict intervals -> turn into meetingTimes
        ...(act?.strictSchedule && act?.strictIntervals && typeof act.strictIntervals === 'object'
            ? {
                meetingTimes: Object.entries(act.strictIntervals as Record<string, Array<{ start: string; end: string }>>)
                    .flatMap(([day, arr]) => (Array.isArray(arr) ? arr : [])
                        .map(({ start, end }) => ({ day, start: parseTimeToHHMM(start)!, end: parseTimeToHHMM(end)! }))
                    )
                    .filter(mt => mt.start != null && mt.end != null) as any,
            }
            : {}),
    }));

    return {
        id: groupKey,
        name: groupKey[0].toUpperCase() + groupKey.slice(1),
        priority: normalizePriority(answers[`${groupKey}_priority`]),
        children,
    };
}

function transformWork(answers: QAAnswers): Category | null {
    if (!answers["work_is_employed"]) return null;
    const children: ObligationChild[] = [];

    // Fixed shifts
    if (answers["work_has_fixed_shifts"] && typeof answers["work_fixed_shift_times"] === 'object') {
        const intervals = answers["work_fixed_shift_times"] as Record<string, Array<{ start: string; end: string }>>;
        const mts: MeetingTime[] = [];
        for (const [day, arr] of Object.entries(intervals)) {
            (arr || []).forEach(({ start, end }) => {
                const s = parseTimeToHHMM(start);
                const e = parseTimeToHHMM(end);
                if (s != null && e != null) mts.push({ day, start: s, end: e });
            });
        }
        if (mts.length) {
            children.push({
                id: "work_fixed",
                name: "Work Shift",
                relativePriority: 1,
                meetingTimes: mts,
                maxStretch: 2,
            } as any);
        }
    }

    // NOTE: Do not schedule generic flexible "Work Tasks" blocks.
    // Only fixed shifts appear in the schedule to avoid confusing extra blocks.

    if (!children.length) return null;
    return {
        id: "work",
        name: "Work",
        priority: normalizePriority(answers["work_priority"]),
        children,
    };
}

function transformSocial(answers: QAAnswers): Category | null {
    if (!answers["social_boolean"]) return null;
    const children: ObligationChild[] = [];

    // Recurring obligations as fixed meetings
    const rec: string[] = Array.isArray(answers["social_recurring_obligations"]) ? answers["social_recurring_obligations"] : [];
    for (const name of rec) {
        const key = `social_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}_intervals`;
        const intervals = answers[key] as Record<string, Array<{ start: string; end: string }>> | undefined;
        if (intervals && typeof intervals === 'object') {
            const mts: MeetingTime[] = [];
            for (const [day, arr] of Object.entries(intervals)) {
                (arr || []).forEach(({ start, end }) => {
                    const s = parseTimeToHHMM(start);
                    const e = parseTimeToHHMM(end);
                    if (s != null && e != null) mts.push({ day, start: s, end: e });
                });
            }
            if (mts.length) children.push({ id: `social_${name}`, name, relativePriority: 0.5, meetingTimes: mts, maxStretch: 2 } as any);
        }
    }

    // Flexible social hours target
    const hours = Number(answers["social_hours_target"]);
    if (Number.isFinite(hours) && hours > 0) {
        children.push({
            id: "social_flex",
            name: "Socializing",
            relativePriority: 0.5,
            weeklyHours: hours,
            maxStretch: 2,
            preferredTimeBlocks: normalizePreferredTimes(answers["social_time_prefs"]) || ["evening"],
        } as any);
    }

    if (!children.length) return null;
    return {
        id: "social",
        name: "Social",
        priority: normalizePriority(answers["social_priority"]),
        children,
    };
}

function transformSleep(answers: QAAnswers): Category | null {
    const nightlyHours = parseFloat(answers["sleep_hours_per_night"] || "8");
    const bedtime = parseTimeToHHMM(answers["sleep_earliest_bedtime"] || "10:00 PM");
    const latestWake = parseTimeToHHMM(answers["sleep_latest_wake"] || "07:00 AM");

    // Compute category priority so weekly blocks ~= desired sleep per week
    const weeklyBlocksDesired = Math.max(0, nightlyHours) * 7 * 4; // 4 blocks/hour
    const BLOCKS_PER_WEEK = 96 * 7;
    const catPriority = weeklyBlocksDesired / BLOCKS_PER_WEEK; // 0..1

    const children: ObligationChild[] = [
        {
            id: "night-sleep",
            name: "Night Sleep",
            relativePriority: 1,
            maxStretch: 9,
            preferredTimeBlocks: ["night"],
            // Hints consumed by the scheduler
            desiredNightlyHours: Math.max(0, nightlyHours),
            earliestBedtimeHHMM: bedtime,
            latestWakeHHMM: latestWake,
        } as ObligationChild,
    ];

    // Optional daily nap if enabled
    if (answers["sleep_naps"]) {
        const napLenRaw = Number(answers["nap-length"]);
        const napLenMin = Number.isFinite(napLenRaw) ? Math.max(45, napLenRaw) : 0; // enforce min 45 minutes
        const napPref = normalizePreferredTimes(answers["sleep_nap_windows"]) || ["afternoon"];
        if (napLenMin > 0) {
            children.push({
                id: "daily-nap",
                name: "Nap",
                relativePriority: 0.2,
                weeklyHours: (napLenMin / 60) * 7,
                maxStretch: Math.max(0.75, napLenMin / 60), // allow up to nap length; min 45m
                preferredTimeBlocks: napPref,
                timesPerDay: 1,
                durationMinutes: napLenMin,
            } as ObligationChild);
        }
    }

    return {
        id: "sleep",
        name: "Sleep",
        priority: Math.max(0, Math.min(1, catPriority)),
        children,
    };
}

// --- Main Entry Point ---

export function qaAnswersToCategories(answers: QAAnswers): Category[] {
    const categories: Category[] = [];

    const school = transformClasses(answers);
    if (school) categories.push(school);

    const sleep = transformSleep(answers);
    if (sleep) categories.push(sleep);

    const selfcare = transformActivityGroup(answers, "selfcare", "selfcare_activities");
    if (selfcare) categories.push(selfcare);

    const exercise = transformActivityGroup(answers, "exercise", "exercise_activities");
    if (exercise) categories.push(exercise);

    const leisure = transformActivityGroup(answers, "leisure", "leisure_activities");
    if (leisure) categories.push(leisure);

    const work = transformWork(answers);
    if (work) categories.push(work);

    const social = transformSocial(answers);
    if (social) categories.push(social);

    return categories;
}
