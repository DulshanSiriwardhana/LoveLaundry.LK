import { useReveal } from "../../hooks/useReveal";

interface SectionHeaderProps {
    badge: string;
    main: string;
    highlight?: string;
    description?: string;
    centered?: boolean;
    dark?: boolean;
}

const SectionHeader = ({
    badge,
    main,
    highlight,
    description,
    centered = false,
    dark = false,
}: SectionHeaderProps) => {
    const headerRef = useReveal<HTMLDivElement>({ y: 25 });

    const titleColor = dark ? "text-on-dark" : "text-ink";
    const descColor = dark ? "text-on-dark/65" : "text-muted";
    const pillBg = dark ? "bg-brand/15" : "bg-brand-soft";

    if (centered) {
        return (
            <div
                ref={headerRef}
                data-reveal
                className="mx-auto max-w-3xl text-center"
            >
                <span
                    className={`
                        inline-flex
                        items-center
                        gap-2.5
                        rounded-full
                        border
                        border-brand/20
                        ${pillBg}
                        px-4
                        py-1.5
                        text-[11px]
                        font-bold
                        uppercase
                        tracking-[0.18em]
                        text-brand
                        sm:text-xs
                    `}
                >
                    {badge}
                </span>

                <h2
                    className={`
                        font-display
                        mt-5
                        text-4xl
                        font-semibold
                        leading-[1.05]
                        tracking-[-0.02em]
                        ${titleColor}
                        sm:text-5xl
                        lg:text-6xl
                    `}
                >
                    {main}
                    {highlight ? (
                        <span className="text-brand"> {highlight}</span>
                    ) : null}
                </h2>

                {description ? (
                    <p
                        className={`
                            mx-auto
                            mt-5
                            max-w-xl
                            text-sm
                            leading-8
                            ${descColor}
                            sm:text-base
                        `}
                    >
                        {description}
                    </p>
                ) : null}
            </div>
        );
    }

    return (
        <div ref={headerRef} data-reveal className="max-w-3xl">
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
                    className="h-[3px] w-10 rounded-full bg-brand shadow-[0_0_8px_rgba(var(--brand-rgb),0.4)]"
                />

                {badge}
            </span>

            <h2
                className={`
                    font-display
                    mt-5
                    text-4xl
                    font-semibold
                    leading-[1.05]
                    tracking-[-0.02em]
                    ${titleColor}
                    sm:text-5xl
                    lg:text-6xl
                `}
            >
                {main}

                {highlight ? (
                    <span className="text-brand"> {highlight}</span>
                ) : null}
            </h2>

            {description ? (
                <p
                    className={`
                        mt-5
                        max-w-xl
                        text-sm
                        leading-8
                        ${descColor}
                        sm:text-base
                    `}
                >
                    {description}
                </p>
            ) : null}
        </div>
    );
};

export default SectionHeader;
