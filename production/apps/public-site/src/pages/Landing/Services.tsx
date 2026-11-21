import { RiArrowRightLine, RiPhoneLine } from "react-icons/ri";
import { useReveal } from "../../hooks/useReveal";
import { services, companyInfo } from "../../data/siteData";
import { useLanguage } from "../../i18n";
import SectionHeader from "./SectionHeader";

const Services = () => {
    const { t } = useLanguage();
    const cardsRef = useReveal<HTMLDivElement>({ x: 40, y: 0, stagger: 0.1 });

    const serviceKeys = [
        { titleKey: "serviceWashTitle", subtitleKey: "serviceWashSubtitle", descKey: "serviceWashDesc" },
        { titleKey: "serviceDryTitle", subtitleKey: "serviceDrySubtitle", descKey: "serviceDryDesc" },
        { titleKey: "serviceIronTitle", subtitleKey: "serviceIronSubtitle", descKey: "serviceIronDesc" },
        { titleKey: "servicePickupTitle", subtitleKey: "servicePickupSubtitle", descKey: "servicePickupDesc" },
    ];

    return (
        <section
            id="services"
            className="
                relative
                bg-surface-muted
                px-4
                py-12
                sm:px-6
                sm:py-16
                lg:px-8
                lg:py-20
            "
        >
            {/* Subtle dot pattern */}
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    opacity-[0.06]
                    bg-[radial-gradient(circle,var(--color-ink)_1px,transparent_1px)]
                    bg-[length:24px_24px]
                "
            />

            <div className="relative mx-auto w-full max-w-[1440px]">
                <SectionHeader
                    badge={t("servicesBadge")}
                    main={t("servicesTitleMain")}
                    highlight={t("servicesTitleHighlight")}
                    centered
                />

                <div
                    ref={cardsRef}
                    className="
                        mt-12
                        grid
                        gap-5
                        sm:mt-14
                        sm:grid-cols-2
                        lg:grid-cols-4
                    "
                >
                    {services.map((service, index) => (
                        <article
                            key={service.title}
                            data-reveal
                            className="
                                group
                                relative
                                overflow-hidden
                                rounded-3xl
                                border
                                border-line
                                bg-surface
                                transition-all
                                duration-300
                                shadow-[0_2px_12px_rgba(var(--shadow-rgb),0.06)]
                                hover:-translate-y-1.5
                                hover:border-brand/40
                                hover:shadow-[0_24px_50px_rgba(var(--shadow-rgb),0.16)]
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

                            <div
                                className="
                                    relative
                                    aspect-[1.35/1]
                                    overflow-hidden
                                    bg-surface-muted
                                "
                            >
                                <img
                                    src={service.image}
                                    alt={t(serviceKeys[index].titleKey)}
                                    loading="lazy"
                                    style={{
                                        filter:
                                            "sepia(0.16) saturate(1.06) contrast(1.02)",
                                    }}
                                    className="
                                        h-full
                                        w-full
                                        object-cover
                                        transition-transform
                                        duration-700
                                        ease-out
                                        group-hover:scale-105
                                    "
                                />
                                <div
                                    aria-hidden="true"
                                    className="
                                        absolute
                                        inset-x-0
                                        bottom-0
                                        h-16
                                        bg-gradient-to-t
                                        from-ink/20
                                        to-transparent
                                        pointer-events-none
                                    "
                                />
                            </div>

                            <div className="p-6">
                                <div
                                    className="
                                        text-[10px]
                                        font-bold
                                        uppercase
                                        tracking-[0.16em]
                                        text-brand
                                    "
                                >
                                    {t(serviceKeys[index].subtitleKey)}
                                </div>

                                <h3
                                    className="
                                        font-display
                                        mt-2
                                        text-xl
                                        font-semibold
                                        tracking-tight
                                        text-ink
                                    "
                                >
                                    {t(serviceKeys[index].titleKey)}
                                </h3>

                                <p
                                    className="
                                        mt-2.5
                                        text-sm
                                        leading-6
                                        text-muted
                                    "
                                >
                                    {t(serviceKeys[index].descKey)}
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
                                        mt-5
                                        flex
                                        items-center
                                        gap-2
                                        text-xs
                                        font-bold
                                        text-brand
                                        transition-all
                                        duration-200
                                        group-hover:gap-3
                                    "
                                >
                                    {t("servicesLearnMore")}

                                    <RiArrowRightLine className="h-4 w-4" />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div
                    className="
                        mt-12
                        flex
                        flex-col
                        items-center
                        gap-4
                        rounded-2xl
                        border
                        border-brand/10
                        bg-gradient-to-r from-brand/5 via-surface to-brand/5
                        px-6
                        py-8
                        text-center
                        sm:flex-row
                        sm:justify-between
                        sm:text-left
                        lg:mt-14
                    "
                >
                    <div>
                        <h3 className="font-display text-lg font-semibold text-ink">
                            {t("servicesCtaTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                            {t("servicesCtaSub")}
                        </p>
                    </div>

                    <a
                        href={`tel:${companyInfo.phone}`}
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
                        <RiPhoneLine className="h-4 w-4" />
                        {t("servicesCtaBtn")}
                    </a>
                </div>
            </div>
        </section>
    );
};

export default Services;
