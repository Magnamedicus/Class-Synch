// app/components/Navbar.tsx

import "../css/Navbar.css";

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar__logo">CLASS SYNCH</div>
            <ul className="navbar__links">
                <li><a href="/">Home</a></li>
                <li><a href="/schedule">My Schedule</a></li>
                <li><a href="/profile">Profile</a></li>
                <li><a href="/about">About</a></li>
            </ul>
        </nav>
    );
}
