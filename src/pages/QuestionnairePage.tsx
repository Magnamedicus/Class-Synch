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

import "../css/QuestionnairePage.css";

/* Assets */
import logo from "../assets/logo.png";
import introImg from "../assets/questionnaire_intro_img.png";

/* Centralized questions config (images + question types) */
import QUESTIONS, { type BucketId } from "../utils/questions";

/* ------------------------------------------------------------------ */
/* Bucket order for the questionnaire                                 */
/* ------------------------------------------------------------------ */
const BUCKET_ORDER: BucketId[] = [
    "school",
    "sleep",
    "work",
    "social",
    "selfCare",
    "exercise",
    "leisure",
    "custom",
];

/* ------------------------------------------------------------------ */
/* Map questions.ts types to your page’s expected modal input types    */
/* ------------------------------------------------------------------ */
type InputTypeExpected =
    | "priority"
    | "number"
    | "text"
    | "enter-classes"
    | "time";

function mapTypeToExpected(t: string): InputTypeExpected {
    switch (t) {
        case "priority":
            return "priority";
        case "number":
            return "number";
        case "text":
            return "text";
        case "enter-classes":
            return "enter-classes";
        case "time":
            return "time";
        default:
            // Any not-yet-implemented types gracefully fall back to text
            return "text";
    }
}

/* ------------------------------------------------------------------ */
/* Flatten questions from config into a single linear sequence         */
/* (keeps your existing linearIndex navigation & back button behavior) */
/* ------------------------------------------------------------------ */
type FlatQuestionItem = {
    id: string;
    text: string;          // used as modal title
    inputType: InputTypeExpected;
    hint?: string;
    default?: number;
    __bucketLabel: string; // e.g., "School Work"
    __bucketId: BucketId;  // e.g., "school"
    __bi: number;          // bucket index in BUCKET_ORDER
    __qi: number;          // index within bucket
    __image: string;       // per-question image from QUESTIONS
};

