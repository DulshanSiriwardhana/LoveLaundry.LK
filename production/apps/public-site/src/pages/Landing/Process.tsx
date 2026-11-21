import { RiArrowRightLine } from "react-icons/ri";
import { useReveal } from "../../hooks/useReveal";
import { processSteps } from "../../data/siteData";
import { useLanguage } from "../../i18n";
import SectionHeader from "./SectionHeader";

const Process = () => {
    const { t } = useLanguage();
    const stepsRef = useReveal<HTMLDivElement>({ x: -40, y: 0, stagger: 0.1 });

    const stepKeys = [
        { titleKey: "processStep1Title", textKey: "processStep1Text" },
        { titleKey: "processStep2Title", textKey: "processStep2Text" },
        { titleKey: "processStep3Title", textKey: "processStep3Text" },
        { titleKey: "processStep4Title", textKey: "processStep4Text" },
    ];

    return (
        <section
            id="process"
            className="
                relative
                overflow-hidden
                bg-surface-dark
                bg-[radial-gradient(circle_at_80%_50%,rgba(var(--brand-rgb),0.14),transparent_50%)]
                px-4
                py-12
                sm:px-6
                sm:py-16
                lg:px-8
                lg:py-20
            "
        >
            <div className="relative mx-auto w-full max-w-[1440px]">
                <SectionHeader
                    badge={t("processBadge")}
                    main={t("processTitleMain")}
                    highlight={t("processTitleHighlight")}
                    centered
                    dark
                />

                <div
                    ref={stepsRef}
                    className="
                        mt-12
                        flex
                        flex-col
                        gap-4
                        sm:mt-14
                        sm:flex-row
                        sm:flex-wrap
                        lg:flex-nowrap
                    "
                >
                    {processSteps.flatMap((step, index) => {
                        const Icon = step.icon;
                        const card = (
                            <div
                                key={step.number}
                                data-reveal
                                className="
                                    group
                                    relative
                                    flex-1
                                    overflow-hidden
                                    rounded-3xl
                                    border
                                    border-on-dark/10
                                    bg-on-dark/5
                                    p-7
                                    shadow-[0_2px_12px_rgba(var(--shadow-rgb),0.2)]
                                    transition-all
                                    duration-300
                                    hover:-translate-y-1.5
                                    hover:border-brand/40
                                    hover:shadow-[0_12px_32px_rgba(var(--shadow-rgb),0.4)]
                                "
                            >
                                <div
                                    aria-hidden="true"
                                    className="
                                        pointer-events-none
                                        absolute
                                        -right-3
                                        -top-6
                                        font-display
                                        text-[120px]
                                        font-bold
                                        leading-none
                                        tracking-tight
                                        text-on-dark/10
                                        transition-colors
                                        duration-300
                                        group-hover:text-brand/20
                                    "
                                >
                                    {step.number}
                                </div>

                                <div className="relative flex items-center justify-between">
                                    <div
                                        className="
                                            flex
                                            h-14
                                            w-14
                                            items-center
                                            justify-center
                                            rounded-2xl
                                            bg-brand
                                            text-on-dark
                                            shadow-[0_4px_12px_rgba(var(--brand-rgb),0.2)]
                                        "
                                    >
                                        <Icon className="h-6 w-6" />
                                    </div>

                                    <span
                                        className="
                                            font-display
                                            text-lg
                                            font-bold
                                            text-brand
                                        "
                                    >
                                        {step.number}
                                    </span>
                                </div>

                                <h3
                                    className="
                                        font-display
                                        mt-6
                                        text-xl
                                        font-semibold
                                        tracking-tight
                                        text-on-dark
                                    "
                                >
                                    {t(stepKeys[index].titleKey)}
                                </h3>

                                <p
                                    className="
                                        mt-2
                                        text-sm
                                        leading-6
                                        text-on-dark/65
                                    "
                                >
                                    {t(stepKeys[index].textKey)}
                                </p>
                            </div>
                        );

                        if (index < processSteps.length - 1) {
                            const separator = (
                                <div
                                    key={`sep-${step.number}`}
                                    className="
                                        hidden
                                        items-center
                                        justify-center
                                        self-stretch
                                        lg:flex
                                    "
                                >
                                    <div className="h-0 w-full border-t-2 border-dashed border-brand/20" />
                                </div>
                            );
                            return [card, separator];
                        }
                        return [card];
                    })}
                </div>

                {/* Bottom CTA */}
                <div
                    className="
                        mt-10
                        flex
                        flex-col
                        items-center
                        gap-4
                        rounded-2xl
                        border
                        border-on-dark/10
                        bg-on-dark/5
                        px-6
                        py-8
                        text-center
                        shadow-[0_4px_20px_rgba(var(--shadow-rgb),0.2)]
                        sm:flex-row
                        sm:justify-between
                        sm:text-left
                        lg:mt-14
                    "
                >
                    <div>
                        <h3 className="font-display text-lg font-semibold text-on-dark">
                            {t("processCtaTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-on-dark/65">
                            {t("processCtaSub")}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            document
                                .getElementById("contact")
                                ?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="
                            flex
                            shrink-0
                            items-center
                            gap-2.5
                            rounded-full
                            bg-brand
                            px-7
                            py-3.5
                            text-sm
                            font-bold
                            text-on-dark
                            shadow-[0_8px_24px_rgba(var(--brand-rgb),0.3)]
                            transition-all
                            duration-200
                            hover:-translate-y-0.5
                            hover:bg-brand-dark
                            hover:shadow-[0_12px_32px_rgba(var(--brand-rgb),0.4)]
                        "
                    >
                        {t("processGetStarted")}
                        <RiArrowRightLine className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </section>
    );
};

export default Process;
