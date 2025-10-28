import {
    useState,
    forwardRef,
    useImperativeHandle,
    useMemo,
    useEffect,
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

    const [newLabel, setNewLabel] = useState<string>("");
    const [newLength, setNewLength] = useState<number>(1);
    const [toast, setToast] = useState<string>("");
    const [moveCandidate, setMoveCandidate] = useState<{
        fromDay: string;
        startIdx: number;
        length: number;
        label: string;
    } | null>(null);

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
        setSelected(block ? { ...block, day } : null);
        setNewLabel(block.label);
        setNewLength(block.length);
        setModalOpen(true);
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

    const updateBlock = () => {
        if (!schedule || !selected) return;
        const updated = { ...schedule, [selected.day]: [...schedule[selected.day]] };

        for (let i = selected.startIdx; i < selected.startIdx + selected.length; i++) {
            updated[selected.day][i] = null;
        }
        for (let i = selected.startIdx; i < selected.startIdx + newLength; i++) {
            if (i < updated[selected.day].length) {
                updated[selected.day][i] = newLabel;
            }
        }

        // After manual edit, merge any identical labels separated by <= 1 block on this day
        mergeNearIdenticalsOnRow(updated[selected.day]);

        setSchedule(updated);
        persist(updated);
        setModalOpen(false);
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
                    onMoveBlock={(fromDay, fromStartIdx, length, label, toDay, toStartIdx) => {
                        setSchedule((prev) => {
                            if (!prev) return prev;
                            // bounds
                            if (toStartIdx < 0 || toStartIdx + length > prev[toDay].length) {
                                setToast("Cannot drop: destination out of bounds");
                                return prev;
                            }
                            // check destination free
                            for (let k = 0; k < length; k++) {
                                if (prev[toDay][toStartIdx + k] !== null) {
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
                        if (!moveCandidate || !schedule) return;
                        const { fromDay, startIdx, length, label } = moveCandidate;
                        // attempt move similar to onMoveBlock
                        const destEnd = idx + length;
                        if (idx < 0 || destEnd > schedule[day as keyof Schedule].length) {
                            setToast("Cannot place: out of bounds");
                            return;
                        }
                        for (let k = 0; k < length; k++) {
                            if (schedule[day as keyof Schedule][idx + k] !== null) {
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
                        // Merge identical labels with tiny gaps on involved days
                        mergeNearIdenticalsOnRow(next[fromDay as keyof Schedule]);
                        mergeNearIdenticalsOnRow(next[day as keyof Schedule]);
                        setSchedule(next);
                        persist(next);
                        setMoveCandidate(null);
                        setToast("Moved");
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

                            <label>
                                Length: {formatMinutes(newLength * 15)}
                                <input
                                    type="range"
                                    min={1}
                                    max={selected.length + freeExtendRight}
                                    step={1}
                                    value={newLength}
                                    style={{
                                        // feed CSS variables for dynamic fill track
                                        // @ts-ignore - custom properties
                                        '--min': 1,
                                        // @ts-ignore
                                        '--max': selected.length + freeExtendRight,
                                        // @ts-ignore
                                        '--value': newLength,
                                    } as React.CSSProperties}
                                    onChange={(e) => setNewLength(Number(e.target.value))}
                                />
                                <span style={{ fontSize: ".8rem", color: "#9ca3af" }}>
                                    Max available here: {formatMinutes((selected.length + freeExtendRight) * 15)}
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
        </div>
    );
});

export default Scheduler;
