import React from "react";
import { Link, useNavigate } from "react-router-dom";

import QuestionCarousel from "../components/QuestionCarousel";
import IntroModal from "../components/IntroModal";
import QuestionModal from "../components/QuestionModal";

import ContinueButton from "../components/ContinueButton"; // kept for consistency if you reference elsewhere
import BackButton from "../components/BackButton";

import PrioritySlider from "../components/inputs/PrioritySlider";
import NumberInput from "../components/inputs/NumberInput";
import TextInput from "../components/inputs/TextInput";
import EnterClasses from "../components/inputs/EnterClasses";
import TimeInput from "../components/inputs/TimeInput";
import DaySelection, { type DayName } from "../components/inputs/DaySelection";
import TimeOfDaySelection, { type TimeName } from "../components/inputs/TimeOfDaySelection";
import SunMoonBoolean from "../components/inputs/SunMoonBoolean";
import WeekdayIntervals, {type WeekdayIntervalsValue,} from "../components/inputs/WeekdayIntervals";



import ProgressBuckets from "../components/ProgressBuckets";

import "../css/QuestionnairePage.css";

/* Assets */
import logo from "../assets/logo.png";
import introImg from "../assets/questionnaire_intro_img.png";

/* Centralized questions config (images + question types + conditions) */
import QUESTIONS, {
    BUCKET_ORDER,
    type BucketId,
    type Condition,
} from "../utils/questions";

/* ------------------------------------------------------------------ */
/* Map questions.ts types to this page’s modal input components        */
/* ------------------------------------------------------------------ */
type InputTypeExpected =
    | "priority"
    | "number"
    | "text"
    | "enter-classes"
    | "time"
    | "day-selection"
    | "boolean"
    | "time-selection"
    |"weekday-time-intervals";

