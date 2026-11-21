import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    RiMenuLine,
    RiCloseLine,
    RiArrowRightLine,
} from "react-icons/ri";
import type { ActionType } from "../../types/action";
import { useLanguage } from "../../i18n";

interface NavbarProps {
    actions: ActionType[];
}

const Navbar = ({ actions }: NavbarProps) => {
    const [open, setOpen] = useState(false);
    const { t, lang, setLang } = useLanguage();
    const [activeSection, setActiveSection] = useState(
        actions[0]?.id ?? "home"
    );

    const scrollTo = (id: string) => {
        const section = document.getElementById(id);

        if (section) {
            const navbarOffset = 90;

            const top =
                section.getBoundingClientRect().top +
                window.scrollY -
                navbarOffset;

            window.scrollTo({
                top,
                behavior: "smooth",
            });
        }

        setActiveSection(id);
        setOpen(false);
    };

    useEffect(() => {
        const sections = actions
            .map((action) => document.getElementById(action.id))
            .filter((section): section is HTMLElement => section !== null);

        if (!sections.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleSections = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (a, b) =>
                            b.intersectionRatio -
                            a.intersectionRatio
                    );

                if (visibleSections.length > 0) {
                    setActiveSection(
                        visibleSections[0].target.id
                    );
                }
            },
            {
                root: null,
                rootMargin: "-25% 0px -55% 0px",
                threshold: [0.1, 0.25, 0.5, 0.75],
            }
        );

        sections.forEach((section) => observer.observe(section));

        return () => {
            observer.disconnect();
        };
    }, [actions]);

    return (
        <header className="fixed inset-x-0 top-0 z-50">
            <div className="mx-auto w-full max-w-[1440px] px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6">
                <div className="relative flex min-h-[60px] items-center justify-between rounded-full border border-line bg-surface px-3 shadow-[0_4px_20px_rgba(var(--shadow-rgb),0.08)] sm:min-h-[64px] sm:px-4 md:px-5 lg:min-h-[68px]">

                    <button
                        type="button"
                        onClick={() => scrollTo("home")}
                        className="flex min-w-0 items-center gap-2.5 sm:gap-3"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:h-10 sm:w-10 md:h-11 md:w-11">
                            <img
                                src="./assets/icon.png"
                                alt="Love Laundry"
                                className="h-full w-full object-contain"
                            />
                        </div>

                        <div className="min-w-0 text-left">
                            <div className="truncate text-[14px] font-bold leading-tight tracking-tight text-ink sm:text-[15px]">
                                {t("companyName")}
                            </div>

                            <div className="hidden text-[8px] font-semibold uppercase tracking-[0.15em] text-faint min-[400px]:block sm:text-[9px] sm:tracking-[0.18em]">
                                {t("companyDescription")}
                            </div>
                        </div>
                    </button>

                    <nav className="hidden items-center md:flex">
                        <div className="flex items-center gap-0.5 lg:gap-1">
                            {actions.map((action) => {
                                const isActive =
                                    activeSection === action.id;

                                return (
                                    <button
                                        key={action.id}
                                        type="button"
                                        onClick={() =>
                                            scrollTo(action.id)
                                        }
                                        className={`
                                            relative
                                            rounded-lg
                                            px-2.5
                                            py-2
                                            text-[12px]
                                            font-semibold
                                            transition-all
                                            duration-200
                                            lg:px-3.5
                                            lg:text-[13px]
                                            ${isActive
                                                ? "bg-brand-soft text-brand"
                                                : "text-muted hover:bg-brand-soft hover:text-brand"
                                            }
                                        `}
                                    >
                                        {action.label}

                                        {isActive && (
                                            <motion.span
                                                layoutId="activeNav"
                                                className="absolute bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-brand"
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 400,
                                                    damping: 30,
                                                }}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={() => scrollTo("contact")}
                            className="
                                ml-2
                                flex
                                items-center
                                gap-1.5
                                rounded-full
                                bg-brand
                                px-3.5
                                py-2
                                text-[12px]
                                font-bold
                                text-on-dark
                                shadow-[0_4px_12px_rgba(var(--brand-rgb),0.18)]
                                transition-all
                                duration-200
                                hover:bg-brand-dark
                                hover:shadow-[0_6px_18px_rgba(var(--brand-rgb),0.25)]
                                lg:ml-3
                                lg:px-5
                                lg:py-2.5
                                lg:text-[13px]
                            "
                        >
                            {t("navBookNow")}

                            <RiArrowRightLine className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                        </button>

                        <div className="ml-2 flex items-center rounded-full border border-line bg-surface p-0.5 lg:ml-3">
                            <button
                                type="button"
                                onClick={() => setLang("en")}
                                className={`min-h-10 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all duration-200 lg:text-[12px] ${lang === "en" ? "bg-brand text-on-dark shadow-sm" : "text-faint hover:text-ink"}`}
                            >
                                EN
                            </button>
                            <button
                                type="button"
                                onClick={() => setLang("sin")}
                                className={`min-h-10 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all duration-200 lg:text-[12px] ${lang === "sin" ? "bg-brand text-on-dark shadow-sm" : "text-faint hover:text-ink"}`}
                            >
                                සිං
                            </button>
                        </div>
                    </nav>

                    <button
                        type="button"
                        onClick={() => setOpen((value) => !value)}
                        aria-label={
                            open ? "Close menu" : "Open menu"
                        }
                        aria-expanded={open}
                        className="
                            flex
                            h-11
                            w-11
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            border
                            border-line
                            bg-surface
                            text-muted
                            transition
                            hover:border-brand/30
                            hover:bg-brand-soft
                            hover:text-brand
                            md:hidden
                        "
                        aria-controls="mobile-navigation"
                    >
                        {open ? (
                            <RiCloseLine className="h-5 w-5" />
                        ) : (
                            <RiMenuLine className="h-5 w-5" />
                        )}
                    </button>

                    <AnimatePresence>
                        {open && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setOpen(false)}
                                    className="fixed inset-0 top-0 -z-10 bg-ink/20 backdrop-blur-[2px] md:hidden"
                                />

                                <motion.div
                                    initial={{
                                        opacity: 0,
                                        y: -10,
                                        scale: 0.98,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1,
                                    }}
                                    exit={{
                                        opacity: 0,
                                        y: -10,
                                        scale: 0.98,
                                    }}
                                    transition={{
                                        duration: 0.18,
                                    }}
                                    id="mobile-navigation"
                                    className="
                                        absolute
                                        left-0
                                        right-0
                                        top-[calc(100%+8px)]
                                        max-h-[calc(100vh-90px)]
                                        overflow-y-auto
                                        rounded-xl
                                        border
                                        border-line
                                        bg-surface
                                        p-2
                                        shadow-[0_15px_40px_rgba(var(--shadow-rgb),0.12)]
                                        md:hidden
                                    "
                                >
                                    <div className="p-1">
                                        {actions.map((action) => {
                                            const Icon = action.icon;
                                            const isActive =
                                                activeSection ===
                                                action.id;

                                            return (
                                                <button
                                                    key={action.id}
                                                    type="button"
                                                    onClick={() =>
                                                        scrollTo(
                                                            action.id
                                                        )
                                                    }
                                                    className={`
                                                        flex
                                                        w-full
                                                        items-center
                                                        gap-3
                                                        rounded-lg
                                                        px-3
                                                        py-3
                                                        text-left
                                                        text-sm
                                                        font-semibold
                                                        transition
                                                        sm:px-4
                                                        sm:py-3.5
                                                        ${isActive
                                                            ? "bg-brand-soft text-brand"
                                                            : "text-ink hover:bg-brand-soft hover:text-brand"
                                                        }
                                                    `}
                                                >
                                                    <span
                                                        className={`
                                                            flex
                                                            h-9
                                                            w-9
                                                            shrink-0
                                                            items-center
                                                            justify-center
                                                            rounded-lg
                                                            ${isActive
                                                                ? "bg-brand text-on-dark"
                                                                : "bg-surface-muted text-faint"
                                                            }
                                                        `}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                    </span>

                                                    <span className="flex-1">
                                                        {action.label}
                                                    </span>

                                                    {isActive ? (
                                                        <span className="h-2 w-2 rounded-full bg-brand" />
                                                    ) : (
                                                        <RiArrowRightLine className="h-4 w-4 text-line-strong" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="my-1 h-px bg-surface-muted" />

                                    <div className="p-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                scrollTo("contact")
                                            }
                                            className="
                                                flex
                                                w-full
                                                items-center
                                                justify-center
                                                gap-2
                                                rounded-lg
                                                bg-brand
                                                px-4
                                                py-3
                                                text-sm
                                                font-bold
                                                text-on-dark
                                                shadow-[0_4px_12px_rgba(var(--brand-rgb),0.18)]
                                                transition
                                                hover:bg-brand-dark
                                                sm:py-3.5
                                            "
                                        >
                                            {t("heroPrimary")}

                                            <RiArrowRightLine className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="my-1 h-px bg-surface-muted" />

                                    <div className="p-1">
                                        <div className="flex items-center justify-center rounded-lg bg-surface-muted p-1">
                                            <button
                                                type="button"
                                                onClick={() => setLang("en")}
                                                className={`min-h-11 flex-1 rounded-md py-2.5 text-sm font-bold transition-all duration-200 ${lang === "en" ? "bg-brand text-on-dark shadow-sm" : "text-faint"}`}
                                            >
                                                EN
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLang("sin")}
                                                className={`min-h-11 flex-1 rounded-md py-2.5 text-sm font-bold transition-all duration-200 ${lang === "sin" ? "bg-brand text-on-dark shadow-sm" : "text-faint"}`}
                                            >
                                                සිං
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
};

export default Navbar;