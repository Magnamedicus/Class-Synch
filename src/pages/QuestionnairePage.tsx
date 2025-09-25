import React from "react";
import { Link } from "react-router-dom";

import QuestionCarousel from "../components/QuestionCarousel";
import IntroModal from "../components/IntroModal";
import QuestionModal from "../components/QuestionModal";

import ContinueButton from "../components/ContinueButton"; // (not used here but kept if you reference elsewhere)
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
import imgA from "../assets/class_synch_bg.png";
import imgB from "../assets/logo.png";
import imgC from "../assets/q_bg.png";

/* ------------------------------------------------------------------ */
/* Demo questionnaire data (same structure you were using)             */
/* ------------------------------------------------------------------ */
const questionnaire = [
    {
        bucket: "School Work",
        questions: [
            {
                id: "bucket_priority_school_work",
                text: "How much do you prioritize School Work this week?",
                inputType: "priority",
                hint: "Higher priority wins conflicts with other tasks",
                default: 70,
            },
            { id: "q1", text: "How many classes are you taking?", inputType: "number", hint: "Enter a number" },
            { id: "q2", text: "Name your classes (or upload schedule)", inputType: "enter-classes", hint: "Type class names" },
        ],
    },
    {
        bucket: "Sleep",
        questions: [
            { id: "q3", text: "How many hours would you like to sleep per night?", inputType: "number", hint: "Enter a number" },
            { id: "q4", text: "What time do you usually go to bed?", inputType: "time", hint: "Choose a time" },
        ],
    },
] as const;

type QuestionItem = (typeof questionnaire)[number]["questions"][number] & {
    __bucket: string;
    __bi: number;
    __qi: number;
};

function flattenQuestions(): QuestionItem[] {
    const out: QuestionItem[] = [];
    questionnaire.forEach((b, bi) => {
        b.questions.forEach((q, qi) => out.push({ ...q, __bucket: b.bucket, __bi: bi, __qi: qi }));
    });
    return out;
}

/* Images for the carousel (cycled if fewer than questions) */
const carouselImages = [imgA, imgB, imgC];

const QuestionnairePage: React.FC = () => {
    /* ---------- data & navigation ---------- */
    const flat = React.useMemo(() => flattenQuestions(), []);
    const [linearIndex, setLinearIndex] = React.useState(0);
    const current = flat[linearIndex];

    /* ---------- answers ---------- */
    const [answers, setAnswers] = React.useState<Record<string, any>>({});
    const [textOrNumber, setTextOrNumber] = React.useState<string>("");
    const [classes, setClasses] = React.useState<string[]>([]);

    /* ---------- intro modal (always on arrival) ---------- */
    const [showIntro, setShowIntro] = React.useState(true);
    React.useEffect(() => {
        // always show intro each time this page mounts
        document.documentElement.classList.toggle("modal-open", showIntro);
        return () => document.documentElement.classList.remove("modal-open");
    }, [showIntro]);

    const closeIntro = () => {
        setShowIntro(false);
        document.documentElement.classList.remove("modal-open");
    };

    /* ---------- per-question modal ---------- */
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
    const closeModal = () => {
        setModalOpen(false);
    };

    /* ---------- render the correct input in the question modal ---------- */
    const renderModalInput = () => {
        if (!current) return null;

        switch (current.inputType) {
            case "priority": {
                const uiVal = answers[current.id] ?? current.default ?? 70;
                return (
                    <PrioritySlider
                        variant="bucket"
                        label={current.text}
                        helpText={current.hint}
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

    /* ---------- submit logic ---------- */
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
            setAnswers((p) => ({ ...p, [current.id]: classes.slice() }));
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

    /* ---------- images aligned to questions ---------- */
    const images = React.useMemo(() => {
        if (carouselImages.length >= flat.length) return carouselImages.slice(0, flat.length);
        const r: string[] = [];
        for (let i = 0; i < flat.length; i++) r.push(carouselImages[i % carouselImages.length]);
        return r;
    }, [flat.length]);

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
                                    images={images}
                                    index={linearIndex}
                                    onIndexChange={setLinearIndex}
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
        </>
    );

};

export default QuestionnairePage;
