# Tabularis design tokens

Tabularis is themed end to end: the twelve built-in themes and every theme package
(light, dark, high contrast, square-cornered, retro font stacks) restyle the whole
application from one declarative JSON file. That only works if the UI never paints a
color, radius or font of its own. This document is the contract between the theme
engine and the components. `node scripts/check-theme-tokens.mjs` (part of `pnpm lint`)
enforces the parts that can be checked mechanically.

## How a theme reaches the UI

1. A theme definition (`src/schemas/theme-definition-v1.json`) declares `colors`,
   `typography.fontFamily`, `layout.borderRadius` and the Monaco `editor` colors.
2. `applyThemeToCSS` (`src/themes/themeUtils.ts`) writes every token to a CSS variable
   on `<html>` and sets `color-scheme`, then caches the base colors so the next startup
   paints them before React mounts (`src/utils/themeBoot.ts`, read by `index.html`).
3. `src/index.css` exposes the variables to Tailwind in `@theme`, derives the status
   variables from the accents, and aliases Tailwind's radius steps to the theme radii.
4. Components use only the utilities below. Monaco receives its own theme through
   `generateMonacoTheme`; ReactFlow and Recharts read `currentTheme.colors` from
   `useTheme()` because SVG attributes cannot resolve CSS variables reliably.

## Tokens and their utilities

