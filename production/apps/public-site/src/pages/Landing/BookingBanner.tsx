import { RiWhatsappLine, RiArrowRightLine, RiStarFill } from "react-icons/ri";
import { COMPANY } from "../../data/constants";
import { useLanguage } from "../../i18n";

const BookingBanner = () => {
    const { t } = useLanguage();

    return (
        <section
            aria-label={t("bookTitle")}
            className="
                relative
                overflow-hidden
                bg-brand
                px-4
                py-10
                sm:px-6
                sm:py-12
                lg:px-8
            "
        >
            {/* Gold accent wash — keeps warm brand palette */}
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    bg-[radial-gradient(70%_140%_at_100%_0%,rgba(var(--accent-rgb),0.28),transparent_60%)]
                "
            />
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    -left-16
                    top-1/2
                    h-48
                    w-48
                    -translate-y-1/2
                    rounded-full
                    bg-on-dark/10
                "
            />

            <div
                className="
                    relative
                    mx-auto
                    flex
                    w-full
                    max-w-[1440px]
                    flex-col
                    items-center
                    gap-6
                    text-center
                    sm:flex-row
                    sm:justify-between
                    sm:text-left
                "
            >
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-on-dark/15 text-on-dark sm:h-16 sm:w-16">
                        <RiWhatsappLine className="h-7 w-7 sm:h-8 sm:w-8" />
                    </div>

                    <div>
                        <div className="flex items-center justify-center gap-2 sm:justify-start">
                            <h3
                                className="
                                    font-display
                                    text-xl
                                    font-semibold
                                    tracking-tight
                                    text-on-dark
                                    sm:text-2xl
                                "
                            >
                                {t("bookTitle")}
                            </h3>
                        </div>

                        <p className="mt-1.5 text-sm text-on-dark/85 sm:text-base">
                            {t("bookDesc")}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-3 sm:items-end">
                    <a
                        href={COMPANY.whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        className="
                            flex
                            shrink-0
                            items-center
                            gap-2.5
                            rounded-full
                            bg-surface
                            px-7
                            py-3.5
                            text-sm
                            font-bold
                            text-brand
                            shadow-[0_12px_30px_rgba(var(--shadow-rgb),0.18)]
                            transition-all
                            duration-200
                            hover:-translate-y-0.5
                            hover:bg-brand-soft
                            hover:shadow-[0_16px_38px_rgba(var(--shadow-rgb),0.24)]
                        "
                    >
                        <RiWhatsappLine className="h-5 w-5" />
                        {t("bookCta")}
                        <RiArrowRightLine className="h-4 w-4" />
                    </a>

                    <div className="flex items-center gap-2 text-xs font-semibold text-on-dark/85">
                        <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <RiStarFill
                                    key={index}
                                    className="h-3.5 w-3.5 text-on-dark"
                                />
                            ))}
                        </div>
                        {t("bookTrusted")}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default BookingBanner;
