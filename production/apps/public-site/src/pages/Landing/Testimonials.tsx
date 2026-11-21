import { RiStarFill } from "react-icons/ri";
import { useReveal } from "../../hooks/useReveal";
import { useLanguage } from "../../i18n";
import SectionHeader from "./SectionHeader";

const Testimonials = () => {
    const { t } = useLanguage();
    const cardsRef = useReveal<HTMLDivElement>({ x: 40, y: 0, stagger: 0.1 });

    return (
        <section
            id="testimonials"
            className="
                relative
                bg-gradient-to-b from-surface via-brand-soft/30 to-surface
                px-4
                py-12
                sm:px-6
                sm:py-16
                lg:px-8
                lg:py-20
            "
        >
            {/* Warm gradient accent */}
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    -top-20
                    right-0
                    h-80
                    w-80
                    rounded-full
                    bg-brand-soft
                    opacity-40
                    blur-3xl
                    sm:h-96
                    sm:w-96
                "
            />

            <div className="relative mx-auto w-full max-w-[1440px]">
                <SectionHeader
                    badge={t("testimonialsBadge")}
                    main={t("testimonialsTitleMain")}
                    highlight={t("testimonialsTitleHighlight")}
                    description={t("testimonialsDescription")}
                />

                <div
                    ref={cardsRef}
                    className="
                        mt-12
                        grid
                        gap-5
                        sm:mt-14
                        md:grid-cols-2
                        lg:grid-cols-3
                    "
                >
                    {[1, 2, 3].map((num) => (
                        <article
                            key={num}
                            data-reveal
                            className="
                                flex
                                flex-col
                                rounded-3xl
                                border
                                border-line
                                bg-surface
                                p-8
                                shadow-[0_4px_20px_rgba(var(--shadow-rgb),0.06)]
                                transition-all
                                duration-300
                                hover:-translate-y-1.5
                                hover:border-brand/40
                                hover:shadow-[0_12px_36px_rgba(var(--shadow-rgb),0.1)]
                            "
                        >
                            <div
                                aria-hidden="true"
                                className="
                                    relative
                                    -mb-3
                                    font-display
                                    text-6xl
                                    font-bold
                                    leading-none
                                    text-brand/20
                                    before:absolute
                                    before:-top-2
                                    before:left-4
                                    before:text-6xl
                                    before:text-brand/20
                                    before:font-display
                                "
                            >
                                "
                            </div>

                            <div className="-mt-5 flex items-center gap-1">
                                {Array.from({ length: 5 }).map(
                                    (_, index) => (
                                        <RiStarFill
                                            key={index}
                                            className="h-[18px] w-[18px] text-accent"
                                        />
                                    )
                                )}
                            </div>

                            <p
                                className="
                                    mt-4
                                    flex-1
                                    text-base
                                    font-semibold
                                    leading-7
                                    text-ink
                                "
                            >
                                {t(`testimonial${num}Quote`)}
                            </p>

                            <div
                                className="
                                    mt-7
                                    flex
                                    items-center
                                    gap-3
                                    border-t
                                    border-transparent
                                    bg-gradient-to-r from-transparent via-brand/20 to-transparent
                                    pt-5
                                "
                            >
                                <div
                                    className="
                                        flex
                                        h-11
                                        w-11
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-full
                                        bg-brand
                                        text-sm
                                        font-bold
                                        text-on-dark
                                    "
                                >
                                    {t(`testimonial${num}Name`)
                                        .split(" ")
                                        .slice(0, 2)
                                        .map((part) => part[0])
                                        .join("")}
                                </div>

                                <div>
                                    <div className="text-sm font-bold text-ink">
                                        {t(`testimonial${num}Name`)}
                                    </div>

                                    <div className="mt-0.5 text-xs text-faint">
                                        {t(`testimonial${num}Service`)} ·{" "}
                                        {t(`testimonial${num}Location`)}
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Testimonials;
