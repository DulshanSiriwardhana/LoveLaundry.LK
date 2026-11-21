import { useCallback, useEffect, useMemo, useState } from "react";
import {
    RiMapPinLine,
    RiNavigationLine,
    RiLoader4Line,
    RiSearchLine,
    RiCloseLine,
    RiArrowRightLine,
    RiAppsLine,
    RiStore2Line,
    RiMapPin2Line,
    RiExternalLinkLine,
    RiGlobalLine,
    RiInformationLine,
} from "react-icons/ri";
import { useReveal } from "../../hooks/useReveal";
import { useLanguage } from "../../i18n";
import { allLocations, mainLaundry, type Location } from "../../data/locations";

type MapSource = "google" | "osm";

interface NearestResult {
    location: Location;
    distanceKm: number;
}

/** Haversine distance in kilometres between two WGS84 coordinates. */
const distanceKm = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Free embedded maps — no API key, billing account or token required.
 * Google Maps is the default because it is the most widely available; the
 * OpenStreetMap embed is a one-click fallback if Google is blocked.
 */
const embedUrl = (loc: Location, source: MapSource, lang: "en" | "sin") => {
    const zoom = loc.precision === "town" ? "13" : "15";

    if (source === "google") {
        const params = new URLSearchParams({
            q: `${loc.lat},${loc.lng}`,
            z: zoom,
            output: "embed",
            hl: lang === "sin" ? "si" : "en",
        });
        return `https://www.google.com/maps?${params.toString()}`;
    }

    const latSpan = loc.precision === "town" ? 0.06 : 0.035;
    const lngSpan = loc.precision === "town" ? 0.09 : 0.055;
    const bbox = [
        loc.lng - lngSpan,
        loc.lat - latSpan,
        loc.lng + lngSpan,
        loc.lat + latSpan,
    ]
        .map((value) => value.toFixed(6))
        .join(",");

    const params = new URLSearchParams({
        bbox,
        layer: "mapnik",
        marker: `${loc.lat},${loc.lng}`,
    });
    return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
};

const directionsUrl = (loc: Location) =>
    `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;

const fullMapUrl = (loc: Location, source: MapSource) => {
    const zoom = loc.precision === "town" ? "13" : "15";

    return source === "google"
        ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`
        : `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=${zoom}/${loc.lat}/${loc.lng}`;
};

