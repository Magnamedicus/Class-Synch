import {
    useState,
    forwardRef,
    useImperativeHandle,
} from "react";
import { generateSchedule } from "../utils/simulatedAnnealingScheduler";
import type { Schedule, Category } from "../utils/simulatedAnnealingScheduler";
import { ScheduleGrid } from "./ScheduleGrid";
import "../css/Modal.css";
import "../css/Scheduler.css";

const CATEGORIES: Category[] = [
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

const Scheduler = forwardRef((props, ref) => {
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


    const handleGenerateSchedule = () => {
        setLoading(true);

        setTimeout(() => {
            try {
                const t0 = performance.now();
                const result = generateSchedule(CATEGORIES);
                const t1 = performance.now();
                setSchedule(result);
                setMs(t1 - t0);
                console.log(
                    `Generated Weekly Schedule in ${Math.round(t1 - t0)} ms`,
                    result
                );
            } catch (err) {
                console.error("❌ Error generating schedule:", err);
            } finally {
                setLoading(false);
            }
        }, 50);
    };


    useImperativeHandle(ref, () => ({
        generate: handleGenerateSchedule,
    }));


    const handleBlockClick = (
        day: string,
        block: { startIdx: number; length: number; label: string },
        blockType: string
    ) => {
        setSelected(block ? { ...block, day } : null);
        setNewLabel(block.label);
        setNewLength(block.length);
        setModalOpen(true);
    };

    // Clear entire contiguous block
    const clearBlock = () => {
        if (!schedule || !selected) return;
        const updated = { ...schedule, [selected.day]: [...schedule[selected.day]] };
        for (
            let i = selected.startIdx;
            i < selected.startIdx + selected.length;
            i++
        ) {
            updated[selected.day][i] = null;
        }
        setSchedule(updated);
        setModalOpen(false);
    };

    // Replace block with another obligation, adjusting length
    const updateBlock = () => {
        if (!schedule || !selected) return;
        const updated = { ...schedule, [selected.day]: [...schedule[selected.day]] };

        // clear old block
        for (
            let i = selected.startIdx;
            i < selected.startIdx + selected.length;
            i++
        ) {
            updated[selected.day][i] = null;
        }

        // apply new block
        for (
            let i = selected.startIdx;
            i < selected.startIdx + newLength;
            i++
        ) {
            if (i < updated[selected.day].length) {
                updated[selected.day][i] = newLabel;
            }
        }

        setSchedule(updated);
        setModalOpen(false);
    };

    // obligations list for dropdown
    const allObligations = CATEGORIES.flatMap((cat) =>
        cat.children.map((child) => child.name)
    );

    // compute end time preview for slider
    const blockEnd = selected ? selected.startIdx + newLength : null;

    return (
        <div style={{ padding: 16 }}>
            {/* 🔹 Loading Overlay */}
            {loading && (
                <div className="loading-overlay">
                    <div className="loading-message">
                        <div className="spinner"></div>
                        Making Your Schedule...
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
                />
            )}


            {modalOpen && selected && (
                <div
                    className="modal-overlay"
                    onClick={() => setModalOpen(false)}
                >
                    <div
                        className="modal-card"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3>Modify Block</h3>
                        <p>
                            {selected.label} • {selected.length * 15} minutes
                        </p>

                        {/* Form panel */}
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
                                    onChange={(e) =>
                                        setNewLength(Number(e.target.value))
                                    }
                                />
                            </label>

                            {blockEnd && (
                                <p style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
                                    Adjusted block runs from index {selected.startIdx} to{" "}
                                    {blockEnd}
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
