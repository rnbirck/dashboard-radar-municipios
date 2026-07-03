---
target: Radar Municipal do RS dashboard (src/app/router.tsx)
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-07-03T22-39-49Z
slug: src-app-router-tsx
---
Method: dual-agent (A: 019f2a1b-d2d9-7120-925d-24e471148abc · B: 019f2a1c-20e6-7400-a2c8-ab511a44f494)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---:|---:|---|
| 1 | Visibility of System Status | 3 | Active nav, selected filters and loading/error states exist; URL/state casing around RF ids can weaken trust. |
| 2 | Match System / Real World | 3 | Domain language is mostly right, but rank, score, median and population-performance semantics need clearer wording. |
| 3 | User Control and Freedom | 2 | Clear filters exist, but there is no strong breadcrumb/back path from municipality detail to regional ranking. |
| 4 | Consistency and Standards | 3 | Visual system is cohesive, but region selection and ranking/detail flows use competing models. |
| 5 | Error Prevention | 2 | Native selects help, but huge municipality/Corede dropdowns before scoping invite slow or mistaken choices. |
| 6 | Recognition Rather Than Recall | 2 | Users must remember rank rules, color meanings and region/Corede context across screens. |
| 7 | Flexibility and Efficiency | 2 | Deep links and keyboard row activation help; missing search-first picker, sort, compare and export paths. |
| 8 | Aesthetic and Minimalist Design | 2 | Polished but over-carded; small labels and repeated panels compete with the core analytical read. |
| 9 | Error Recovery | 2 | Error/empty states exist but are generic and not contextual to missing ranking/detail data. |
| 10 | Help and Documentation | 2 | Home guide helps; ranking, median, score direction and performance logic need contextual help. |
| **Total** |  | **23/40** | **Acceptable, not yet decision-grade** |

## Anti-Patterns Verdict

The dashboard does not look obviously AI-generated. It has a credible institutional palette, real data structure, and sober density. The weak spots are product-dashboard sameness: many bordered panels, repeated metric cards, tiny uppercase metadata, icon-led cards, and gradient hero blocks. The main issue is not taste; it is that the interface makes a municipal manager work too hard to read the municipality's relative position, trajectory and regional comparison.

The deterministic CLI detector returned exit code 0 with no findings for `src`. Browser overlay evidence did find repeated interface-quality signals across pages: `tiny-text`, `hero-eyebrow-chip`, `tight-leading`, `line-length`, `single-font`, `cramped-padding`, `all-caps-body`, `dark-glow`, `low-contrast` and `ai-color-palette`. Some low-contrast and palette findings are likely false positives because gradient/transparent backgrounds are hard to composite, but the tiny-text and cramped-density findings match the design review.

Overlay injection succeeded in headless Chrome during the evidence run, but no persistent user-visible overlay remains.

## Overall Impression

The product feels trustworthy and serious, but it reads more like an analyst workspace than a municipal situational reading tool. The biggest opportunity is to turn each screen from “here are all the data objects” into “here is the current position, variation, history, dimension behavior and comparison with the regional median.”

## What's Working

- Institutional identity is strong: navy, teal and gold feel appropriate for a public/academic analytical tool.
- URL-synced filters and deep links are a real product strength for sharing and returning to a selection.
- Municipality detail starts with useful context: municipality, RF, Corede, population, PIB, area, year and overall rank.

## Main Issues

**[P1] Mobile regional ranking table is unreadable**
Why it matters: managers will open the dashboard during meetings or field work. A 10-column, 49-row table rendered into roughly 319px with hidden horizontal overflow destroys comparison and trust.
Fix: replace the mobile ranking table with ranking cards or compact rows showing rank, municipality, Corede, population performance, dimensions with better/lower placement and a clear “Abrir análise” action.
Suggested command: `$impeccable adapt src/features/municipalities/components/MunicipalityRankingTable.tsx`

**[P1] Primary filtering path overloads users**
Why it matters: finding a municipality currently becomes a 498-option dropdown problem, with Corede choices visible before a region has meaningfully scoped the task.
Fix: make selection progressive: year and Região Funcional first, then Corede, then searchable municipality autocomplete scoped to the selected region. After selection, collapse filters into an editable context bar.
Suggested command: `$impeccable polish src/components/filters/GlobalFilters.tsx`

**[P1] Ranking semantics are still ambiguous**
Why it matters: users can misread whether “subiu”, green/red, “acima” or a low/high position is good. Rankings are high-stakes language for a public dashboard.
Fix: standardize copy: “1º de 49, quanto menor melhor”, “melhorou 5 posições”, “piorou 2 posições”, “posição no ranking da RF”, “desempenho acima do esperado para o porte populacional”.
Suggested command: `$impeccable clarify src/features/municipalities`

