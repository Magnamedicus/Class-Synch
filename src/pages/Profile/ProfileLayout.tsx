// src/pages/Profile/ProfileLayout.tsx
import { NavLink, Outlet } from "react-router-dom";
import Navbar from "../../components/Navbar";
import "../../css/Profile.css";

const tabs = [
    { path: "sleep", label: "🛏️ Sleep" },
    { path: "school", label: "📚 School" },
    { path: "work", label: "💼 Work" },
    { path: "selfcare", label: "🧘 Self-Care" },
    { path: "leisure", label: "🎮 Leisure" },
];

export default function ProfileLayout() {
    return (
        <div className="profile-page">
            <Navbar />
            <div className="profile-container">
                <div className="profile-tabs">
                    {tabs.map((tab) => (
                        <NavLink
                            key={tab.path}
                            to={`/profile/${tab.path}`}
                            className={({ isActive }) =>
                                `profile-tab${isActive ? " is-active" : ""}`
                            }
                        >
                            {tab.label}
                        </NavLink>
                    ))}
                </div>

                <div className="profile-tab-content">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
