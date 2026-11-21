import { motion } from "framer-motion";
import {
    useId,
    useMemo,
    type CSSProperties,
} from "react";

interface WaterBlobProps {
    size?: number | string;
    color?: string;
    opacity?: number;
    blur?: number;
    duration?: number;
    delay?: number;
    giggle?: number;
    borderRadius?: string;
    className?: string;
    style?: CSSProperties;
    position?: "absolute" | "fixed" | "relative";
}

const WaterBlob = ({
    size = 300,
    color = "var(--color-brand)",
    opacity = 0.15,
    blur = 0,
    duration = 7,
    delay = 0,
    giggle = 12,
    className = "",
    style,
    position = "absolute",
}: WaterBlobProps) => {
    const rawId = useId();

    // useId can contain characters that aren't ideal inside SVG URLs.
    const id = useMemo(
        () => rawId.replace(/[^a-zA-Z0-9_-]/g, ""),
        [rawId]
    );

    const filterId = `water-filter-${id}`;
    const gradientId = `water-gradient-${id}`;
    const highlightId = `water-highlight-${id}`;
    const glowId = `water-glow-${id}`;
    const clipId = `water-clip-${id}`;

    return (
        <div
            aria-hidden="true"
            className={`pointer-events-none ${position} ${className}`}
            style={{
                width: size,
                height: size,
                opacity,
                filter: blur ? `blur(${blur}px)` : undefined,
                ...style,
            }}
        >
            <motion.svg
                width="100%"
                height="100%"
                viewBox="0 0 400 400"
                xmlns="http://www.w3.org/2000/svg"
                initial={{
                    x: 0,
                    y: 0,
                    rotate: 0,
                    scale: 1,
                }}
                animate={{
                    x: [0, giggle, -giggle * 0.7, giggle * 0.4, 0],
                    y: [0, -giggle * 0.7, giggle, -giggle * 0.4, 0],
                    rotate: [0, 1.5, -1.5, 1, 0],
                    scale: [1, 1.025, 0.985, 1.015, 1],
                }}
                transition={{
                    duration,
                    delay,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                style={{
                    overflow: "visible",
                }}
            >
                <defs>
                    {/* =====================================================
                        WATER GRADIENT
                    ====================================================== */}
                    <radialGradient
                        id={gradientId}
                        cx="32%"
                        cy="25%"
                        r="78%"
                    >
                        <stop
                            offset="0%"
                            stopColor="var(--color-surface)"
                            stopOpacity="0.42"
                        />

                        <stop
                            offset="16%"
                            stopColor={color}
                            stopOpacity="0.42"
                        />

                        <stop
                            offset="48%"
                            stopColor={color}
                            stopOpacity="0.22"
                        />

                        <stop
                            offset="78%"
                            stopColor={color}
                            stopOpacity="0.13"
                        />

                        <stop
                            offset="100%"
                            stopColor={color}
                            stopOpacity="0.04"
                        />
                    </radialGradient>

                    {/* =====================================================
                        SPECULAR HIGHLIGHT
                    ====================================================== */}
                    <linearGradient
                        id={highlightId}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stopColor="var(--color-surface)"
                            stopOpacity="0.65"
                        />

                        <stop
                            offset="35%"
                            stopColor="var(--color-surface)"
                            stopOpacity="0.18"
                        />

                        <stop
                            offset="65%"
                            stopColor="var(--color-surface)"
                            stopOpacity="0"
                        />

                        <stop
                            offset="100%"
                            stopColor="var(--color-surface)"
                            stopOpacity="0"
                        />
                    </linearGradient>

                    {/* =====================================================
                        SOFT OUTER GLOW
                    ====================================================== */}
                    <filter
                        id={glowId}
                        x="-40%"
                        y="-40%"
                        width="180%"
                        height="180%"
                    >
                        <feGaussianBlur
                            stdDeviation="10"
                        />
                    </filter>

                    {/* =====================================================
                        WATER DISTORTION

                        feTurbulence creates procedural noise.

                        feDisplacementMap uses that noise to distort
                        the source shape.

                        This is the part that makes the surface feel
                        fluid rather than like a CSS blob.
                    ====================================================== */}
                    <filter
                        id={filterId}
                        x="-25%"
                        y="-25%"
                        width="150%"
                        height="150%"
                        colorInterpolationFilters="sRGB"
                    >
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.012 0.025"
                            numOctaves="3"
                            seed="8"
                            result="noise"
                        >
                            <animate
                                attributeName="baseFrequency"
                                dur={`${duration * 1.8}s`}
                                values="
                                    0.012 0.025;
                                    0.018 0.020;
                                    0.009 0.030;
                                    0.014 0.022;
                                    0.012 0.025
                                "
                                repeatCount="indefinite"
                            />
                        </feTurbulence>

                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="noise"
                            scale="14"
                            xChannelSelector="R"
                            yChannelSelector="G"
                        />
                    </filter>

                    {/* =====================================================
                        CLIP
                    ====================================================== */}
                    <clipPath id={clipId}>
                        <path
                            d="
                                M 205 28

                                C 258 24
                                  315 43
                                  350 86

                                C 382 125
                                  381 179
                                  362 223

                                C 343 268
                                  314 318
                                  267 348

                                C 221 378
                                  165 375
                                  119 350

                                C 75 327
                                  39 291
                                  29 242

                                C 19 192
                                  31 139
                                  63 96

                                C 94 55
                                  146 31
                                  205 28

                                Z
                            "
                        />
                    </clipPath>
                </defs>

                {/* =========================================================
                    SOFT BACK GLOW

                    This creates a very subtle halo around the water.
                ========================================================== */}
                <ellipse
                    cx="205"
                    cy="225"
                    rx="150"
                    ry="125"
                    fill={color}
                    opacity="0.08"
                    filter={`url(#${glowId})`}
                />

                {/* =========================================================
                    MAIN WATER BODY
                ========================================================== */}
                <motion.path
                    d="
                        M 205 28

                        C 258 24
                          315 43
                          350 86

                        C 382 125
                          381 179
                          362 223

                        C 343 268
                          314 318
                          267 348

                        C 221 378
                          165 375
                          119 350

                        C 75 327
                          39 291
                          29 242

                        C 19 192
                          31 139
                          63 96

                        C 94 55
                          146 31
                          205 28

                        Z
                    "
                    fill={`url(#${gradientId})`}
                    filter={`url(#${filterId})`}
                    animate={{
                        d: [
                            `
                                M 205 28
                                C 258 24 315 43 350 86
                                C 382 125 381 179 362 223
                                C 343 268 314 318 267 348
                                C 221 378 165 375 119 350
                                C 75 327 39 291 29 242
                                C 19 192 31 139 63 96
                                C 94 55 146 31 205 28 Z
                            `,
                            `
                                M 214 31
                                C 269 20 321 49 351 91
                                C 380 132 374 184 357 227
                                C 339 273 301 315 259 345
                                C 213 376 161 368 116 345
                                C 72 323 42 284 34 239
                                C 25 190 40 140 72 97
                                C 106 54 155 37 214 31 Z
                            `,
                            `
                                M 198 30
                                C 249 22 309 38 347 83
                                C 382 124 383 176 361 224
                                C 340 272 313 321 263 351
                                C 218 378 163 373 115 347
                                C 71 323 37 290 31 240
                                C 24 190 34 139 68 94
                                C 101 51 146 34 198 30 Z
                            `,
                            `
                                M 205 28
                                C 258 24 315 43 350 86
                                C 382 125 381 179 362 223
                                C 343 268 314 318 267 348
                                C 221 378 165 375 119 350
                                C 75 327 39 291 29 242
                                C 19 192 31 139 63 96
                                C 94 55 146 31 205 28 Z
                            `,
                        ],
                    }}
                    transition={{
                        duration: duration * 1.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* =========================================================
                    INTERNAL LIQUID LIGHT
                ========================================================== */}
                <g clipPath={`url(#${clipId})`}>
                    {/* Large soft internal reflection */}
                    <motion.ellipse
                        cx="130"
                        cy="105"
                        rx="105"
                        ry="48"
                        fill={`url(#${highlightId})`}
                        opacity="0.28"
                        initial={{
                            rotate: -25,
                            x: -20,
                            y: -10,
                        }}
                        animate={{
                            rotate: [-25, -15, -30, -20, -25],
                            x: [-20, 25, -5, 15, -20],
                            y: [-10, 5, -15, 8, -10],
                        }}
                        transition={{
                            duration: duration * 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />

                    {/* Secondary soft reflection */}
                    <motion.ellipse
                        cx="275"
                        cy="280"
                        rx="115"
                        ry="38"
                        fill="var(--color-surface)"
                        opacity="0.045"
                        animate={{
                            x: [-15, 15, -5, -15],
                            y: [8, -8, 5, 8],
                            rotate: [15, 8, 18, 15],
                        }}
                        transition={{
                            duration: duration * 1.8,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />

                    {/* Thin liquid streak */}
                    <motion.path
                        d="
                            M 70 145
                            C 125 120 183 125 225 148
                            C 270 173 318 167 355 143
                        "
                        fill="none"
                        stroke="var(--color-surface)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        opacity="0.16"
                        animate={{
                            pathLength: [0.65, 1, 0.7],
                            opacity: [0.08, 0.22, 0.08],
                            x: [-10, 12, -10],
                        }}
                        transition={{
                            duration: duration * 1.2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />

                    {/* Tiny secondary highlight */}
                    <motion.ellipse
                        cx="105"
                        cy="215"
                        rx="30"
                        ry="10"
                        fill="var(--color-surface)"
                        opacity="0.12"
                        animate={{
                            x: [0, 20, -5, 0],
                            scaleX: [1, 1.2, 0.85, 1],
                        }}
                        transition={{
                            duration: duration * 0.9,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                </g>

                {/* =========================================================
                    GLASS-LIKE EDGE

                    Very subtle. This prevents it looking like a flat
                    colored SVG shape.
                ========================================================== */}
                <motion.path
                    d="
                        M 205 28
                        C 258 24 315 43 350 86
                        C 382 125 381 179 362 223
                        C 343 268 314 318 267 348
                        C 221 378 165 375 119 350
                        C 75 327 39 291 29 242
                        C 19 192 31 139 63 96
                        C 94 55 146 31 205 28
                        Z
                    "
                    fill="none"
                    stroke="var(--color-surface)"
                    strokeWidth="1.5"
                    opacity="0.13"
                    filter={`url(#${filterId})`}
                />

                {/* =========================================================
                    MOVING SPECULAR DOT
                ========================================================== */}
                <motion.ellipse
                    cx="120"
                    cy="92"
                    rx="18"
                    ry="7"
                    fill="var(--color-surface)"
                    opacity="0.28"
                    animate={{
                        x: [0, 35, 60, 25, 0],
                        y: [0, -8, 12, 4, 0],
                        scale: [1, 1.15, 0.7, 1.1, 1],
                        opacity: [0.18, 0.3, 0.1, 0.24, 0.18],
                    }}
                    transition={{
                        duration: duration * 1.1,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </motion.svg>
        </div>
    );
};

export default WaterBlob;