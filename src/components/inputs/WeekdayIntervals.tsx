import React from "react";
import TimeInput from "./TimeInput";
import "../../css/WeekdayIntervals.css";

export type Weekday =
    | "monday" | "tuesday" | "wednesday" | "thursday"
    | "friday" | "saturday" | "sunday";

export type TimeRange = { start: string; end: string };
export type WeekdayIntervalsValue = Partial<Record<Weekday, TimeRange[]>>;

export interface WeekdayIntervalsProps {
    value: WeekdayIntervalsValue;
    onChange: (val: WeekdayIntervalsValue) => void;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}

const DAYS: Array<{ key: Weekday; short: string; label: string }> = [
    { key: "monday",    short: "Mon", label: "Monday" },
    { key: "tuesday",   short: "Tue", label: "Tuesday" },
    { key: "wednesday", short: "Wed", label: "Wednesday" },
    { key: "thursday",  short: "Thu", label: "Thursday" },
    { key: "friday",    short: "Fri", label: "Friday" },
    { key: "saturday",  short: "Sat", label: "Saturday" },
    { key: "sunday",    short: "Sun", label: "Sunday" },
];

function clone(val: WeekdayIntervalsValue): WeekdayIntervalsValue {
    const out: WeekdayIntervalsValue = {};
    (Object.keys(val) as Weekday[]).forEach((d) => {
        out[d] = (val[d] ?? []).map(r => ({ start: r.start, end: r.end }));
    });
    return out;
}

const WeekdayIntervals: React.FC<WeekdayIntervalsProps> = ({
                                                               value,
                                                               onChange,
                                                               disabled = false,
                                                               className = "",
                                                               ariaLabel = "Add weekday time intervals",
                                                           }) => {
    const valRef = React.useRef(value);
    valRef.current = value;

    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [pickerDay, setPickerDay] = React.useState<Weekday | null>(null);
    const [pickerIdx, setPickerIdx] = React.useState<number | null>(null); // null => add; number => edit
    const [pickerStart, setPickerStart] = React.useState("");
    const [pickerEnd, setPickerEnd] = React.useState("");
    const [pickerErr, setPickerErr] = React.useState<string>("");

    // open picker for add/edit
    const openPicker = (day: Weekday, idx: number | null) => {
        if (disabled) return;
        setPickerDay(day);
        setPickerIdx(idx);
        if (idx === null) {
            setPickerStart("");
            setPickerEnd("");
        } else {
            const range = (valRef.current[day] ?? [])[idx];
            setPickerStart(range?.start ?? "");
            setPickerEnd(range?.end ?? "");
        }
        setPickerErr("");
        setPickerOpen(true);
    };

    const closePicker = () => {
        setPickerOpen(false);
        setPickerDay(null);
        setPickerIdx(null);
        setPickerErr("");
    };

    const ensureDay = (day: Weekday) => valRef.current[day] ?? [];
    const writeDay = (day: Weekday, ranges: TimeRange[]) => {
        const next = clone(valRef.current);
        next[day] = ranges;
        if (!ranges.length) delete next[day];
        onChange(next);
    };

    const submitPicker = () => {
        if (!pickerDay) return;

        const s = (pickerStart || "").trim();
        const e = (pickerEnd || "").trim();

        // basic validation
        if (!s || !e) {
            setPickerErr("Please enter both a start and end time.");
            return;
        }
        if (e <= s) {
            setPickerErr("End time must be later than start time.");
            return;
        }

        const ranges = ensureDay(pickerDay).slice();
        const newRange: TimeRange = { start: s, end: e };

        if (pickerIdx === null) {
            ranges.push(newRange);
        } else {
            ranges[pickerIdx] = newRange;
        }
        writeDay(pickerDay, ranges);
        closePicker();
    };

    const removeInterval = (day: Weekday, idx: number) => {
        if (disabled) return;
        const ranges = ensureDay(day).slice();
        ranges.splice(idx, 1);
        writeDay(day, ranges);
    };

    const countAll = React.useMemo(() => {
        let c = 0;
        for (const d of DAYS) c += (value[d.key]?.length ?? 0);
        return c;
    }, [value]);

    // keyboard support inside picker
    React.useEffect(() => {
        if (!pickerOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closePicker();
            if (e.key === "Enter") submitPicker();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [pickerOpen, pickerStart, pickerEnd, pickerDay, pickerIdx]);

    return (
        <div className={`wi-root ${className}`} role="group" aria-label={ariaLabel}>
            <div className="wi-head">
                <div className="wi-title">Weekday Intervals</div>
                <div className="wi-sub">{countAll} interval{countAll === 1 ? "" : "s"} added</div>
            </div>

            <div className="wi-grid">
                {DAYS.map((d) => {
                    const ranges = value[d.key] ?? [];
                    return (
                        <section key={d.key} className="wi-card" aria-label={d.label}>
                            <header className="wi-card__head">
                                <div className="wi-day">{d.short}</div>
                                <button
                                    type="button"
                                    className="wi-addBtn"
                                    onClick={() => openPicker(d.key, null)}
                                    disabled={disabled}
                                    aria-label={`Add interval on ${d.label}`}
                                >
                                    + Add
                                </button>
                            </header>

                            {ranges.length === 0 ? (
                                <div className="wi-empty">No intervals</div>
                            ) : (
                                <ul className="wi-list">
                                    {ranges.map((r, i) => (
                                        <li key={i} className="wi-row">
                                            <button
                                                type="button"
                                                className="wi-chip"
                                                onClick={() => openPicker(d.key, i)}
                                                title="Click to edit"
                                            >
                                                <span className="wi-chip__time">{r.start}</span>
                                                <span className="wi-chip__dash">–</span>
                                                <span className="wi-chip__time">{r.end}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="wi-removeBtn"
                                                onClick={() => removeInterval(d.key, i)}
                                                aria-label={`Remove interval ${i + 1} on ${d.label}`}
                                                title="Remove"
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    );
                })}
            </div>

            {/* Inline picker modal (overlay inside the QuestionModal) */}
            {pickerOpen && (
                <div className="wi-overlay" role="dialog" aria-modal="true" aria-label="Add time interval">
                    <div className="wi-picker">
                        <div className="wi-picker__head">
                            <div className="wi-picker__title">
                                {pickerIdx === null ? "Add interval" : "Edit interval"}
                                {pickerDay ? (
                                    <span className="wi-picker__badge">
                    {DAYS.find(d => d.key === pickerDay)?.label}
                  </span>
                                ) : null}
                            </div>
                            <button type="button" className="wi-picker__close" onClick={closePicker} aria-label="Close">×</button>
                        </div>

                        <div className="wi-picker__body">
                            <div className="wi-picker__row">
                                <label className="wi-picker__label">Start time</label>
                                <TimeInput value={pickerStart} onChange={setPickerStart} />
                            </div>

                            <div className="wi-picker__row">
                                <label className="wi-picker__label">End time</label>
                                <TimeInput value={pickerEnd} onChange={setPickerEnd} />
                            </div>

                            {pickerErr && <div className="wi-picker__err" role="alert">{pickerErr}</div>}
                        </div>

                        <div className="wi-picker__actions">
                            <button type="button" className="wi-btn wi-btn--ghost" onClick={closePicker}>Cancel</button>
                            <button type="button" className="wi-btn wi-btn--primary" onClick={submitPicker}>
                                {pickerIdx === null ? "Add Interval" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeekdayIntervals;
