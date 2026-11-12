# UI Theme

**Project:** Nexora — Multi-Tenant Project Management SaaS  
**Phase:** 3 — System Design  
**Step:** 3.6a — UI Theme (supplements Frontend Architecture)  
**Version:** 1.1 (Pine Teal, 12 November 2026)  
**Status:** Locked

## 1. Objective

Fix the visual language of the client — colours, greys, dark mode, typography and density — so every page is built from the same design tokens.

## 2. Decisions

| ID | Concern | Decision |
|---|---|---|
| UI-1 | Brand colour | **Pine Teal** `#0f6b62` for primary buttons, links and focus rings; brand panel `#0d3b37`; email buttons match. (v1.0 used indigo `#4f46e5`; replaced as too bright and plain.) |
| UI-2 | Greys | **Green-grey** neutrals (page `#f6f8f7`, borders `#dbe4e1`, secondary text `#5b6c69`) |
| UI-3 | Dark mode | **Light / dark / system** from the start; default follows the OS; toggle in every header |
| UI-4 | Typography | **Geist** (variable font, self-hosted via `@fontsource-variable/geist`) |
| UI-5 | Density | shadcn/ui **compact** defaults (32 px controls, `--radius: 0.625rem`) |
| UI-6 | Landing page | Public `/`: header, hero (Get started → `/register`, Log in → `/login`), product preview, three feature cards, footer |
| UI-7 | Style | **Minimal and flat.** Solid colours, thin borders, whitespace. **No neon colours, glows, gradients or blur.** Focus rings are thin (2 px, 25 %). |
| UI-8 | Auth pages | Split layout: solid brand panel (headline + mini board) beside the form on wide screens, form only on phones. Inputs with leading icons (40 px), show / hide on every password field, live password rules on new-password fields. |

## 3. Tokens

Defined once in `client/src/index.css` as CSS variables; components use only the token classes (`bg-primary`, `text-muted-foreground`, `bg-brand`, …), never raw colours.

| Token | Light | Dark |
|---|---|---|
| `background` | `#f6f8f7` | `#0c1312` |
| `foreground` | `#122220` | `#e4eeec` |
| `card` / `popover` | `#ffffff` | `#111a19` / `#142120` |
| `primary` | `#0f6b62` (white text, 6.4:1) | `#5cbfb1` (dark text `#062420`) |
| `muted` / `secondary` / `accent` | `#eaf0ee` / `#e3ece9` | `#1b2827` / `#213130` |
| `muted-foreground` | `#5b6c69` (5.2:1 on white) | `#93a6a3` |
| `border` / `input` | `#dbe4e1` / `#d3dedb` | white 9 % / 14 % |
| `brand` / `brand-foreground` | `#0d3b37` / `#e7f5f2` | `#0e2a27` / `#d9f1ec` |
| `chart-1 … 5` | teal, blue (in progress), amber (review / pending), rose, grey | lighter variants |
| `destructive` | `#c2410c` | `#f2805a` |

In dark mode the primary is a lighter teal with dark text, keeping contrast above WCAG AA (NFR-USE-03). Blue is reserved for "in progress" so it never competes with the brand teal.

## 4. Dark Mode Implementation

- `next-themes` adds the `dark` class to `<html>`; the choice is stored in `localStorage("theme")`.
- An inline script in `client/index.html` applies the class before the first paint, so there is no light flash.
- Because everything uses tokens, switching theme needs no component changes.

## 5. Rules for New UI

1. Use token classes only — no `bg-white`, `text-black`, `slate-*`/`gray-*`, hex values or `bg-gradient-*`.
2. No glow shadows, blur blobs or animated backgrounds; at most `shadow-sm` / `shadow-md` on overlays.
3. Check every new page in light and dark mode and at 360 px width.
