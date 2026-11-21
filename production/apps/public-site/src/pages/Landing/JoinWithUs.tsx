import {
    RiArrowRightLine,
    RiWhatsappLine,
} from "react-icons/ri";
import { useReveal } from "../../hooks/useReveal";
import { useLanguage } from "../../i18n";
import { hiringSection, jobOpenings } from "../../data/siteData";

const JoinWithUs = () => {
    const { t } = useLanguage();
    const cardsRef = useReveal<HTMLDivElement>({ y: 30, stagger: 0.08 });
    const perksRef = useReveal<HTMLDivElement>({ y: 20, stagger: 0.06 });

    return (
        <section
            id="careers"
            className="
                relative
                overflow-hidden
                bg-ink
                bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(var(--brand-rgb),0.12),transparent_70%)]
                px-4
                py-12
                sm:px-6
                sm:py-16
                lg:px-8
                lg:py-20
            "
        >
            {/* Decorative elements */}
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    -right-32
                    -top-32
                    h-96
                    w-96
                    rounded-full
                    bg-brand/8
                "
            />

            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    -bottom-24
                    -left-24
                    h-72
                    w-72
                    rounded-full
                    border-[20px]
                    border-on-dark/5
                "
            />

            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    right-[15%]
                    top-[12%]
                    grid
                    grid-cols-3
                    gap-2
                    opacity-20
                "
            >
                {Array.from({ length: 9 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-1 w-1 rounded-full bg-brand"
                    />
                ))}
            </div>

            <div className="relative mx-auto w-full max-w-[1440px]">
                {/* Section Header */}
                <div className="mb-12 max-w-3xl sm:mb-16">
                    <span
                        className="
                            inline-flex
                            items-center
                            gap-2.5
                            text-[11px]
                            font-bold
                            uppercase
                            tracking-[0.22em]
                            text-brand
                            sm:text-xs
                        "
                    >
                        <span
                            aria-hidden="true"
                            className="h-[3px] w-8 rounded-full bg-brand"
                        />
                        {t("joinBadge")}
                    </span>

                    <h2
                        className="
                            font-display
                            mt-5
                            text-4xl
                            font-semibold
                            leading-[1.05]
                            tracking-[-0.02em]
                            text-on-dark
                            sm:text-5xl
                            lg:text-6xl
                        "
                    >
                        {t("joinTitleMain")}
                        <span className="text-brand">
                            {" "}
                            {t("joinTitleHighlight")}
                        </span>
                    </h2>

                    <p
                        className="
                            mt-5
                            max-w-xl
                            text-sm
                            leading-7
                            text-line-strong
                            sm:text-base
                        "
                    >
                        {t("joinDescription")}
                    </p>
                </div>

                {/* Job Cards Grid */}
                <div
                    ref={cardsRef}
                    className="
                        grid
                        gap-4
                        sm:grid-cols-2
                        lg:grid-cols-4
                    "
                >
                    {jobOpenings.map((job, index) => (
                        <article
                            key={index}
                            data-reveal
                            className="
                                group
                                relative
                                overflow-hidden
                                rounded-2xl
                                border
                                border-on-dark/10
                                bg-on-dark/5
                                p-6
                                backdrop-blur-sm
                                shadow-[0_4px_20px_rgba(var(--shadow-rgb),0.3)]
                                transition-all
                                duration-300
                                hover:-translate-y-1
                                hover:border-brand/30
                                hover:bg-on-dark/8
                                hover:shadow-[0_8px_32px_rgba(var(--shadow-rgb),0.4)]
                            "
                        >
                            {/* Top accent */}
                            <div
                                aria-hidden="true"
                                className="
                                    absolute
                                    top-0
                                    left-0
                                    right-0
                                    h-[2px]
                                    bg-gradient-to-r
                                    from-brand
                                    to-brand/30
                                    opacity-0
                                    transition-opacity
                                    duration-300
                                    group-hover:opacity-100
                                "
                            />

                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand transition-colors duration-300 group-hover:bg-brand/25">
                                <job.icon className="h-6 w-6" />
                            </div>

                            <span className="
                                inline-block
                                rounded-full
                                bg-on-dark/10
                                px-3
                                py-1
                                text-[10px]
                                font-bold
                                uppercase
                                tracking-wider
                                text-line-strong
                            ">
                                {t(`joinJob${index + 1}Type`)}
                            </span>

                            <h3 className="
                                font-display
                                mt-3
                                text-lg
                                font-semibold
                                text-on-dark
                            ">
                                {t(`joinJob${index + 1}Title`)}
                            </h3>

                            <p className="
                                mt-2
                                text-sm
                                leading-6
                                text-subtle
                            ">
                                {t(`joinJob${index + 1}Desc`)}
                            </p>
                        </article>
                    ))}
                </div>

                {/* Perks + CTA */}
                <div
                    className="
                        mt-12
                        flex
                        flex-col
                        gap-8
                        rounded-2xl
                        border
                        border-on-dark/10
                        bg-on-dark/5
                        p-6
                        sm:p-8
                        lg:mt-14
                        lg:flex-row
                        lg:items-center
                        lg:justify-between
                    "
                >
                    {/* Perks */}
                    <div
                        ref={perksRef}
                        className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6"
                    >
                        {hiringSection.perks.map((perk, index) => (
                            <div
                                key={index}
                                data-reveal
                                className="flex items-center gap-3 rounded-xl bg-on-dark/5 px-4 py-3"
                            >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                                    <perk.icon className="h-4 w-4" />
                                </div>
                                <span className="text-sm font-semibold text-line-strong">
                                    {t(`joinPerk${index + 1}`)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* CTA Button */}
                    <a
                        href={hiringSection.cta.href}
                        target="_blank"
                        rel="noreferrer"
                        className="
                            flex
                            shrink-0
                            items-center
                            justify-center
                            gap-3
                            rounded-full
                            bg-brand
                            px-8
                            py-4
                            text-sm
                            font-bold
                            text-on-dark
                            shadow-[0_0_20px_rgba(var(--brand-rgb),0.4)]
                            transition-all
                            duration-200
                            hover:-translate-y-0.5
                            hover:bg-brand-dark
                            hover:shadow-[0_0_28px_rgba(var(--brand-rgb),0.55)]
                        "
                    >
                        <RiWhatsappLine className="h-5 w-5" />
                        {t("joinCta")}
                        <RiArrowRightLine className="h-4 w-4" />
                    </a>
                </div>
            </div>
        </section>
    );
};

export default JoinWithUs;
