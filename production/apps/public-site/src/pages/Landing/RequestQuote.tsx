import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
    RiArrowRightLine,
    RiCalendarLine,
    RiCheckboxCircleLine,
    RiFileList3Line,
    RiWhatsappLine,
} from "react-icons/ri";

import { COMPANY } from "../../data/constants";
import { useLanguage } from "../../i18n";
import SectionHeader from "./SectionHeader";

export type QuoteService =
    | "hotel-linen"
    | "commercial"
    | "shop-dropoff"
    | "counter"
    | "dry-cleaning"
    | "other";

const QUOTE_TYPES: { value: QuoteService; labelKey: string }[] = [
    { value: "hotel-linen", labelKey: "quoteTypeHotel" },
    { value: "commercial", labelKey: "quoteTypeCommercial" },
    { value: "shop-dropoff", labelKey: "quoteTypeShop" },
    { value: "counter", labelKey: "quoteTypeCounter" },
    { value: "dry-cleaning", labelKey: "quoteTypeDryCleaning" },
    { value: "other", labelKey: "quoteTypeOther" },
];

const inputClass = `
    w-full
    rounded-xl
    border
    border-line-strong
    bg-surface
    px-4
    py-3
    text-sm
    font-semibold
    text-ink
    outline-none
    transition
    placeholder:font-normal
    placeholder:text-faint
    focus:border-brand
    focus:ring-2
    focus:ring-brand/25
`;

interface RequestQuoteProps {
    service?: QuoteService;
}

