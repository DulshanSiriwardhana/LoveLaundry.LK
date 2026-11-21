import { RiArrowRightLine } from "react-icons/ri";
import { useReveal } from "../../hooks/useReveal";
import { commercialServices } from "../../data/siteData";
import { useLanguage } from "../../i18n";
import SectionHeader from "./SectionHeader";

const Commercial = () => {
    const { t } = useLanguage();
    const cardsRef = useReveal<HTMLDivElement>({ x: 40, y: 0, stagger: 0.12 });

    const commercialKeys = [
        { titleKey: "commercialHotelTitle", subtitleKey: "commercialHotelSubtitle", descKey: "commercialHotelDesc" },
        { titleKey: "commercialCompTitle", subtitleKey: "commercialCompSubtitle", descKey: "commercialCompDesc" },
        { titleKey: "commercialBulkTitle", subtitleKey: "commercialBulkSubtitle", descKey: "commercialBulkDesc" },
    ];

    return (
        <section
            id="commercial"
            className="
                relative
                overflow-hidden
                bg-surface-dark
                px-4
                py-12
                sm:px-6
                sm:py-16
                lg:px-8
                lg:py-20
            "
        >
            {/* Warm brand glow */}
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-[radial-gradient(70%_60%_at_100%_0%,rgba(var(--brand-rgb),0.18),transparent_60%)]
                "
            />

            <div className="relative mx-auto w-full max-w-[1440px]">
                <SectionHeader
                    badge={t("commercialBadge")}
                    main={t("commercialTitleMain")}
                    highlight={t("commercialTitleHighlight")}
                    description={t("commercialDescription")}
                    centered
                    dark
                />

                <div
                    ref={cardsRef}
                    className="
                        mt-12
                        grid
                        gap-4
                        sm:mt-14
                        sm:grid-cols-2
                        lg:grid-cols-3
                    "
                >
                    {commercialServices.map((service, index) => {
                        const Icon = service.icon;

                        return (
                            <article
                                key={service.title}
                                data-reveal
                                className="
                                    group
                                    relative
                                    overflow-hidden
                                    rounded-3xl
                                    border
                                    border-on-dark/10
                                    bg-on-dark/5
                                    p-8
                                    transition-all
                                    duration-300
                                    shadow-[0_2px_16px_rgba(var(--shadow-rgb),0.2)]
                                    hover:-translate-y-1.5
                                    hover:border-brand/40
                                    hover:shadow-[0_20px_40px_rgba(var(--shadow-rgb),0.4)]
                                "
                            >
                                <div
                                    aria-hidden="true"
                                    className="
                                        absolute
                                        inset-x-0
                                        top-0
                                        z-10
                                        h-1
                                        bg-brand
                                        opacity-0
                                        transition-opacity
                                        duration-300
                                        group-hover:opacity-100
                                    "
                                />

                                <div className="flex items-start justify-between">
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
                                            shadow-[0_8px_20px_rgba(var(--brand-rgb),0.3)]
                                            transition-transform
                                            duration-300
                                            group-hover:-rotate-6
                                            group-hover:scale-105
                                        "
                                    >
                                        <Icon className="h-7 w-7" />
                                    </div>

                                    <div
                                        className="
                                            font-display
                                            text-2xl
                                            font-bold
                                            tracking-tight
                                            text-on-dark/10
                                        "
                                    >
                                        0{index + 1}
                                    </div>
                                </div>

                                <div
                                    className="
                                        mt-6
                                        text-[10px]
                                        font-bold
                                        uppercase
                                        tracking-[0.16em]
                                        text-brand
                                    "
                                >
                                    {t(commercialKeys[index].subtitleKey)}
                                </div>

                                <h3
                                    className="
                                        font-display
                                        mt-2
                                        text-xl
                                        font-semibold
                                        tracking-tight
                                        text-on-dark
                                        sm:text-2xl
                                    "
                                >
                                    {t(commercialKeys[index].titleKey)}
                                </h3>

                                <p
                                    className="
                                        mt-3
                                        text-sm
                                        leading-6
                                        text-on-dark/65
                                    "
                                >
                                    {t(commercialKeys[index].descKey)}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => {
                                        document
                                            .getElementById("contact")
                                            ?.scrollIntoView({
                                                behavior: "smooth",
                                            });
                                    }}
                                    className="
                                        mt-7
                                        inline-flex
                                        items-center
                                        gap-2
                                        rounded-full
                                        bg-surface
                                        px-5
                                        py-2.5
                                        text-xs
                                        font-bold
                                        text-brand
                                        transition-all
                                        duration-200
                                        group-hover:gap-3
                                        group-hover:bg-brand-soft
                                    "
                                >
                                    {t("commercialGetQuote")}

                                    <RiArrowRightLine className="h-4 w-4" />
                                </button>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default Commercial;
