// src/pages/Profile/SleepTab.tsx
import React from "react";
import QUESTIONS, { type Condition } from "../../utils/questions";
import "../../css/Profile.css";

// Inputs
import PrioritySlider from "../../components/inputs/PrioritySlider";
import NumberInput from "../../components/inputs/NumberInput";
import TimeInput from "../../components/inputs/TimeInput";
import SunMoonBoolean from "../../components/inputs/SunMoonBoolean";
import TimeOfDaySelection from "../../components/inputs/TimeOfDaySelection";
import DaySelection from "../../components/inputs/DaySelection";

type AnswerMap = Record<string, any>;

/* ---------------- Match QuestionnairePage storage helpers ---------------- */
function readJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}
function writeJSON(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
}
function emailKey(email: string) {
    return encodeURIComponent((email || "").trim().toLowerCase());
}
function qaAnswersKey(email: string) {
    return `QA::answers::${emailKey(email)}`;
}

/* ---------------- Visibility logic (same idea as QuestionnairePage) ---------------- */
function evalCondition(cond: Condition, answers: AnswerMap): boolean {
    if ("allOf" in cond) return cond.allOf.every((c) => evalCondition(c as any, answers));
    if ("anyOf" in cond) return cond.anyOf.some((c) => evalCondition(c as any, answers));
    const val = answers[(cond as any).id];
    if (Object.prototype.hasOwnProperty.call(cond, "equals")) return val === (cond as any).equals;
    if (Object.prototype.hasOwnProperty.call(cond, "notEquals")) return val !== (cond as any).notEquals;
    if ((cond as any).truthy) return !!val;
    if ((cond as any).falsy) return !val;
    return true;
}
function isVisible(question: { when?: Condition }, answers: AnswerMap) {
    return !question.when || evalCondition(question.when, answers);
}

/* ---------------- Build defaults from questions.ts (like QuestionnairePage) ---------------- */
function buildDefaultAnswers(): AnswerMap {
    const out: AnswerMap = {};
    (QUESTIONS.sleep.questions ?? []).forEach((q) => {
        if (q.defaultValue !== undefined) out[q.id] = q.defaultValue;
        else if (q.type === "priority") out[q.id] = 70; // same default used in QuestionnairePage
    });
    return out;
}

/* ---------------- Component ---------------- */
export default function SleepTab() {
    const [email, setEmail] = React.useState<string>("");
    const [answers, setAnswers] = React.useState<AnswerMap>({});

    // Load user + answers
    React.useEffect(() => {
        const currentUser = readJSON<{ email?: string }>("currentUser", {});
        if (!currentUser?.email) return;
        setEmail(currentUser.email);

        const key = qaAnswersKey(currentUser.email);
        const existing = readJSON<AnswerMap>(key, {});
        const merged = { ...buildDefaultAnswers(), ...existing };
        setAnswers(merged);
    }, []);

    // Keep this tab in sync if localStorage changes elsewhere in the app
    React.useEffect(() => {
        if (!email) return;
        const key = qaAnswersKey(email);
        const onStorage = (e: StorageEvent) => {
            if (e.key === key && e.newValue) {
                try {
                    const next = JSON.parse(e.newValue);
                    setAnswers((prev) => ({ ...prev, ...next }));
                } catch {
                    /* ignore */
                }
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [email]);

    // Persist on change
    const updateAnswer = (id: string, value: any) => {
        setAnswers((prev) => {
            const next = { ...prev, [id]: value };
            if (email) writeJSON(qaAnswersKey(email), next);
            return next;
        });
    };

    // Render a question input bound to answers
    const renderInput = (q: (typeof QUESTIONS)["sleep"]["questions"][number]) => {
        const value = answers[q.id];

        switch (q.type) {
            case "priority": {
                const v = typeof value === "number" ? value : (q.defaultValue as number) ?? 70;
                return (
                    <PrioritySlider
                        variant="bucket"
                        value={v}
                        onChange={(nv) => updateAnswer(q.id, nv)}
                        small
                    />
                );
            }
            case "number": {
                const v = value ?? "";
                return <NumberInput value={String(v)} onChange={(nv) => updateAnswer(q.id, nv)} placeholder={q.hint || "0"} small />;
            }
            case "time": {
                const v = typeof value === "string" ? value : "";
                return <TimeInput value={v} onChange={(nv) => updateAnswer(q.id, nv)} small />;
            }
            case "boolean": {
                const v = !!value;
                return <SunMoonBoolean value={v} onChange={(nv) => updateAnswer(q.id, nv)} yesLabel="Yes" noLabel="No" small />;
            }
            case "time-selection": {
                const v = Array.isArray(value) ? value : [];
                return <TimeOfDaySelection value={v} onChange={(nv) => updateAnswer(q.id, nv)} small />;
            }
            case "day-selection": {
                const v = Array.isArray(value) ? value : [];
                return <DaySelection value={v} onChange={(nv) => updateAnswer(q.id, nv)} small />;
            }
            default:
                return <p className="unsupported">Unsupported question type: {q.type}</p>;
        }
    };

    const sleepQuestions = QUESTIONS.sleep.questions;

    return (
        <div className="profile-tab-pane">
            <h2>🛏️ Sleep Preferences</h2>
            <div className="profile-grid">
                {sleepQuestions
                    .filter((q) => isVisible(q, answers)) // honor "when" for naps windows/length
                    .map((q) => (
                        <div className="profile-card input-mode" key={q.id}>
                            <p className="question-desc">{q.description}</p>
                            {renderInput(q)}
                        </div>
                    ))}
            </div>
        </div>
    );
}
