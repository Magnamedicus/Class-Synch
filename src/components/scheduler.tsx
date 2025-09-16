import React, {
    useState,
    forwardRef,
    useImperativeHandle,
} from "react";
import { generateSchedule } from "../utils/simulatedAnnealingScheduler";
import type {
    Schedule,
    Category,
    MeetingTime,
} from "../utils/simulatedAnnealingScheduler";
import { ScheduleGrid } from "./ScheduleGrid";
import "../css/Modal.css";
import "../css/scheduler.css";

/** ===========================
 * Public ref handle (exported)
 * =========================== */
export interface SchedulerHandle {
    generate: () => Schedule; // returns the generated schedule
}

/** ===========================
 * Fallback demo categories
 * =========================== */
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
                name: "NightSleep",
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
                name: "FriendHang",
                relativePriority: 0.7,
                maxStretch: 3.0,
                preferredTimeBlocks: ["evening"],
                dependencyIds: [],
            },
            {
                id: "family",
                name: "FamilyTime",
                relativePriority: 0.3,
                maxStretch: 2.5,
                preferredTimeBlocks: ["evening"],
                dependencyIds: [],
            },
        ],
    },
];

/** ===========================
 * Time parsing helpers
 * Accept "09:00", "930", "12:30 PM", or numbers like 1330
 * =========================== */
function parseTimeToHHMM(input: unknown): number | undefined {
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input !== "string") return undefined;

    const s = input.trim();

    const ampm = s.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)$/i);
    if (ampm) {
        let h = parseInt(ampm[1], 10);
        const m = parseInt(ampm[2] || "0", 10);
        const suffix = ampm[3].toUpperCase();
        if (h === 12) h = 0;       // 12 AM -> 0
        if (suffix === "PM") h += 12;
        return h * 100 + m;
    }

    const colon = s.match(/^(\d{1,2}):(\d{2})$/);
    if (colon) {
        const h = parseInt(colon[1], 10);
        const m = parseInt(colon[2], 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 100 + m;
    }

    const compact = s.match(/^(\d{3,4})$/);
    if (compact) {
        const val = parseInt(compact[1], 10);
        const h = Math.floor(val / 100);
        const m = val % 100;
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 100 + m;
    }

    return undefined;
}

function coerceMeetingTimes(raw: any): MeetingTime[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((mt) => {
            const day =
                typeof mt?.day === "string" ? mt.day.toLowerCase() : undefined;
            const start = parseTimeToHHMM(mt?.start);
            const end = parseTimeToHHMM(mt?.end);
            if (!day || start == null || end == null) return null;
            return { day, start, end } as MeetingTime;
        })
        .filter(Boolean) as MeetingTime[];
}

/** ===========================
 * Adapt activeProfile → Category[]
 * =========================== */
function profileToCategories(profile: any): Category[] {
    const buckets = Array.isArray(profile?.buckets) ? profile.buckets : [];

    return buckets.map((bucket: any, i: number) => {
        const obligations = Array.isArray(bucket?.obligations)
            ? bucket.obligations
            : [];

        const children = obligations.map((ob: any, j: number) => ({
            id: ob?.id ?? `ob-${i}-${j}`,
            name: ob?.name ?? `Obligation ${j + 1}`,
            relativePriority:
                typeof ob?.priority === "number"
                    ? ob.priority / 100
                    : 1 / Math.max(obligations.length, 1),
            maxStretch: typeof ob?.maxStretch === "number" ? ob.maxStretch : 1.0,
            preferredTimeBlocks: Array.isArray(ob?.preferredTimeBlocks)
                ? ob.preferredTimeBlocks
                : undefined,
            dependencyIds: Array.isArray(ob?.dependencyIds)
                ? ob.dependencyIds
                : [],
            meetingTimes: coerceMeetingTimes(ob?.meetingTimes),
        }));

        const sum = children.reduce((s, c) => s + (c.relativePriority ?? 0), 0);
        const normalizedChildren =
            sum > 0.0001
                ? children.map((c) => ({
                    ...c,
                    relativePriority: (c.relativePriority ?? 0) / sum,
                }))
                : children.map((c) => ({
                    ...c,
                    relativePriority: 1 / Math.max(children.length, 1),
                }));

        return {
            id: bucket?.id ?? `cat-${i}`,
            name: bucket?.name ?? `Category ${i + 1}`,
            priority:
                typeof bucket?.priority === "number"
                    ? bucket.priority / 100
                    : 1 / Math.max(buckets.length, 1),
            children: normalizedChildren,
        } as Category;
    });
}

