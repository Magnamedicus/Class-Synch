import React from "react";
import PrioritySlider from "./PrioritySlider";
import TimeOfDaySelection, { type TimeName } from "./TimeOfDaySelection";
import NumberInput from "./NumberInput";
import SunMoonBoolean from "./SunMoonBoolean";
import WeekdayIntervals, { type WeekdayIntervalsValue } from "./WeekdayIntervals";
import QuestionModal from "../QuestionModal";
import "../../css/SelfCareSelector.css"; // reuse the dark/luxe styles
import { X, ChevronLeft, ChevronRight, Plus } from "lucide-react";

/**
 * ExerciseSelector — mirrors SelfCareSelector with:
 *  - Presets + custom entry
 *  - Per-activity follow-ups (priority, preferred times, duration, frequency)
 *  - Strict-schedule boolean → opens WeekdayIntervals in a nested modal
 *  - EXTRA: Rest period needed after the workout (minutes)
 */

// ---- Long, comprehensive preset list ----
const EXERCISE_PRESETS = [
    // General / gym styles
    "Gym",
    "Weight Lifting",
    "Powerlifting",
    "Bodybuilding",
    "Strength Training",
    "Circuit Training",
    "CrossFit",
    "Calisthenics",
    "Stretching",
    "Foam Rolling",
    "Core / Abs",
    "Balance Exercises",

    // Split routines
    "Push ups",
    "Pull ups",
    "Leg Training",
    "Chest & Back Training",
    "Shoulders & Arms",
    "Full-Body Training",

    // Cardio
    "Running",
    "Jogging",
    "Sprinting",
    "Track Workouts",
    "Treadmill",
    "Trail Running",
    "Hiking",
    "Rucking",
    "Walking (Brisk)",
    "Stair Climber",
    "Elliptical",
    "Rowing Machine",
    "Outdoor Cycling",
    "Indoor Cycling/Spinning",
    "Swimming (Laps)",
    "Open-Water Swimming",
    "Jump Rope",

    // Martial arts / combat sports
    "Boxing",
    "Kickboxing",
    "Muay Thai",
    "Brazilian Jiu-Jitsu",
    "Wrestling",
    "Judo",
    "Karate",
    "Taekwondo",
    "MMA Drills",

    // Classes / studio
    "Yoga",
    "Pilates",
    "Dance Cardio",
    "Zumba",

    // Climbing / skills
    "Rock Climbing (Top-Rope)",
    "Bouldering",
    "Parkour / Freerunning",
    "Gymnastics",


    // Court / field / team sports
    "Basketball",
    "Soccer",
    "Football",
    "Baseball",
    "Softball",
    "Volleyball",
    "Rugby",
    "Lacrosse",
    "Field Hockey",
    "Ice Hockey",
    "Ultimate Frisbee",
    "Pickleball",
    "Tennis",
    "Table Tennis",
    "Badminton",
    "Rowing",

    // Outdoor & seasonal
    "Disc Golf",
    "Golf",
    "Skiing",
    "Snowboarding",
    "Ice Skating",
    "Inline Skating",
    "Surfing",
    "Paddleboarding",
    "Kayaking",
    "Canoeing",


    // Conditioning / accessories
    "Kettlebell Training",


    // Rehab / recovery

    "Low-Impact Cardio",
] as const;

// Allow custom strings too
export type ExerciseActivity = (typeof EXERCISE_PRESETS)[number] | (string & {});

export interface ExercisePrefs {
    activity: ExerciseActivity;
    priority: number;               // 0..1
    preferredTimes: TimeName[];     // morning/afternoon/evening/night (existing enum)
    durationMinutes: number;        // typical session length
    timesPerDay: number;
    timesPerWeek: number;

    // strict schedule flow (optional)
    strictSchedule?: boolean;
    strictIntervals?: WeekdayIntervalsValue;

    // EXTRA: rest period needed after this workout (minutes)
    restPeriodMinutes?: number;
}

interface Props {
    value: ExercisePrefs[];
    onChange: (v: ExercisePrefs[]) => void;
    label?: string;
    inputPlaceholder?: string;  // text input placeholder
    selectPlaceholder?: string; // dropdown placeholder
    id?: string;
    className?: string;
}

const DEFAULTS: Omit<ExercisePrefs, "activity"> = {
    priority: 0.5,
    preferredTimes: [],
    durationMinutes: 45,
    timesPerDay: 1,
    timesPerWeek: 3,
    strictSchedule: false,
    strictIntervals: {},
    restPeriodMinutes: 10,
};

