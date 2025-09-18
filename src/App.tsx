import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/home";
import Profile from "./pages/Profile";
import MySchedule from "./pages/MySchedule";
import About from "./pages/about";
import QuestionnairePage from "./pages/QuestionnairePage.tsx";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/schedule" element={<MySchedule />} />
                <Route path="/about" element={<About />} />
                <Route path="/questionnaire" element={<QuestionnairePage />} />
            </Routes>
        </Router>
    );
}

export default App;
