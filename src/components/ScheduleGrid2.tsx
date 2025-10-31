// Lightweight clone of ScheduleGrid with support for custom labels and legend extension
import React, { useMemo } from "react";
import { DAYS, BLOCKS_PER_DAY } from "../utils/scheduleHelpers";
import type { Schedule } from "../utils/simulatedAnnealingScheduler";
import "../css/ScheduleGrid.css";

const BLOCKS_PER_HOUR = Math.floor(BLOCKS_PER_DAY / 24);
const ROW_PX = 20;

function idxToTimeLabel(idx: number): string {
    const h = Math.floor(idx / BLOCKS_PER_HOUR);
    const m = (idx % BLOCKS_PER_HOUR) * 15;
    const hh = ((h + 11) % 12) + 1;
    const ampm = h < 12 ? "AM" : "PM";
    const mm = m.toString().padStart(2, "0");
    return `${hh}:${mm} ${ampm}`;
}

type DayBlock = { label: string; startIdx: number; length: number };

function buildBlocksForDay(daySlots: (string | null)[]): DayBlock[] {
    const blocks: DayBlock[] = [];
    let i = 0;
    while (i < BLOCKS_PER_DAY) {
        const label = daySlots[i];
        if (!label) { i++; continue; }
        let j = i + 1;
        while (j < BLOCKS_PER_DAY && daySlots[j] === label) j++;
        blocks.push({ label, startIdx: i, length: j - i });
        i = j;
    }
    return blocks;
}

function detectType(label: string, customList?: Set<string> | string[]) {
    const l = (label || "").toLowerCase();
    const isCustom = customList ? (customList instanceof Set ? customList.has(label) : (customList as string[]).includes(label)) : false;
    if (isCustom) return "custom" as const;
    if (/\(class meeting\)$/.test(l)) return "class" as const;
    if (/\(studying\)$/.test(l)) return "study" as const;
    if (l.includes("sleep") || l === "night sleep" || l.includes("nap")) return "sleep" as const;
    if (/\brest\b/.test(l)) return "selfcare" as const;
    if (l.includes("work shift") || /^work\b/.test(l) || l.includes("shift")) return "work" as const;
    if (l.includes("social") || l.includes("club") || l.includes("d&d") || l.includes("friends") || l.includes("hang")) return "social" as const;
    if (l.includes("yoga") || l.includes("hygiene") || l.includes("laundry") || l.includes("self")) return "selfcare" as const;
    if (l.includes("gym") || l.includes("exercise") || l.includes("run") || l.includes("lift") || l.includes("workout")) return "exercise" as const;
    if (l.includes("leisure") || l.includes("reading") || l.includes("read") || l.includes("nature") || l.includes("walk") || l.includes("movie") || l.includes("game")) return "leisure" as const;
    return "study" as const;
}

export interface ScheduleGridProps {
    schedule: Schedule;
    onBlockClick?: (day: string, block: DayBlock, blockType: string) => void;
    onMoveBlock?: (fromDay: string, fromStartIdx: number, length: number, label: string, toDay: string, toStartIdx: number) => void;
    onStartTapMove?: (payload: { fromDay: string; startIdx: number; length: number; label: string }) => void;
    onCellClick?: (day: string, startIdx: number) => void;
    moved?: { day: string; startIdx: number; label: string } | null;
    labelTransform?: (label: string) => string;
    hoverOriginal?: (label: string) => string | undefined;
    onRequestSwap?: (from: { fromDay: string; startIdx: number; length: number; label: string }, to: { day: string; startIdx: number; length: number; label: string }) => void;
    customLabels?: string[]; // new: labels that should be styled as custom
}

