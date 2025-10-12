import React from "react";
import PrioritySlider from "./PrioritySlider";
import TimeOfDaySelection, { type TimeName } from "./TimeOfDaySelection";
import NumberInput from "./NumberInput";
import SunMoonBoolean from "./SunMoonBoolean";
import WeekdayIntervals, { type WeekdayIntervalsValue } from "./WeekdayIntervals";
import QuestionModal from "../QuestionModal";
import "../../css/SelfCareSelector.css"; // reuse same styles
import { X, ChevronLeft, ChevronRight, Plus } from "lucide-react";

/**
 * CustomObligationsSelector — free-form version of SelfCareSelector
 * - No presets dropdown; users only type activities to add
 * - Same follow-ups per activity:
 *   priority, preferred time(s) of day, duration, times/day, times/week,
 *   and optional strict time windows via nested modal.
 */

export type CustomObligation = string & {};

export interface CustomObligationPrefs {
    activity: CustomObligation;
    priority: number;                 // 0..1 (same as your sliders elsewhere)
    preferredTimes: TimeName[];       // morning/afternoon/evening/night
    durationMinutes: number;          // typical session duration
    timesPerDay: number;
    timesPerWeek: number;
    strictSchedule?: boolean;         // toggle to open strict intervals
    strictIntervals?: WeekdayIntervalsValue;
}

interface Props {
    value: CustomObligationPrefs[];
    onChange: (v: CustomObligationPrefs[]) => void;
    label?: string;
    placeholder?: string;
    id?: string;
    className?: string;
}

const DEFAULTS: Omit<CustomObligationPrefs, "activity"> = {
    priority: 0.5,
    preferredTimes: [],
    durationMinutes: 30,
    timesPerDay: 1,
    timesPerWeek: 3,
    strictSchedule: false,
    strictIntervals: {},
};

