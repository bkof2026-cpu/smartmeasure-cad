# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Backend (Auth, Roles & KPI Dashboard)

This app also has a real backend now, deployed as Vercel serverless Functions alongside the static Vite frontend (not a Next.js app):

- `api/` - one file per endpoint (`api/auth/employee-login.ts` → `/api/auth/employee-login`, etc.), plus `api/_lib/` shared helpers (`db.ts` Neon client, `auth.ts` session/rate-limit helpers, `requireAdmin.ts` manager/ceo guard, `respond.ts`, `dateRange.ts`)
- `db/schema.sql` - Postgres schema (users/drawings/sessions/login_attempts) — run via `npm run migrate`
- `scripts/` - owner-run CLI: `npm run add-employee -- --id=E101 --name="..."`, `npm run remove-employee -- --id=E101`, `npm run migrate`
- `src/auth/authClient.ts` - the only module that calls `/api/auth/*`, `/api/drawings`, `/api/profile/my-stats` from the frontend
- `src/screens/Dashboard.tsx` - Manager/CEO KPI dashboard (Recharts)

Requires a `DATABASE_URL` env var (Neon Postgres connection string) — set in Vercel project settings for production, and in `.env.local` for local `npm run migrate`/`add-employee`/`remove-employee`.

## PWA (installable on Android/iOS)

Configured via `vite-plugin-pwa` in `vite.config.ts` — generates `manifest.webmanifest` and a Workbox service worker (`sw.js`) at build time; nothing to run manually. Static app shell (JS/CSS/HTML/icons) is precached; every `/api/*` request is always `NetworkFirst` (8s timeout, 5-minute fallback cache only if the network genuinely fails) so dashboard/drawing data is never served stale.

- `public/icons/` - `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`. **These are placeholder icons** (a simple drafting-triangle glyph matching the login screen's 📐 branding, generated programmatically) — swap for real branded artwork before a real launch.
- `index.html` - the extra PWA `<meta>`/`<link>` tags live outside the `<!-- figma:head-start/end -->` comment slots (so the Figma site-config plugin's injection never disturbs them); the manifest `<link>` and service-worker registration `<script>` are auto-injected by `vite-plugin-pwa` at build time, not present in source.
- Manifest/SW only activate on a production build (`npm run build` + `vite preview`, or the real Vercel deployment) — `npm run dev`'s plain dev server intentionally has no manifest link, so don't expect install prompts there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.
