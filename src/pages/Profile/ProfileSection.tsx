// src/pages/Profile/ProfileSection.tsx
import React from "react";
import QUESTIONS from "../../utils/questions";
import { readAnswers, writeAnswers, type QAAnswers } from "../../utils/qaStorage";

import PrioritySlider from "../../components/inputs/PrioritySlider";
import NumberInput from "../../components/inputs/NumberInput";
import TextInput from "../../components/inputs/TextInput";
import TimeInput from "../../components/inputs/TimeInput";
import DaySelection from "../../components/inputs/DaySelection";
import TimeOfDaySelection from "../../components/inputs/TimeOfDaySelection";
import SunMoonBoolean from "../../components/inputs/SunMoonBoolean";
import EnterClasses from "../../components/inputs/EnterClasses";

type BucketId = keyof typeof QUESTIONS;

function defaultFor(type: string) {
    switch (type) {
        case "priority": return 0;
        case "number": return 0;
        case "text": return "";
        case "time": return "";
        case "boolean": return false;
        case "day-selection": return [];
        case "time-selection": return [];
        case "enter-classes": return [];
        default: return "";
    }
}

export default function ProfileSection({
                                           email,
                                           bucket,
                                           title,
                                           // NEW: optionally override which questions to render as the “general” section
                                           questionsOverride,
                                           // NEW: optionally hide specific general questions
                                           filterQuestion,
                                           // Optional: render class-specific follow-ups
                                           perClassFollowups,
                                       }: {
    email: string;
    bucket: BucketId;
    title: string;
    questionsOverride?: any[];                          // <- NEW
    filterQuestion?: (q: any) => boolean;               // <- NEW
    perClassFollowups?: (cls: string) => any[];
}) {
    const [answers, setAnswers] = React.useState<QAAnswers>({});

    React.useEffect(() => {
        setAnswers(readAnswers(email));
    }, [email]);

    const update = (id: string, value: any) => {
        const next = { ...answers, [id]: value };
        setAnswers(next);
        writeAnswers(email, next);
    };

    const renderInput = (q: any) => {
        const value = answers[q.id] ?? defaultFor(q.type);
        const common = { id: q.id, value, onChange: (v: any) => update(q.id, v), small: true };

        switch (q.type) {
            case "priority": return <PrioritySlider {...common} />;
            case "number": return <NumberInput {...common} />;
            case "text": return <TextInput {...common} />;
            case "time": return <TimeInput {...common} />;
            case "boolean": return <SunMoonBoolean {...common} />;
            case "day-selection": return <DaySelection {...common} />;
            case "time-selection": return <TimeOfDaySelection {...common} />;
            case "enter-classes": return <EnterClasses {...common} />;
            default: return <em>Unsupported: {q.type}</em>;
        }
    };

    // Choose the base “general” questions
    const baseQsRaw = questionsOverride ?? QUESTIONS[bucket]?.questions ?? [];
    const baseQs = filterQuestion ? baseQsRaw.filter(filterQuestion) : baseQsRaw;

    // Classes list (kept the same key you were already using)
    const classes: string[] =
        (answers["school_classes"] && Array.isArray(answers["school_classes"]))
            ? answers["school_classes"]
            : [];

    return (
        <div className="profile-tab-pane">
            <h2>{title}</h2>

            {/* GENERAL (non per-class) QUESTIONS */}
            {baseQs.length > 0 && (
                <>
                    <h3 className="mt-4">General</h3>
                    <div className="profile-grid">
                        {baseQs.map((q: any) => (
                            <div className="profile-card input-mode" key={q.id}>
                                <p className="question-desc">{q.description}</p>
                                {renderInput(q)}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* PER-CLASS FOLLOW-UPS (collapsible) */}
            {perClassFollowups && classes.length > 0 && (
                <>
                    <h3 className="mt-6">Class-specific details</h3>
                    <div className="profile-accordion">
                        {classes.map((cls) => (
                            <details className="profile-accordion__item" key={cls}>
                                <summary className="profile-accordion__summary">
                                    <span className="profile-accordion__chevron" aria-hidden>▸</span>
                                    <strong>{cls}</strong>
                                </summary>
                                <div className="profile-accordion__body">
                                    <div className="profile-grid">
                                        {perClassFollowups(cls).map((q) => {
                                            const id = q.id; // ensure ids match your questionnaire flattening
                                            const value = answers[id] ?? defaultFor(q.type);
                                            const common = { id, value, onChange: (v: any) => update(id, v), small: true };

                                            switch (q.type) {
                                                case "priority": return <PrioritySlider key={id} {...common} />;
                                                case "number": return <NumberInput key={id} {...common} />;
                                                case "text": return <TextInput key={id} {...common} />;
                                                case "time": return <TimeInput key={id} {...common} />;
                                                case "boolean": return <SunMoonBoolean key={id} {...common} />;
                                                case "day-selection": return <DaySelection key={id} {...common} />;
                                                case "time-selection": return <TimeOfDaySelection key={id} {...common} />;
                                                default: return <em key={id}>Unsupported: {q.type}</em>;
                                            }
                                        })}
                                    </div>
                                </div>
                            </details>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
