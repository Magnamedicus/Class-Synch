// src/App.tsx
import { RouterProvider } from "react-router-dom";
import router from "./router"; // This is the router you defined in router.tsx

function App() {
    return <RouterProvider router={router} />;
}

export default App;
