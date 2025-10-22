// src/pages/Profile/CustomTab.tsx
import React from "react";
import QUESTIONS, { type Condition } from "../../utils/questions";
import "../../css/Profile.css";
import "../../css/CustomTab.css";

// Inputs used in the Custom bucket
import SunMoonBoolean from "../../components/inputs/SunMoonBoolean";
import CustomObligationsSelector, {
    type CustomObligationPrefs,
} from "../../components/inputs/CustomObligationSelector";

/* ---------------- Storage helpers (match QuestionnairePage) ---------------- */
type AnswerMap = Record<string, any>;

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

/* ---------------- Visibility logic (same style as QuestionnairePage) ---------------- */
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

/* ---------------- Build defaults from questions.ts ---------------- */
function buildDefaultAnswers(): AnswerMap {
    const out: AnswerMap = {};
    (QUESTIONS.custom.questions ?? []).forEach((q) => {
        if (q.defaultValue !== undefined) out[q.id] = q.defaultValue;
        // no priority types in Custom; nothing else to seed
    });
    return out;
}

/* -------------------------------- Component ------------------------------- */
const CustomTab: React.FC = () => {
    const [email, setEmail] = React.useState<string>("");
    const [answers, setAnswers] = React.useState<AnswerMap>({});

    // Load user + answers on mount
    React.useEffect(() => {
        const currentUser = readJSON<{ email?: string }>("currentUser", {});
        if (!currentUser?.email) return;
        setEmail(currentUser.email);

        const key = qaAnswersKey(currentUser.email);
        const existing = readJSON<AnswerMap>(key, {});
        const merged = { ...buildDefaultAnswers(), ...existing };
        setAnswers(merged);
    }, []);

    // Keep in sync if localStorage changes elsewhere
    React.useEffect(() => {
        if (!email) return;
        const key = qaAnswersKey(email);
        const onStorage = (e: StorageEvent) => {
            if (e.key === key && e.newValue) {
                try {
                    const next = JSON.parse(e.newValue);
                    setAnswers((prev) => ({ ...prev, ...next }));
                } catch { /* ignore */ }
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

    // Renderer for each Custom question type
    const renderInput = (q: (typeof QUESTIONS)["custom"]["questions"][number]) => {
        const value = answers[q.id];

        switch (q.type) {
            case "boolean": {
                const v = !!value;
                return (
                    <SunMoonBoolean
                        value={v}
                        onChange={(nv) => updateAnswer(q.id, nv)}
                        yesLabel="Yes"
                        noLabel="No"
                        small
                    />
                );
            }
            case "custom-obligations-selector": {
                const v: CustomObligationPrefs[] = Array.isArray(value) ? value : [];
                return (
                    <CustomObligationsSelector
                        value={v}
                        onChange={(nv) => updateAnswer(q.id, nv)}
                        label="Add custom obligations/activities to include"
                        placeholder="Enter a custom obligation or activity…"
                    />
                );
            }
            default:
                return <p className="unsupported">Unsupported question type: {q.type}</p>;
        }
    };

    const customQs = QUESTIONS.custom.questions;

    return (
        <div className="profile-tab-pane  profile-tab--custom">
            <h2>🧩 Custom Obligations</h2>

            <div className="profile-grid">
                {customQs
                    .filter((q) => isVisible(q, answers)) // gated by custom_enabled
                    .map((q) => (
                        <div className="profile-card input-mode" key={q.id}>
                            <p className="question-desc">{q.description}</p>
                            {renderInput(q)}
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default CustomTab;
