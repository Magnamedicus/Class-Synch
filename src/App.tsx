import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/home";
import Profile from "./pages/Profile";
import MySchedule from "./pages/MySchedule";
import About from "./pages/about";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/schedule" element={<MySchedule />} />
                <Route path="/about" element={<About />} />
            </Routes>
        </Router>
    );
}

export default App;
