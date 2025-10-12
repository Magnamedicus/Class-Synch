import React from "react";
import { Link, useNavigate } from "react-router-dom";

import QuestionCarousel from "../components/QuestionCarousel";
import IntroModal from "../components/IntroModal";
import QuestionModal from "../components/QuestionModal";

import ContinueButton from "../components/ContinueButton";
import BackButton from "../components/BackButton";

/* Inputs */
import PrioritySlider from "../components/inputs/PrioritySlider";
import NumberInput from "../components/inputs/NumberInput";
import TextInput from "../components/inputs/TextInput";
import EnterClasses from "../components/inputs/EnterClasses";
import TimeInput from "../components/inputs/TimeInput";
import DaySelection, { type DayName } from "../components/inputs/DaySelection";
import TimeOfDaySelection, { type TimeName } from "../components/inputs/TimeOfDaySelection";
import SunMoonBoolean from "../components/inputs/SunMoonBoolean";
import WeekdayIntervals, { type WeekdayIntervalsValue } from "../components/inputs/WeekdayIntervals";
import EnterObligations from "../components/inputs/EnterObligations";

/* Custom selectors */
import SelfCareSelector, { type SelfCarePrefs } from "../components/inputs/SelfCareSelector";
import ExerciseSelector, { type ExercisePrefs } from "../components/inputs/ExerciseSelector";
import LeisureSelector, { type LeisurePrefs } from "../components/inputs/LeisureSelector";
import CustomObligationsSelector, { type CustomObligationPrefs } from "../components/inputs/CustomObligationSelector";

import ProgressBuckets from "../components/ProgressBuckets";

import "../css/QuestionnairePage.css";

/* Assets */
import logo from "../assets/logo.png";
import introImg from "../assets/questionnaire_intro_img.png";

/* Questions config */
import QUESTIONS, {
    BUCKET_ORDER,
    type BucketId,
    type Condition,
} from "../utils/questions";

/* ------------------------------------------------------------------ */
/* Map questions.ts types to modal input components                    */
/* ------------------------------------------------------------------ */
type InputTypeExpected =
    | "priority"
    | "number"
    | "text"
    | "enter-classes"
    | "enter-social"
    | "time"
    | "day-selection"
    | "boolean"
    | "time-selection"
    | "weekday-time-intervals"
    | "selfcare-selector"
    | "exercise-selector"
    | "leisure-selector"
    | "custom-obligations-selector"; // ⬅️ NEW

function mapTypeToExpected(t: string): InputTypeExpected {
    switch (t) {
        case "priority":
        case "number":
        case "text":
        case "enter-classes":
        case "enter-social":
        case "time":
        case "time-selection":
        case "day-selection":
        case "boolean":
        case "weekday-time-intervals":
        case "selfcare-selector":
        case "exercise-selector":
        case "leisure-selector":
        case "custom-obligations-selector":
            return t as InputTypeExpected;
        default:
            return "text";
    }
}

/* ------------------------------------------------------------------ */
/* Flatten from config (preserves bucket metadata for navigation)      */
/* ------------------------------------------------------------------ */
type FlatQuestionItem = {
    id: string;
    text: string;
    inputType: InputTypeExpected;
    hint?: string;
    default?: number | string | boolean;
    when?: Condition;
    __bucketLabel: string;
    __bucketId: BucketId;
    __bi: number;
    __qi: number;
    __image: string;
};

function buildDefaultAnswers(): Record<string, any> {
    const out: Record<string, any> = {};
    BUCKET_ORDER.forEach((bid) => {
        const b = QUESTIONS[bid];
        b?.questions.forEach((q) => {
            if (q.defaultValue !== undefined) out[q.id] = q.defaultValue;
        });
    });
    return out;
}

