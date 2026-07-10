---
timestamp: 2026-06-06T05-40-57Z
slug: frontend-app-docs
---
## MangaDock Engineering Hub — Design Critique

**Target:** `Frontend/app/docs/` · Engineering Hub at `/docs`
**Type:** Internal developer tool (product register)
**Assessments:** A (design review, live browser) + B (detector, source scan, visual inspection)

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No "scenario complete" state in Simulations; legend is below fold on first use |
| 2 | Match System / Real World | 2 | `μs · in-process` / `ms · runtime truth` labels are dense; InfoRow terms are well-chosen |
| 3 | User Control and Freedom | 2 | Back from GitHub detail loses filter state; no keyboard control for simulation stepping |
| 4 | Consistency and Standards | 2 | Two sidebar hierarchies (flat nav vs. accordion) with different active state semantics |
| 5 | Error Prevention | 1 | TechStackView renders invisible text on white bg — user sees ghost content with no warning |
| 6 | Recognition Rather Than Recall | 2 | Scroll-spy sidebar is strong; sidebar search scope is invisible and misleadingly narrow |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts for simulation stepping; no global search (Cmd+K); no URL hash anchors |
| 8 | Aesthetic and Minimalist Design | 1 | TechStackView invisible; domain summary strip below SimulatorPanel is decorative chrome |
| 9 | Error Recovery | 2 | No retry on GitHub fetch failures; no error boundary on MarkdownRenderer |
| 10 | Help and Documentation | 1 | No onboarding; `?sim=` deeplink is invisible; hub has no help about itself |
| **Total** | | **17/40** | **Poor — significant improvements before users are comfortable** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?**

**LLM assessment:** Not a textbook dump, but specific tells are present. The domain summary strip (2×4 grid of tiles reading "5 scenarios", "2 scenarios") is textbook AI scaffolding — identical cards with uniform chrome and no content differentiation. The `Box/Arrow` diagram primitives apply the same size/shape/weight to every node, implying flat peer relationships in an architecture where there is real hierarchy. The dark card + mono eyebrow label on every diagram (`"ภาพรวม Request Flow"`, `"Frontend Architecture"`) is applied uniformly regardless of content. Counter-signals of genuine craft are present: the step simulator, `aria-live` regions, `prefers-reduced-motion` handling, the bilingual per-step technical disclosure, and the `?sim=` URL deep-link are deliberate, opinionated choices. The scroll-spy sidebar with per-section color coding is coherent and considered. Assessment: **not AI-generated overall, but one element (domain summary strip) and one system (Box/Arrow diagrams) read as scaffolding rather than designed communication**.

**Deterministic scan:** CLI detector run was attempted; agent encountered a technical barrier executing the external script. Browser-level manual review was performed as fallback. Direct source analysis identified the following concrete issues:

| Finding | File | Severity |
|---------|------|----------|
| TechStackView: all text tokens are white-based, rendered on white `bg-white` container | `TechStackView.tsx` (entire), `DocsClient.tsx:1153` | P0 |
| Sidebar nav buttons: `py-2` = ~36px height, under 44px WCAG 2.5.5 touch target | `DocsClient.tsx:993,1009` | P2 |
| Diagram arrow label font: `text-[9px]` — below 11px practical minimum | `OverviewView.tsx:85–95` | P3 |
| `labelFg()` luminance threshold 0.4 mildly aggressive for mid-range yellows/greens | `utils.ts:18` | P3 |

**Visual overlays:** Live-server injection was not attempted (technical barrier). No user-visible overlay is available for this run. Fallback: browser screenshots and source-level analysis were used.

---

## Overall Impression

The Engineering Hub has real craft underneath — the Simulations tab is the clearest evidence, with its bilingual per-step disclosure, `prefers-reduced-motion` respect, and `?sim=` deeplink. The OverviewView's `InfoRow` language is honest and informative. But two issues break the experience before a user reaches those highlights: the TechStack view renders ghost content (invisible text on white), and the domain summary strip deflates the Simulations experience with filler immediately below the hero panel. Fix the invisible TechStack first; it is a P0 regression that a first-time visitor will encounter on their second click.

---

## What's Working

**1. SimulatorPanel progressive disclosure.** The collapsible "รายละเอียดเชิงเทคนิค" expand-per-step keeps the primary teaching layer clean while surfacing implementation detail exactly when contextually relevant. Auto-close on step change prevents stale detail bleeding across steps. This required domain understanding, not just template-filling.

**2. Scroll-spy sidebar with section-matched color coding.** Indigo=Frontend, amber=Backend, emerald=MIT, sky=Supabase in the sidebar dots match the section diagram border colors. The spatial anchoring while reading long content is quiet and consistent. This is honest visual design work.

**3. OverviewView `InfoRow` copy.** `Leader Election`, `Write-behind`, `Dirty Queue` as mono terms paired with plain-prose descriptions makes the Backend caching model legible without a diagram. The visual grammar (mono term / human description split) is correct for a glossary-style explanation.

---

## Priority Issues

