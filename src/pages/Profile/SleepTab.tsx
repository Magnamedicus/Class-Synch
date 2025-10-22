import { useEffect, useState } from "react";
import QUESTIONS from "../../utils/questions";
import "../../css/Profile.css";

// Input components (same as questionnaire, scaled for profile)
import PrioritySlider from "../../components/inputs/PrioritySlider";
import NumberInput from "../../components/inputs/NumberInput";
import TimeInput from "../../components/inputs/TimeInput";
import SunMoonBoolean from "../../components/inputs/SunMoonBoolean";
import TimeOfDaySelection from "../../components/inputs/TimeOfDaySelection";
import DaySelection from "../../components/inputs/DaySelection";

type AnswerMap = Record<string, any>;

export default function SleepTab() {
    const [answers, setAnswers] = useState<AnswerMap>({});
    const [email, setEmail] = useState<string>("");

    // Load user and answers on mount
    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const userEmail = currentUser?.email;
        if (!userEmail) return;

        const key = `QA::answers::${encodeURIComponent(userEmail)}`;
        const storedAnswers = JSON.parse(localStorage.getItem(key) || "{}");
        setAnswers(storedAnswers);
        setEmail(userEmail);
    }, []);

    // Update answer in state + localStorage
    const handleAnswerChange = (id: string, value: any) => {
        const updated = { ...answers, [id]: value };
        setAnswers(updated);

        if (email) {
            const key = `QA::answers::${encodeURIComponent(email)}`;
            localStorage.setItem(key, JSON.stringify(updated));
        }
    };

    // Return a safe default value for each type
    const getDefaultValue = (type: string) => {
        switch (type) {
            case "boolean":
                return false;
            case "number":
            case "priority":
                return 0;
            case "time":
                return "00:00";
            case "time-selection":
            case "day-selection":
                return [];
            default:
                return "";
        }
    };

    // Choose which input component to render
    const renderInput = (question: any) => {
        const value = answers[question.id] ?? getDefaultValue(question.type);
        const props = {
            id: question.id,
            value,
            onChange: (val: any) => handleAnswerChange(question.id, val),
            small: true,
        };

        switch (question.type) {
            case "priority":
                return <PrioritySlider {...props} />;
            case "number":
                return <NumberInput {...props} />;
            case "time":
                return <TimeInput {...props} />;
            case "boolean":
                return <SunMoonBoolean {...props} />;
            case "time-selection":
                return <TimeOfDaySelection {...props} />;
            case "day-selection":
                return <DaySelection {...props} />;
            default:
                return <p className="unsupported">Unsupported question type</p>;
        }
    };

    const sleepQuestions = QUESTIONS["sleep"].questions;

    return (
        <div className="profile-tab-pane">
            <h2>🛏️ Sleep Preferences</h2>
            <div className="profile-grid">
                {sleepQuestions.map((q) => (
                    <div className="profile-card input-mode" key={q.id}>
                        <p className="question-desc">{q.description}</p>
                        {renderInput(q)}
                    </div>
                ))}
            </div>
        </div>
    );
}
