import { Routes, Route } from "react-router-dom";
import Home from "./pages/home";
import "./App.css";

function App() {
    return (
        <div className="app-container">

            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/schedule" element={<div>Schedule Page</div>} />
                <Route path="/profile" element={<div>Profile Page</div>} />
                <Route path="/about" element={<div>About Page</div>} />
            </Routes>
        </div>
    );
}

export default App;

