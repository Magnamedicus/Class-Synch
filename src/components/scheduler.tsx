import {
    useState,
    forwardRef,
    useImperativeHandle,
    useMemo,
    useEffect,
    useCallback,
} from "react";
import { generateSchedule } from "../utils/simulatedAnnealingScheduler";
import { qaAnswersToCategories } from "../utils/qaAnswersToCategories";
import { readAnswers } from "../utils/qaStorage";
import type {
    Schedule,
    Category,
    MeetingTime,
} from "../utils/simulatedAnnealingScheduler";
import { ScheduleGrid } from "./ScheduleGrid";
import TimeInput from "./inputs/TimeInput";
import "../css/Modal.css";
import "../css/scheduler.css";

/* =========================
   Types & handle exported
========================= */
export type SchedulerHandle = {
    generate: () => Promise<Schedule | void>;
    load: (s: Schedule) => void;
};

/* =========================
   Fallback demo categories
========================= */
const FALLBACK_CATEGORIES: Category[] = [
    {
        id: "school",
        name: "school-work",
        priority: 0.7,
        children: [
            {
                id: "bio101",
                name: "Biology-101",
                relativePriority: 0.4,
                maxStretch: 1.0,
                meetingTimes: [
                    { day: "monday", start: 800, end: 900 },
                    { day: "wednesday", start: 800, end: 900 },
                    { day: "friday", start: 800, end: 900 },
                ],
                preferredTimeBlocks: ["morning", "afternoon"],
                dependencyIds: [],
            },
            {
                id: "eng204",
                name: "English-204",
                relativePriority: 0.2,
                maxStretch: 2.0,
                meetingTimes: [
                    { day: "tuesday", start: 1330, end: 1530 },
                    { day: "thursday", start: 1330, end: 1530 },
                ],
                preferredTimeBlocks: ["morning", "afternoon"],
                dependencyIds: [],
            },
            {
                id: "chem301",
                name: "Chemistry-301",
                relativePriority: 0.4,
                maxStretch: 2.0,
                meetingTimes: [
                    { day: "tuesday", start: 900, end: 1100 },
                    { day: "thursday", start: 900, end: 1100 },
                ],
                preferredTimeBlocks: ["morning", "afternoon"],
                dependencyIds: [],
            },
        ],
    },
    {
        id: "rest",
        name: "Sleep",
        priority: 0.2,
        children: [
            {
                id: "night-sleep",
                name: "Night Sleep",
                relativePriority: 1.0,
                maxStretch: 8.0,
                preferredTimeBlocks: ["night"],
                dependencyIds: [],
            },
        ],
    },
    {
        id: "social",
        name: "Socializing",
        priority: 0.1,
        children: [
            {
                id: "friends",
                name: "Friend Hangout",
                relativePriority: 0.7,
                maxStretch: 3.0,
                preferredTimeBlocks: ["evening"],
                dependencyIds: [],
            },
            {
                id: "family",
                name: "Family Time",
                relativePriority: 0.3,
                maxStretch: 2.5,
                preferredTimeBlocks: ["evening"],
                dependencyIds: [],
            },
        ],
    },
];

/* =========================
   Build categories from saved answers
========================= */

function getUserCategories(): Category[] {
    try {
        const curRaw = localStorage.getItem("currentUser");
        const cur = curRaw ? JSON.parse(curRaw) as { email?: string } : null;
        if (!cur?.email) return FALLBACK_CATEGORIES;
        const answers = readAnswers(cur.email);
        const cats = qaAnswersToCategories(answers);
        return cats.length ? cats : FALLBACK_CATEGORIES;
    } catch (e) {
        console.warn("Failed to load questionnaire answers; using fallback categories.", e);
        return FALLBACK_CATEGORIES;
    }
}

/* Yield to the browser so the overlay can paint */
const nextPaint = () =>
    new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

/* =========================
   Component
========================= */