const ExerciseSelector: React.FC<Props> = ({
                                               value,
                                               onChange,
                                               label = "Choose exercise to include",
                                               inputPlaceholder = "Enter an exercise…",
                                               selectPlaceholder = "Or choose from presets…",
                                               id,
                                               className = "",
                                           }) => {
    const [draftCustom, setDraftCustom] = React.useState<string>("");
    const [draftSelect, setDraftSelect] = React.useState<string>("");
    const [cursor, setCursor] = React.useState<number>(0);

    // nested strict-times modal
    const [strictOpen, setStrictOpen] = React.useState(false);
    const [strictTemp, setStrictTemp] = React.useState<WeekdayIntervalsValue>({});

    const selectedNames = React.useMemo(() => value.map(v => v.activity), [value]);
    const selectedLower = React.useMemo(
        () => selectedNames.map(n => n.toLowerCase()),
        [selectedNames]
    );

    const available = EXERCISE_PRESETS.filter(
        opt => !selectedLower.includes(opt.toLowerCase())
    );

    const current = value[cursor];

    const add = () => {
        const raw = (draftCustom || draftSelect || "").trim();
        if (!raw) return;

        const dupIdx = selectedNames.findIndex(a => a.toLowerCase() === raw.toLowerCase());
        if (dupIdx >= 0) {
            setCursor(dupIdx);
            setDraftCustom("");
            setDraftSelect("");
            return;
        }

        const next = [...value, { activity: raw as ExerciseActivity, ...DEFAULTS }];
        onChange(next);
        setDraftCustom("");
        setDraftSelect("");
        setCursor(next.length - 1);
    };

    const remove = (activity: ExerciseActivity) => {
        const idx = value.findIndex(v => v.activity.toLowerCase() === activity.toLowerCase());
        if (idx < 0) return;
        const next = value.slice();
        next.splice(idx, 1);
        onChange(next);
        setCursor(c => Math.max(0, Math.min(c, next.length - 1)));
    };

    const update = (partial: Partial<ExercisePrefs>) => {
        const curr = value[cursor];
        if (!curr) return;
        const next = value.slice();
        next[cursor] = { ...curr, ...partial };
        onChange(next);
    };

    const goPrev = () => setCursor(c => Math.max(0, c - 1));
    const goNext = () => setCursor(c => Math.min(value.length - 1, c + 1));

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
        <div className={`scsel exsel ${className}`} id={id}>
            {/* Add row: custom + select + Add */}
            <div className="scsel-row">
                {label ? <label className="scsel-label" htmlFor="exsel-custom">{label}</label> : null}
                <div className="scsel-add">
                    <input
                        id="exsel-custom"
                        className="scsel-input"
                        type="text"
                        value={draftCustom}
                        placeholder={inputPlaceholder}
                        onChange={(e) => setDraftCustom(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); add(); }
                        }}
                    />
                    <select
                        id="exsel-dd"
                        className="scsel-select"
                        value={draftSelect}
                        onChange={(e) => setDraftSelect(e.target.value)}
                    >
                        <option value="" disabled>{selectPlaceholder}</option>
                        {available.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="scsel-btn scsel-btn-primary"
                        onClick={add}
                        disabled={!(draftCustom.trim() || draftSelect)}
                        aria-label="Add exercise"
                        title="Add exercise"
                    >
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {/* Chips */}
            {value.length > 0 && (
                <div className="scsel-chips" role="list" aria-label="Selected exercises">
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
                                onClick={(e) => { e.stopPropagation(); remove(p.activity); }}
                                aria-label={`Remove ${p.activity}`}
                            >
                <X size={14} aria-hidden />
              </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Config panel for current */}
            {current ? (
                <div className="scsel-panel" aria-live="polite">
                    <div className="scsel-panel-header">
                        <h3 className="scsel-title">Configure: {current.activity}</h3>
                        <div className="scsel-stepper">
                            <button className="scsel-btn" onClick={goPrev} disabled={cursor === 0}>
                                <ChevronLeft size={16} /> Prev
                            </button>
                            <div className="scsel-step-info">{cursor + 1} / {value.length}</div>
                            <button className="scsel-btn" onClick={goNext} disabled={cursor === value.length - 1}>
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Q1: Priority */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">How much do you prioritize this workout?</div>
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
                        <div className="scsel-question-label">What time of day do you prefer for this workout?</div>
                        <div className="scsel-question-control scsel-tod">
                            <TimeOfDaySelection
                                value={current.preferredTimes}
                                onChange={(arr) => update({ preferredTimes: arr })}
                                ariaLabel="Preferred time of day"
                            />
                        </div>
                    </div>

                    {/* Q3: Duration */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">How long is this workout, on average? (minutes)</div>
                        <div className="scsel-question-control scsel-inline">
                            <NumberInput
                                value={String(current.durationMinutes ?? 0)}
                                onChange={(s) => {
                                    const n = Math.max(0, Math.round(parseInt(s || "0", 10) || 0));
                                    update({ durationMinutes: n });
                                }}
                                placeholder={45}
                            />
                        </div>
                    </div>

                    {/* Q4: Times per day */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">How many times per day do you want to do this workout?</div>
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
                        <div className="scsel-question-label">How many times per week do you want to do this workout?</div>
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

                    {/* Q6: EXTRA — Rest period after workout */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">How long of a rest period do you need after this workout? (minutes)</div>
                        <div className="scsel-question-control scsel-inline">
                            <NumberInput
                                value={String(current.restPeriodMinutes ?? 0)}
                                onChange={(s) => {
                                    const n = Math.max(0, Math.round(parseInt(s || "0", 10) || 0));
                                    update({ restPeriodMinutes: n });
                                }}
                                placeholder={10}
                            />
                        </div>
                    </div>

                    {/* Q7: Strict schedule? */}
                    <div className="scsel-question">
                        <div className="scsel-question-label">Do you want strict times scheduled for this workout?</div>
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
                <p className="scsel-empty">No exercises selected yet.</p>
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

export default ExerciseSelector;
