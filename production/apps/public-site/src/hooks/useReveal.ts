import { useLayoutEffect, useRef } from "react";

interface RevealOptions {
    y?: number;
    x?: number;
    scale?: number;
    duration?: number;
    delay?: number;
    stagger?: number;
    start?: string;
    once?: boolean;
    ease?: string;
}

/**
 * Scroll-triggered reveal animation.
 *
 * Elements carrying `data-reveal` inside the returned ref are animated with a
 * short, staggered fade/slide. The animation is CSS-driven (via the `.reveal`
 * / `.reveal-visible` classes in index.css), so it is cheap, cancels cleanly in
 * React StrictMode and never leaves content invisible if an observer is lost.
 */
export const useReveal = <T extends HTMLElement>(options: RevealOptions = {}) => {
    const {
        y = 24,
        x = 0,
        scale = 0.985,
        duration = 0.55,
        delay = 0,
        stagger = 0.07,
        once = true,
    } = options;

    const ref = useRef<T>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce || !("IntersectionObserver" in window)) return;

        const isSelf =
            el.hasAttribute("data-reveal") && el.getAttribute("data-reveal") !== "";

        const targets = isSelf
            ? [el]
            : Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));

        if (!targets.length) return;

        const cleanupTarget = (target: HTMLElement) => {
            target.classList.remove("reveal", "reveal-visible");
            target.style.removeProperty("--reveal-x");
            target.style.removeProperty("--reveal-y");
            target.style.removeProperty("--reveal-scale");
            target.style.removeProperty("--reveal-duration");
            target.style.removeProperty("--reveal-delay");
        };

        targets.forEach((target, index) => {
            target.style.setProperty("--reveal-x", `${x}px`);
            target.style.setProperty("--reveal-y", `${y}px`);
            target.style.setProperty("--reveal-scale", String(scale));
            target.style.setProperty("--reveal-duration", `${duration}s`);
            target.style.setProperty("--reveal-delay", `${delay + index * stagger}s`);
            target.classList.add("reveal");
        });

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const target = entry.target as HTMLElement;
                    if (entry.isIntersecting) {
                        target.classList.add("reveal-visible");
                        if (once) observer.unobserve(target);
                    } else if (!once) {
                        target.classList.remove("reveal-visible");
                    }
                });
            },
            { threshold: 0.06, rootMargin: "0px 0px -6% 0px" }
        );

        targets.forEach((target) => {
            // Once the animation is done, drop the helper classes so hover
            // transforms and layout are completely owned by the component.
            target.addEventListener(
                "transitionend",
                (event) => {
                    if (event.propertyName === "opacity") cleanupTarget(target);
                },
                { once: true }
            );
            observer.observe(target);
        });

        return () => {
            observer.disconnect();
            targets.forEach(cleanupTarget);
        };
    }, [x, y, scale, duration, delay, stagger, once]);

    return ref;
};
