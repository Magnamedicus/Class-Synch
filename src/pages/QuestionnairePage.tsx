import React from "react";
import { Link, useLocation } from "react-router-dom";

/* UI pieces */
import QuestionCarousel from "../components/QuestionCarousel";
import QuestionModal from "../components/QuestionModal";
import IntroModal from "../components/IntroModal";

import PrioritySlider from "../components/inputs/PrioritySlider";
import NumberInput from "../components/inputs/NumberInput";
import TextInput from "../components/inputs/TextInput";
import EnterClasses from "../components/inputs/EnterClasses";
import TimeInput from "../components/inputs/TimeInput";
import BackButton from "../components/BackButton";

/* Styles & assets */
import "../css/QuestionnairePage.css";
import logo from "../assets/logo.png";

/* Carousel images (imported so bundler resolves hashed URLs) */
import imgA from "../assets/class_synch_bg.png";
import imgB from "../assets/logo.png";
import imgC from "../assets/q_bg.png";

/* Intro modal image (exact filename as requested) */
import introImg from "../assets/questionnaire_intro_img.png";

/* ================================================
   Questionnaire definition (expand as you go)
   ================================================ */
const questionnaire = [
    {
        bucket: "School Work",
        questions: [
            {
                id: "bucket_priority_school_work",
                text: "How much do you prioritize School Work this week?",
                inputType: "priority",
                hint: "Higher priority wins conflicts with other tasks",
                default: 70, // UI 0–100
            },
            {
                id: "q1",
                text: "How many classes are you taking?",
                inputType: "number",
                hint: "Enter a number",
            },
            {
                id: "q2",
                text: "Name your classes (or upload schedule)",
                inputType: "enter-classes",
                hint: "Type class names",
            },
        ],
    },
    {
        bucket: "Sleep",
        questions: [
            {
                id: "q3",
                text: "How many hours would you like to sleep per night?",
                inputType: "number",
                hint: "Enter a number",
            },
            {
                id: "q4",
                text: "What time do you usually go to bed?",
                inputType: "time",
                hint: "Choose a time",
            },
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

/* ================================================
   Local persistence (answers only — no intro memory)
   ================================================ */
const STORAGE_KEY = "classsynch.questionnaire.v1";
const loadPersisted = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};
const savePersisted = (data: any) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
};

/* ================================================
   Component
   ================================================ */
const carouselImages = [imgA, imgB, imgC];

const QuestionnairePage: React.FC = () => {
    const location = useLocation();

    const flat = React.useMemo(() => flattenQuestions(), []);
    const [linearIndex, setLinearIndex] = React.useState(0);
    const current = flat[linearIndex];

    // Answers (store UI values; normalize later when generating schedule)
    const [answers, setAnswers] = React.useState<Record<string, any>>(() => {
        const persisted = loadPersisted();
        return persisted?.answers ?? {};
    });
    const [classes, setClasses] = React.useState<string[]>(() => {
        const persisted = loadPersisted();
        return persisted?.classes ?? [];
    });

    // Question modal
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [modalValue, setModalValue] = React.useState<any>("");

    // Intro modal: ALWAYS open on page mount/arrival
    const [showIntro, setShowIntro] = React.useState<boolean>(true);

    // If your router keeps this component mounted, re-open intro when you navigate back here
    React.useEffect(() => {
        setShowIntro(true);
    }, [location.pathname]);

    // When any modal is open, add html.modal-open to blur background
    React.useEffect(() => {
        const active = isModalOpen || showIntro;
        const el = document.documentElement;
        if (active) el.classList.add("modal-open");
        else el.classList.remove("modal-open");
    }, [isModalOpen, showIntro]);

    const closeIntro = React.useCallback(() => {
        setShowIntro(false);
    }, []);

    // Persist progress (answers/classes/index)
    React.useEffect(() => {
        savePersisted({ answers, classes, linearIndex });
    }, [answers, classes, linearIndex]);

    // Map images to # of questions (cycle if fewer)
    const images = React.useMemo(() => {
        if (carouselImages.length >= flat.length) return carouselImages.slice(0, flat.length);
        const r: string[] = [];
        for (let i = 0; i < flat.length; i++) r.push(carouselImages[i % carouselImages.length]);
        return r;
    }, [flat.length]);

    // Open question modal for current item and preload value
    const openModalForCurrent = React.useCallback(() => {
        if (!current) return;
        if (current.inputType === "enter-classes") {
            setModalValue([...classes]);
        } else if (current.inputType === "priority") {
            setModalValue(answers[current.id] ?? current.default ?? 70);
        } else {
            setModalValue(answers[current.id] ?? "");
        }
        setIsModalOpen(true);
    }, [current, answers, classes]);

    const closeModal = React.useCallback(() => setIsModalOpen(false), []);

    // Modal validation (basic)
    const modalValid = React.useMemo(() => {
        if (!current) return false;
        switch (current.inputType) {
            case "priority":
                return typeof modalValue === "number" && modalValue >= 0 && modalValue <= 100;
            case "number":
                return String(modalValue).trim().length > 0 && !Number.isNaN(Number(modalValue));
            case "text":
                return String(modalValue).trim().length > 0;
            case "enter-classes":
                return Array.isArray(modalValue) && modalValue.length > 0;
            case "time":
                return String(modalValue).trim().length > 0;
            default:
                return true;
        }
    }, [current, modalValue]);

    // Submit answer from modal and advance
    const submitModal = React.useCallback(() => {
        if (!current || !modalValid) return;

        if (current.inputType === "enter-classes") {
            const arr = Array.isArray(modalValue) ? modalValue.slice() : [];
            setAnswers((p) => ({ ...p, [current.id]: arr }));
            setClasses(arr);
        } else {
            setAnswers((p) => ({ ...p, [current.id]: modalValue }));
        }

        closeModal();
        setLinearIndex((i) => (i + 1 < flat.length ? i + 1 : i)); // stay on last if finished
    }, [current, modalValue, modalValid, closeModal, flat.length]);

    const goBack = () => setLinearIndex((i) => Math.max(0, i - 1));

    // Render the proper input in the modal
    const renderModalInput = () => {
        if (!current) return null;
        switch (current.inputType) {
            case "priority":
                return (
                    <PrioritySlider
                        variant="bucket"
                        label={current.text}
                        helpText={current.hint}
                        value={Number(modalValue ?? 70)}
                        onChange={(v) => setModalValue(v)}
                    />
                );
            case "number":
                return (
                    <NumberInput
                        value={String(modalValue ?? "")}
                        onChange={(v) => setModalValue(v)}
                        placeholder="0"
                    />
                );
            case "text":
                return (
                    <TextInput
                        value={String(modalValue ?? "")}
                        onChange={(v) => setModalValue(v)}
                        placeholder={current.hint}
                    />
                );
            case "enter-classes":
                return (
                    <EnterClasses
                        value={Array.isArray(modalValue) ? modalValue : []}
                        onChange={(arr) => setModalValue(arr)}
                    />
                );
            case "time":
                return (
                    <TimeInput
                        value={String(modalValue ?? "")}
                        onChange={(v) => setModalValue(v)}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="questionnaire-page">
            {/* Logo → home */}
            <Link to="/" className="q-home-link" aria-label="Go to home">
                <img src={logo} alt="App Logo" className="page-logo" />
            </Link>

            {/* Centered, slightly smaller carousel */}
            <div className="q-center">
                <div className="q-carousel-wrap">
                    <QuestionCarousel
                        images={images}
                        index={linearIndex}
                        onIndexChange={setLinearIndex}
                        autoAdvanceMs={undefined}
                        dragBufferPx={50}
                        showDots
                    />
                </div>

                {/* Single centered action */}
                <div className="q-center-actions">
                    <button className="q-answer-btn" type="button" onClick={openModalForCurrent}>
                        Answer Question
                    </button>
                </div>
            </div>

            {/* Fixed Back in bottom-left */}
            <div className="q-back-fixed">
                <BackButton onClick={goBack} disabled={linearIndex === 0} />
            </div>

            {/* Intro modal (ALWAYS on arrival) */}
            <IntroModal
                isOpen={showIntro}
                imageSrc={introImg}
                onClose={closeIntro}
                buttonLabel="Get Started"
            />

            {/* Answer modal */}
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
        </div>
    );
};

export default QuestionnairePage;
