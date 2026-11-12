# UI Theme

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.6a — UI Theme (supplements Frontend Architecture)  
**Version:** 1.0  
**Status:** Locked (12 November 2026)

## 1. Objective

Fix the visual language of the client — colours, greys, dark mode, typography and density — so every page is built from the same design tokens.

## 2. Decisions

| ID | Concern | Decision |
|---|---|---|
| UI-1 | Brand colour | **Indigo** `#4f46e5` (indigo-600) for primary buttons, links and focus rings; matches the email templates |
| UI-2 | Greys | **Slate** scale for backgrounds, borders and secondary text |
| UI-3 | Dark mode | **Light / dark / system** from the start; default follows the OS; toggle in every header |
| UI-4 | Typography | **Geist** (variable font, self-hosted via `@fontsource-variable/geist`) |
| UI-5 | Density | shadcn/ui **compact** defaults (32 px controls, `--radius: 0.625rem`) |
| UI-6 | Landing page | Public `/`: header, hero (Get started → `/register`, Log in → `/login`), product preview, three feature cards, footer |
| UI-7 | Style | **Minimal and flat.** Solid colours, thin borders, whitespace. **No neon colours, glows or gradients.** |

## 3. Tokens

Defined once in `client/src/index.css` as CSS variables (OKLCH, Tailwind scales); components use only the token classes (`bg-primary`, `text-muted-foreground`, `border`, …), never raw colours.

| Token | Light | Dark |
|---|---|---|
| `background` | white | slate-950 |
| `foreground` | slate-950 | slate-50 |
| `card` / `popover` | white | slate-900 |
| `primary` | indigo-600 (white text, 6.3:1) | indigo-400 (slate-950 text) |
| `muted` / `secondary` / `accent` | slate-100 | slate-800 |
| `muted-foreground` | slate-500 (4.8:1 on white) | slate-400 |
| `border` / `input` | slate-200 | white 10% / 15% |
| `ring` | indigo-600 | indigo-400 |
| `destructive` | red-600 | red-400 |

In dark mode the primary is indigo-400 with dark text because white on indigo-500 is 4.47:1, just below WCAG AA (NFR-USE-03).

Task status colours are decided with the Kanban board (Sprint 5), using the `chart-*` tokens.

## 4. Dark Mode Implementation

- `next-themes` adds the `dark` class to `<html>`; the choice is stored in `localStorage("theme")`.
- An inline script in `client/index.html` applies the class before the first paint, so there is no light flash.
- Because everything uses tokens, switching theme needs no component changes.

## 5. Rules for New UI

1. Use token classes only — no `bg-white`, `text-black`, `slate-*`/`gray-*`, hex values or `bg-gradient-*`.
2. No glow shadows, blur blobs or animated backgrounds; at most `shadow-sm` / `shadow-md` on overlays.
3. Check every new page in light and dark mode and at 390 px width.
