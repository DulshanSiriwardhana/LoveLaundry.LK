import { useLanguage } from "../../i18n";
import type { QuoteService } from "./RequestQuote";
import { useReveal } from "../../hooks/useReveal";
import heroVideo from "../../assets/videos/web.mp4";
import { useReducedMotion } from "framer-motion";
import {
    RiArrowRightLine,
    RiArrowDownLine,
    RiHeart3Fill,
    RiStarFill,
    RiTimeFill,
    RiShoppingBasket2Line,
} from "react-icons/ri";

interface HeroProps {
    onQuote: (service?: QuoteService) => void;
}

const Hero = ({ onQuote }: HeroProps) => {
    const { t } = useLanguage();
    const prefersReducedMotion = useReducedMotion();
    const textRef = useReveal<HTMLDivElement>({ y: 28, stagger: 0.09 });

    const scrollTo = (id: string) => {
        const element = document.getElementById(id);
        if (!element) return;
        const offset = 90;
        window.scrollTo({
            top: element.getBoundingClientRect().top + window.scrollY - offset,
            behavior: "smooth",
        });
    };

    const stats = [
        {
            icon: RiShoppingBasket2Line,
            value: "10+",
            label: t("heroStatServices"),
        },
        {
            icon: RiStarFill,
            value: "4.9",
            label: t("heroStatRating"),
        },
        {
            icon: RiTimeFill,
            value: "3+",
            label: t("heroStatConvenience"),
        },
    ];

    return (
        <section
            id="home"
            className="
                relative
                flex
                min-h-[92vh]
                items-center
                overflow-hidden
                bg-surface-dark
                px-4
                pb-24
                pt-32
                sm:px-6
                sm:pb-28
                sm:pt-36
                lg:px-8
                lg:pb-32
                lg:pt-40
            "
        >
            {/* Full-bleed background video */}
            <video
                aria-hidden="true"
                autoPlay={!prefersReducedMotion}
                muted
                loop
                playsInline
                preload={prefersReducedMotion ? "none" : "metadata"}
                poster="./assets/images/love-laundry-hero.png"
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    h-full
                    w-full
                    object-cover
                "
            >
                <source src={heroVideo} type="video/mp4" />
            </video>

            {/* Brand-red wash to keep theme + boost text contrast */}
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-[radial-gradient(110%_90%_at_85%_0%,rgba(var(--brand-rgb),0.32),transparent_55%)]
                "
            />
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-[radial-gradient(80%_80%_at_0%_100%,rgba(var(--accent-rgb),0.14),transparent_55%)]
                "
            />

            {/* Dark vignette / contrast gradient */}
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-[linear-gradient(180deg,rgba(var(--night-rgb),0.55),rgba(var(--night-rgb),0.35)_30%,rgba(var(--night-rgb),0.45)_65%,rgba(var(--night-rgb),0.92))]
                "
            />

            <div className="relative mx-auto w-full max-w-[1440px]">
                <div
                    ref={textRef}
                    className="relative z-10 max-w-2xl"
                >
                    <div
                        data-reveal
                        className="
                            inline-flex
                            items-center
                            gap-2.5
                            rounded-full
                            border
                            border-on-dark/15
                            bg-on-dark/5
                            px-4
                            py-2
                            text-[11px]
                            font-bold
                            uppercase
                            tracking-[0.16em]
                            text-on-dark
                            backdrop-blur-sm
                            sm:text-xs
                        "
                    >
                        <RiHeart3Fill className="h-3.5 w-3.5 text-brand" />
                        {t("heroBadge")}
                    </div>

                    <h1
                        className="
                            font-display
                            mt-6
                            text-[46px]
                            font-semibold
                            leading-[1.02]
                            tracking-[-0.02em]
                            text-on-dark
                            sm:text-6xl
                            md:text-7xl
                            lg:text-[78px]
                            xl:text-[88px]
                        "
                    >
                        <span data-reveal className="block">
                            {t("heroTitleMain")}
                        </span>
                        <span
                            data-reveal
                            className="relative inline-block text-brand"
                        >
                            {t("heroTitleHighlight")}
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 240 14"
                                className="
                                    absolute
                                    -bottom-1
                                    left-0
                                    h-3
                                    w-full
                                    sm:-bottom-2
                                    sm:h-4
                                "
                                preserveAspectRatio="none"
                            >
                                <path
                                    d="M4 10 C 70 2, 170 2, 236 8"
                                    fill="none"
                                    stroke="var(--color-accent)"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    opacity="0.85"
                                />
                            </svg>
                        </span>
                    </h1>

                    <p
                        data-reveal
                        className="
                            mt-7
                            max-w-xl
                            text-base
                            leading-8
                            text-on-dark/70
                            sm:text-lg
                        "
                    >
                        {t("heroDescription")}
                    </p>

                    <div
                        data-reveal
                        className="
                            mt-9
                            flex
                            flex-col
                            gap-3
                            sm:flex-row
                        "
                    >
                        <button
                            type="button"
                            onClick={() => scrollTo("locations")}
                            className="
                                flex
                                h-14
                                w-full
                                items-center
                                justify-center
                                gap-2.5
                                rounded-full
                                bg-brand
                                px-9
                                text-sm
                                font-bold
                                text-on-dark
                                shadow-[0_14px_34px_rgba(var(--brand-rgb),0.4)]
                                transition-all
                                duration-200
                                hover:-translate-y-0.5
                                hover:bg-brand-dark
                                hover:shadow-[0_18px_44px_rgba(var(--brand-rgb),0.55)]
                                sm:w-auto
                            "
                        >
                            {t("heroPrimary")}
                            <RiArrowRightLine className="h-4 w-4" />
                        </button>

                        <button
                            type="button"
                            onClick={() => scrollTo("services")}
                            className="
                                flex
                                h-14
                                w-full
                                items-center
                                justify-center
                                gap-2.5
                                rounded-full
                                border-2
                                border-on-dark/30
                                bg-on-dark/5
                                px-9
                                text-sm
                                font-bold
                                text-on-dark
                                backdrop-blur-sm
                                transition-all
                                duration-200
                                hover:-translate-y-0.5
                                hover:border-on-dark/60
                                hover:bg-on-dark/10
                                sm:w-auto
                            "
                        >
                            {t("heroSecondary")}
                            <RiArrowRightLine className="h-4 w-4" />
                        </button>
                    </div>

                    <div
                        data-reveal
                        className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-on-dark/80"
                    >
                        <button
                            type="button"
                            onClick={() => scrollTo("track")}
                            className="underline-offset-4 transition hover:text-brand hover:underline"
                        >
                            {t("heroTrack")}
                        </button>
                        <button
                            type="button"
                            onClick={() => onQuote()}
                            className="underline-offset-4 transition hover:text-brand hover:underline"
                        >
                            {t("heroQuote")}
                        </button>
                    </div>

                    {/* Stats */}
                    <div
                        data-reveal
                        className="
                            mt-12
                            grid
                            max-w-xl
                            grid-cols-3
                            gap-3
                            sm:gap-4
                        "
                    >
                        {stats.map((stat, index) => (
                            <div
                                key={index}
                                className="
                                    flex
                                    flex-col
                                    items-start
                                    gap-2
                                    rounded-2xl
                                    border
                                    border-on-dark/10
                                    bg-on-dark/5
                                    px-4
                                    py-5
                                    backdrop-blur-sm
                                    sm:px-5
                                "
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-brand">
                                    <stat.icon className="h-5 w-5" />
                                </div>

                                <div className="font-display text-2xl font-bold tracking-tight text-on-dark sm:text-3xl">
                                    {stat.value}
                                </div>

                                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-dark/60 sm:text-[11px]">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scroll indicator */}
            <button
                type="button"
                onClick={() => scrollTo("services")}
                className="
                    absolute
                    bottom-6
                    left-1/2
                    -translate-x-1/2
                    flex
                    flex-col
                    items-center
                    gap-1
                    text-on-dark/60
                    transition-colors
                    hover:text-brand
                    sm:bottom-8
                "
            >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    {t("heroScroll")}
                </span>
                <RiArrowDownLine className="h-4 w-4 animate-bounce" />
            </button>
        </section>
    );
};

export default Hero;
