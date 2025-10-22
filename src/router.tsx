// src/router.tsx
import { createBrowserRouter } from "react-router-dom";

// === Core Pages ===
import Home from "./pages/home";
import About from "./pages/about";
import QuestionnairePage from "./pages/QuestionnairePage";
import MySchedule from "./pages/MySchedule";

// === Profile Tabs Layout ===
import ProfileLayout from "./pages/Profile/ProfileLayout";

// === Profile Tabs (Buckets) ===
import SleepTab from "./pages/Profile/SleepTab";
import SchoolTab from "./pages/Profile/SchoolTab";
import WorkTab from "./pages/Profile/WorkTab";
import SelfCareTab from "./pages/Profile/SelfCareTab";
import LeisureTab from "./pages/Profile/LeisureTab";
import ExerciseTab from "./pages/Profile/ExerciseTab";

// === Router Definition ===
const router = createBrowserRouter([
    { path: "/", element: <Home /> },
    { path: "/about", element: <About /> },
    { path: "/questionnaire", element: <QuestionnairePage /> },
    { path: "/schedule", element: <MySchedule /> },

    // === Profile (Parent Layout + Child Tabs) ===
    {
        path: "/profile",
        element: <ProfileLayout />,
        children: [
            { index: true, element: <SleepTab /> }, // default to Sleep
            { path: "sleep", element: <SleepTab /> },
            { path: "school", element: <SchoolTab /> },
            { path: "work", element: <WorkTab /> },
            { path: "selfcare", element: <SelfCareTab /> },
            { path: "leisure", element: <LeisureTab /> },
            { path: "exercise", element: <ExerciseTab /> },
        ],
    },
]);

export default router;