const RequestQuote = ({ service = "counter" }: RequestQuoteProps) => {
    const { t } = useLanguage();
    const [type, setType] = useState<QuoteService>(service);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [location, setLocation] = useState("");
    const [notes, setNotes] = useState("");
    const [whatsappHref, setWhatsappHref] = useState("");

    useEffect(() => {
        setType(service);
    }, [service]);

    const minDate = useMemo(() => {
        const now = new Date();
        return new Date(
            now.getTime() - now.getTimezoneOffset() * 60_000,
        )
            .toISOString()
            .slice(0, 10);
    }, []);

    const isCollection =
        type === "hotel-linen" || type === "commercial";
    const selectedTypeLabel = t(
        QUOTE_TYPES.find((option) => option.value === type)?.labelKey ??
            "quoteTypeOther",
    );

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const lines = [
            t("quoteMessageIntro"),
            `${t("quoteTypeLabel")}: ${selectedTypeLabel}`,
            `${t("quoteNameLabel")}: ${name.trim()}`,
            `${t("quotePhoneLabel")}: ${phone.trim()}`,
            date ? `${t("quoteDateLabel")}: ${date}` : "",
            time ? `${t("quoteTimeLabel")}: ${time}` : "",
            location
                ? `${isCollection ? t("quoteCollectionAreaLabel") : t("quoteDropoffLabel")}: ${location}`
                : "",
            notes.trim() ? `${t("quoteNotesLabel")}: ${notes.trim()}` : "",
            t("quoteMessageNotice"),
        ].filter(Boolean);

        const base = COMPANY.whatsappLink.split("?")[0];
        const href = `${base}?text=${encodeURIComponent(lines.join("\n"))}`;
        setWhatsappHref(href);
        window.open(href, "_blank", "noopener,noreferrer");
    };

    return (
        <section
            id="quote"
            aria-labelledby="quote-title"
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
            <div className="mx-auto w-full max-w-[1440px]">
                <SectionHeader
                    titleId="quote-title"
                    badge={t("quoteBadge")}
                    main={t("quoteTitleMain")}
                    highlight={t("quoteTitleHighlight")}
                    description={t("quoteDescription")}
                    centered
                />

                <div
                    className="
                        mt-10
                        grid
                        gap-6
                        sm:mt-12
                        lg:grid-cols-[0.85fr_1.15fr]
                        lg:gap-8
                    "
                >
                    <aside
                        className="
                            flex
                            flex-col
                            justify-between
                            rounded-3xl
                            border
                            border-line
                            bg-surface
                            p-6
                            shadow-[0_12px_36px_rgba(var(--shadow-rgb),0.07)]
                            sm:p-8
                        "
                    >
                        <div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                                <RiFileList3Line className="h-6 w-6" />
                            </div>
                            <h3 className="font-display mt-5 text-2xl font-bold leading-snug text-ink">
                                {t("quoteFormTitle")}
                            </h3>
                            <p className="mt-3 text-sm leading-7 text-muted">
                                {t("quoteFormSubtitle")}
                            </p>
                        </div>

                        <div className="mt-8 space-y-3">
                            <div className="flex items-start gap-3 rounded-xl bg-surface-muted p-3.5">
                                <RiCheckboxCircleLine className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                                <p className="text-xs leading-6 text-muted">
                                    {t("quoteDisclaimer")}
                                </p>
                            </div>
                            <div className="flex items-start gap-3 rounded-xl bg-surface-muted p-3.5">
                                <RiCalendarLine className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                                <p className="text-xs leading-6 text-muted">
                                    {t("quoteHours")}
                                </p>
                            </div>
                        </div>
                    </aside>

                    <form
                        onSubmit={handleSubmit}
                        className="
                            rounded-3xl
                            border
                            border-line
                            bg-surface
                            p-5
                            shadow-[0_12px_36px_rgba(var(--shadow-rgb),0.07)]
                            sm:p-8
                        "
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label
                                    htmlFor="quote-type"
                                    className="mb-2 block text-xs font-bold text-ink"
                                >
                                    {t("quoteTypeLabel")} *
                                </label>
                                <select
                                    id="quote-type"
                                    required
                                    value={type}
                                    onChange={(event) =>
                                        setType(
                                            event.target.value as QuoteService,
                                        )
                                    }
                                    className={inputClass}
                                >
                                    {QUOTE_TYPES.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {t(option.labelKey)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label
                                    htmlFor="quote-name"
                                    className="mb-2 block text-xs font-bold text-ink"
                                >
                                    {t("quoteNameLabel")} *
                                </label>
                                <input
                                    id="quote-name"
                                    type="text"
                                    required
                                    autoComplete="name"
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                    placeholder={t("quoteNamePlaceholder")}
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="quote-phone"
                                    className="mb-2 block text-xs font-bold text-ink"
                                >
                                    {t("quotePhoneLabel")} *
                                </label>
                                <input
                                    id="quote-phone"
                                    type="tel"
                                    required
                                    minLength={7}
                                    inputMode="tel"
                                    autoComplete="tel"
                                    value={phone}
                                    onChange={(event) =>
                                        setPhone(event.target.value)
                                    }
                                    placeholder={t("quotePhonePlaceholder")}
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="quote-date"
                                    className="mb-2 block text-xs font-bold text-ink"
                                >
                                    {t("quoteDateLabel")}
                                </label>
                                <input
                                    id="quote-date"
                                    type="date"
                                    min={minDate}
                                    value={date}
                                    onChange={(event) =>
                                        setDate(event.target.value)
                                    }
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="quote-time"
                                    className="mb-2 block text-xs font-bold text-ink"
                                >
                                    {t("quoteTimeLabel")}
                                </label>
                                <select
                                    id="quote-time"
                                    value={time}
                                    onChange={(event) =>
                                        setTime(event.target.value)
                                    }
                                    className={inputClass}
                                >
                                    <option value="">
                                        {t("quoteTimePlaceholder")}
                                    </option>
                                    <option value={t("quoteTimeMorning")}>
                                        {t("quoteTimeMorning")}
                                    </option>
                                    <option value={t("quoteTimeAfternoon")}>
                                        {t("quoteTimeAfternoon")}
                                    </option>
                                    <option value={t("quoteTimeEvening")}>
                                        {t("quoteTimeEvening")}
                                    </option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label
                                    htmlFor="quote-location"
                                    className="mb-2 block text-xs font-bold text-ink"
                                >
                                    {isCollection
                                        ? t("quoteCollectionAreaLabel")
                                        : t("quoteDropoffLabel")}
                                </label>
                                <select
                                    id="quote-location"
                                    value={location}
                                    onChange={(event) =>
                                        setLocation(event.target.value)
                                    }
                                    className={inputClass}
                                >
                                    <option value="">
                                        {t("quoteLocationPlaceholder")}
                                    </option>
                                    <option value={t("quoteLocationMain")}>
                                        {t("quoteLocationMain")}
                                    </option>
                                    {COMPANY.serviceAreas.map((area) => (
                                        <option key={area} value={area}>
                                            {area}
                                        </option>
                                    ))}
                                    <option value={t("quoteLocationUnsure")}>
                                        {t("quoteLocationUnsure")}
                                    </option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <label
                                    htmlFor="quote-notes"
                                    className="mb-2 block text-xs font-bold text-ink"
                                >
                                    {t("quoteNotesLabel")}
                                </label>
                                <textarea
                                    id="quote-notes"
                                    rows={3}
                                    value={notes}
                                    onChange={(event) =>
                                        setNotes(event.target.value)
                                    }
                                    placeholder={t("quoteNotesPlaceholder")}
                                    className={`${inputClass} resize-y`}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="
                                mt-6
                                flex
                                w-full
                                items-center
                                justify-center
                                gap-2.5
                                rounded-xl
                                bg-brand
                                px-6
                                py-4
                                text-sm
                                font-bold
                                text-on-dark
                                shadow-[0_10px_28px_rgba(var(--brand-rgb),0.28)]
                                transition
                                hover:-translate-y-0.5
                                hover:bg-brand-dark
                            "
                        >
                            <RiWhatsappLine className="h-5 w-5" />
                            {t("quoteSubmit")}
                            <RiArrowRightLine className="h-4 w-4" />
                        </button>

                        <p className="mt-3 text-center text-[11px] leading-5 text-faint">
                            {t("quoteRequiredNotice")}
                        </p>

                        <div aria-live="polite">
                            {whatsappHref && (
                                <div
                                    className="
                                        mt-4
                                        rounded-xl
                                        border
                                        border-brand/20
                                        bg-brand-soft
                                        p-4
                                        text-center
                                        text-xs
                                        font-semibold
                                        text-ink
                                    "
                                >
                                    {t("quoteSuccessText")}{" "}
                                    <a
                                        href={whatsappHref}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-bold text-brand underline underline-offset-4"
                                    >
                                        {t("quoteDirectLink")}
                                    </a>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </section>
    );
};

export default RequestQuote;
