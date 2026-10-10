import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("responsive planner CSS contracts", () => {
  it("defines the login hero, form and responsive layout contracts", () => {
    expect(css).toMatch(/\.login-split \{[^}]*grid-template-columns: minmax\(0, 1\.1fr\) minmax\(0, 1fr\);[^}]*min-height: 100vh;[^}]*min-height: 100dvh;[^}]*overflow-x: hidden/);
    expect(css).toMatch(/\.hero-shader-root \{[^}]*position: absolute;[^}]*inset: 0;[^}]*z-index: 0;[^}]*width: 100%;[^}]*height: 100%;[^}]*overflow: hidden;[^}]*pointer-events: none;[^}]*contain: layout style paint;[^}]*will-change: opacity/);
    expect(css).toMatch(/\.hero-shader-root canvas \{[^}]*display: block;[^}]*pointer-events: none/);
    expect(css).toMatch(/\.hero-shader-orb \{[^}]*opacity: 0\.8/);
    expect(css).toMatch(/\.login-hero::after \{[^}]*z-index: 2;[^}]*background: var\(--login-scrim\);[^}]*pointer-events: none/);
    expect(css).toMatch(/\.login-hero-img \{[^}]*z-index: 1;[^}]*width: 100%;[^}]*height: 100%;[^}]*object-fit: cover;[^}]*object-position: center 30%;[^}]*opacity: 0\.38;[^}]*mix-blend-mode: luminosity/);
    expect(css).toMatch(/\.login-hero-content \{[^}]*z-index: 3;[^}]*gap: var\(--s-10\);[^}]*padding: var\(--s-10\) clamp\(var\(--s-6\), 5vw, var\(--s-16\)\)/);
    expect(css).toMatch(/\.login-hero-copy \{[^}]*max-width: 34rem;[^}]*margin-top: auto/);
    expect(css).toMatch(/\.login-feature-list \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.login-form-side \{[^}]*display: grid;[^}]*place-items: center;[^}]*padding: var\(--s-12\) var\(--s-6\)/);
    expect(css).toMatch(/\.login-card \{[^}]*max-width: 400px/);
    expect(css).toMatch(/\.login-submit \{[^}]*min-height: 52px/);
    expect(css).toMatch(/\.login-toggle \{[^}]*border-top: 1px solid var\(--ink-200\)/);
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.login-split \{ grid-template-columns: 1fr;[\s\S]*?\.login-feature-list \{ grid-template-columns: 1fr; \}[\s\S]*?\.login-card-logo \{ display: none; \}/);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.login-feature-list \{ display: none; \}/);
    expect(css).not.toMatch(/\.login-location-marker|\.login-hero-scrim/);
  });

  it("defines desktop, broad-tablet and narrow visual grid orders", () => {
    expect(css).toContain('grid-template-areas: "progress content summary"');
    expect(css).toMatch(/@media \(max-width: 1199px\)[\s\S]*?grid-template-areas: "progress" "content" "summary"/);
    expect(css).toMatch(/@media \(max-width: 899px\)[\s\S]*?grid-template-areas: "progress" "summary" "content"/);
  });

  it("reserves mobile space and accounts for safe-area insets", () => {
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.form \{ padding-bottom: calc\(var\(--mobile-action-height\) \+ env\(safe-area-inset-bottom, 0px\)\)/);
    expect(css).toMatch(/\.form-actions \{ position: fixed;[\s\S]*?env\(safe-area-inset-bottom, 0px\)/);
    expect(css).toMatch(/\.form-actions--split \{ grid-template-columns: minmax\(104px, 0\.72fr\) minmax\(0, 1\.28fr\)/);
  });

  it("keeps narrow date-time fields stacked and equipment in three columns", () => {
    expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.shoot-details-date-time \{ grid-template-columns: 1fr; \}/);
    expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.crew-equipment-gear \.choice-chips--tiles \.choice-chips-list \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  });

  it("removes fixed action spacing and chrome from print", () => {
    expect(css).toMatch(/@media print[\s\S]*?\.form \{ padding-bottom: 0 !important; \}/);
    expect(css).toMatch(/@media print[\s\S]*?\.form-actions \{ position: static !important;/);
    expect(css).toMatch(/@media print[\s\S]*?\.form-actions[\s\S]*?display: none !important/);
  });

  it("defines the confirmation card layout and durable wrapping contracts", () => {
    expect(css).toMatch(/\.confirmation-card \{[^}]*max-width: 760px/);
    expect(css).toMatch(/\.confirmation-topbar-logo \{[^}]*max-width: 100%/);
    expect(css).toMatch(/\.confirmation-body \{[^}]*padding: var\(--s-8\);[^}]*text-align: left/);
    expect(css).toMatch(/\.confirmation-info \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.confirmation-list \{[^}]*grid-template-columns: 150px minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.confirmation-actions \{[^}]*justify-content: flex-end/);
    expect(css).toMatch(/\.confirmation-info-card-value--reference \{[^}]*word-break: break-word/);
  });

  it("stacks confirmation content on mobile and preserves final reduced-motion states", () => {
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.confirmation-info \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    expect(css).toMatch(/@media \(max-width: 620px\)[\s\S]*?\.confirmation-list \{ grid-template-columns: minmax\(0, 1fr\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.confirmation-icon-check \{ animation: none !important; stroke-dashoffset: 0; \}/);
    expect(css).not.toMatch(/\.confirmation-topbar \{ height: (?:160|200|240)px/);
  });

  it("pulses only the live-summary halo and keeps a static reduced-motion fallback", () => {
    expect(css).toMatch(/\.shoot-summary-label::before \{[^}]*width: 7px;[^}]*height: 7px;[^}]*background: #4ade80;[^}]*animation: live-pulse 2s ease-out infinite/);
    expect(css).toMatch(/@keyframes live-pulse[\s\S]*?70% \{ box-shadow: 0 0 0 7px rgba\(74, 222, 128, 0\); \}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.shoot-summary-label::before \{ animation: none; box-shadow: 0 0 0 3px rgba\(74, 222, 128, 0\.3\); \}/);
    expect(css).not.toMatch(/shoot-summary-live-indicator|shoot-summary-live-dot|summary-live-pulse/);
  });

  it("defines independent stepper controls, mobile wrapping and reduced-motion figures", () => {
    expect(css).toMatch(/\.stepper \{[^}]*display: flex;[^}]*align-items: center;[^}]*gap: var\(--s-2\);[^}]*min-width: 0/);
    expect(css).toMatch(/\.stepper-btn \{[^}]*width: 48px;[^}]*height: 48px;[^}]*border: 1px solid var\(--ink-300\)/);
    expect(css).toMatch(/\.stepper input\[type="number"\] \{[^}]*width: 88px;[^}]*height: 48px;[^}]*text-align: center;[^}]*appearance: textfield/);
    expect(css).toMatch(/\.stepper-figures \{[^}]*margin-left: var\(--s-3\);[^}]*min-height: 26px/);
    expect(css).toMatch(/\.stepper-figure \{[^}]*animation: figure-in 320ms[^}]*animation-delay: calc\(var\(--i\) \* 30ms\)/);
    expect(css).toMatch(/@keyframes figure-in \{ from \{ opacity: 0; transform: translateY\(6px\) scale\(0\.6\); \} \}/);
    expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.stepper \{ flex-wrap: wrap; \}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.stepper-figure \{ opacity: 1; transform: none; animation: none !important; \}/);
    expect(css).not.toMatch(/number-stepper-layout|number-stepper-control|people-visual/);
  });
});