**[P2] Municipality detail does not foreground situational reading**
Why it matters: the stated goal is to show position, variation, dimension behavior and indicator evolution, but the user must infer that structure from seven dimension cards, charts and tables.
Fix: add a neutral reading band before the charts with current position, variation, comparison universe, dimensions with better and lower placement, historical trajectory and comparison with the median of the Regiao Funcional.
Suggested command: `$impeccable shape municipality detail situational reading`

**[P2] Charts need stronger interpretation scaffolding**
Why it matters: rank-line direction, radar score, regional median and indicator direction are not self-explanatory. Browser evidence also saw duplicated radar label text in the DOM, e.g. “EducaçãoEducação”.
Fix: label rank direction directly, add chart captions, simplify radar labels, strengthen legends, expose median/sample context and remove duplicated label artifacts.
Suggested command: `$impeccable polish src/features/municipalities/components/MunicipalityCharts.tsx`

## Problems By Screen

Home: polished and reassuring, but explanation-heavy. Too many repeated cards appear before the user reaches an actual work surface. The “CEI” affordance looks actionable but is not central to the dashboard task.

Ranking/regional selection: region select and region list duplicate the same decision. RF codes are visually prominent, while region/Corede meaning should lead. The screen should help a gestor choose a region, not make them reconcile two controls.

Regional ranking table: dense and useful on desktop, but headers are tiny, colors carry too much rank meaning, “Acima” is ambiguous, and there is no quick summary for strongest/weakest municipalities or dimensions. On mobile this is the most severe failure.

Municipality detail: the header is the strongest screen element. After that, dimension cards compete equally, the situational reading structure is missing, and the indicator selector arrives late. The user sees many analytical components before the interface clearly organizes current position, variation, trajectory and comparison with the regional median.

Global filters/navigation: filters are consistent, but labels are too small. Corede and municipality choices should become available after context is narrowed. Help points back to home rather than explaining ranking/median logic in place.

Historical visualization: line charts exist and are valuable, but rank direction needs more explicit labeling. A better pattern would state how position is plotted and keep the caption neutral: colocacao, variacao, historico and trajectory over time.

Mobile/responsive: filters are usable, detail history tables scroll correctly, and the page avoids document-level horizontal overflow. The ranking table, however, compresses instead of adapting. Detail charts become small, with sub-11px labels and low reading comfort.

## Persona Red Flags

Alex, power/data user: no fast municipality search, no sortable dimension columns, no export/compare path and repeated dropdown work slow expert analysis.

Sam, accessibility/keyboard user: clickable table rows via `tr` can be fragile for assistive tech, chart ARIA is generic, color communicates rank tone, and 9px or smaller labels reduce accessibility. Focus is mostly visible, but native selects need verification.

Municipal secretary/planning technician: needs a neutral situational reading quickly. The app does not immediately organize “current position”, “variation”, “historical trajectory”, “dimensions with better/lower placement” or “comparison with the regional median”, so they must assemble the reading manually.

## Visual V2 Direction

V2 should move from a card-heavy dashboard to a neutral municipal situational reading workspace. It should organize relative location and trajectory without assigning meaning or suggesting management action.

Use a sticky context ribbon across analytical screens: Ano, Região Funcional, Corede, Município and universo comparativo. This should replace the feeling of a filter form as the main navigation object after selection.

Lead each analytical state with a neutral reading band: current position, placement variation, comparison universe, dimensions with better placement, dimensions with lower placement, historical trajectory and comparison with the median of the Regiao Funcional. Then show table/charts as the underlying data.

Preserve navy, teal and gold, but assign roles more strictly: gold for selected/current context, teal for municipality data, slate for regional median/comparison, semantic red/green only with text labels.

Raise the minimum UI label size. Avoid 7-10px metadata in production dashboard surfaces. Use tabular numerals and clearer ordinal treatments for rankings.

Standardize ranking copy everywhere: “posição no ranking”, “colocação”, “variação de X posições”, “histórico”, “trajetória”, “de N municípios” and “mediana da Região Funcional”.

Make charts self-explanatory rather than prescriptive: rank direction label, stronger legends, neutral captions, median/sample context and simplified radar labels.

On mobile, abandon compressed wide tables. Use ranking cards and drill-down rows, keep charts full-width, and collapse filters into an editable context summary after selection.

## Questions to Consider

- What should a mayor or secretary be able to understand after 30 seconds on a municipality detail page without being told what to conclude?
- Is the dashboard optimizing for analyst completeness or municipal situational reading?
- How can the interface foreground relative position and trajectory without turning them into a recommendation?
- Which is more important in V2: regional ranking exploration or municipality situational reading speed?
