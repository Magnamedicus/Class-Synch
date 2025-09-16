// app/components/Navbar.tsx

import { Link } from "react-router-dom";
import "../css/Navbar.css";

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar__logo">CLASS SYNCH</div>
            <ul className="navbar__links">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/schedule">My Schedule</Link></li>
                <li><Link to="/profile">Profile</Link></li>
                <li><Link to="/about">About</Link></li>
            </ul>
        </nav>
    );
}
