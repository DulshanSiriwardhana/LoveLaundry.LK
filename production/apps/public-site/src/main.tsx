import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { LanguageProvider } from "./i18n";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <MotionConfig reducedMotion="user">
            <LanguageProvider>
                <App />
            </LanguageProvider>
        </MotionConfig>
    </StrictMode>
);