function mapTypeToExpected(t: string): InputTypeExpected {
    switch (t) {
        case "priority":
        case "number":
        case "text":
        case "enter-classes":
        case "time":
        case "time-selection":
        case "day-selection":
        case "boolean":
        case "weekday-time-intervals":   // ✅ add mapping
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
    if (cond.truthy) return !!val;
    // @ts-expect-error truthy/falsy narrow
    if (cond.falsy) return !val;
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
    const [answers, setAnswers] = React.useState<Record<string, any>>(() => buildDefaultAnswers());
    const [textOrNumber, setTextOrNumber] = React.useState<string>("");
    const [classes, setClasses] = React.useState<string[]>([]);
    const [selectedDays, setSelectedDays] = React.useState<DayName[]>([]);
    const [selectedTime, setSelectedTime] = React.useState<TimeName[]>([]);


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

    /* ---------- Bucket ranges for mapping (static from config order) ---------- */
    const bucketRanges = React.useMemo(() => {
        const ranges: Array<{
            bucketId: BucketId;
            label: string;
            start: number;
            end: number; // inclusive
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

    /* ---------- Visible questions (apply conditions) ---------- */
    const visibleInCurrentBucket = React.useMemo(() => {
        if (!currentRange) return [] as number[];
        const list: number[] = [];
        for (let i = currentRange.start; i <= currentRange.end; i++) {
            if (isVisible(flat[i], answers)) list.push(i);
        }
        return list;
    }, [currentRange, flat, answers]);

    // If the current question becomes hidden due to a changed answer, auto-jump
    React.useEffect(() => {
        if (current && !isVisible(current, answers)) {
            // try forward
            for (let i = linearIndex + 1; i < flat.length; i++) {
                if (isVisible(flat[i], answers)) {
                    setLinearIndex(i);
                    return;
                }
            }
            // then backward
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

    /* ---------- Progress bar (global visible progress + bucket landmarks) ---------- */
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

        // completed = number of visible questions with index < linearIndex
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
            // if no visible items in that bucket, jump to next visible after it
            const range = bucketRanges.find((r) => r.bucketId === bucketId);
            if (!range) return;
            for (let i = range.end + 1; i < flat.length; i++) {
                if (isVisible(flat[i], answers)) {
                    setLinearIndex(i);
                    return;
                }
            }
            // or previous visible
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
                        label={undefined}
                        helpText={undefined}
                        value={Number(uiVal)}
                        onChange={(v) => setAnswers((p) => ({ ...p, [item.id]: v }))}
                    />
                );
            }
            case "number":
                return (
                    <NumberInput
                        value={textOrNumber}
                        onChange={setTextOrNumber}
                        placeholder="0"
                    />
                );
            case "text":
                return (
                    <TextInput
                        value={textOrNumber}
                        onChange={setTextOrNumber}
                        placeholder={item.hint}
                    />
                );
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

            case "weekday-time-intervals": {
                const currentVal = (answers[item.id] as WeekdayIntervalsValue) ?? {};
                return (
                    <WeekdayIntervals
                        value={currentVal}
                        onChange={(v) =>
                            setAnswers((p) => ({ ...p, [item.id]: v }))
                        }
                    />
                );
            }
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

    /* ---------- Per-class follow-up mini-wizard (after EnterClasses) ---------- */
    type SimpleClass = string;

    const [classFollowupsOpen, setClassFollowupsOpen] = React.useState(false);
    const [classListForFollowups, setClassListForFollowups] = React.useState<SimpleClass[]>([]);
    const [classIdx, setClassIdx] = React.useState(0);
    const [classStep, setClassStep] = React.useState(0);

    // local inputs
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

    function slugify(s: string) {
        return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }

    function startClassFollowUps(classNames: SimpleClass[]) {
        if (!classNames.length) return;
        setClassListForFollowups(classNames);
        setClassIdx(0);
        setClassStep(0);

        // reset inputs
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
        // advance to next *visible* question
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
                    <PrioritySlider
                        variant="bucket"
                        label={undefined}
                        helpText={undefined}
                        value={cfPriority}
                        onChange={setCfPriority}
                    />
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
                            <label
                                style={{
                                    display: "block",
                                    fontSize: ".9rem",
                                    opacity: 0.9,
                                    marginBottom: ".25rem",
                                }}
                            >
                                Start time
                            </label>
                            <TimeInput value={cfMeetStart} onChange={setCfMeetStart} />
                        </div>
                        <div className="q-time-compact">
                            <label
                                style={{
                                    display: "block",
                                    fontSize: ".9rem",
                                    opacity: 0.9,
                                    marginBottom: ".25rem",
                                }}
                            >
                                End time
                            </label>
                            <TimeInput value={cfMeetEnd} onChange={setCfMeetEnd} />
                        </div>
                    </div>

                    <p className="q-hint">
                        Select meeting days and enter the usual start/end time for this class.
                    </p>
                </>
            );
        }

        if (classStep === 2) {
            return (
                <>
                    <NumberInput
                        value={cfStudyHours}
                        onChange={setCfStudyHours}
                        placeholder="e.g., 6 (hours per week)"
                    />
                    <p className="q-hint">
                        How many hours per week would you like to study for this class?
                    </p>
                </>
            );
        }

        return (
            <>
                <div
                    role="group"
                    aria-label="Preferred study times (select all that apply)"
                    style={{ display: "grid", gap: "0.5rem" }}
                >
                    {(["morning", "afternoon", "evening", "night"] as const).map((opt) => (
                        <label
                            key={opt}
                            style={{ display: "flex", alignItems: "center", gap: ".5rem" }}
                        >
                            <input
                                type="checkbox"
                                checked={cfPrefTimes.includes(opt)}
                                onChange={() => togglePrefTime(opt)}
                            />
                            <span style={{ textTransform: "capitalize" }}>{opt}</span>
                        </label>
                    ))}
                </div>
                <p className="q-hint">
                    What times of day do you prefer to study for this class? (Select all that
                    apply)
                </p>
            </>
        );
    }

    /* ---------- Submit / Back (honor visibility) ---------- */
    const submitModal = () => {
        const item = flat[linearIndex];
        if (!item) return;

        let ok = true;

        if (item.inputType === "enter-classes") {
            ok = classes.length > 0;

        } else if (item.inputType === "priority" || item.inputType === "boolean") {
            ok = true; // stored live

        } else if (item.inputType === "day-selection") {
            ok = selectedDays.length > 0;

        } else if (item.inputType === "time-selection") {
            ok = selectedTime.length > 0;

        } else if (item.inputType === "weekday-time-intervals") {
            // ✅ validate at least one interval exists
            const v = (answers[item.id] as Record<string, Array<{ start: string; end: string }>> | undefined) ?? {};
            const count = Object.values(v).reduce((acc, arr) => acc + (arr?.length ?? 0), 0);
            ok = count > 0;

        } else {
            ok = textOrNumber.trim().length > 0;
        }

        setModalValid(ok);
        if (!ok) return;

        if (item.inputType === "enter-classes") {
            setAnswers((p) => ({ ...p, [item.id]: classes.slice() }));
            setModalOpen(false);
            startClassFollowUps(classes.slice());
            return;

        } else if (item.inputType === "priority" || item.inputType === "boolean") {
            // already saved live

        } else if (item.inputType === "day-selection") {
            setAnswers((p) => ({ ...p, [item.id]: selectedDays.slice() }));
            setSelectedDays([]);

        } else if (item.inputType === "time-selection") {
            setAnswers((p) => ({ ...p, [item.id]: selectedTime.slice() }));
            setSelectedTime([]);

        } else if (item.inputType !== "weekday-time-intervals") {
            // text/number/time etc.
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

    // Optional: finish callback
    const onFinishAll = () => navigate("/schedule");

    return (
        <>
            {/* Blur/disable ONLY this content when a modal is open */}
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

                    {/* Back button (fixed) */}
                    <div className="q-back-fixed">
                        <BackButton onClick={goBack} disabled={linearIndex === 0} />
                    </div>
                </div>
            </div>

            {/* Progress bar (fixed overlay; doesn’t shift layout) */}
            <ProgressBuckets
                buckets={visibleInfo.buckets}
                totalVisible={visibleInfo.totalVisible}
                completedVisible={visibleInfo.completedVisible}
                currentBucketId={currentRange?.bucketId ?? null}
                onJumpToBucket={onJumpToBucket}
            />

            {/* ⬇️ Modals (outside blurred container) */}
            <IntroModal
                isOpen={showIntro}
                imageSrc={introImg}
                onClose={closeIntro}
                buttonLabel="Get Started"
            />

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

            {/* Per-class follow-up modal (appears after Enter Classes) */}
            <QuestionModal
                isOpen={classFollowupsOpen}
                title={
                    classFollowupsOpen
                        ? (() => {
                            const name = classListForFollowups[classIdx] ?? "";
                            if (classStep === 0)
                                return `How much priority are you putting on ${name}?`;
                            if (classStep === 1) return `When does ${name} meet?`;
                            if (classStep === 2)
                                return `How many hours per week would you like to study for ${name}?`;
                            return `What times of day do you prefer to study for ${name}?`;
                        })()
                        : ""
                }
                onClose={closeClassFollowUps}
                onSubmit={submitClassFollowupStep}
                submitLabel={
                    classStep < 3
                        ? "Next"
                        : classIdx < classListForFollowups.length - 1
                            ? "Next Class"
                            : "Finish"
                }
            >
                {renderClassFollowupBody()}
            </QuestionModal>
        </>
    );
};

export default QuestionnairePage;