function getActiveCategories(): Category[] {
    try {
        const raw = localStorage.getItem("activeProfile");
        if (!raw) return FALLBACK_CATEGORIES;
        const parsed = JSON.parse(raw);
        const mapped = profileToCategories(parsed);
        return mapped.length ? mapped : FALLBACK_CATEGORIES;
    } catch (e) {
        console.warn("Failed to read activeProfile; using fallback categories.", e);
        return FALLBACK_CATEGORIES;
    }
}

/** ===========================
 * Component
 * =========================== */
const Scheduler = forwardRef<SchedulerHandle, Record<string, never>>((_, ref) => {
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [ms, setMs] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<{
        day: string;
        startIdx: number;
        length: number;
        label: string;
    } | null>(null);

    const [newLabel, setNewLabel] = useState<string>("");
    const [newLength, setNewLength] = useState<number>(1);

    const persist = (s: Schedule) => {
        try {
            localStorage.setItem("lastSchedule", JSON.stringify(s));
        } catch (e) {
            console.warn("Unable to persist schedule to localStorage:", e);
        }
    };

    /** Main generate entrypoint (exposed via ref) */
    const handleGenerateSchedule = (): Schedule => {
        setLoading(true);
        setModalOpen(false);

        const categories = getActiveCategories();

        const t0 = performance.now();
        const result = generateSchedule(categories);
        const t1 = performance.now();

        setSchedule(result);
        setMs(t1 - t0);
        persist(result);

        setTimeout(() => setLoading(false), 0);

        console.log(`Generated Weekly Schedule in ${Math.round(t1 - t0)} ms`, result);
        return result;
    };

    useImperativeHandle(ref, () => ({
        generate: handleGenerateSchedule,
    }));

    // Block click -> open modal
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

    // Modal actions
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

        setSchedule(updated);
        persist(updated);
        setModalOpen(false);
    };

    // for modal dropdown options
    const currentCategories = getActiveCategories();
    const allObligations = currentCategories.flatMap((cat) =>
        cat.children.map((child) => child.name)
    );

    const blockEnd = selected ? selected.startIdx + newLength : null;

    return (
        <div style={{ padding: 16 }}>
            {/* Loading overlay */}
            {loading && (
                <div className="loading-overlay">
                    <div className="loading-message">
                        <div className="spinner"></div>
                        Making Your Schedule...
                    </div>
                </div>
            )}

            {/* Perf info */}
            {ms !== null && (
                <div style={{ marginBottom: 8 }}>
                    Generated in {Math.round(ms)} ms
                </div>
            )}

            {/* Grid */}
            {schedule && (
                <ScheduleGrid schedule={schedule} onBlockClick={handleBlockClick} />
            )}

            {/* Edit modal */}
            {modalOpen && selected && (
                <div className="modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Modify Block</h3>
                        <p>
                            {selected.label} • {selected.length * 15} minutes
                        </p>

                        <div className="modal-form">
                            <label>
                                Change to:
                                <select
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                >
                                    {allObligations.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                Length: {newLength * 15} minutes
                                <input
                                    type="range"
                                    min={1}
                                    max={selected.length * 2}
                                    step={1}
                                    value={newLength}
                                    onChange={(e) => setNewLength(Number(e.target.value))}
                                />
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