const CustomObligationsSelector: React.FC<Props> = ({
                                                        value,
                                                        onChange,
                                                        label = "Add any additional custom obligations/activities to include",
                                                        placeholder = "Enter a custom obligation or activity…",
                                                        id,
                                                        className = "",
                                                    }) => {
    const [draftCustom, setDraftCustom] = React.useState<string>("");
    const [cursor, setCursor] = React.useState<number>(0);

    // nested modal for strict intervals
    const [strictOpen, setStrictOpen] = React.useState(false);
    const [strictTemp, setStrictTemp] = React.useState<WeekdayIntervalsValue>({});

    const selectedActivities = React.useMemo(() => value.map((p) => p.activity), [value]);
    const selectedLower = React.useMemo(
        () => selectedActivities.map((s) => s.toLowerCase()),
        [selectedActivities]
    );

    const current = value[cursor];

    const add = () => {
        const raw = (draftCustom || "").trim();
        if (!raw) return;

        const exists = selectedLower.includes(raw.toLowerCase());
        if (exists) {
            const idx = selectedActivities.findIndex(
                (a) => a.toLowerCase() === raw.toLowerCase()
            );
            if (idx >= 0) setCursor(idx);
            setDraftCustom("");
            return;
        }

        const next = [...value, { activity: raw as CustomObligation, ...DEFAULTS }];
        onChange(next);
        setDraftCustom("");
        setCursor(next.length - 1);
    };

    const remove = (activity: CustomObligation) => {
        const idx = value.findIndex((p) => p.activity.toLowerCase() === activity.toLowerCase());
        if (idx < 0) return;
        const next = value.slice();
        next.splice(idx, 1);
        onChange(next);
        setCursor((c) => Math.max(0, Math.min(c, next.length - 1)));
    };

    const update = (partial: Partial<CustomObligationPrefs>) => {
        const curr = value[cursor];
        if (!curr) return;
        const next = value.slice();
        next[cursor] = { ...curr, ...partial };
        onChange(next);
    };

    const goPrev = () => setCursor((c) => Math.max(0, c - 1));
    const goNext = () => setCursor((c) => Math.min(value.length - 1, c + 1));

    const openStrictModal = () => {
        const seed = (current?.strictIntervals ?? {}) as WeekdayIntervalsValue;
        setStrictTemp(JSON.parse(JSON.stringify(seed)));
        setStrictOpen(true);
    };
    const closeStrictModal = () => {
        setStrictOpen(false);
        if (current?.strictSchedule && !current?.strictIntervals) {
            update({ strictSchedule: false });
        }
    };
    const saveStrictModal = () => {
        update({ strictSchedule: true, strictIntervals: JSON.parse(JSON.stringify(strictTemp)) });
        setStrictOpen(false);
    };

    return (
        <div className={`scsel ${className}`} id={id}>
            {/* Add row: custom input + Add button */}
            <div className="scsel-row">
                {label ? (
                    <label className="scsel-label" htmlFor="cosel-custom">
                        {label}
                    </label>
                ) : null}
                <div className="scsel-add">
                    <input
                        id="cosel-custom"
                        className="scsel-input"
                        type="text"
                        value={draftCustom}
                        placeholder={placeholder}
                        onChange={(e) => setDraftCustom(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                add();
                            }
                        }}
                    />
                    <button
                        type="button"
                        className="scsel-btn scsel-btn-primary"
                        onClick={add}
                        disabled={!draftCustom.trim()}
                        aria-label="Add custom obligation/activity"
                        title="Add custom obligation/activity"
                    >
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {/* Chip list */}
            {value.length > 0 && (
                <div className="scsel-chips" role="list" aria-label="Added custom obligations/activities">
                    {value.map((p, i) => (
                        <button
                            key={`${p.activity}-${i}`}
                            role="listitem"
                            type="button"
                            onClick={() => setCursor(i)}
                            className={`scsel-chip${i === cursor ? " scsel-chip-active" : ""}`}
                            aria-current={i === cursor}
                        >
                            <span>{p.activity}</span>
                            <span
                                className="scsel-chip-close"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    remove(p.activity);
                                }}
                                aria-label={`Remove ${p.activity}`}
                            >
                <X size={14} aria-hidden />
              </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Wizard for current */}
            {current ? (
                <div className="scsel-panel" aria-live="polite">
                    <div className="scsel-panel-header">
                        <h3 className="scsel-title">Configure: {current.activity}</h3>
                        <div className="scsel-stepper">
                            <button className="scsel-btn" onClick={goPrev} disabled={cursor === 0}>
                                <ChevronLeft size={16} /> Prev
                            </button>
                            <div className="scsel-step-info">
                                {cursor + 1} / {value.length}
                            </div>
                            <button className="scsel-btn" onClick={goNext} disabled={cursor === value.length - 1}>
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Q1: Priority */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">How much do you prioritize this activity?</div>
                        <div className="scsel-question-control">
                            <PrioritySlider
                                value={current.priority}
                                onChange={(n: number) => update({ priority: n })}
                                showValue
                                variant="obligation"
                                aria-label="Priority"
                            />
                        </div>
                    </div>

                    {/* Q2: Preferred time(s) of day */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">What time of day do you prefer for this activity?</div>
                        <div className="scsel-question-control scsel-tod">
                            <TimeOfDaySelection
                                value={current.preferredTimes}
                                onChange={(arr) => update({ preferredTimes: arr })}
                                ariaLabel="Preferred time of day"
                            />
                        </div>
                    </div>

                    {/* Q3: Duration (minutes) */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">
                            For how long, on average, do you like to perform this activity? (minutes)
                        </div>
                        <div className="scsel-question-control scsel-inline">
                            <NumberInput
                                value={String(current.durationMinutes ?? 0)}
                                onChange={(s) => {
                                    const n = Math.max(0, Math.round(parseInt(s || "0", 10) || 0));
                                    update({ durationMinutes: n });
                                }}
                                placeholder={30}
                            />
                        </div>
                    </div>

                    {/* Q4: Times per day */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">
                            How many times per day would you want to perform this activity?
                        </div>
                        <div className="scsel-question-control scsel-inline">
                            <NumberInput
                                value={String(current.timesPerDay ?? 0)}
                                onChange={(s) => {
                                    const n = Math.max(0, Math.round(parseInt(s || "0", 10) || 0));
                                    update({ timesPerDay: n });
                                }}
                                placeholder={1}
                            />
                        </div>
                    </div>

                    {/* Q5: Times per week */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">
                            How many times per week would you want to perform this activity?
                        </div>
                        <div className="scsel-question-control scsel-inline">
                            <NumberInput
                                value={String(current.timesPerWeek ?? 0)}
                                onChange={(s) => {
                                    const n = Math.max(0, Math.round(parseInt(s || "0", 10) || 0));
                                    update({ timesPerWeek: n });
                                }}
                                placeholder={3}
                            />
                        </div>
                    </div>

                    {/* Q6: Strict schedule? */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">Do you want strict times scheduled for this activity?</div>
                        <div className="scsel-question-control">
                            <div className="q-center-control">
                                <SunMoonBoolean
                                    value={!!current.strictSchedule}
                                    onChange={(v) => {
                                        if (v) {
                                            update({ strictSchedule: true });
                                            openStrictModal();
                                        } else {
                                            update({ strictSchedule: false, strictIntervals: {} });
                                        }
                                    }}
                                    yesLabel="Yes"
                                    noLabel="No"
                                    ariaLabel="Toggle strict scheduling"
                                />
                            </div>

                            {current.strictSchedule && current.strictIntervals && (
                                <p className="q-hint" style={{ marginTop: ".5rem" }}>
                                    Strict times set —{" "}
                                    <button
                                        type="button"
                                        className="scsel-btn"
                                        onClick={openStrictModal}
                                        aria-label="Edit strict time windows"
                                    >
                                        Edit time windows
                                    </button>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <p className="scsel-empty">No custom obligations added yet.</p>
            )}

            {/* Nested modal for strict weekday intervals */}
            <QuestionModal
                isOpen={strictOpen}
                title={current ? `Set strict times for ${current.activity}` : "Set strict times"}
                onClose={closeStrictModal}
                onSubmit={saveStrictModal}
                submitLabel="Save"
            >
                <WeekdayIntervals value={strictTemp} onChange={setStrictTemp} />
            </QuestionModal>
        </div>
    );
};

export default CustomObligationsSelector;
export type { CustomObligationPrefs };
