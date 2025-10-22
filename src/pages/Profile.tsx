// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import "../css/Profile.css";
import bgImage from "../assets/profile_bg.png";

// === Types ===
interface Identity {
    email: string;
    username?: string;
}

type QAAnswers = Record<string, any>;

// === Friendly labels for categories & questions ===
const CATEGORY_LABELS: Record<string, string> = {
    Sleep: "🛏️ Sleep",
    Work: "💼 Work",
    SchoolWork: "📚 School",
    SelfCare: "🧘 Self Care",
    Leisure: "🕹️ Leisure",
};

const QUESTION_LABELS: Record<string, string> = {
    Sleep_HoursNeedQ: "How many hours of sleep do you need?",
    Sleep_BedTimeQ: "What time do you usually go to bed?",
    Sleep_WakeUpQ: "What time do you wake up?",
    Sleep_ConsistentBedTimeQ: "Do you keep a consistent bedtime?",
    Sleep_PriorityQ: "How important is sleep to you?",
    Sleep_NapBool: "Do you take naps?",
    Sleep_NapTimesQ: "When do you typically nap?",
    Sleep_NapLengthQ: "How long are your naps?",
    Work_BooleanQ: "Do you currently have a job?",
    Work_PriorityQ: "How important is work in your weekly schedule?",
    Work_HoursAmountQ: "How many hours per week do you work?",
    Work_CommuteLengthQ: "How long is your commute to work?",
    Work_HomeBoolean: "Do you work from home?",
    SchoolWork_PriorityQ: "How important is school work to you?",
    SchoolWork_ClassAmountQ: "How many classes are you taking?",
    SchoolWork_AddClassesQ: "List your classes",
    SchoolWork_MaxStudyQ: "What's your max study session length?",
    SchoolWork_StudyBreaksQ: "Do you take breaks while studying?",
    SchoolWork_NoStudyQ: "When do you NOT want to study?",
    SchoolWork_CommuteQ: "How long is your commute to school?",
};

// === Helper: Format answer to be human-readable ===
const formatAnswer = (value: any): JSX.Element => {
    if (typeof value === "boolean") return <span>{value ? "✅ Yes" : "❌ No"}</span>;
    if (typeof value === "string") return <span>{formatText(value)}</span>;
    if (Array.isArray(value)) {
        return (
            <ul>
                {value.map((v, i) => (
                    <li key={i}>{formatAnswer(v)}</li>
                ))}
            </ul>
        );
    }
    if (typeof value === "object" && value !== null) {
        if ("day" in value && "start" in value && "end" in value) {
            return (
                <span>
          📅 {value.day}: {value.start} – {value.end}
        </span>
            );
        }
        return (
            <ul>
                {Object.entries(value).map(([k, v]) => (
                    <li key={k}>
                        <strong>{formatText(k)}:</strong> {formatAnswer(v)}
                    </li>
                ))}
            </ul>
        );
    }
    return <span>{String(value)}</span>;
};

// === Helper: Format text into readable label ===
const formatText = (str: string) =>
    str
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, (l) => l.toUpperCase());

export default function ProfilePage() {
    const [identity, setIdentity] = useState<Identity | null>(null);
    const [answers, setAnswers] = useState<QAAnswers>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const raw = localStorage.getItem("currentUser");
        setIdentity(raw ? JSON.parse(raw) : null);
    }, []);

    useEffect(() => {
        if (!identity?.email) return;
        const key = `QA::answers::${encodeURIComponent(identity.email.trim().toLowerCase())}`;
        const rawAnswers = localStorage.getItem(key);
        try {
            setAnswers(rawAnswers ? JSON.parse(rawAnswers) : {});
        } catch {
            setAnswers({});
        } finally {
            setLoading(false);
        }
    }, [identity]);

    if (loading)
        return (
            <div className="profile-loading">
                <Navbar />
                <p>Loading your personalized profile...</p>
            </div>
        );

    if (!identity)
        return (
            <div className="profile-error">
                <Navbar />
                <h1>User not found</h1>
                <p>Please complete the questionnaire first.</p>
            </div>
        );

    if (!answers || Object.keys(answers).length === 0)
        return (
            <div className="profile-empty">
                <Navbar />
                <h1>No answers found</h1>
                <p>
                    Go to the <a href="/questionnaire">Questionnaire</a> to get started.
                </p>
            </div>
        );

    // === Group answers by category ===
    const grouped: Record<string, { id: string; label: string; value: any }[]> = {};

    Object.entries(answers).forEach(([key, val]) => {
        const [category] = key.split("_");
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push({
            id: key,
            label: QUESTION_LABELS[key] || formatText(key.replace(`${category}_`, "")),
            value: val,
        });
    });

    return (
        <div className="profile-page">
            <Navbar />

            <div className="profile-hero" style={{ backgroundImage: `url(${bgImage})` }}>
                <div className="profile-hero__scrim" />
                <div className="profile-hero__copy">
                    <h1 className="profile-hero__title">
                        Welcome, {identity.username || "Student"}!
                    </h1>
                    <p className="profile-hero__subtitle">
                        Here's your weekly summary based on the questionnaire.
                    </p>
                </div>
            </div>

            <div className="profile-container animate-in">
                <h2 className="section-title">Your Personalized Overview</h2>
                <p className="section-subtitle">Reflecting your real-life priorities and preferences</p>

                {Object.entries(grouped).map(([category, items]) => (
                    <section key={category} className="card profile-section">
                        <div className="card-header">
                            <h3>{CATEGORY_LABELS[category] || formatText(category)}</h3>
                        </div>
                        <div className="profile-section-body">
                            {items.map(({ id, label, value }) => (
                                <div key={id} className="profile-answer-row">
                                    <strong className="profile-question">{label}</strong>
                                    <div className="profile-answer">{formatAnswer(value)}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                <div className="profile-actions">
                    <a href="/questionnaire" className="btn btn-primary">
                        Edit My Questionnaire
                    </a>
                </div>
            </div>
        </div>
    );
}

