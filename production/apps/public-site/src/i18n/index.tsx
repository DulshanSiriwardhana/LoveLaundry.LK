import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import en from "./en";
import sin from "./sin";

export type Language = "en" | "sin";

interface LanguageContextValue {
    lang: Language;
    setLang: (l: Language) => void;
    t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = { en, sin };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const [lang, setLang] = useState<Language>(() => {
        try {
            const saved = localStorage.getItem("ll-lang");
            return saved === "sin" || saved === "en" ? saved : "en";
        } catch {
            return "en";
        }
    });

    const handleSetLang = useCallback((l: Language) => {
        setLang(l);
        try { localStorage.setItem("ll-lang", l); } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.lang = lang;
        root.classList.toggle("lang-sin", lang === "sin");
    }, [lang]);

    const t = useCallback(
        (key: string): string => {
            const dict = translations[lang];
            return dict[key] ?? translations.en[key] ?? key;
        },
        [lang]
    );

    return (
        <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
    return ctx;
};
