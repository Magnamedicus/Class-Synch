// src/router.tsx
import { createBrowserRouter } from "react-router-dom";
import Home from "./pages/home";
import Profile from "./pages/Profile";
import Scheduler from "./components/scheduler"; // if this is a page
import About from "./pages/about";
import QuestionnairePage from "./pages/QuestionnairePage.tsx";

// Define routes
const router = createBrowserRouter([
    {
        path: "/",
        element: <Home />,
    },
    {
        path: "/profile",
        element: <Profile />,
    },
    {
        path: "/schedule",
        element: <Scheduler />,
    },
    {
        path: "/about",
        element: <About />,
    },
    {
        path: "/questionnaire",
        element: <QuestionnairePage />,
    }
]);

export default router;
