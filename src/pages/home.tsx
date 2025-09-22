// src/pages/Home.tsx
import { useState } from "react";
import Scheduler from "../components/scheduler";
import "../css/Home.css";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

export default function Home() {
    const [showLogin, setShowLogin] = useState(false);
    const [isSignup, setIsSignup] = useState(false);

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const navigate = useNavigate();

    const toggleForm = () => {
        setShowLogin((v) => !v);
    };

    const handleAuth = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");

        try {
            const stored = localStorage.getItem("user");
            const existingUser = stored ? JSON.parse(stored) : null;

            if (isSignup) {
                if (existingUser && existingUser.email === email) {
                    throw new Error("A profile with this email already exists");
                }

                const newUser = { username, email, password };

                // Save base user
                localStorage.setItem("user", JSON.stringify(newUser));

                // Save active profile with defaults
                localStorage.setItem(
                    "activeProfile",
                    JSON.stringify({
                        ...newUser,
                        buckets: [{ name: "School Work", priority: 100 }],
                        obligations: [],
                    })
                );

                alert("✅ Profile created!");
                navigate("/profile");
            } else {
                if (!existingUser) {
                    throw new Error("No user profile found. Please sign up first.");
                }

                if (
                    existingUser.email === email &&
                    existingUser.password === password
                ) {
                    // Load profile into activeProfile
                    localStorage.setItem(
                        "activeProfile",
                        JSON.stringify({
                            ...existingUser,
                            buckets: existingUser.buckets || [
                                { name: "School Work", priority: 100 },
                            ],
                            obligations: existingUser.obligations || [],
                        })
                    );

                    alert("✅ Login successful!");
                    navigate("/profile");
                } else {
                    throw new Error("Invalid login credentials");
                }
            }
        } catch (err: any) {
            setErrorMessage(err.message);
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

                <div
                    id="home-dropdown-content"
                    className={`dropdown__content ${showLogin ? "open" : ""}`}
                >
                    {/* ⬇️ Removed the 'Generate Schedule' button from Home dropdown */}

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

                            <button type="submit">
                                {isSignup ? "Sign Up" : "Log In"}
                            </button>
                        </form>

                        {errorMessage && <p className="error">{errorMessage}</p>}

                        <p
                            onClick={() => setIsSignup((v) => !v)}
                            className="toggle-form"
                        >
                            {isSignup
                                ? "Already have an account? Log in"
                                : "Need an account? Sign up"}
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
                <button className = "reset"
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

