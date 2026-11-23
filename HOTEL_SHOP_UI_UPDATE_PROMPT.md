# Prompt: bring the Hotel and Shop apps up to the current UI version

Copy the block below into a coding agent that has access to the target folder/checkout.

---

You are updating the **Hotel** and **Shop** frontends so they match the current UI/theme version used by the rest of the LoveLaundry system. Work in the target folder I point you at; do not assume it is laid out exactly like the reference folder.

## Goal

Port the current-version UI and theme system into both apps, without losing any feature the target app already has.

## Source of truth (reference version)

In this checkout the newest UI/theme implementation lives in:

- `production/apps/hotel-app/` — Hotel Desk, current version
- `production/apps/shop-app/` — Shop Portal, current version

Key files that define the current version:

- `src/ll-theme.tsx` — single theme owner: 40 selectable themes (20 blue-free), `lovelaundry-theme` storage key, legacy `theme-preset` migration, pre-paint `THEME_INIT_SCRIPT`, accessible `ThemeSwitcher`
- `src/ll-design-tokens.css` — all semantic colour tokens per theme
- `src/index.css` — token-driven component styles
- `index.html` — inline pre-paint theme bootstrap script (its exact bytes are hashed in the CSP)
- `vercel.json` — hardened response headers with hash-based CSP

## Targets (the apps to update)

Depending on the checkout, the deployed apps are in one or more of:

- `system-manegment/hotel-app/` → GitHub `LoveLaundry/hotel-app` (`main`)
- `system-manegment/shop-app/` → GitHub `LoveLaundry/shop-app` (`main`)
- the standalone clones of those two repos

Live sites: `hotels-manager-amber.vercel.app`, `lovelaundry-shop-app.vercel.app`.
(`hotels-manager.vercel.app` is a different app named "HotelManager Pro" with no source in this checkout, and `shops-manager.vercel.app` currently returns `DEPLOYMENT_NOT_FOUND`. Do not treat either as a source of truth.)

## Important: the two codebases are NOT copies

The reference apps and the deployed apps have substantially different trees. The deployed apps contain features the reference apps do not (`src/features/`, `src/ui/`, `src/pages/AboutPage.tsx`, `tests/`, `public/`, `nginx/`, `Dockerfile`, `.env.production`, etc.). The reference apps contain theme files the deployed apps do not (`ll-theme.tsx`, `ll-design-tokens.css`, inline theme bootstrap).

**Do not bulk-copy or overwrite one tree with the other.** Merge deliberately:

1. Inventory both trees and list: files only in reference, files only in target, files in both that differ.
2. Bring across the theme system (`ll-theme.tsx`, `ll-design-tokens.css`) and wire it into the target's `src/main.tsx`, `src/App.tsx` and shell without removing target-specific routes or components.
3. Add the inline pre-paint theme bootstrap to the target `index.html`, preserving its existing `<title>` and meta tags.
4. Convert hardcoded colours in the target's styles to the semantic tokens so every theme works — especially text on coloured surfaces.
5. Keep the hardened `vercel.json` headers. If you change `index.html`, recompute the SHA-256 hashes of every inline `<script>` and update `script-src` in the CSP. Never add `unsafe-inline` to `script-src`.

## Hard constraints

- Preserve all existing routes, APIs, auth flows, permissions, business logic and WebSocket behaviour.
- No feature removal. No hardcoded credentials or API keys. No frontend-only security boundaries.
- Browser/mobile AI clients must use the signed-in JWT only; `LOVE_AI_API_KEYS` stays server-side.
- Keep the theme contract: storage key `lovelaundry-theme`, legacy `theme-preset` migration, 40 themes / 20 blue-free, light/dark mode.
- Do not install or upgrade dependencies unless explicitly approved.
- Never log passwords, access tokens or refresh tokens.

## Known bug to avoid (already fixed in quotations-ui)

An earlier theme change set the active sidebar item's background to the *same* colour as its text (`--sidebar-active-bg` == `--sidebar-active`), making the label invisible in every theme. When porting, the active surface must move **away** from the text colour. The fixed pattern is:

```css
--sidebar-active-bg: color-mix(in srgb, #000000 12%, var(--sidebar-bg));  /* light themes: white text */
--sidebar-active-bg: color-mix(in srgb, #FFFFFF 12%, var(--sidebar-bg));  /* dark themes: black text */
```

Add a regression test that asserts, for every theme, that the active nav text/background contrast is at least 4.5:1.

## Verification before finishing

- `npm test` and `npm run build` both pass in each updated app.
- A contrast check over all themes reports >= 4.5:1 for active nav text and other token-driven text on coloured surfaces.
- The deployed `vercel.json` includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` and a hash-based `Content-Security-Policy`; inline script hashes match the built `index.html` exactly.
- Commit, push to the correct `main` branch for each repo, then re-check the live URLs with `curl -sSI` for the new headers and asset hashes.
- Report any URL that is dead or serves an unrelated app as NOT VERIFIED rather than claiming success.