function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildFlatFromConfig(): FlatQuestionItem[] {
    const items: FlatQuestionItem[] = [];
    BUCKET_ORDER.forEach((bid, bi) => {
        const bucket = QUESTIONS[bid];
        if (!bucket) return;
        const label = bucket.name;
        (bucket.questions ?? []).forEach((q, qi) => {
            items.push({
                id: q.id,
                text: q.description,
                inputType: mapTypeToExpected(q.type),
                hint: q.hint ?? "",
                default:
                    q.defaultValue !== undefined
                        ? q.defaultValue
                        : q.type === "priority"
                            ? 70
                            : undefined,
                when: q.when,
                __bucketLabel: label,
                __bucketId: bid,
                __bi: bi,
                __qi: qi,
                __image: q.image,
            });
        });
    });
    return items;
}

/* ------------------------------------------------------------------ */
/* Conditional visibility helpers                                      */
/* ------------------------------------------------------------------ */
function evalCondition(cond: Condition, answers: Record<string, any>): boolean {
    if ("allOf" in cond) return cond.allOf.every((c) => evalCondition(c, answers));
    if ("anyOf" in cond) return cond.anyOf.some((c) => evalCondition(c, answers));
    const val = answers[cond.id];
    if (Object.prototype.hasOwnProperty.call(cond, "equals")) {
        // @ts-expect-error loose compare per schema
        return val === cond.equals;
    }
    if (Object.prototype.hasOwnProperty.call(cond, "notEquals")) {
        // @ts-expect-error loose compare per schema
        return val !== cond.notEquals;
    }
    // @ts-expect-error truthy/falsy narrow
    if ((cond as any).truthy) return !!val;
    // @ts-expect-error truthy/falsy narrow
    if ( (cond as any).falsy) return !val;
    return true;
}
function isVisible(q: FlatQuestionItem, answers: Record<string, any>): boolean {
    return !q.when || evalCondition(q.when, answers);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
const QuestionnairePage: React.FC = () => {
    const navigate = useNavigate();

    /* ---------- Build flat list and track the linear index ---------- */
    const flat = React.useMemo(() => buildFlatFromConfig(), []);
    const [linearIndex, setLinearIndex] = React.useState(0);
    const current = flat[linearIndex];

    /* ---------- Answers & local UI state ---------- */
    const [answers, setAnswers] = React.useState<Record<string, any>>(
        () => buildDefaultAnswers()
    );
    const [textOrNumber, setTextOrNumber] = React.useState<string>("");
    const [classes, setClasses] = React.useState<string[]>([]);
    const [selectedDays, setSelectedDays] = React.useState<DayName[]>([]);
    const [selectedTime, setSelectedTime] = React.useState<TimeName[]>([]);

    const [socialObligations, setSocialObligations] = React.useState<string[]>([]);
    const [socialFollowupsOpen, setSocialFollowupsOpen] = React.useState(false);
    const [socialListForFollowups, setSocialListForFollowups] = React.useState<string[]>([]);
    const [socialIdx, setSocialIdx] = React.useState(0);
    const [soIntervals, setSoIntervals] = React.useState<WeekdayIntervalsValue>({});

    /* NEW: Rich arrays from custom selectors */
    const [selfCarePrefs, setSelfCarePrefs] = React.useState<SelfCarePrefs[]>([]);
    const [exercisePrefs, setExercisePrefs] = React.useState<ExercisePrefs[]>([]);
    const [leisurePrefs, setLeisurePrefs] = React.useState<LeisurePrefs[]>([]);
    const [customPrefs, setCustomPrefs] = React.useState<CustomObligationPrefs[]>([]); // ⬅️ NEW

    /* ---------- Intro modal ---------- */
    const [showIntro, setShowIntro] = React.useState(true);
    React.useEffect(() => {
        document.documentElement.classList.toggle("modal-open", showIntro);
        return () => document.documentElement.classList.remove("modal-open");
    }, [showIntro]);
    const closeIntro = () => {
        setShowIntro(false);
        document.documentElement.classList.remove("modal-open");
    };

    /* ---------- Per-question modal ---------- */
    const [isModalOpen, setModalOpen] = React.useState(false);
    const [modalValid, setModalValid] = React.useState(true);
    React.useEffect(() => {
        document.documentElement.classList.toggle("modal-open", isModalOpen);
        return () => document.documentElement.classList.remove("modal-open");
    }, [isModalOpen]);
    const openModalForCurrent = () => {
        setModalOpen(true);
        setModalValid(true);
    };
    const closeModal = () => setModalOpen(false);

    /* ---------- Social follow-ups ---------- */
    function startSocialFollowUps(names: string[]) {
        if (!names.length) return;
        setSocialListForFollowups(names);
        setSocialIdx(0);
        setSoIntervals({});
        setSocialFollowupsOpen(true);
        document.documentElement.classList.add("modal-open");
    }
    function closeSocialFollowUps() {
        setSocialFollowupsOpen(false);
        document.documentElement.classList.remove("modal-open");
        setLinearIndex((i) => {
            for (let n = i + 1; n < flat.length; n++) {
                if (isVisible(flat[n], answers)) return n;
            }
            return i;
        });
    }
    function submitSocialFollowupStep() {
        const currentName = socialListForFollowups[socialIdx];
        if (!currentName) return;

        const count = Object.values(soIntervals).reduce(
            (acc, arr) => acc + (arr?.length ?? 0),
            0
        );
        if (count === 0) return;

        const base = `social_${slugify(currentName)}`;
        setAnswers((p) => ({
            ...p,
            [`${base}_intervals`]: JSON.parse(JSON.stringify(soIntervals)),
        }));

        const next = socialIdx + 1;
        if (next < socialListForFollowups.length) {
            setSocialIdx(next);
            setSoIntervals({});
        } else {
            closeSocialFollowUps();
        }
    }
    function renderSocialFollowupBody() {
        const name = socialListForFollowups[socialIdx] ?? "";
        if (!name) return null;

        return (
            <>
                <p className="q-hint">
                    Add the recurring days & times for <strong>{name}</strong>.
                </p>
                <WeekdayIntervals value={soIntervals} onChange={setSoIntervals} />
            </>
        );
    }

    /* ---------- Bucket ranges for mapping ---------- */
    const bucketRanges = React.useMemo(() => {
        const ranges: Array<{
            bucketId: BucketId;
            label: string;
            start: number;
            end: number;
            length: number;
        }> = [];
        let cursor = 0;
        BUCKET_ORDER.forEach((bid) => {
            const count = QUESTIONS[bid]?.questions.length ?? 0;
            if (count > 0) {
                const start = cursor;
                const end = cursor + count - 1;
                ranges.push({
                    bucketId: bid,
                    label: QUESTIONS[bid].name,
                    start,
                    end,
                    length: count,
                });
                cursor += count;
            }
        });
        return ranges;
    }, []);

    const currentRange = React.useMemo(
        () => bucketRanges.find((r) => linearIndex >= r.start && linearIndex <= r.end),
        [bucketRanges, linearIndex]
    );

    /* ---------- Visible questions ---------- */
    const visibleInCurrentBucket = React.useMemo(() => {
        if (!currentRange) return [] as number[];
        const list: number[] = [];
        for (let i = currentRange.start; i <= currentRange.end; i++) {
            if (isVisible(flat[i], answers)) list.push(i);
        }
        return list;
    }, [currentRange, flat, answers]);

    React.useEffect(() => {
        if (current && !isVisible(current, answers)) {
            for (let i = linearIndex + 1; i < flat.length; i++) {
                if (isVisible(flat[i], answers)) {
                    setLinearIndex(i);
                    return;
                }
            }
            for (let i = linearIndex - 1; i >= 0; i--) {
                if (isVisible(flat[i], answers)) {
                    setLinearIndex(i);
                    return;
                }
            }
        }
    }, [answers, current, flat, linearIndex]);

    const withinIndex = React.useMemo(() => {
        if (!currentRange || visibleInCurrentBucket.length === 0) return 0;
        const pos = visibleInCurrentBucket.indexOf(linearIndex);
        return Math.max(0, pos);
    }, [currentRange, visibleInCurrentBucket, linearIndex]);

    const images = React.useMemo(() => {
        if (!currentRange) return [];
        return visibleInCurrentBucket.map((idx) => flat[idx].__image);
    }, [flat, currentRange, visibleInCurrentBucket]);

    const handleCarouselIndexChange = (newWithin: number) => {
        if (!currentRange || visibleInCurrentBucket.length === 0) return;
        const clampedWithin = Math.max(0, Math.min(newWithin, visibleInCurrentBucket.length - 1));
        const targetLinear = visibleInCurrentBucket[clampedWithin];
        setLinearIndex(targetLinear);
    };

    /* ---------- Progress bar ---------- */
    const visibleInfo = React.useMemo(() => {
        let total = 0;
        const buckets = bucketRanges.map((r) => {
            const visIdx: number[] = [];
            for (let i = r.start; i <= r.end; i++) {
                if (isVisible(flat[i], answers)) visIdx.push(i);
            }
            const info = {
                id: r.bucketId,
                label: r.label,
                count: visIdx.length,
                offset: total,
                firstVisibleLinearIndex: visIdx.length ? visIdx[0] : null,
            };
            total += visIdx.length;
            return info;
        });

        let completed = 0;
        for (let i = 0; i < flat.length; i++) {
            if (!isVisible(flat[i], answers)) continue;
            if (i < linearIndex) completed += 1;
            else break;
        }

        return {
            buckets,
            totalVisible: total,
            completedVisible: completed,
        };
    }, [bucketRanges, flat, answers, linearIndex]);

    const onJumpToBucket = (bucketId: string) => {
        const b = visibleInfo.buckets.find((x) => x.id === bucketId);
        if (!b) return;
        if (b.firstVisibleLinearIndex !== null) {
            setLinearIndex(b.firstVisibleLinearIndex);
        } else {
            const range = bucketRanges.find((r) => r.bucketId === bucketId);
            if (!range) return;
            for (let i = range.end + 1; i < flat.length; i++) {
                if (isVisible(flat[i], answers)) {
                    setLinearIndex(i);
                    return;
                }
            }
            for (let i = range.start - 1; i >= 0; i--) {
                if (isVisible(flat[i], answers)) {
                    setLinearIndex(i);
                    return;
                }
            }
        }
    };

    /* ---------- Render the correct input in the question modal ---------- */
    const renderModalInput = () => {
        const item = flat[linearIndex];
        if (!item) return null;

        switch (item.inputType) {
            case "priority": {
                const uiVal = (answers[item.id] ?? item.default ?? 70) as number;
                return (
                    <PrioritySlider
                        variant="bucket"
                        value={Number(uiVal)}
                        onChange={(v) => setAnswers((p) => ({ ...p, [item.id]: v }))}
                    />
                );
            }
            case "number":
                return <NumberInput value={textOrNumber} onChange={setTextOrNumber} placeholder="0" />;
            case "text":
                return <TextInput value={textOrNumber} onChange={setTextOrNumber} placeholder={item.hint} />;
            case "enter-classes":
                return <EnterClasses value={classes} onChange={setClasses} />;
            case "time":
                return <TimeInput value={textOrNumber} onChange={setTextOrNumber} />;
            case "day-selection":
                return (
                    <DaySelection
                        value={selectedDays}
                        onChange={setSelectedDays}
                        ariaLabel="Select days (you can choose multiple)"
                    />
                );
            case "time-selection":
                return (
                    <TimeOfDaySelection
                        value={selectedTime}
                        onChange={setSelectedTime}
                        ariaLabel="Select your preferred time of day (you can choose multiple)"
                    />
                );
            case "boolean": {
                const boolVal =
                    (answers[item.id] as boolean | undefined) ??
                    (typeof item.default === "boolean" ? (item.default as boolean) : false);
                return (
                    <div className="q-center-control">
                        <SunMoonBoolean
                            value={!!boolVal}
                            onChange={(v) => setAnswers((p) => ({ ...p, [item.id]: v }))}
                            yesLabel="Yes"
                            noLabel="No"
                            ariaLabel="Toggle yes or no"
                        />
                    </div>
                );
            }
            case "enter-social":
                return (
                    <EnterObligations
                        value={socialObligations}
                        onChange={setSocialObligations}
                        label="Recurring Social Obligations"
                        placeholder="Add a recurring social obligation (e.g., Club meeting, Choir, D&D night)…"
                    />
                );
            case "weekday-time-intervals": {
                const currentVal = (answers[item.id] as WeekdayIntervalsValue) ?? {};
                return (
                    <WeekdayIntervals
                        value={currentVal}
                        onChange={(v) => setAnswers((p) => ({ ...p, [item.id]: v }))}
                    />
                );
            }
            case "selfcare-selector":
                return (
                    <SelfCareSelector
                        value={selfCarePrefs}
                        onChange={setSelfCarePrefs}
                        label="Choose self-care activities to include"
                        placeholder="Enter or choose a self-care activity…"
                    />
                );
            case "exercise-selector":
                return (
                    <ExerciseSelector
                        value={exercisePrefs}
                        onChange={setExercisePrefs}
                        label="Choose exercise to include"
                        inputPlaceholder="Enter an exercise…"
                        selectPlaceholder="Or choose from presets…"
                    />
                );
            case "leisure-selector":
                return (
                    <LeisureSelector
                        value={leisurePrefs}
                        onChange={setLeisurePrefs}
                        label="Choose leisure activities to include"
                        placeholder="Enter or choose a leisure activity…"
                    />
                );
            case "custom-obligations-selector":
                return (
                    <CustomObligationsSelector
                        value={customPrefs}
                        onChange={setCustomPrefs}
                        label="Add custom obligations/activities to include"
                        placeholder="Enter a custom obligation or activity…"
                    />
                );
            default:
                return (
                    <input
                        type="text"
                        value={textOrNumber}
                        onChange={(e) => setTextOrNumber(e.target.value)}
                        placeholder="Enter your answer"
                    />
                );
        }
    };

    /* ---------- Per-class follow-up mini-wizard (unchanged) ---------- */
    type SimpleClass = string;
    const [classFollowupsOpen, setClassFollowupsOpen] = React.useState(false);
    const [classListForFollowups, setClassListForFollowups] = React.useState<SimpleClass[]>([]);
    const [classIdx, setClassIdx] = React.useState(0);
    const [classStep, setClassStep] = React.useState(0);

    const [cfPriority, setCfPriority] = React.useState<number>(70);
    const [cfMeetDays, setCfMeetDays] = React.useState<string[]>([]);
    const [cfMeetStart, setCfMeetStart] = React.useState<string>("");
    const [cfMeetEnd, setCfMeetEnd] = React.useState<string>("");
    const [cfStudyHours, setCfStudyHours] = React.useState<string>("");
    const [cfPrefTimes, setCfPrefTimes] = React.useState<string[]>([]);

    React.useEffect(() => {
        document.documentElement.classList.toggle("modal-open", classFollowupsOpen);
        return () => document.documentElement.classList.remove("modal-open");
    }, [classFollowupsOpen]);

    function startClassFollowUps(classNames: SimpleClass[]) {
        if (!classNames.length) return;
        setClassListForFollowups(classNames);
        setClassIdx(0);
        setClassStep(0);

        setCfPriority(70);
        setCfMeetDays([]);
        setCfMeetStart("");
        setCfMeetEnd("");
        setCfStudyHours("");
        setCfPrefTimes([]);

        setClassFollowupsOpen(true);
    }
    function resetFollowupInputsForNextClass() {
        setCfPriority(70);
        setCfMeetDays([]);
        setCfMeetStart("");
        setCfMeetEnd("");
        setCfStudyHours("");
        setCfPrefTimes([]);
    }
    function closeClassFollowUps() {
        setClassFollowupsOpen(false);
        setLinearIndex((i) => {
            for (let n = i + 1; n < flat.length; n++) {
                if (isVisible(flat[n], answers)) return n;
            }
            return i;
        });
    }
    function submitClassFollowupStep() {
        const currentClass = classListForFollowups[classIdx];
        if (!currentClass) return;
        const keyBase = `class_${slugify(currentClass)}`;

        if (classStep === 0) {
            setAnswers((p) => ({ ...p, [`${keyBase}_priority`]: cfPriority }));
            setClassStep(1);
            return;
        }

        if (classStep === 1) {
            if (cfMeetDays.length === 0) return;
            if (!cfMeetStart.trim() || !cfMeetEnd.trim()) return;
            setAnswers((p) => ({
                ...p,
                [`${keyBase}_meeting_days`]: cfMeetDays.slice(),
                [`${keyBase}_meeting_time`]: { start: cfMeetStart, end: cfMeetEnd },
            }));
            setClassStep(2);
            return;
        }

        if (classStep === 2) {
            if (!cfStudyHours.trim()) return;
            setAnswers((p) => ({ ...p, [`${keyBase}_study_hours`]: cfStudyHours }));
            setClassStep(3);
            return;
        }

        if (cfPrefTimes.length === 0) return;
        setAnswers((p) => ({ ...p, [`${keyBase}_pref_times`]: cfPrefTimes.slice() }));

        const nextClass = classIdx + 1;
        if (nextClass < classListForFollowups.length) {
            setClassIdx(nextClass);
            setClassStep(0);
            resetFollowupInputsForNextClass();
        } else {
            closeClassFollowUps();
        }
    }
    function togglePrefTime(val: string) {
        setCfPrefTimes((prev) =>
            prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
        );
    }
    function toggleMeetDay(val: string) {
        setCfMeetDays((prev) =>
            prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
        );
    }
    function renderClassFollowupBody() {
        const name = classListForFollowups[classIdx] ?? "";
        if (!name) return null;

        if (classStep === 0) {
            return (
                <>
                    <PrioritySlider variant="bucket" value={cfPriority} onChange={setCfPriority} />
                    <p className="q-hint">Set how much priority you’re placing on this class.</p>
                </>
            );
        }

        if (classStep === 1) {
            const DAYS: Array<{ key: string; label: string }> = [
                { key: "monday", label: "Mon" },
                { key: "tuesday", label: "Tue" },
                { key: "wednesday", label: "Wed" },
                { key: "thursday", label: "Thu" },
                { key: "friday", label: "Fri" },
                { key: "saturday", label: "Sat" },
                { key: "sunday", label: "Sun" },
            ];
            return (
                <>
                    <div
                        role="group"
                        aria-label="Meeting days (select all that apply)"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(7, auto)",
                            gap: ".5rem",
                            marginBottom: "0.75rem",
                            overflowX: "auto",
                            paddingBottom: ".25rem",
                        }}
                    >
                        {DAYS.map((d) => (
                            <label
                                key={d.key}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: ".35rem",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={cfMeetDays.includes(d.key)}
                                    onChange={() => toggleMeetDay(d.key)}
                                />
                                <span>{d.label}</span>
                            </label>
                        ))}
                    </div>

                    <div className="q-time-grid" aria-label="Meeting time range">
                        <div className="q-time-compact">
                            <label style={{ display: "block", fontSize: ".9rem", opacity: 0.9, marginBottom: ".25rem" }}>
                                Start time
                            </label>
                            <TimeInput value={cfMeetStart} onChange={setCfMeetStart} />
                        </div>
                        <div className="q-time-compact">
                            <label style={{ display: "block", fontSize: ".9rem", opacity: 0.9, marginBottom: ".25rem" }}>
                                End time
                            </label>
                            <TimeInput value={cfMeetEnd} onChange={setCfMeetEnd} />
                        </div>
                    </div>

                    <p className="q-hint">Select meeting days and enter the usual start/end time for this class.</p>
                </>
            );
        }

        if (classStep === 2) {
            return (
                <>
                    <NumberInput value={cfStudyHours} onChange={setCfStudyHours} placeholder="e.g., 6 (hours per week)" />
                    <p className="q-hint">How many hours per week would you like to study for this class?</p>
                </>
            );
        }

        return (
            <>
                <div role="group" aria-label="Preferred study times (select all that apply)" style={{ display: "grid", gap: "0.5rem" }}>
                    {(["morning", "afternoon", "evening", "night"] as const).map((opt) => (
                        <label key={opt} style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                            <input
                                type="checkbox"
                                checked={cfPrefTimes.includes(opt)}
                                onChange={() => togglePrefTime(opt)}
                            />
                            <span style={{ textTransform: "capitalize" }}>{opt}</span>
                        </label>
                    ))}
                </div>
                <p className="q-hint">What times of day do you prefer to study for this class? (Select all that apply)</p>
            </>
        );
    }

    /* ---------- Submit / Back ---------- */
    const submitModal = () => {
        const item = flat[linearIndex];
        if (!item) return;

        let ok = true;

        if (item.inputType === "enter-classes") {
            ok = classes.length > 0;
        } else if (item.inputType === "enter-social") {
            ok = socialObligations.length > 0;
        } else if (item.inputType === "priority" || item.inputType === "boolean") {
            ok = true;
        } else if (item.inputType === "day-selection") {
            ok = selectedDays.length > 0;
        } else if (item.inputType === "time-selection") {
            ok = selectedTime.length > 0;
        } else if (item.inputType === "weekday-time-intervals") {
            ok = true;
        } else if (item.inputType === "selfcare-selector") {
            ok = selfCarePrefs.length > 0;
        } else if (item.inputType === "exercise-selector") {
            ok = exercisePrefs.length > 0;
        } else if (item.inputType === "leisure-selector") {
            ok = leisurePrefs.length > 0;
        } else if (item.inputType === "custom-obligations-selector") {
            ok = customPrefs.length > 0;
        } else {
            ok = textOrNumber.trim().length > 0;
        }

        setModalValid(ok);
        if (!ok) return;

        // store values
        if (item.inputType === "enter-classes") {
            setAnswers((p) => ({ ...p, [item.id]: classes.slice() }));
            setModalOpen(false);
            startClassFollowUps(classes.slice());
            return;
        } else if (item.inputType === "enter-social") {
            setAnswers((p) => ({ ...p, [item.id]: socialObligations.slice() }));
            setModalOpen(false);
            startSocialFollowUps(socialObligations.slice());
            return;
        } else if (item.inputType === "day-selection") {
            setAnswers((p) => ({ ...p, [item.id]: selectedDays.slice() }));
            setSelectedDays([]);
        } else if (item.inputType === "time-selection") {
            setAnswers((p) => ({ ...p, [item.id]: selectedTime.slice() }));
            setSelectedTime([]);
        } else if (item.inputType === "weekday-time-intervals") {
            // already stored within component
        } else if (item.inputType === "selfcare-selector") {
            setAnswers((p) => ({ ...p, [item.id]: selfCarePrefs.slice() }));
        } else if (item.inputType === "exercise-selector") {
            setAnswers((p) => ({ ...p, [item.id]: exercisePrefs.slice() }));
        } else if (item.inputType === "leisure-selector") {
            setAnswers((p) => ({ ...p, [item.id]: leisurePrefs.slice() }));
        } else if (item.inputType === "custom-obligations-selector") {
            setAnswers((p) => ({ ...p, [item.id]: customPrefs.slice() }));
        } else if (item.inputType === "priority" || item.inputType === "boolean") {
            // stored live via onChange
        } else {
            setAnswers((p) => ({ ...p, [item.id]: textOrNumber }));
            setTextOrNumber("");
        }

        setModalOpen(false);

        // advance to next visible
        for (let n = linearIndex + 1; n < flat.length; n++) {
            if (isVisible(flat[n], answers)) {
                setLinearIndex(n);
                return;
            }
        }
    };

    const goBack = () => {
        for (let p = linearIndex - 1; p >= 0; p--) {
            if (isVisible(flat[p], answers)) {
                setLinearIndex(p);
                return;
            }
        }
    };

    const onFinishAll = () => navigate("/schedule");

    return (
        <>
            {/* Main questionnaire page content */}
            <div className="questionnaire-page">
                <div className="questionnaire-content">
                    {/* Logo → home */}
                    <Link to="/" className="q-home-link" aria-label="Go to home">
                        <img src={logo} alt="App Logo" className="page-logo" />
                    </Link>

                    {/* Centered carousel + Answer CTA */}
                    <section className="qc-stack">
                        <div className="qc-safe-wrap">
                            <div className="qc-frame">
                                <QuestionCarousel
                                    images={images}
                                    index={withinIndex}
                                    onIndexChange={handleCarouselIndexChange}
                                    autoAdvanceMs={undefined}
                                    dragBufferPx={50}
                                    showDots
                                />
                            </div>
                        </div>

                        <div className="q-center-actions">
                            <button className="q-answer-btn" type="button" onClick={openModalForCurrent}>
                                Answer Question
                            </button>
                        </div>
                    </section>

                    {/* Back button */}
                    <div className="q-back-fixed">
                        <BackButton onClick={goBack} disabled={linearIndex === 0} />
                    </div>
                </div>
            </div>

            {/* Progress bar (bottom overlay) */}
            <ProgressBuckets
                buckets={visibleInfo.buckets}
                totalVisible={visibleInfo.totalVisible}
                completedVisible={visibleInfo.completedVisible}
                currentBucketId={currentRange?.bucketId ?? null}
                onJumpToBucket={onJumpToBucket}
            />

            {/* Intro modal */}
            <IntroModal isOpen={showIntro} imageSrc={introImg} onClose={closeIntro} buttonLabel="Get Started" />

            {/* Main question modal */}
            <QuestionModal
                isOpen={isModalOpen}
                title={current?.text}
                onClose={closeModal}
                onSubmit={submitModal}
                submitLabel="Submit"
            >
                {renderModalInput()}
                {current?.hint ? <p className="q-hint">{current.hint}</p> : null}
                {!modalValid && (
                    <p className="q-validate-msg" role="alert">
                        Please provide a valid answer to continue.
                    </p>
                )}
            </QuestionModal>

            {/* Class follow-up modal */}
            <QuestionModal
                isOpen={classFollowupsOpen}
                title={
                    classFollowupsOpen
                        ? (() => {
                            const name = classListForFollowups[classIdx] ?? "";
                            if (classStep === 0) return `How much priority are you putting on ${name}?`;
                            if (classStep === 1) return `When does ${name} meet?`;
                            if (classStep === 2) return `How many hours per week would you like to study for ${name}?`;
                            return `What times of day do you prefer to study for ${name}?`;
                        })()
                        : ""
                }
                onClose={closeClassFollowUps}
                onSubmit={submitClassFollowupStep}
                submitLabel={
                    classStep < 3 ? "Next" : classIdx < classListForFollowups.length - 1 ? "Next Class" : "Finish"
                }
            >
                {renderClassFollowupBody()}
            </QuestionModal>

            {/* Social follow-up modal */}
            <QuestionModal
                isOpen={socialFollowupsOpen}
                title={socialFollowupsOpen ? `When does ${socialListForFollowups[socialIdx] ?? ""} happen?` : ""}
                onClose={closeSocialFollowUps}
                onSubmit={submitSocialFollowupStep}
                submitLabel={socialIdx < socialListForFollowups.length - 1 ? "Next Obligation" : "Finish"}
            >
                {renderSocialFollowupBody()}
            </QuestionModal>
        </>
    );
};

export default QuestionnairePage;