export function ScheduleGrid({ schedule, onBlockClick, onMoveBlock, onStartTapMove, onCellClick, moved, onRequestSwap, labelTransform, hoverOriginal, customLabels }: ScheduleGridProps) {
    const customSet = useMemo(() => new Set(customLabels || []), [customLabels]);
    const dayBlocks = useMemo(() => {
        const result: Record<string, DayBlock[]> = {};
        for (const day of DAYS) {
            result[day] = buildBlocksForDay(schedule[day] || Array(BLOCKS_PER_DAY).fill(null));
        }
        return result;
    }, [schedule]);

    return (
        <div className="schedule">
            <div className="schedule__legend">
                <span className="legend__item"><span className="legend__swatch legend__swatch--study" /> Study</span>
                <span className="legend__item"><span className="legend__swatch legend__swatch--class" /> Class Meeting</span>
                <span className="legend__item"><span className="legend__swatch legend__swatch--sleep" /> Sleep</span>
                <span className="legend__item"><span className="legend__swatch legend__swatch--social" /> Social</span>
                <span className="legend__item"><span className="legend__swatch legend__swatch--work" /> Work Shift</span>
                <span className="legend__item"><span className="legend__swatch legend__swatch--selfcare" /> Self-Care</span>
                <span className="legend__item"><span className="legend__swatch legend__swatch--exercise" /> Exercise</span>
                <span className="legend__item"><span className="legend__swatch legend__swatch--leisure" /> Leisure</span>
                <span className="legend__item"><span className="legend__swatch legend__swatch--custom" /> Custom</span>
            </div>

            <div className="schedule__header">
                <div className="schedule__corner" />
                {DAYS.map((d) => (
                    <div key={d} className="schedule__day-header">{d}</div>
                ))}
            </div>

            <div className="schedule__body">
                <div className="schedule__time">
                    {Array.from({ length: BLOCKS_PER_HOUR * 24 }).map((_, idx) => (
                        <div key={idx} className="schedule__time-slot" data-label={idx % BLOCKS_PER_HOUR === 0 ? idxToTimeLabel(idx) : ""} />
                    ))}
                </div>

                {DAYS.map((day) => (
                    <div key={day} className="schedule__day">
                        {Array.from({ length: BLOCKS_PER_HOUR * 24 }).map((_, idx) => (
                            <div
                                key={idx}
                                className="schedule__cell"
                                data-idx={idx}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                                }}
                                onDragEnter={(e) => {
                                    (e.currentTarget as HTMLDivElement).classList.add("droptarget");
                                }}
                                onDragLeave={(e) => {
                                    (e.currentTarget as HTMLDivElement).classList.remove("droptarget");
                                }}
                                onDrop={(e) => {
                                    if (!onMoveBlock) return;
                                    try {
                                        let raw = e.dataTransfer.getData("application/json");
                                        if (!raw) raw = e.dataTransfer.getData("text/plain");
                                        if (!raw) raw = e.dataTransfer.getData("text");
                                        const data = JSON.parse(raw || "null");
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
                                    (e.currentTarget as HTMLDivElement).classList.remove("droptarget");
                                }}
                                onClick={() => onCellClick?.(day, idx)}
                            />
                        ))}

                        {dayBlocks[day].map((b, i) => {
                            const blockType = detectType(b.label, customSet);
                            const topPx = b.startIdx * ROW_PX;
                            const heightPx = Math.max(b.length, 2) * ROW_PX;
                            const startLabel = idxToTimeLabel(b.startIdx);
                            const endLabel = idxToTimeLabel(b.startIdx + b.length);
                            const shownLabel = labelTransform ? labelTransform(b.label) : b.label;
                            const title = hoverOriginal ? (hoverOriginal(b.label) || `${b.label} - ${startLabel}-${endLabel}`) : `${b.label} - ${startLabel}-${endLabel}`;
                            return (
                                <div
                                    key={`${day}-block-${i}-${b.label}-${b.startIdx}`}
                                    className={`block block--${blockType} ${moved && moved.day===day && moved.startIdx===b.startIdx && moved.label===b.label ? 'block--arrive' : ''}`}
                                    data-len={b.length}
                                    style={{ "--top": `${topPx}px`, "--height": `${heightPx}px` } as React.CSSProperties}
                                    title={title}
                                    draggable
                                    onDragStart={(e) => {
                                        const payload = { fromDay: day, startIdx: b.startIdx, length: b.length, label: b.label };
                                        const json = JSON.stringify(payload);
                                        e.dataTransfer.setData("application/json", json);
                                        e.dataTransfer.setData("text/plain", json);
                                        e.dataTransfer.setData("text", json);
                                        e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragOver={(e) => { if (onRequestSwap) e.preventDefault(); }}
                                    onDrop={(e) => {
                                        try {
                                            if (!onRequestSwap) return;
                                            let raw = e.dataTransfer.getData("application/json");
                                            if (!raw) raw = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text");
                                            const data = JSON.parse(raw || "null");
                                            if (!data || typeof data.startIdx !== "number") return;
                                            onRequestSwap(
                                                { fromDay: data.fromDay, startIdx: data.startIdx, length: data.length, label: data.label },
                                                { day, startIdx: b.startIdx, length: b.length, label: b.label }
                                            );
                                        } catch {}
                                    }}
                                    onTouchStart={(e) => {
                                        if (!onStartTapMove) return;
                                        const target = e.currentTarget as HTMLDivElement;
                                        const timer = window.setTimeout(() => {
                                            onStartTapMove({ fromDay: day, startIdx: b.startIdx, length: b.length, label: b.label });
                                        }, 500);
                                        const clear = () => window.clearTimeout(timer);
                                        target.addEventListener('touchend', clear, { once: true });
                                        target.addEventListener('touchcancel', clear, { once: true });
                                    }}
                                    onClick={() => onBlockClick?.(day, b, blockType)}
                                >
                                    <div className="block__title">{shownLabel}</div>
                                    <div className="block__meta">{startLabel} - {endLabel}</div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ScheduleGrid;