const Scheduler = forwardRef<SchedulerHandle>((_props, ref) => {
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [ms, setMs] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<{
        day: string;
        startIdx: number;
        length: number;
        label: string;
    } | null>(null);
    const [createMode, setCreateMode] = useState<boolean>(false);

    const [newLabel, setNewLabel] = useState<string>("");
    const [newLength, setNewLength] = useState<number>(1);
    const [toast, setToast] = useState<string>("");
    const [moveCandidate, setMoveCandidate] = useState<{
        fromDay: string;
        startIdx: number;
        length: number;
        label: string;
    } | null>(null);
    const [swapPrompt, setSwapPrompt] = useState<{
        from: { day: keyof Schedule; startIdx: number; length: number; label: string };
        to: { day: keyof Schedule; startIdx: number; length: number; label: string };
    } | null>(null);

    // Resolve display alias for labels and optional original code for hover tooltips
    const labelToDisplay = useCallback((label: string): string => {
        try {
            const cur = localStorage.getItem("currentUser");
            const { email } = cur ? JSON.parse(cur) : {};
            if (!email) return label;
            const ans = readAnswers(email);
            const suffixMatch = label.match(/ \((Class Meeting|Studying)\)$/i);
            const suffix = suffixMatch ? suffixMatch[0] : "";
            const base = label.replace(/ \((Class Meeting|Studying)\)$/i, "");
            const classes: string[] = Array.isArray(ans?.school_classes) ? (ans.school_classes as string[]) : [];
            const findSlug = (name: string): string => {
                const hit = classes.find((c) => c.toLowerCase() === name.toLowerCase());
                if (hit) return hit.toLowerCase();
                for (const code of classes) {
                    const a = (ans[`class_${code.toLowerCase()}_alias`] || "").toString().trim();
                    if (a && a.toLowerCase() === name.toLowerCase()) return code.toLowerCase();
                }
                return name.toLowerCase();
            };
            const slug = findSlug(base);
            const alias = (ans[`class_${slug}_alias`] || "").toString().trim();
            const newBase = alias || base;
            return newBase + suffix;
        } catch {
            return label;
        }
    }, []);

    const labelToOriginal = useCallback((label: string): string | undefined => {
        try {
            const cur = localStorage.getItem("currentUser");
            const { email } = cur ? JSON.parse(cur) : {};
            if (!email) return undefined;
            const ans = readAnswers(email);
            const base = label.replace(/ \((Class Meeting|Studying)\)$/i, "");
            const classes: string[] = Array.isArray(ans?.school_classes) ? (ans.school_classes as string[]) : [];
            const findSlug = (name: string): string => {
                const hit = classes.find((c) => c.toLowerCase() === name.toLowerCase());
                if (hit) return hit.toLowerCase();
                for (const code of classes) {
                    const a = (ans[`class_${code.toLowerCase()}_alias`] || "").toString().trim();
                    if (a && a.toLowerCase() === name.toLowerCase()) return code.toLowerCase();
                }
                return name.toLowerCase();
            };
            const slug = findSlug(base);
            const orig = (ans[`class_${slug}_original`] || "").toString().trim();
            return orig || undefined;
        } catch {
            return undefined;
        }
    }, []);

    // Live alias-to-label update when Profile saves a rename
    useEffect(() => {
        function onMerge(e: any) {
            if (!schedule) return;
            const patch = e?.detail?.patch || {};
            const aliasKeys = Object.keys(patch).filter((k) => /(^|_)class_[a-z0-9-]+_alias$/.test(k));
            if (!aliasKeys.length) return;
            // Read classes to map slug->code
            let classes: string[] = [];
            try {
                const currentUserRaw = localStorage.getItem('currentUser');
                const { email } = currentUserRaw ? JSON.parse(currentUserRaw) : {};
                if (email) {
                    const ans = readAnswers(email);
                    if (Array.isArray(ans?.school_classes)) classes = ans.school_classes as string[];
                }
            } catch {}
            const next: Schedule = {
                monday: [...schedule.monday],
                tuesday: [...schedule.tuesday],
                wednesday: [...schedule.wednesday],
                thursday: [...schedule.thursday],
                friday: [...schedule.friday],
                saturday: [...schedule.saturday],
                sunday: [...schedule.sunday],
            };
            for (const key of aliasKeys) {
                const alias = (patch[key] || '').trim();
                const slug = key.replace(/^.*class_/, '').replace(/_alias$/, '');
                const code = classes.find((c) => c.toLowerCase() === slug) || '';
                if (!alias && !code) continue;
                const replaceBase = (row: (string | null)[]) => {
                    for (let i = 0; i < row.length; i++) {
                        const lab = row[i];
                        if (!lab) continue;
                        const m = lab.match(/^(.*) \((Class Meeting|Studying)\)$/i);
                        const suffix = m ? ` (${m[2]})` : '';
                        const base = m ? m[1] : lab;
                        if (base === code || base === alias) {
                            const newBase = alias || code;
                            const newLabel = suffix ? newBase + suffix : newBase;
                            row[i] = newLabel;
                        }
                    }
                };
                replaceBase(next.monday);
                replaceBase(next.tuesday);
                replaceBase(next.wednesday);
                replaceBase(next.thursday);
                replaceBase(next.friday);
                replaceBase(next.saturday);
                replaceBase(next.sunday);
            }
                        setSchedule(next);
            persist(next);

            // Also update persisted schedules (lastSchedule + savedSchedules)
            try {
                const last = localStorage.getItem("lastSchedule");
                if (last) {
                    const obj = JSON.parse(last);
                    const rows: Array<keyof Schedule> = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as any;
                    const doReplace = (row: (string|null)[]) => {
                        for (const key of aliasKeys) {
                            const a = (patch[key] || '').trim();
                            const slug = key.replace(/^.*class_/, '').replace(/_alias$/, '');
                            const code = classes.find((c) => c.toLowerCase() === slug) || '';
                            for (let i = 0; i < row.length; i++) {
                                const lab = row[i];
                                if (!lab) continue;
                                const m = lab.match(/^(.*) \((Class Meeting|Studying)\)$/i);
                                const suffix = m ? ` (${m[2]})` : '';
                                const base = m ? m[1] : lab;
                                if (base === code || base === a) {
                                    const newBase = a || code;
                                    const newLabel = suffix ? newBase + suffix : newBase;
                                    row[i] = newLabel;
                                }
                            }
                        }
                    };
                    for (const k of rows) doReplace(obj[k]);
                    localStorage.setItem("lastSchedule", JSON.stringify(obj));
                }
            } catch {}
            try {
                const rawList = localStorage.getItem("savedSchedules");
                if (rawList) {
                    const list = JSON.parse(rawList);
                    if (Array.isArray(list)) {
                        for (const entry of list) {
                            if (entry && entry.schedule) {
                                const rows: Array<keyof Schedule> = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as any;
                                const sch = entry.schedule;
                                const doReplace = (row: (string|null)[]) => {
                                    for (const key of aliasKeys) {
                                        const a = (patch[key] || '').trim();
                                        const slug = key.replace(/^.*class_/, '').replace(/_alias$/, '');
                                        const code = classes.find((c) => c.toLowerCase() === slug) || '';
                                        for (let i = 0; i < row.length; i++) {
                                            const lab = row[i];
                                            if (!lab) continue;
                                            const m = lab.match(/^(.*) \((Class Meeting|Studying)\)$/i);
                                            const suffix = m ? ` (${m[2]})` : '';
                                            const base = m ? m[1] : lab;
                                            if (base === code || base === a) {
                                                const newBase = a || code;
                                                const newLabel = suffix ? newBase + suffix : newBase;
                                                row[i] = newLabel;
                                            }
                                        }
                                    }
                                };
                                for (const k of rows) doReplace(sch[k]);
                            }
                        }
                        localStorage.setItem("savedSchedules", JSON.stringify(list));
                    }
                }
            } catch {}setSchedule(next);
            persist(next);
        }
        window.addEventListener('qa:merge-answers', onMerge as any);
        return () => window.removeEventListener('qa:merge-answers', onMerge as any);
    }, [schedule]);
    const [bedTime, setBedTime] = useState<string>("10:00 PM");
    const [wakeTime, setWakeTime] = useState<string>("07:00 AM");

    const BLOCKS_PER_HOUR = 4;
    const hhmmToBlock = (hhmm: number) => {
        const h = Math.floor(hhmm / 100);
        const m = hhmm % 100;
        return h * BLOCKS_PER_HOUR + Math.floor(m / 15);
    };
    const parseTimeToHHMM = (t: string): number | null => {
        if (!t) return null;
        const s = t.trim();
        const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (m12) {
            let h = parseInt(m12[1], 10);
            const mm = parseInt(m12[2], 10);
            const ap = m12[3].toUpperCase();
            if (h === 12) h = 0;
            if (ap === "PM") h += 12;
            return h * 100 + mm;
        }
        const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
        if (m24) {
            const h = parseInt(m24[1], 10);
            const mm = parseInt(m24[2], 10);
            return h * 100 + mm;
        }
        return null;
    };

    // If user switches the label to Night Sleep in the dropdown, seed override inputs
    useEffect(() => {
        if (newLabel && newLabel.toLowerCase().includes("night sleep")) {
            setBedTime("10:00 PM");
            setWakeTime("07:00 AM");
        }
    }, [newLabel]);

    const persist = (s: Schedule) => {
        try {
            localStorage.setItem("lastSchedule", JSON.stringify(s));
        } catch (e) {
            console.warn("Unable to persist schedule to localStorage:", e);
        }
    };

    // Restore last saved schedule on mount so it persists across navigation
    useEffect(() => {
        try {
            const stored = localStorage.getItem('lastSchedule');
            if (stored) {
                const parsed = JSON.parse(stored) as Schedule;
                if (parsed && parsed.monday && parsed.sunday) {
                    setSchedule(parsed);
                }
            }
        } catch (e) {
            console.warn('Failed to restore lastSchedule:', e);
        }
    }, []);

    const handleGenerateSchedule = async (): Promise<Schedule | void> => {
        try {
            setLoading(true);
            await nextPaint(); // ensure overlay is visible

            const categories = getUserCategories();
            const t0 = performance.now();
            const result = generateSchedule(categories);
            const t1 = performance.now();

            setSchedule(result);
            setMs(t1 - t0);
            persist(result);
            try { localStorage.setItem('scheduleClosed', 'false'); } catch {}
            return result;
        } catch (err) {
            console.error("❌ Error generating schedule:", err);
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        generate: handleGenerateSchedule,
        load: (s: Schedule) => {
            setSchedule(s);
            try {
                localStorage.setItem('lastSchedule', JSON.stringify(s));
                localStorage.setItem('scheduleClosed', 'false');
            } catch {}
        },
    }));

const handleBlockClick = (
        day: string,
        block: { startIdx: number; length: number; label: string },
        _blockType: string
    ) => {
        if (moveCandidate) {
            setSwapPrompt({
                from: { day: moveCandidate.fromDay as keyof Schedule, startIdx: moveCandidate.startIdx, length: moveCandidate.length, label: moveCandidate.label },
                to: { day: day as keyof Schedule, startIdx: block.startIdx, length: block.length, label: block.label },
            });
            setMoveCandidate(null);
            return;
        }
        setSelected(block ? { ...block, day } : null);
        setNewLabel(block.label);
        setNewLength(block.length);
        setModalOpen(true);
        setCreateMode(false);
        if (block.label.toLowerCase().includes("night sleep")) {
            setBedTime("10:00 PM");
            setWakeTime("07:00 AM");
        }
    };

    const clearBlock = () => {
        if (!schedule || !selected) return;
        const updated = { ...schedule, [selected.day]: [...schedule[selected.day]] };
        for (let i = selected.startIdx; i < selected.startIdx + selected.length; i++) {
            updated[selected.day][i] = null;
        }
        setSchedule(updated);
        persist(updated);
        setModalOpen(false);
    };

    // Merge identical labels separated by a small gap (<= 1 block) on a single row
    const mergeNearIdenticalsOnRow = (row: (string | null)[], maxGap = 1) => {
        let changed = true;
        while (changed) {
            changed = false;
            let i = 0;
            while (i < row.length) {
                const lab = row[i];
                if (!lab) { i++; continue; }
                let j = i + 1;
                while (j < row.length && row[j] === lab) j++;
                let g = j;
                while (g < row.length && row[g] === null) g++;
                if (g < row.length && (g - j) > 0 && (g - j) <= maxGap) {
                    let k = g;
                    while (k < row.length && row[k] === lab) k++;
                    if (k > g) {
                        for (let p = j; p < g; p++) row[p] = lab;
                        changed = true;
                        j = k;
                    }
                }
                i = j;
            }
        }
    };

    const getContiguousBlock = (row: (string | null)[], at: number): { startIdx: number; length: number; label: string } | null => {
        if (at < 0 || at >= row.length) return null;
        const lab = row[at];
        if (!lab) return null;
        let i = at;
        while (i > 0 && row[i - 1] === lab) i--;
        let j = at + 1;
        while (j < row.length && row[j] === lab) j++;
        return { startIdx: i, length: j - i, label: lab };
    };

    const updateBlock = () => {
        if (!schedule || !selected) return;
        const updated = { ...schedule, [selected.day]: [...schedule[selected.day]] };

        if (createMode) {
            // Place new block into contiguous free space starting at startIdx
            const end = selected.startIdx + newLength;
            for (let i = selected.startIdx; i < end; i++) {
                if (updated[selected.day][i] !== null) {
                    setToast("Space is no longer free here");
                    return;
                }
            }
            for (let i = selected.startIdx; i < end; i++) {
                if (i < updated[selected.day].length) updated[selected.day][i] = newLabel;
            }
        } else {
            // Edit existing block: clear then re-write at same start
            for (let i = selected.startIdx; i < selected.startIdx + selected.length; i++) {
                updated[selected.day][i] = null;
            }
            for (let i = selected.startIdx; i < selected.startIdx + newLength; i++) {
                if (i < updated[selected.day].length) {
                    updated[selected.day][i] = newLabel;
                }
            }
        }

        // After manual edit, merge any identical labels separated by <= 1 block on this day
        mergeNearIdenticalsOnRow(updated[selected.day]);

        setSchedule(updated);
        persist(updated);
        setModalOpen(false);
        setCreateMode(false);
    };

    const currentCategories = getUserCategories();

    // Format minutes as "X hours and Y minutes" when >= 60
    const formatMinutes = (mins: number) => {
        if (mins < 60) return `${mins} minutes`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const hPart = `${h} ${h === 1 ? 'hour' : 'hours'}`;
        if (m === 0) return hPart;
        const mPart = `${m} ${m === 1 ? 'minute' : 'minutes'}`;
        return `${hPart} and ${mPart}`;
    };

    // Build dropdown options from what's currently visible on the grid,
    // so user can convert any block into any label that exists on the schedule.
    const labelOptions: string[] = useMemo(() => {
        const set = new Set<string>();
        if (schedule) {
            Object.values(schedule).forEach((row) => {
                row.forEach((lab) => { if (lab) set.add(lab); });
            });
        }
        if (selected?.label) set.add(selected.label);
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [schedule, selected?.label]);
    const blockEnd = selected ? selected.startIdx + newLength : null;

    // Compute how many 15m blocks are free to the right of the selected block
    const freeExtendRight = useMemo(() => {
        if (!schedule || !selected) return 0;
        const row = schedule[selected.day as keyof Schedule];
        if (!row) return 0;
        let free = 0;
        for (let i = selected.startIdx + selected.length; i < row.length; i++) {
            if (row[i] === null) free++;
            else break;
        }
        return free;
    }, [schedule, selected?.day, selected?.startIdx, selected?.length]);

    // When creating a new block, contiguous free space starting at the selected cell
    const freeFromStart = useMemo(() => {
        if (!schedule || !selected || !createMode) return 0;
        const row = schedule[selected.day as keyof Schedule];
        if (!row) return 0;
        let free = 0;
        for (let i = selected.startIdx; i < row.length; i++) {
            if (row[i] === null) free++;
            else break;
        }
        return free;
    }, [schedule, selected?.day, selected?.startIdx, createMode]);

    return (
        <div style={{ padding: 16 }}>
            {/* Loading Overlay */}
            {loading && (
                <div className="loading-overlay">
                    <div className="loading-card">
                        <div className="loading-title pulse">Making Your Schedule</div>
                        <div className="loading-spinner" aria-label="loading" />
                    </div>
                </div>
            )}

            {ms !== null && (
                <div style={{ marginBottom: 8 }}>
                    Generated in {Math.round(ms)} ms
                </div>
            )}

            {schedule && (
                <ScheduleGrid
                    
                    schedule={schedule}
                    onBlockClick={handleBlockClick}
                    onRequestSwap={(from, to) => {
                        setSwapPrompt({
                            from: { day: from.fromDay as keyof Schedule, startIdx: from.startIdx, length: from.length, label: from.label },
                            to: { day: to.day as keyof Schedule, startIdx: to.startIdx, length: to.length, label: to.label },
                        });
                    }}
                    onMoveBlock={(fromDay, fromStartIdx, length, label, toDay, toStartIdx) => {
                        setSchedule((prev) => {
                            if (!prev) return prev;
                            // bounds
                            if (toStartIdx < 0 || toStartIdx + length > prev[toDay].length) {
                                setToast("Cannot drop: destination out of bounds");
                                return prev;
                            }
                            // check destination free
                            const sameDay = fromDay === toDay;
                            const srcStart = fromStartIdx;
                            const srcEnd = fromStartIdx + length; // exclusive
                            for (let k = 0; k < length; k++) {
                                const pos = toStartIdx + k;
                                const occupied = prev[toDay][pos] !== null;
                                const overlapsSource = sameDay && pos >= srcStart && pos < srcEnd;
                                if (occupied && !overlapsSource) {
                                    const target = getContiguousBlock(prev[toDay], toStartIdx);
                                    if (target) {
                                        setSwapPrompt({
                                            from: { day: fromDay as keyof Schedule, startIdx: fromStartIdx, length, label },
                                            to: { day: toDay as keyof Schedule, startIdx: target.startIdx, length: target.length, label: target.label },
                                        });
                                        return prev;
                                    }
                                    setToast("Cannot drop: destination occupied");
                                    return prev;
                                }
                            }
                            const next: Schedule = {
                                monday: [...prev.monday],
                                tuesday: [...prev.tuesday],
                                wednesday: [...prev.wednesday],
                                thursday: [...prev.thursday],
                                friday: [...prev.friday],
                                saturday: [...prev.saturday],
                                sunday: [...prev.sunday],
                            };
                            // clear source
                            for (let k = 0; k < length; k++) {
                                next[fromDay as keyof Schedule][fromStartIdx + k] = null;
                            }
                            // place at destination
                            for (let k = 0; k < length; k++) {
                                next[toDay as keyof Schedule][toStartIdx + k] = label;
                            }
                            // Merge identical labels with tiny gaps on involved days
                            mergeNearIdenticalsOnRow(next[fromDay as keyof Schedule]);
                            mergeNearIdenticalsOnRow(next[toDay as keyof Schedule]);
                            persist(next);
                            return next;
                        });
                    }}
                    onStartTapMove={(payload) => {
                        setMoveCandidate(payload);
                        setToast("Select a target cell to move here");
                    }}
                    onCellClick={(day, idx) => {
                        if (!schedule) return;
                        // If we are in tap-to-move mode, place the move
                        if (moveCandidate) {
                            const { fromDay, startIdx, length, label } = moveCandidate;
                            const destEnd = idx + length;
                            if (idx < 0 || destEnd > schedule[day as keyof Schedule].length) {
                                setToast("Cannot place: out of bounds");
                                return;
                            }
                            const sameDay = fromDay === day;
                            const srcStart = startIdx;
                            const srcEnd = startIdx + length; // exclusive
                            for (let k = 0; k < length; k++) {
                                const pos = idx + k;
                                const occupied = schedule[day as keyof Schedule][pos] !== null;
                                const overlapsSource = sameDay && pos >= srcStart && pos < srcEnd;
                                if (occupied && !overlapsSource) {
                                    const target = getContiguousBlock(schedule[day as keyof Schedule], idx);
                                    if (target) {
                                        setSwapPrompt({
                                            from: { day: fromDay as keyof Schedule, startIdx, length, label },
                                            to: { day: day as keyof Schedule, startIdx: target.startIdx, length: target.length, label: target.label },
                                        });
                                        setMoveCandidate(null);
                                        return;
                                    }
                                    setToast("Cannot place: destination occupied");
                                    return;
                                }
                            }
                            const next: Schedule = {
                                monday: [...schedule.monday],
                                tuesday: [...schedule.tuesday],
                                wednesday: [...schedule.wednesday],
                                thursday: [...schedule.thursday],
                                friday: [...schedule.friday],
                                saturday: [...schedule.saturday],
                                sunday: [...schedule.sunday],
                            };
                            for (let k = 0; k < length; k++) next[fromDay as keyof Schedule][startIdx + k] = null;
                            for (let k = 0; k < length; k++) next[day as keyof Schedule][idx + k] = label;
                            mergeNearIdenticalsOnRow(next[fromDay as keyof Schedule]);
                            mergeNearIdenticalsOnRow(next[day as keyof Schedule]);
                            setSchedule(next);
                            persist(next);
                            setMoveCandidate(null);
                            setToast("Moved");
                            return;
                        }

                        // Otherwise, if the clicked cell is empty, open create modal
                        const row = schedule[day as keyof Schedule];
                        if (row && row[idx] === null) {
                            // Build options from current labels; if none, default to "Free"
                            const options = new Set<string>();
                            Object.values(schedule).forEach((r) => r.forEach((lab) => { if (lab) options.add(lab); }));
                            const first = options.values().next().value || "Study";
                            setSelected({ day, startIdx: idx, length: 1, label: first });
                            setNewLabel(first);
                            setNewLength(1);
                            setCreateMode(true);
                            setModalOpen(true);
                        }
                    }}
                />
            )}
            {toast && (
                <div className="toast" role="status" aria-live="polite" onAnimationEnd={() => setToast("")}>{toast}</div>
            )}

            {modalOpen && selected && (
                <div className="modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Modify Block</h3>
                        <p>
                            {selected.label} • {formatMinutes(selected.length * 15)}
                        </p>

                        <div className="modal-form">
                            <label>
                                Change to:
                                <select
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                >
                                    {labelOptions.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {newLabel.toLowerCase().includes("night sleep") && (
                                <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.25rem" }}>
                                    {/* If Night Sleep block is in PM (>= 12:00), show Bedtime */}
                                    {selected.startIdx >= (12 * BLOCKS_PER_HOUR) && (
                                        <label>
                                            Set Bed Time
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                <TimeInput value={bedTime} onChange={setBedTime} />
                                                <button type="button" onClick={() => {
                                                    if (!schedule) return;
                                                    const hhmm = parseTimeToHHMM(bedTime);
                                                    if (hhmm == null) { setToast("Invalid time"); return; }
                                                    const row = [...schedule[selected.day]];
                                                    const blockStart = selected.startIdx;
                                                    const blockEnd = selected.startIdx + selected.length;
                                                    const desiredStart = Math.max(0, Math.min(hhmmToBlock(hhmm), row.length));
                                                    if (desiredStart < blockStart) {
                                                        // Earlier bedtime: extend sleep earlier, overwriting anything
                                                        for (let i = desiredStart; i < blockStart; i++) row[i] = selected.label;
                                                    } else if (desiredStart > blockStart) {
                                                        // Later bedtime: shorten by clearing from current start up to desiredStart
                                                        const clearEnd = Math.min(desiredStart, blockEnd);
                                                        for (let i = blockStart; i < clearEnd; i++) row[i] = null;
                                                    }
                                                    const next = { ...schedule, [selected.day]: row } as Schedule;
                                                    setSchedule(next);
                                                    persist(next);
                                                    setToast("Bedtime set");
                                                    setModalOpen(false);
                                                }}>Apply Bedtime (override)</button>
                                            </div>
                                        </label>
                                    )}
                                    {/* If Night Sleep block is in AM (< 12:00), show Wake-up */}
                                    {selected.startIdx < (12 * BLOCKS_PER_HOUR) && (
                                        <label>
                                            Set Wake-up Time
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                <TimeInput value={wakeTime} onChange={setWakeTime} />
                                                <button type="button" onClick={() => {
                                                    if (!schedule) return;
                                                    const hhmm = parseTimeToHHMM(wakeTime);
                                                    if (hhmm == null) { setToast("Invalid time"); return; }
                                                    const row = [...schedule[selected.day]];
                                                    const blockStart = selected.startIdx;
                                                    const blockEnd = selected.startIdx + selected.length;
                                                    const desiredEnd = Math.max(0, Math.min(hhmmToBlock(hhmm), row.length));
                                                    if (desiredEnd > blockEnd) {
                                                        // Later wake: extend sleep later, overwriting anything
                                                        for (let i = blockEnd; i < desiredEnd; i++) row[i] = selected.label;
                                                    } else if (desiredEnd < blockEnd) {
                                                        // Earlier wake: shorten by clearing trailing part
                                                        for (let i = desiredEnd; i < blockEnd; i++) row[i] = null;
                                                    }
                                                    const next = { ...schedule, [selected.day]: row } as Schedule;
                                                    setSchedule(next);
                                                    persist(next);
                                                    setToast("Wake-up set");
                                                    setModalOpen(false);
                                                }}>Apply Wake-up (override)</button>
                                            </div>
                                        </label>
                                    )}
                                </div>
                            )}

                            <label>
                                Length: {formatMinutes(newLength * 15)}
                                <input
                                    type="range"
                                    min={1}
                                    max={createMode ? Math.max(1, freeFromStart) : (selected.length + freeExtendRight)}
                                    step={1}
                                    value={newLength}
                                    style={{
                                        // feed CSS variables for dynamic fill track
                                        // @ts-ignore - custom properties
                                        '--min': 1,
                                        // @ts-ignore
                                        '--max': createMode ? Math.max(1, freeFromStart) : (selected.length + freeExtendRight),
                                        // @ts-ignore
                                        '--value': newLength,
                                    } as React.CSSProperties}
                                    onChange={(e) => setNewLength(Number(e.target.value))}
                                />
                                <span style={{ fontSize: ".8rem", color: "#9ca3af" }}>
                                    Max available here: {formatMinutes(((createMode ? Math.max(1, freeFromStart) : (selected.length + freeExtendRight)) * 15))}
                                </span>
                            </label>

                            {blockEnd && (
                                <p style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
                                    Adjusted block runs from index {selected.startIdx} to {blockEnd}
                                </p>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button onClick={updateBlock}>Save</button>
                            <button onClick={clearBlock}>Clear</button>
                            <button onClick={() => setModalOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {swapPrompt && (
                <div className="modal-overlay" onClick={() => setSwapPrompt(null)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Swap These Blocks?</h3>
                        <p>Do you want to swap the positions of these blocks?</p>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            <li><strong>From:</strong> {swapPrompt.from.label}</li>
                            <li><strong>To:</strong> {swapPrompt.to.label}</li>
                        </ul>
                        <div className="modal-actions">
                            <button onClick={() => {
                                if (!schedule) { setSwapPrompt(null); return; }
                                const next: Schedule = {
                                    monday: [...schedule.monday],
                                    tuesday: [...schedule.tuesday],
                                    wednesday: [...schedule.wednesday],
                                    thursday: [...schedule.thursday],
                                    friday: [...schedule.friday],
                                    saturday: [...schedule.saturday],
                                    sunday: [...schedule.sunday],
                                };
                                const a = swapPrompt.from; const b = swapPrompt.to;
                                for (let i = 0; i < a.length; i++) next[a.day][a.startIdx + i] = b.label;
                                for (let i = 0; i < b.length; i++) next[b.day][b.startIdx + i] = a.label;
                                mergeNearIdenticalsOnRow(next[a.day]);
                                mergeNearIdenticalsOnRow(next[b.day]);
                                setSchedule(next);
                                persist(next);
                                setSwapPrompt(null);
                                setToast('Blocks swapped');
                            }}>Swap</button>
                            <button onClick={() => setSwapPrompt(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default Scheduler;



