---
name: frontend-project-design
description: Use when designing, implementing, or reviewing a web interface. Combines product-aware UI/UX, visual direction, and accessible frontend patterns while respecting the project’s actual stack and design system.
---

# Frontend Project Design

Use this skill for work that changes how a web interface looks, behaves, or adapts across viewports. It combines product-aware UI/UX research, visual direction, and practical component styling guidance. Adapt recommendations to the user’s request, actual stack, and established design system.

This is a repo-local skill stored under `skills/` and loaded manually according to `AGENTS.md`; do not assume it is automatically discovered.

## Inspect the project first

- Identify the target page, component, user task, and in-scope states.
- Inspect the relevant manifests, existing components, styles, design tokens, routes, and layout patterns before proposing changes.
- Confirm the target framework and styling setup from current project files. This repository currently has a Vue 3 + Vite frontend under `web/`, with established Vue layouts and CSS variables; verify these remain true for the task.
- Reuse the system already in place. Check its tokens and component patterns before adding or changing them.
- Do not assume or install React, shadcn/ui, Tailwind, or another library because an example in a reference says to. Apply component composition, semantic tokens, responsive styling, and accessibility concepts using the project’s actual tools.

## Choose direction for the product surface

Distinguish an internal product surface from a marketing page:

- **Internal app, dashboard, admin, or workflow:** start with the working surface. Make status, information hierarchy, permissions, and primary actions easy to scan. Do not add a marketing hero. Prefer sections, tables, lists, and simple layout; use cards when the card itself is an interaction or useful grouping. Favor utility copy over promotional language.
- **Landing page or branded campaign:** establish a concise visual thesis and content order before building. Give the page a clear brand and message hierarchy, a purposeful visual anchor when the brief benefits from one, and a clear action. A full-bleed image can suit a branded landing page, but imagery is not mandatory.
- **Other interfaces:** choose hierarchy and interaction patterns from the user’s task and existing product language.

For substantial visual work, form a brief visual thesis, content plan, and interaction thesis. Use these to guide implementation, not as text to place in the UI. Keep one dominant idea per section, concise useful copy, a restrained type and color system, and only interactions that improve understanding or operation. Do not force imagery, animation, cards, or a particular mood into routine app UI.

## Targeted design research

When the repository’s `.agents/skills/ui-ux-pro-max/scripts/search.py` exists and Python 3 is available, use its help and run only searches relevant to the task. Run commands from the repository root. Examples:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py --design-system "internal HR payroll dashboard" --stack vue
python3 .agents/skills/ui-ux-pro-max/scripts/search.py --domain ux "accessible responsive table filters"
python3 .agents/skills/ui-ux-pro-max/scripts/search.py --stack vue "reactivity computed"
```

Confirm the reported domain or stack and inspect the top result for relevance to the actual product and task. Search output is guidance, not a project decision: for example, a generic landing-page recommendation may not fit an internal payroll app. Retry with broader terms if the CLI reports no match; if it remains unhelpful, use the project’s patterns and this skill’s guidance, and state that no relevant result was found when it affects the recommendation.

The design-system command is for recommendations. Do not pass `--persist`, `--page`, `--force`, or an output path that writes generated files unless the user explicitly asks for those artifacts. Do not put personal, payroll, authentication, or other sensitive project data into search queries. If Python or the CLI is unavailable, do not install anything; continue with local patterns and the guidance below.

## Components, tokens, and visual consistency

- Prefer existing project components and semantic HTML. Compose small components where this matches local conventions; avoid adding abstraction for a one-off without a clear benefit.
- Reuse existing semantic tokens for page surfaces, text, borders, focus, actions, and status. If a needed token is missing, extend the established token source with the smallest useful semantic addition rather than scattering literal colors or sizes.
- Keep typography, spacing, borders, radii, elevation, and layering consistent. Use visual hierarchy through scale, spacing, alignment, and contrast before adding decorative effects.
- Use the project’s existing icon family where available. Do not use emoji as interface icons; give icon-only controls an accessible name.
- Keep each screen’s primary action clear. Distinguish actions by importance without making secondary actions look equally prominent.
- Show permission and disabled states accurately: a control unavailable to the current user must not imply an authorized action. Preserve server-side authorization; UI state is not a security boundary.

## Accessibility, responsive layout, and states

- Use semantic elements and associated labels for form controls. Preserve keyboard operation, logical focus order, visible focus, and clear accessible names and state for interactive controls.
- Check contrast: normal text should meet at least 4.5:1, large text 3:1, and meaningful UI components or icons 3:1 against adjacent colors. These thresholds do not apply to purely decorative elements or inactive/disabled components. Make status understandable without color alone.
- Place validation feedback near the relevant field and associate errors with their fields. On submit with errors, move focus to an error summary or the first invalid field when appropriate. Provide clear loading, empty, success, and error feedback when in scope.
- Design for narrow and wide viewports. Check for overflow, long text, dense tables, and fixed elements obscuring content or focus. Keep zoom available and ensure text enlargement does not break essential layout or controls.
- Ensure web touch targets are usable: prefer 44×44 CSS px where practical; WCAG 2.2 AA sets 24×24 CSS px as the minimum with defined exceptions. Use CSS pixels for web guidance, not native platform units. Avoid interactions that depend only on hover or color.
- For dialogs, popovers, expanded areas, and other stateful controls, verify opening, closing, focus behavior, and keyboard use when relevant.
- Motion is optional. When adding it, use it to clarify hierarchy or state, keep it restrained, and respect `prefers-reduced-motion`.

## Implement and verify in scope

Make the smallest coherent change that fulfills the requested interface outcome. Recheck the affected interaction states, keyboard path, narrow and wide layouts, text growth/zoom behavior, and reduced-motion behavior when relevant. Verify permission and disabled behavior when the change involves gated actions.

Run checks appropriate to the changed surface and the scripts actually defined by the project. For this repository, inspect `web/package.json` before selecting commands; do not assume a test or lint script exists. Add a test when it meaningfully verifies behavior and is proportionate to the change’s scope and risk; avoid tests for small, readily reversible changes or tests that merely repeat the implementation. Do not add dependencies just to follow this skill. Report commands run and material unverified cases accurately.

## Resolve conflicting guidance

The user’s current request and constraints take priority. Within that scope, follow the existing project design system, stack, and interaction conventions. Recommendations from reference skills are adaptable guidance, not grounds to replace established patterns or add a dependency. If a reference recommendation conflicts with the product surface or an existing pattern, choose the option that best preserves the requested behavior and explain the decision briefly.

If available, consult these repo-local reference skills for further detail, without assuming they are automatically loaded:

- `.agents/skills/ui-ux-pro-max/SKILL.md` — searchable UI/UX guidance and design-system references.
- `.agents/skills/ui-styling/SKILL.md` — component composition, token, responsive, and accessibility references. Its React/shadcn/Tailwind setup instructions apply only when that stack is actually present.

The frontend art-direction source may be available outside the repository at `/home/lena/.codex/skills/frontend-skill/SKILL.md`. Use it only if that path exists; this skill remains usable without it.
