// app/components/ScheduleGrid.tsx
import React, { useMemo } from "react";
import { DAYS, BLOCKS_PER_DAY } from "../utils/scheduleHelpers";
import type { Schedule } from "../utils/simulatedAnnealingScheduler";
import "../css/ScheduleGrid.css";

const BLOCKS_PER_HOUR = Math.floor(BLOCKS_PER_DAY / 24);
const ROW_PX = 20; // must match .schedule__day grid row height

function idxToTimeLabel(idx: number): string {
    const h = Math.floor(idx / BLOCKS_PER_HOUR);
    const m = (idx % BLOCKS_PER_HOUR) * 15;
    const hh = ((h + 11) % 12) + 1;
    const ampm = h < 12 ? "AM" : "PM";
    const mm = m.toString().padStart(2, "0");
    return `${hh}:${mm} ${ampm}`;
}

type DayBlock = {
    label: string;
    startIdx: number;
    length: number;
};

function buildBlocksForDay(daySlots: (string | null)[]): DayBlock[] {
    const blocks: DayBlock[] = [];
    let i = 0;
    while (i < BLOCKS_PER_DAY) {
        const label = daySlots[i];
        if (!label) {
            i++;
            continue;
        }
        let j = i + 1;
        while (j < BLOCKS_PER_DAY && daySlots[j] === label) j++;
        blocks.push({ label, startIdx: i, length: j - i });
        i = j;
    }
    return blocks;
}

function taskToType(label: string): "study" | "class" | "sleep" | "social" | "work" | "selfcare" | "exercise" | "leisure" {
    const l = label.toLowerCase();
    if (/(\(class meeting\))$/.test(l)) return "class";
    if (/(\(studying\))$/.test(l)) return "study";
    if (l.includes("sleep") || l === "night sleep" || l.includes("nap")) return "sleep";
    if (/\(rest\)$/.test(l)) return "selfcare";
    if (l.includes("work shift") || /^work\b/.test(l) || l.includes("shift")) return "work";
    if (l.includes("social") || l.includes("club") || l.includes("d&d") || l.includes("friends") || l.includes("hang")) return "social";
    // treat yoga as self-care by default (from questionnaire), not exercise
    if (l.includes("yoga") || l.includes("hygiene") || l.includes("laundry") || l.includes("self")) return "selfcare";
    if (l.includes("gym") || l.includes("exercise") || l.includes("run") || l.includes("lift") || l.includes("workout")) return "exercise";
    if (l.includes("leisure") || l.includes("reading") || l.includes("read") || l.includes("nature") || l.includes("walk") || l.includes("movie") || l.includes("game")) return "leisure";
    return "study";
}

interface Props {
    schedule: Schedule;
    onBlockClick?: (
        day: string,
        block: DayBlock,
        blockType: string
    ) => void;
    onMoveBlock?: (
        fromDay: string,
        fromStartIdx: number,
        length: number,
        label: string,
        toDay: string,
        toStartIdx: number
    ) => void;
}

export function ScheduleGrid({ schedule, onBlockClick, onMoveBlock }: Props) {
    const dayBlocks = useMemo(() => {
        const result: Record<string, DayBlock[]> = {};
        for (const day of DAYS) {
            result[day] =
                buildBlocksForDay(
                    schedule[day] || Array(BLOCKS_PER_DAY).fill(null)
                );
        }
        return result;
    }, [schedule]);

    return (
        <div className="schedule">
            {/* Legend */}
            <div className="schedule__legend">
                <span className="legend__item">
                    <span className="legend__swatch legend__swatch--study" /> Study
                </span>
                <span className="legend__item">
                    <span className="legend__swatch legend__swatch--class" /> Class Meeting
                </span>
                <span className="legend__item">
                    <span className="legend__swatch legend__swatch--sleep" /> Sleep
                </span>
                <span className="legend__item">
                    <span className="legend__swatch legend__swatch--social" /> Social
                </span>
                <span className="legend__item">
                    <span className="legend__swatch legend__swatch--work" /> Work Shift
                </span>
                <span className="legend__item">
                    <span className="legend__swatch legend__swatch--selfcare" /> Self-Care
                </span>
                <span className="legend__item">
                    <span className="legend__swatch legend__swatch--exercise" /> Exercise
                </span>
                <span className="legend__item">
                    <span className="legend__swatch legend__swatch--leisure" /> Leisure
                </span>
            </div>

            {/* Header */}
            <div className="schedule__header">
                <div className="schedule__corner" />
                {DAYS.map((day) => (
                    <div key={day} className="schedule__day-header">
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                    </div>
                ))}
            </div>

            {/* Body */}
            <div className="schedule__body">
                {/* Time Column */}
                <div className="schedule__time">
                    {Array.from({ length: BLOCKS_PER_DAY }).map((_, idx) => (
                        <div
                            key={`time-${idx}`}
                            className="schedule__time-slot"
                            data-label={
                                idx % BLOCKS_PER_HOUR === 0 ? idxToTimeLabel(idx) : ""
                            }
                        />
                    ))}
                </div>

                {/* Day Columns */}
                {DAYS.map((day) => (
                    <div key={day} className="schedule__day">
                        {Array.from({ length: BLOCKS_PER_DAY }).map((_, idx) => (
                            <div
                                key={`${day}-cell-${idx}`}
                                className="schedule__cell"
                                onDragOver={(e) => {
                                    // allow drop
                                    e.preventDefault();
                                }}
                                onDrop={(e) => {
                                    if (!onMoveBlock) return;
                                    try {
                                        const raw = e.dataTransfer.getData("text/plain");
                                        const data = JSON.parse(raw) as {
                                            fromDay: string;
                                            startIdx: number;
                                            length: number;
                                            label: string;
                                        };
                                        if (!data || typeof data.startIdx !== "number") return;
                                        onMoveBlock(
                                            data.fromDay,
                                            data.startIdx,
                                            data.length,
                                            data.label,
                                            day,
                                            idx
                                        );
                                    } catch {}
                                }}
                            />
                        ))}

                        {dayBlocks[day].map((b, i) => {
                            const blockType = taskToType(b.label);
                            const topPx = b.startIdx * ROW_PX;
                            const heightPx = b.length * ROW_PX;

                            const startLabel = idxToTimeLabel(b.startIdx);
                            const endLabel = idxToTimeLabel(b.startIdx + b.length);

                            return (
                                <div
                                    key={`${day}-block-${i}-${b.label}-${b.startIdx}`}
                                    className={`block block--${blockType}`}
                                    style={
                                        {
                                            "--top": `${topPx}px`,
                                            "--height": `${heightPx}px`,
                                        } as React.CSSProperties
                                    }
                                    title={`${b.label} • ${startLabel}–${endLabel}`}
                                    draggable
                                    onDragStart={(e) => {
                                        const payload = {
                                            fromDay: day,
                                            startIdx: b.startIdx,
                                            length: b.length,
                                            label: b.label,
                                        };
                                        e.dataTransfer.setData(
                                            "text/plain",
                                            JSON.stringify(payload)
                                        );
                                        e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onClick={() =>
                                        onBlockClick?.(day, b, blockType)
                                    }
                                >
                                    <div className="block__title">{b.label}</div>
                                    <div className="block__meta">
                                        {startLabel} – {endLabel}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
