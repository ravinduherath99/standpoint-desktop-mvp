# UI/UX Pro Max — Design Research Rules for StandPoint

These rules govern every visual, interaction and accessibility change to the
StandPoint Desktop MVP frontend.

---

## 1. Read the toolkit before touching UI

Before making **any** visual or layout change, read
`design-tools/ui-ux-pro-max/SKILL.md` in full.  It documents searchable
domains, the priority table, and the search workflow.

## 2. Research before implementing

Use the local search engine to inform design decisions:

```bash
python3 design-tools/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
```

Always research **typography**, **colours**, **layout** and **interaction
patterns** from the toolkit before implementing or changing them.  Prefer the
toolkit's database over personal preference.

## 3. Follow the documented checklist

`design-tools/ui-ux-pro-max/references/pro-rules.md` exists and contains the
canonical **Pre-Delivery Checklist**.  Run through it before any UI delivery.
If the checklist file is relocated in a future toolkit update, report the new
location instead of assuming it disappeared.

`design-tools/ui-ux-pro-max/references/quick-reference.md` holds the full
119-guideline reference across all 10 priority categories.  Consult it during
review/audit passes.

## 4. Inspect actual dependencies — never assume

The StandPoint frontend uses the following verified packages (from
`frontend/package.json`):

| Package | Installed version |
|---------|-------------------|
| react | ^19.2.8 |
| react-dom | ^19.2.8 |
| tailwindcss | ^4.3.3 |
| @tailwindcss/vite | ^4.3.3 |
| vite | ^8.3.0 |
| framer-motion | ^13.4.1 |
| lucide-react | ^1.47.0 |
| react-router-dom | ^6.30.6 |
| vitest | ^5.0.1 |
| @testing-library/react | ^16.3.3 |

Always read `frontend/package.json` before assuming a framework version.
Do **not** assume React 18, Tailwind v3, Next.js, or any package that is not
listed.

## 5. Keep shared design tokens in styles.css

All shared design values (colour palette, typography scale, spacing, radii,
shadows, surface tokens) live in `frontend/src/styles.css`.

- Add new tokens under the existing `:root` section.
- Never hard-code hex colours, font stacks, or spacing values inside component
  files — use CSS custom properties.
- When the toolkit suggests Outfit / Work Sans or a specific palette, update
  the tokens in styles.css so every component inherits the change.

## 6. Preserve accessibility

- Maintain **accessible labels** (`aria-label`, `aria-labelledby`, `sr-only`
  text) on all interactive elements.
- Preserve **ARIA roles** and live-region announcements already in place.
- Keep visible **keyboard focus** indicators (`:focus-visible` outline).
- Respect **`prefers-reduced-motion`** — existing media queries that disable
  animation must not be removed.
- Target **≥ 4.5 : 1** contrast ratio for normal text against its background.
- Target **≥ 44 px × 44 px** minimum interactive target size (buttons, chips,
  inputs, clickable areas).
- If the toolkit's font or colour suggestion would break a contrast ratio,
  choose the accessible alternative and note the conflict.

## 7. Preserve existing functional fixes

The following behaviours have been deliberately implemented and tested.
Do **not** regress them:

- **Authentication flow** — Login → token storage → protected routes.
- **Plan saving** — `savePlan()` API call and server reference generation.
- **Confirmation screen** — Retrieves and displays the saved reference.
- **StrictMode compatibility** — All effects and callbacks must survive
  React 19 `<StrictMode>` double-invoke.

## 8. Run tests and build after every implementation stage

```bash
cd frontend && npm test && npm run build
```

All existing tests must pass.  The production build must complete without
errors before considering an implementation stage done.

## 9. Never remove or weaken tests

Do **not** delete, skip, or downgrade test assertions to hide defects.
If a test fails after a design change, fix the implementation — not the test.

---

### Quick-reference: search commands for StandPoint domains

| Task | Example command |
|------|----------------|
| Photography planner typography | `python3 design-tools/ui-ux-pro-max/scripts/search.py "photography planner" --domain typography -n 2` |
| Photography colour palette | `python3 design-tools/ui-ux-pro-max/scripts/search.py "photography travel outdoor modern" --domain color` |
| Login form UX patterns | `python3 design-tools/ui-ux-pro-max/scripts/search.py "login form password error" --domain ux -n 4` |
| Button interaction guidelines | `python3 design-tools/ui-ux-pro-max/scripts/search.py "button hover focus disabled" --domain ux` |
| Responsive layout rules | `python3 design-tools/ui-ux-pro-max/scripts/search.py "mobile layout responsive" --domain ux` |
| Icon selection | `python3 design-tools/ui-ux-pro-max/scripts/search.py "camera photography planner" --domain icons` |
| Full design system | `python3 design-tools/ui-ux-pro-max/scripts/search.py "photography shoot planner" --design-system` |