### [P0] TechStackView: all text invisible on white background
**What:** `TechStackView.tsx` uses dark-mode color tokens throughout (`text-[#f8f9fb]`, `text-white/40`, `bg-white/[0.02]`, `text-white/30`) but renders inside `DocsClient`'s `bg-white` main container with no background override. Contrast ratio for heading text: ~1.05:1. Card descriptions, version badges, category labels, footer notes: all invisible or near-invisible. Only the colored left-border stripes on cards remain faintly visible.
**Why it matters:** A user's second click lands here. They see empty-looking cards and a ghost heading. This reads as a broken product.
**Fix:** Wrap TechStackView in a `bg-[#0f1118]` or `bg-[#1c1c1e]` full-bleed container (following the same pattern as OverviewView's dark diagram cards), or rekey all color tokens to light-mode equivalents. The wrapping approach is lower-risk: `<div className="min-h-full bg-[#0f1118] rounded-2xl overflow-hidden"><TechStackView /></div>` inside the content wrapper.
**Suggested command:** `/impeccable audit TechStackView`

### [P0] Simulations legend is below viewport fold on first use
**What:** The color legend (`Processing · Success · Error · Writing · Skipped · Idle`) sits at the bottom of `SimulatorPanel`. On common 768–900px viewports, the legend is below the fold when the panel first renders. Users encounter amber/green node states in the flow diagram before they can read the color key.
**Why it matters:** The diagram becomes partially uninterpretable until the user discovers the legend exists at the bottom. This undermines the core value of the Simulations feature on first use.
**Fix:** Move the legend inline above the flow diagram, or add a compact persistent color-keyed mini-legend next to the `1 / N` counter (in the navigation row). The bottom legend can stay as a secondary reference.
**Suggested command:** `/impeccable layout simulations/SimulatorPanel.tsx`

### [P1] Back navigation from GitHub detail views destroys filter and page state
**What:** `IssueDetailView.onBack` hardcodes `navigate({ type: 'gh-issues', state: 'open', page: 1 })`. Same bug in `PullDetailView`. If a developer filtered to `closed` state, page 3 to find a specific resolved issue, clicking back drops them at page 1 of `open`.
**Why it matters:** Active tax on PR/issue review workflows. Will be encountered every time a developer reads a closed issue or older PR.
**Fix:** Thread `state` and `page` from the parent list view into the detail view's `onBack` handler, or store last-used list state in a `useRef` at the `DocsClient` level.
**Suggested command:** `/impeccable harden DocsClient.tsx`

### [P1] Domain summary strip is pure decorative chrome
**What:** The 2×4 grid of domain tiles below `SimulatorPanel` in `SimulationsView` duplicates the sidebar accordion exactly — same 8 domain names, same scenario count — adds no scenario preview, no "what you haven't seen yet" tracking, no shortcut that doesn't already exist in the sidebar. Consumes ~120px vertical space and forces scrolling past it.
**Why it matters:** Creates a visual valley immediately after the strongest emotional peak (the simulator interaction). Users scroll past and find nothing new. Assessment A called this "the most slop-adjacent element" in the interface.
**Fix:** Remove it. If reclaimed space feels empty, extend the SimulatorPanel's minimum height to give diagrams more breathing room, or show a "what else to explore" suggestion based on active scenario domain.
**Suggested command:** `/impeccable distill simulations/SimulationsView.tsx`

### [P1] Sidebar search is invisibly narrow — returns zero results for scenario and overview content
**What:** The sidebar `search` state filters only `MdFile[]` by name/content. Typing "L1 HIT", "authentication", or "cache" finds nothing because those are scenario labels and overview terms, not document filenames. The search box gives no scope indicator.
**Why it matters:** First search attempt returning zero results creates a "this doesn't work" impression that's hard to undo. Power users will immediately distrust the search and fall back to `Cmd+F`.
**Fix (quick):** Add a scope label below the input: "Searching docs only" with a muted style. Fix (better): extend the search to include `ALL_DOMAINS` scenario labels (trivial, all data is client-side).
**Suggested command:** `/impeccable harden DocsClient.tsx`

---

## Persona Red Flags

### Alex (Power User — knows the codebase, uses the hub daily)
- No keyboard shortcuts for simulation stepping — must reach for mouse every step
- Can't deep-link to a specific overview section (scroll-spy updates state but not URL hash)
- Back-from-detail losing filter state is an active tax on every closed-issue lookup
- Will type "L1 HIT" into search, get nothing, mentally write off search as broken
- No Cmd+K global search; will return to editor `Cmd+F` for any real lookup

### Sam (Accessibility-Dependent — screen reader, prefers-reduced-motion)
- `prefers-reduced-motion` correctly handled; autoplay disabled. Genuine effort.
- `aria-live="polite"` on step counter and description; progress dots correctly labeled. Strong.
- **Gap:** `FlowDiagram` nodes (`Box` components in `LinearLayout`/`WriteLayout`) have no `aria-label` at the `div` level beyond `role="img" aria-label="${label} — ${state}"` in the new `CNode`. Verify these land correctly in the rendered DOM tree vs. OverviewView's legacy `Box` components which have no ARIA attributes.
- The `ExternalLink` icon in the sidebar footer has no `aria-label`; would be announced as "link" without context.

### Jordan (First-Timer — new team member, first week)
- No "start here" guidance — hub assumes context about its own structure
- Will not discover `?sim=` deeplink or sharing capability
- Mixed Thai nav / English content will confuse a non-Thai English speaker; no language note or toggle visible
- Sidebar search returning zero on first attempt creates early distrust
- Will scroll past the domain summary strip in Simulations without understanding its purpose (because it has none)

---

## Minor Observations

- `<Zap size={13}>` for the Simulations nav icon suggests speed/electricity, not interactivity. `<Play>` or `<Workflow>` would match semantics better.
- `MarkdownRenderer` joins multi-line paragraph segments with a space (`pl.join(' ')`), silently stripping hard line breaks used in dev docs for equations, pseudo-code blocks, or structured text.
- `OV_SECTIONS` scroll-spy uses `el.offsetTop` against the main scroll container; sections using `margin-top` that collapses with preceding `hr` elements may trigger the wrong active section label.
- GitHub footer link (`Slow-Inc/MangaDock`) is hardcoded — will require manual update if repo is renamed/forked.
- Diagram arrow labels at `text-[9px]` (`/api/proxy/`, `HTTP`, `HTTP+webhook`) fall below the 11px practical minimum for legibility at normal zoom.
