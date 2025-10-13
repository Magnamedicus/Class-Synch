// src/pages/Home.tsx
import { useState, useEffect } from "react";
import Scheduler from "../components/scheduler";
import "../css/Home.css";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

/**
 * localStorage keys
 * - users:         Record<email, { email, username, password, ... }>
 * - currentUser:   { email, username }
 * - QA::answers::<email>:  questionnaire answers blob
 * - QA::progress::<email>: questionnaire progress (e.g., linearIndex)
 */

// Small helpers
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

export default function Home() {
    const [showLogin, setShowLogin] = useState(false);
    const [isSignup, setIsSignup] = useState(false);

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const navigate = useNavigate();

    // One-time: migrate legacy single "user"/"activeProfile" to new map if present
    useEffect(() => {
        const legacy = readJSON<any>("user", null);
        const users = readJSON<Record<string, any>>("users", {});
        if (legacy?.email && !users[emailKey(legacy.email)]) {
            users[emailKey(legacy.email)] = legacy;
            writeJSON("users", users);
            localStorage.removeItem("user");
        }
    }, []);

    const toggleForm = () => setShowLogin((v) => !v);

    const handleAuth = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");

        try {
            const key = emailKey(email);
            if (!key) throw new Error("Please enter a valid email.");

            const users = readJSON<Record<string, any>>("users", {});

            if (isSignup) {
                if (users[key]) throw new Error("A profile with this email already exists.");
                const newUser = {
                    username: username.trim(),
                    email: email.trim(),
                    password, // demo only; don't store plaintext in production
                    createdAt: Date.now(),
                };

                users[key] = newUser;
                writeJSON("users", users);

                // Set current user
                writeJSON("currentUser", { email: newUser.email, username: newUser.username });

                // Initialize empty per-user questionnaire state (optional)
                writeJSON(`QA::answers::${key}`, {});
                writeJSON(`QA::progress::${key}`, { linearIndex: 0 });

                alert("✅ Profile created!");
                navigate("/profile");
            } else {
                const existing = users[key];
                if (!existing) throw new Error("No user profile found. Please sign up first.");
                if (existing.password !== password) throw new Error("Invalid login credentials.");

                writeJSON("currentUser", { email: existing.email, username: existing.username });

                alert("✅ Login successful!");
                navigate("/profile");
            }
        } catch (err: any) {
            setErrorMessage(err?.message || "Something went wrong.");
        }
    };

    // Development-only reset button
    const handleReset = () => {
        localStorage.clear();
        alert("🗑️ All profile data cleared from browser storage!");
    };

    return (
        <div className="home">
            {/* Hide 'Generate Schedule' in the Home dropdown only */}
            <Navbar showGenerate={false} />

            <div className="dropdown">
                <div
                    className="dropdown__trigger"
                    onClick={toggleForm}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") toggleForm();
                    }}
                    aria-expanded={showLogin}
                    aria-controls="home-dropdown-content"
                >
                    ≡ Menu
                </div>

                <div id="home-dropdown-content" className={`dropdown__content ${showLogin ? "open" : ""}`}>
                    <div className="auth-form">
                        <h3>{isSignup ? "Create Profile" : "Login"}</h3>
                        <form onSubmit={handleAuth}>
                            {isSignup && (
                                <input
                                    type="text"
                                    placeholder="Username"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            )}
                            <input
                                type="email"
                                placeholder="Email Address"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            <button type="submit">{isSignup ? "Sign Up" : "Log In"}</button>
                        </form>

                        {errorMessage && <p className="error">{errorMessage}</p>}

                        <p onClick={() => setIsSignup((v) => !v)} className="toggle-form">
                            {isSignup ? "Already have an account? Log in" : "Need an account? Sign up"}
                        </p>
                    </div>
                </div>
            </div>

            <header className="hero">
                <h1>Welcome to Class Synch</h1>
                <p>Effortless learning. Perfect sync.</p>
            </header>

            <main className="main-content">
                <Scheduler />

                {/* Development-only reset button */}
                <button
                    className="reset"
                    onClick={handleReset}
                    style={{
                        marginTop: "2rem",
                        backgroundColor: "red",
                        color: "white",
                        padding: "0.5rem 1rem",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                    }}
                >
                    🗑️ Reset All Profile Data
                </button>
            </main>
        </div>
    );
}