function buildFlatFromConfig(): FlatQuestionItem[] {
    const items: FlatQuestionItem[] = [];
    BUCKET_ORDER.forEach((bid, bi) => {
        const bucket = QUESTIONS[bid];
        if (!bucket) return;
        const label = bucket.name;
        (bucket.questions ?? []).forEach((q, qi) => {
            items.push({
                id: q.id,
                text: q.description,                   // modal title
                inputType: mapTypeToExpected(q.type),  // modal input type
                hint: "",                              // keep your previous hint default
                default: q.type === "priority" ? 70 : undefined,
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
/* Component                                                           */
/* ------------------------------------------------------------------ */
const QuestionnairePage: React.FC = () => {
    const navigate = useNavigate();

    /* ---------- Build flat list and track the linear index ---------- */
    const flat = React.useMemo(() => buildFlatFromConfig(), []);
    const [linearIndex, setLinearIndex] = React.useState(0);
    const current = flat[linearIndex];

    /* ---------- Map linear index to current bucket + within-bucket --- */
    const bucketRanges = React.useMemo(() => {
        // ranges like: [{bucketId, label, start, end, length}]
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

    const withinIndex = React.useMemo(() => {
        if (!currentRange) return 0;
        return linearIndex - currentRange.start;
    }, [currentRange, linearIndex]);

    const images = React.useMemo(() => {
        if (!currentRange) return [];
        const { start, end } = currentRange;
        return flat.slice(start, end + 1).map((q) => q.__image);
    }, [flat, currentRange]);

    const handleCarouselIndexChange = (newWithin: number) => {
        if (!currentRange) return;
        const newLinear = currentRange.start + Math.max(0, Math.min(newWithin, currentRange.length - 1));
        setLinearIndex(newLinear);
    };

    /* ---------- answers (same pattern you used) ---------- */
    const [answers, setAnswers] = React.useState<Record<string, any>>({});
    const [textOrNumber, setTextOrNumber] = React.useState<string>("");
    const [classes, setClasses] = React.useState<string[]>([]);

    /* ---------- intro modal (unchanged behavior) ---------- */
    const [showIntro, setShowIntro] = React.useState(true);
    React.useEffect(() => {
        document.documentElement.classList.toggle("modal-open", showIntro);
        return () => document.documentElement.classList.remove("modal-open");
    }, [showIntro]);

    const closeIntro = () => {
        setShowIntro(false);
        document.documentElement.classList.remove("modal-open");
    };

    /* ---------- per-question modal (unchanged behavior) ---------- */
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

    /* ---------- render the correct input in the question modal ---------- */
    const renderModalInput = () => {
        if (!current) return null;

        switch (current.inputType) {
            case "priority": {
                const uiVal = answers[current.id] ?? current.default ?? 70;
                return (
                    <PrioritySlider
                        variant="bucket"
                        label={undefined}
                        helpText={undefined}
                        value={Number(uiVal)}
                        onChange={(v) => setAnswers((p) => ({ ...p, [current.id]: v }))}
                    />
                );
            }
            case "number":
                return <NumberInput value={textOrNumber} onChange={setTextOrNumber} placeholder="0" />;
            case "text":
                return <TextInput value={textOrNumber} onChange={setTextOrNumber} placeholder={current.hint} />;
            case "enter-classes":
                return <EnterClasses value={classes} onChange={setClasses} />;
            case "time":
                return <TimeInput value={textOrNumber} onChange={setTextOrNumber} />;
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
    type SimpleClass = string; // using your current EnterClasses as string[]

    const [classFollowupsOpen, setClassFollowupsOpen] = React.useState(false);
    const [classListForFollowups, setClassListForFollowups] = React.useState<SimpleClass[]>([]);
    const [classIdx, setClassIdx] = React.useState(0);
    const [classStep, setClassStep] = React.useState(0);

    // local inputs for the follow-ups
    const [cfPriority, setCfPriority] = React.useState<number>(70);

    // NEW: meeting days + time range
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
        // After finishing all classes, advance to the next *question* in the linear flow
        setLinearIndex((i) => Math.min(i + 1, flat.length - 1));
    }

    function submitClassFollowupStep() {
        const currentClass = classListForFollowups[classIdx];
        if (!currentClass) return;
        const keyBase = `class_${slugify(currentClass)}`;

        // Step 0: Priority
        if (classStep === 0) {
            setAnswers((p) => ({ ...p, [`${keyBase}_priority`]: cfPriority }));
            setClassStep(1);
            return;
        }

        // Step 1: Meeting days + time range (validate at least one day + both times)
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

        // Step 2: Study hours (simple required)
        if (classStep === 2) {
            if (!cfStudyHours.trim()) return;
            setAnswers((p) => ({ ...p, [`${keyBase}_study_hours`]: cfStudyHours }));
            setClassStep(3);
            return;
        }

        // Step 3: Preferred times (multi-select; require at least one)
        if (cfPrefTimes.length === 0) return;
        setAnswers((p) => ({ ...p, [`${keyBase}_pref_times`]: cfPrefTimes.slice() }));

        // Next class or finish
        const nextClass = classIdx + 1;
        if (nextClass < classListForFollowups.length) {
            setClassIdx(nextClass);
            setClassStep(0);
            resetFollowupInputsForNextClass();
        } else {
            // done with all classes
            closeClassFollowUps();
        }
    }

    // Toggle selection for multi-select chips (checkboxes for simplicity)
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

        // Step 0: Priority
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

        // Step 1: Meeting days + time range
        // Step 1: Meeting days + time range
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
                            overflowX: "auto",           // just-in-case safety on very small screens
                            paddingBottom: ".25rem",
                        }}
                    >
                        {DAYS.map((d) => (
                            <label key={d.key} style={{ display: "flex", alignItems: "center", gap: ".35rem", whiteSpace: "nowrap" }}>
                                <input
                                    type="checkbox"
                                    checked={cfMeetDays.includes(d.key)}
                                    onChange={() => toggleMeetDay(d.key)}
                                />
                                <span>{d.label}</span>
                            </label>
                        ))}
                    </div>

                    {/* Compact, responsive two-column layout for time range */}
                    <div className="q-time-grid" aria-label="Meeting time range">
                        <div className="q-time-compact">
                            <label style={{ display: "block", fontSize: ".9rem", opacity: .9, marginBottom: ".25rem" }}>
                                Start time
                            </label>
                            <TimeInput value={cfMeetStart} onChange={setCfMeetStart} />
                        </div>
                        <div className="q-time-compact">
                            <label style={{ display: "block", fontSize: ".9rem", opacity: .9, marginBottom: ".25rem" }}>
                                End time
                            </label>
                            <TimeInput value={cfMeetEnd} onChange={setCfMeetEnd} />
                        </div>
                    </div>

                    <p className="q-hint">Select meeting days and enter the usual start/end time for this class.</p>
                </>
            );
        }


        // Step 2: Study hours per week
        if (classStep === 2) {
            return (
                <>
                    <NumberInput
                        value={cfStudyHours}
                        onChange={setCfStudyHours}
                        placeholder="e.g., 6 (hours per week)"
                    />
                    <p className="q-hint">How many hours per week would you like to study for this class?</p>
                </>
            );
        }

        // Step 3: Preferred times (select all that apply)
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

    /* ---------- submit logic (unchanged UX; adds follow-up trigger) ---------- */
    const submitModal = () => {
        if (!current) return;

        let ok = true;
        if (current.inputType === "enter-classes") {
            ok = classes.length > 0;
        } else if (current.inputType === "priority") {
            ok = true; // slider stored live
        } else {
            ok = textOrNumber.trim().length > 0;
        }
        setModalValid(ok);
        if (!ok) return;

        if (current.inputType === "enter-classes") {
            // Save classes, close this modal, then run per-class follow-ups
            setAnswers((p) => ({ ...p, [current.id]: classes.slice() }));
            setModalOpen(false);
            startClassFollowUps(classes.slice());
            return; // do NOT advance linearIndex yet; we do it after follow-ups
        } else if (current.inputType !== "priority") {
            setAnswers((p) => ({ ...p, [current.id]: textOrNumber }));
            setTextOrNumber("");
        }

        setModalOpen(false);
        // advance to next question
        setLinearIndex((i) => Math.min(i + 1, flat.length - 1));
    };

    const goBack = () => {
        setLinearIndex((i) => Math.max(0, i - 1));
    };

    // Optional: finish callback (unchanged)
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

                    {/* Stack keeps the carousel lowered from the top and centers the CTA */}
                    <section className="qc-stack">
                        <div className="qc-safe-wrap">
                            <div className="qc-frame">
                                <QuestionCarousel
                                    images={images}                  // images for CURRENT BUCKET only
                                    index={withinIndex}              // index within CURRENT BUCKET
                                    onIndexChange={handleCarouselIndexChange} // dot/drag -> linear index mapping
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

            {/* ⬇️ Render modals OUTSIDE the blurred container */}
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
