# Rules Please! design system

This document is the visual contract for the Rules Please! interface. The source of truth is [`design-system.css`](./design-system.css); application markup and behavior remain in [`index.html`](./index.html).

## Design direction

The interface uses a refined, minimal visual language inspired by native iOS utility screens: white surfaces, near-black text and actions, quiet gray separators, and green reserved for positive or active states. Generous whitespace and restrained elevation keep long rules conversations easy to scan.

## Foundations

### Color

| Token | Purpose |
| --- | --- |
| `--color-background` | App and page background |
| `--color-sidebar` | Desktop navigation rail |
| `--color-surface` | Cards, sheets and controls |
| `--color-surface-subtle` | Hover, input and secondary backgrounds |
| `--color-surface-strong` | Selected and stronger neutral states |
| `--color-text` | Primary copy and black actions |
| `--color-text-muted` | Secondary copy and values |
| `--color-text-faint` | Tertiary labels and chevrons |
| `--color-border` | Dividers and card outlines |
| `--color-accent-positive` | Ready, enabled and successful states |
| `--color-danger` | Destructive actions and review states |
| `--color-warning` | Work-in-progress states |

Use semantic tokens instead of literal colors in component rules. The short aliases such as `--bg`, `--surface`, and `--accent-2` are retained for compatibility with existing components.

### Typography

- Family: `--font-sans`, using San Francisco on Apple platforms and Segoe UI as fallback.
- Scale: `--text-xs`, `--text-sm`, `--text-md`, `--text-lg`, and `--text-display`.
- Weights: `--weight-regular`, `--weight-medium`, and `--weight-semibold`.
- Body text should use `--line-body`; compact interface labels use `--line-compact`.

### Spacing and shape

- Spacing follows a four-pixel rhythm from `--space-1` through `--space-8`.
- Standard radii are `--radius-sm`, `--radius-md`, and `--radius-lg`.
- Use `--radius-pill` only for chips, circular controls, switches, and pill buttons.
- Standard interactive controls have a minimum height of `--control-height`.
- Content widths are centralized in `--content-width`, `--composer-width`, `--settings-width`, and `--app-width`.

## Reusable classes

### Layout

| Class | Role |
| --- | --- |
| `.shell` | Desktop rail and main viewport grid |
| `.viewport` / `.phone` / `.screen` | Main application frame and screen rows |
| `.top` / `.content` / `.footer` | Standard screen regions |
| `.stack` | Reusable vertical grid rhythm |
| `.scroll` | Contained scrolling region |

### Actions and status

| Class | Role |
| --- | --- |
| `.primary` | Highest-priority action |
| `.secondary` | Neutral text or surface action |
| `.danger-btn` | Destructive action |
| `.icon-btn` | Square icon-only action; always provide `aria-label` |
| `.chip` | Compact metadata or status label |
| `.status-dot` | Small status indicator used with visible text |

### Product components

- `.conversation`: chat list item.
- `.game-thumbnail`: cached board-game cover with an initials fallback; use `.game-thumbnail--result` or `.game-thumbnail--detail` where a larger cover is needed.
- `.search`: search-field container.
- `.tile`: quick-start action card.
- `.result`: board-game search result.
- `.messages`, `.bubble`, `.composer`: conversation surface.
- `.setup-panel`, `.setting-row`: rulebook setup and detail controls.
- `.source-card`, `.sheet`, `.scrim`: citations and source details.
- `.settings-page`, `.account-card`, `.settings-list`, `.settings-item`, `.settings-value`: settings hierarchy.
- `.switch`: binary state indicator; add `.on` for enabled state and expose the state accessibly in markup.

## Component states

- Selected or active: `.active`.
- Indexed and ready: `.ready`.
- Processing: `.working`.
- Needs attention: `.review`.
- Enabled switch: `.switch.on`.
- Disabled native actions use the `disabled` attribute; visual opacity is handled centrally.

Do not communicate state by color alone. Pair status colors with text, an accessible label, or a native control state.

## Responsive contract

- Up to `520px`: compact mobile spacing and single-column result layouts.
- Up to `900px`: hide the desktop rail, use the full viewport, and show mobile navigation where applicable.
- Above `900px`: show the rail and constrain the application and content to their tokenized maximum widths.
- Settings must always use `width: 100%` with `--settings-width` as its maximum. Removing the explicit width causes CSS Grid to shrink the page to its text content.

Validate changes at 390×844, 820×1180, 1366×768, and 1440×900 with no horizontal overflow.

## Contribution rules

1. Add or change a token before repeating a new visual value across components.
2. Reuse an existing component class before introducing a near-duplicate.
3. Keep application-specific layout in a product component, not in a primitive such as `.primary`.
4. Preserve visible keyboard focus, semantic HTML, minimum touch targets, and readable contrast.
5. Update this document whenever a public token, reusable class, state, or breakpoint changes.