const MapContent = () => {
    const { t, lang } = useLanguage();

    const [source, setSource] = useState<MapSource>("google");
    const [selected, setSelected] = useState<Location>(mainLaundry);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState<"all" | "main" | "shops">(
        "all"
    );
    const [nearest, setNearest] = useState<NearestResult | null>(null);
    const [loadingGeo, setLoadingGeo] = useState(false);
    const [geoError, setGeoError] = useState("");

    const filteredLocations = useMemo(
        () =>
            allLocations.filter((loc) => {
                const query = searchQuery.trim().toLowerCase();
                const matchesSearch =
                    query === "" ||
                    loc.name.toLowerCase().includes(query) ||
                    loc.address.toLowerCase().includes(query);
                const matchesFilter =
                    activeFilter === "all" ||
                    (activeFilter === "main" && loc.id === mainLaundry.id) ||
                    (activeFilter === "shops" && loc.id !== mainLaundry.id);

                return matchesSearch && matchesFilter;
            }),
        [searchQuery, activeFilter]
    );

    // Keep the map focused on a location that is still visible in the list.
    useEffect(() => {
        if (
            filteredLocations.length > 0 &&
            !filteredLocations.some((loc) => loc.id === selected.id)
        ) {
            setSelected(filteredLocations[0]);
            setNearest(null);
        }
    }, [filteredLocations, selected.id]);

    const selectLocation = useCallback((loc: Location) => {
        setSelected(loc);
        setSearchQuery("");
        setActiveFilter("all");
        setNearest(null);
    }, []);

    const findNearest = () => {
        setGeoError("");

        if (!navigator.geolocation) {
            setGeoError(t("mapGeoUnsupported"));
            return;
        }

        setLoadingGeo(true);
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                let closest = allLocations[0];
                let shortest = distanceKm(
                    coords.latitude,
                    coords.longitude,
                    closest.lat,
                    closest.lng
                );

                allLocations.forEach((loc) => {
                    const distance = distanceKm(
                        coords.latitude,
                        coords.longitude,
                        loc.lat,
                        loc.lng
                    );
                    if (distance < shortest) {
                        shortest = distance;
                        closest = loc;
                    }
                });

                setNearest({ location: closest, distanceKm: shortest });
                setSelected(closest);
                setSearchQuery("");
                setActiveFilter("all");
                setLoadingGeo(false);
            },
            () => {
                setGeoError(t("mapGeoDenied"));
                setLoadingGeo(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const distanceLabel = nearest
        ? nearest.distanceKm < 1
            ? `${Math.round(nearest.distanceKm * 1000)} m`
            : `${nearest.distanceKm.toFixed(1)} km`
        : "";

    const subtitleFor = (loc: Location) => {
        if (loc.id === mainLaundry.id) return t("mapMainCentre");
        if (loc.precision === "town") {
            return `${loc.address} · ${t("mapTownLocation")}`;
        }
        return loc.address;
    };

    return (
        <>
            {/* Location list */}
            <div className="flex flex-col gap-3 lg:w-[340px] lg:shrink-0">
                <button
                    type="button"
                    onClick={findNearest}
                    disabled={loadingGeo}
                    className="
                        flex h-12 items-center justify-center gap-2.5 rounded-xl
                        bg-brand px-5 text-sm font-bold text-on-dark
                        shadow-[0_8px_24px_rgba(var(--brand-rgb),0.35)]
                        transition-all duration-200
                        hover:-translate-y-0.5 hover:bg-brand-dark
                        disabled:cursor-not-allowed disabled:opacity-60
                    "
                >
                    {loadingGeo ? (
                        <RiLoader4Line className="h-5 w-5 animate-spin" />
                    ) : (
                        <RiNavigationLine className="h-5 w-5" />
                    )}
                    {loadingGeo ? t("mapFinding") : t("mapFindNearest")}
                </button>

                {geoError && (
                    <div className="flex gap-2 rounded-xl border border-brand/20 bg-brand-soft px-3 py-2.5 text-xs leading-relaxed text-brand">
                        <RiInformationLine className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{geoError}</span>
                    </div>
                )}

                {nearest && (
                    <div className="nearest-result-card group relative overflow-hidden rounded-xl border border-brand/20 p-4">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand-dark to-brand-deep opacity-[0.08] transition-opacity duration-300 group-hover:opacity-[0.12]" />
                        <div className="relative flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-on-dark shadow-md shadow-brand/30">
                                <RiNavigationLine className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-brand">
                                    {t("mapNearestLocation")} · {distanceLabel}
                                </div>
                                <div className="mt-0.5 truncate font-display text-sm font-semibold text-ink">
                                    {nearest.location.name}
                                </div>
                                <div className="mt-0.5 truncate text-xs text-faint">
                                    {subtitleFor(nearest.location)}
                                </div>
                            </div>
                        </div>
                        <a
                            href={directionsUrl(nearest.location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="
                                relative mt-3 flex w-full items-center justify-center
                                gap-1.5 rounded-lg border border-brand/20
                                bg-surface/80 py-2 text-xs font-semibold text-brand
                                transition-all duration-200 hover:border-brand/40 hover:bg-brand-soft
                            "
                        >
                            <RiArrowRightLine className="h-3.5 w-3.5" />
                            {t("mapGetDirections")}
                        </a>
                    </div>
                )}

                <div className="relative">
                    <RiSearchLine className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={t("mapSearchPlaceholder")}
                        className="
                            w-full rounded-xl border border-line bg-surface py-2.5
                            pl-10 pr-10 text-sm text-ink outline-none
                            transition-all duration-200
                            focus:border-brand/40 focus:shadow-[0_0_0_3px_rgba(var(--brand-rgb),0.08)]
                        "
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-subtle transition-colors hover:bg-line hover:text-muted"
                            aria-label={t("mapClearFilters")}
                        >
                            <RiCloseLine className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
                    {(
                        [
                            { key: "all", label: t("mapFilterAll"), icon: RiAppsLine },
                            { key: "main", label: t("mapFilterMain"), icon: RiMapPin2Line },
                            { key: "shops", label: t("mapFilterShops"), icon: RiStore2Line },
                        ] as const
                    ).map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveFilter(tab.key)}
                            className={`
                                flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2
                                text-xs font-semibold transition-all duration-200
                                ${activeFilter === tab.key
                                    ? "bg-surface text-brand shadow-sm"
                                    : "text-faint hover:text-ink"}
                            `}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-medium text-faint">
                        {filteredLocations.length === allLocations.length
                            ? `${allLocations.length} ${t("mapLocations")}`
                            : `${filteredLocations.length} of ${allLocations.length} ${t("mapLocations")}`}
                    </span>
                    {(searchQuery || activeFilter !== "all") && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setActiveFilter("all");
                            }}
                            className="text-xs font-semibold text-brand transition-colors hover:text-brand-dark"
                        >
                            {t("mapClearFilters")}
                        </button>
                    )}
                </div>

                <div className="location-list flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[420px]">
                    {filteredLocations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
                            <div className="text-sm font-semibold text-ink">
                                {t("mapNoResults")}
                            </div>
                            <div className="mt-1 text-xs text-faint">
                                {t("mapTryAdjust")}
                            </div>
                        </div>
                    ) : (
                        filteredLocations.map((loc) => {
                            const isMain = loc.id === mainLaundry.id;
                            const isSelected = selected.id === loc.id;

                            return (
                                <div
                                    key={loc.id}
                                    className={`
                                        flex items-center gap-3 rounded-xl border px-4 py-3
                                        transition-all duration-200
                                        ${isSelected
                                            ? "border-brand/50 bg-brand-soft shadow-sm"
                                            : "border-line bg-surface hover:border-brand/30"}
                                    `}
                                >
                                    <button
                                        type="button"
                                        onClick={() => selectLocation(loc)}
                                        aria-pressed={isSelected}
                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                    >
                                        <div
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                                                isMain
                                                    ? "bg-brand text-on-dark"
                                                    : "bg-brand/10 text-brand"
                                            }`}
                                        >
                                            {isMain ? (
                                                <RiMapPin2Line className="h-5 w-5" />
                                            ) : (
                                                <RiStore2Line className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-ink">
                                                {loc.name}
                                            </div>
                                            <div className="truncate text-xs text-faint">
                                                {subtitleFor(loc)}
                                            </div>
                                        </div>
                                    </button>
                                    <a
                                        href={directionsUrl(loc)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="shrink-0 rounded-lg border border-brand/20 bg-surface p-2 text-brand transition-all duration-200 hover:border-brand/40 hover:bg-brand-soft"
                                        title={t("mapGetDirections")}
                                        aria-label={`${t("mapGetDirections")} — ${loc.name}`}
                                    >
                                        <RiArrowRightLine className="h-4 w-4" />
                                    </a>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Free embedded map — Google by default, OpenStreetMap fallback */}
            <div className="relative min-h-[420px] flex-1 overflow-hidden bg-surface-muted lg:min-h-[520px] lg:rounded-r-3xl">
                <iframe
                    key={`${source}-${selected.id}`}
                    title={`${selected.name} — ${t("mapTitle")}`}
                    src={embedUrl(selected, source, lang)}
                    className="h-full min-h-[420px] w-full border-0 lg:min-h-[520px]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allow="geolocation; fullscreen"
                />

                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-surface/90 to-transparent"
                />

                <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-center justify-between gap-2">
                    <div className="pointer-events-auto flex items-center rounded-full border border-line bg-surface/95 p-1 shadow-sm backdrop-blur">
                        <button
                            type="button"
                            onClick={() => setSource("google")}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
                                source === "google"
                                    ? "bg-brand text-on-dark shadow-sm"
                                    : "text-faint hover:text-ink"
                            }`}
                        >
                            <RiMapPinLine className="h-3.5 w-3.5" />
                            {t("mapSourceGoogle")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSource("osm")}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
                                source === "osm"
                                    ? "bg-brand text-on-dark shadow-sm"
                                    : "text-faint hover:text-ink"
                            }`}
                        >
                            <RiGlobalLine className="h-3.5 w-3.5" />
                            {t("mapSourceOSM")}
                        </button>
                    </div>

                    <a
                        href={fullMapUrl(selected, source)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[11px] font-bold text-ink shadow-sm backdrop-blur transition-colors hover:border-brand/30 hover:text-brand"
                    >
                        <RiExternalLinkLine className="h-3.5 w-3.5" />
                        {t("mapOpenFull")}
                    </a>
                </div>

                <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20">
                    <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-[0_8px_28px_rgba(var(--shadow-rgb),0.12)] backdrop-blur">
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-brand">
                                {t("mapSelected")}
                            </div>
                            <div className="truncate text-sm font-semibold text-ink">
                                {selected.name}
                            </div>
                            <div className="truncate text-xs text-faint">
                                {subtitleFor(selected)}
                            </div>
                        </div>
                        <a
                            href={directionsUrl(selected)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-on-dark transition-colors hover:bg-brand-dark"
                        >
                            {t("mapGetDirections")}
                            <RiArrowRightLine className="h-3.5 w-3.5" />
                        </a>
                    </div>
                    <p className="mt-2 text-center text-[10px] text-faint">
                        {t("mapFallbackHint")}
                    </p>
                </div>
            </div>
        </>
    );
};

const LocationMap = () => {
    const { t } = useLanguage();
    const sectionRef = useReveal<HTMLDivElement>({ y: 20 });

    return (
        <section
            id="locations"
            className="relative overflow-hidden bg-surface-dark px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_0%_0%,rgba(var(--brand-rgb),0.16),transparent_60%)]"
            />
            <div ref={sectionRef} className="relative mx-auto w-full max-w-[1440px]">
                <div data-reveal className="mb-10 sm:mb-14">
                    <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-brand sm:text-xs">
                        <RiMapPinLine className="h-4 w-4" />
                        {t("mapBadge")}
                    </span>
                    <h2 className="font-display mt-3 text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-on-dark sm:text-4xl lg:text-5xl">
                        {t("mapTitle")}
                        <span className="text-brand"> {t("mapTitleHighlight")}</span>
                    </h2>
                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-on-dark/65 sm:text-base">
                        {t("mapDescription")}
                    </p>
                </div>

                <div
                    data-reveal
                    className="flex flex-col gap-5 overflow-hidden rounded-3xl border border-on-dark/10 bg-surface p-2 shadow-[0_16px_48px_rgba(var(--shadow-rgb),0.3)] sm:p-3 lg:flex-row"
                >
                    <MapContent />
                </div>
            </div>
        </section>
    );
};

export default LocationMap;