| Intent | Theme token | CSS variable | Tailwind utilities |
| --- | --- | --- | --- |
| Window background | `bg.base` | `--bg-base` | `bg-base` |
| Raised panel, modal body | `bg.elevated` | `--bg-elevated` | `bg-elevated` |
| Popover, dropdown | `bg.overlay` | `--bg-overlay` | `bg-overlay` |
| Input field | `bg.input` | `--bg-input` | `bg-input` |
| Tooltip | `bg.tooltip` | `--bg-tooltip` | `bg-tooltip` |
| Card, list row | `surface.primary` | `--surface-primary` | `bg-surface-primary` |
| Secondary surface, chip | `surface.secondary` | `--surface-secondary` | `bg-surface-secondary` |
| Tertiary surface, disabled track | `surface.tertiary` | `--surface-tertiary` | `bg-surface-tertiary` |
| Hover | `surface.hover` | `--surface-hover` | `bg-surface-hover` |
| Selection | `surface.active` | `--surface-active` | `bg-surface-active` |
| Body text | `text.primary` | `--text-primary` | `text-primary` |
| Supporting text | `text.secondary` | `--text-secondary` | `text-secondary` |
| Hints, placeholders | `text.muted` | `--text-muted` | `text-muted`, `placeholder:text-muted` |
| Disabled text | `text.disabled` | `--text-disabled` | `text-disabled` |
| Text on an accent | `text.inverse` | `--text-inverse` | `text-inverse` |
| Primary action, links, focus | `accent.primary` | `--accent-primary` | `bg-accent-primary`, `text-accent-primary`, `border-accent-primary`, `ring-accent-primary`, `accent-accent-primary` |
| Tools, schema changes, themes | `accent.secondary` | `--accent-secondary` | `*-accent-secondary` |
| Success, connected, run | `accent.success` | `--accent-success` | `*-accent-success` |
| Warning, needs attention | `accent.warning` | `--accent-warning` | `*-accent-warning` |
| Error, danger, delete | `accent.error` | `--accent-error` | `*-accent-error` |
| Informational notice | `accent.info` | `--accent-info` | `*-accent-info` |
| Borders | `border.subtle/default/strong` | `--border-*` | `border-subtle`, `border-default`, `border-strong` |
| Focus ring | `border.focus` | `--border-focus` | `border-focus`, `focus-ring` |
| Data types in results | `semantic.string/number/boolean/date/null` | `--semantic-*` | `text-semantic-string` ... |
| Primary key, foreign key, index | `semantic.primaryKey/foreignKey/index` | `--semantic-pk/fk/index` | `text-semantic-pk`, `text-semantic-fk`, `text-semantic-index` |
| Modified, deleted, new rows | `semantic.modified/deleted/new` | `--semantic-*` | `bg-semantic-modified/20`, `text-semantic-deleted`, `border-semantic-new` |
| UI font | `typography.fontFamily.base` | `--font-base` | inherited from `body` |
| Code font | `typography.fontFamily.mono` | `--font-mono` | `font-mono` |
| Result grid font (user setting) | | `--font-result` | `font-result` |
| Corner radius | `layout.borderRadius.sm/base/lg/xl` | `--radius-*` | `rounded`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl` |

Every accent utility accepts Tailwind opacity: `bg-accent-error/10` is a tinted
background, `border-accent-error/30` a soft border, `hover:bg-accent-primary/90` the
hover state of a solid button. The status variables `--color-error*`,
`--color-success*`, `--color-warning*` and `--color-info*` (utilities `text-error-text`,
`bg-error-bg`, `border-error-border` and so on) are derived from the accents in
`index.css` and are equivalent to those tints.

## Recipes

| Element | Classes |
| --- | --- |
| Primary button | `bg-accent-primary hover:bg-accent-primary/90 text-inverse rounded-lg` |
| Danger button | `bg-accent-error hover:bg-accent-error/90 text-inverse rounded-lg` |
| Run / confirm button | `bg-accent-success hover:bg-accent-success/90 text-inverse` |
| Secondary button | `text-secondary hover:text-primary` |
| Soft (tinted) button | `bg-accent-primary/15 border border-accent-primary/25 text-accent-primary hover:bg-accent-primary/25` |
| Text input | `bg-base border border-strong rounded-lg text-primary placeholder:text-muted focus:border-accent-primary focus:outline-none` |
| Checkbox / radio | `accent-accent-primary` |
| Modal header icon tile | `bg-accent-primary/15 rounded-lg` with `text-accent-primary` icon |
| Error banner | `bg-accent-error/10 border border-accent-error/30 text-accent-error rounded-lg` |
| Warning banner | `bg-accent-warning/10 border border-accent-warning/30 text-accent-warning rounded-lg` |
| Status chip / badge | `toneStyle()` and `TONE_*` from `src/utils/tones.ts` |
| Modal overlay | `fixed inset-0 bg-black/50 backdrop-blur-sm` (neutral scrim, allowed) |
| Selected row | `bg-accent-primary/10 border-l-4 border-accent-primary` |
| Inserted / modified / deleted row | `semantic.new` / `semantic.modified` / `semantic.deleted` tokens |
| Active rail item | `bg-accent-primary text-inverse` |
| Glow behind an indicator | `shadow-[0_0_6px_var(--accent-primary)]` |
| Inline style needing alpha | `tint("var(--accent-primary)", 20)` from `src/utils/tones.ts` |

Meaning drives the token, not hue. Blue in a mock-up means `accent-primary`, red means
`accent-error`, green `accent-success`, amber `accent-warning`, purple `accent-secondary`.
Two states that must be told apart use two different tokens, never two shades of one.

## Rules

1. No Tailwind palette classes (`text-blue-400`, `bg-red-900/20`, `border-amber-500/30`,
   `ring-indigo-500`, `from-purple-500`, `accent-blue-500`, `placeholder-slate-500`).
2. No hex, `rgb()` or `hsl()` literals in TSX or TS. Read `currentTheme.colors` through
   `useTheme()` when a library needs a resolved color; use `var(--token)` or `tint()` in
   inline styles. Neutral black or white shadows are the only literal allowed.
3. `text-white` only on user-picked or brand colors (connection tiles, swatch check
   marks). Over an accent use `text-inverse`; for hover brightening use `hover:text-primary`.
4. `bg-black/50` scrims are fine; anything else black or white must be a token.
5. Radii come from the theme: `rounded*` utilities are already mapped, never write
   `rounded-[6px]` or `borderRadius: 6`. Use `theme.layout.borderRadius.*` in inline styles.
6. Fonts come from the theme or the user setting: `font-mono`, `font-result`, or
   `var(--font-base)`. Never hardcode a family in components.
7. Never force `color-scheme`; `applyThemeToCSS` sets it on `<html>` and native controls
   inherit it. Do not assume a dark background anywhere.
8. Diagrams and charts (ReactFlow, Recharts) take their colors from `currentTheme.colors`
   so they follow theme changes at runtime.
9. Exceptions are identities, not styling: brand marks, driver and paradigm colors,
   colors the user picked. They live in the `ALLOWLIST` of
   `scripts/check-theme-tokens.mjs` with a reason. Do not add UI files there.

## Checking your work

```sh
pnpm lint:theme            # token conformance, also part of pnpm lint
pnpm typecheck && pnpm test
```

Then open Settings, Appearance and switch between Tabularis Light, High Contrast and a
package with strong opinions (the Oddities themes ship square corners, a red background
and yellow accents). Everything you touched must recolor, keep its contrast and square
its corners with the theme.
