import {
    RiArrowRightLine,
    RiPhoneLine,
    RiWhatsappLine,
    RiSparkling2Fill,
} from "react-icons/ri";
import { useReveal } from "../../hooks/useReveal";
import { useLanguage } from "../../i18n";
import { contactSection, companyInfo } from "../../data/siteData";

const Contact = () => {
    const bannerRef = useReveal<HTMLDivElement>({ y: 30, scale: 0.98 });
    const { t } = useLanguage();

    return (
        <section
            id="contact"
            className="
                relative
                overflow-hidden
                bg-ink
                px-4
                py-12
                sm:px-6
                sm:py-16
                lg:px-8
                lg:py-20
            "
        >
            <div className="relative mx-auto w-full max-w-[1440px]">
                <div
                    ref={bannerRef}
                    data-reveal
                    className="
                        relative
                        overflow-hidden
                        rounded-[28px]
                        bg-surface
                        px-6
                        py-14
                        shadow-[0_8px_40px_rgba(var(--shadow-rgb),0.3)]
                        sm:rounded-[40px]
                        sm:px-12
                        sm:py-16
                        lg:px-16
                    "
                >
                    <div
                        aria-hidden="true"
                        className="
                            pointer-events-none
                            absolute
                            -right-24
                            -top-32
                            h-96
                            w-96
                            rounded-full
                            bg-brand/10
                        "
                    />

                    <div
                        aria-hidden="true"
                        className="
                            pointer-events-none
                            absolute
                            -bottom-28
                            -left-20
                            h-80
                            w-80
                            rounded-full
                            border-[24px]
                            border-brand/10
                        "
                    />

                    <div
                        className="
                            relative
                            grid
                            gap-10
                            lg:grid-cols-[1fr_auto]
                            lg:items-center
                            lg:gap-16
                        "
                    >
                        <div>
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
                                <RiSparkling2Fill className="h-4 w-4" />

                                {t("contactBadge")}
                            </span>

                            <h2
                                className="
                                    font-display
                                    mt-4
                                    max-w-2xl
                                    text-4xl
                                    font-semibold
                                    leading-[1.05]
                                    tracking-[-0.02em]
                                    text-ink
                                    sm:text-5xl
                                    lg:text-6xl
                                "
                            >
                                {t("contactTitle")}
                            </h2>

                            <p
                                className="
                                    mt-5
                                    max-w-xl
                                    text-sm
                                    leading-7
                                    text-muted
                                    sm:text-base
                                "
                            >
                                {t("contactDescription")}
                            </p>

                            {/* Quick Stats */}
                            <div className="mt-6 flex flex-wrap gap-4 sm:gap-6">
                                {[
                                    { label: t("contactAvailable"), value: companyInfo.availability },
                                    { label: t("contactCustomers"), value: companyInfo.customerCount },
                                    { label: t("contactRating"), value: `${companyInfo.rating}/5` },
                                ].map((stat) => (
                                    <div key={stat.label} className="flex items-center gap-2">
                                        <div className="font-display text-lg font-bold text-ink sm:text-xl">
                                            {stat.value}
                                        </div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-faint">
                                            {stat.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div
                            className="
                                flex
                                flex-col
                                gap-3
                                sm:flex-row
                                lg:min-w-[210px]
                                lg:flex-col
                            "
                        >
                            <a
                                href={contactSection.buttons.phone.href}
                                className="
                                    flex
                                    h-13
                                    items-center
                                    justify-center
                                    gap-3
                                    rounded-full
                                    bg-surface
                                    px-8
                                    text-sm
                                    font-bold
                                    text-brand
                                    shadow-[0_12px_30px_rgba(var(--brand-dark-rgb),0.35)]
                                    transition-all
                                    duration-200
                                    hover:-translate-y-0.5
                                    hover:shadow-[0_16px_40px_rgba(var(--brand-dark-rgb),0.45)]
                                "
                            >
                                <RiPhoneLine className="h-5 w-5" />

                                {t("contactCall")}
                            </a>

                            <a
                                href={contactSection.buttons.whatsapp.href}
                                target="_blank"
                                rel="noreferrer"
                                className="
                                    flex
                                    h-13
                                    items-center
                                    justify-center
                                    gap-3
                                    rounded-full
                                    border
                                    border-brand/20
                                    bg-brand/10
                                    px-8
                                    text-sm
                                    font-bold
                                    text-brand
                                    transition-all
                                    duration-200
                                    hover:-translate-y-0.5
                                    hover:bg-brand/20
                                "
                            >
                                <RiWhatsappLine className="h-5 w-5" />

                                {t("contactWhatsapp")}

                                <RiArrowRightLine className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Contact;
