# Decisions Module — Redesign & Audit Spec

- **Date**: 2026-04-23
- **Status**: Approved, ready for implementation plan
- **Target branch**: `feature/ui-refinement-and-theme-system`
- **Scope**: Panel admin (`condominium-admin`) — admin + board actors only

## 1. Context

The backend shipped V1 of the `decisions` module (presupuestos + votaciones) per spec at NotebookLM `encuestas.md`. The panel admin has an initial implementation (commits `3ae4f1a`, `c9e50d8`) with 14/16 endpoints wired but uneven UX and two functional gaps.

This spec covers:
- Gap audit fixes (functional)
- UX/UI redesign of list + detail pages
- Visual polish (quote cards, tally chart, photo lightbox, countdown urgency)
- Code quality cleanup (typing, extracting components)

**Out of scope**: voting UI (voting lives in APK — confirmed). Backend changes. APK side.

## 2. Scope boundaries

### In scope
- `/decisions` list page — rewrite to card grid with triage chips
- `/decisions/[id]` detail page — rewrite with hero + stacked sections + fase-aware primary CTA + overflow menu
- Quote card visual overhaul (winner highlight, tiebreak marking, deleted state, file preview flow)
- Tally chart component (replaces inline progress bars)
- Photo lightbox for decision photo
- Countdown urgency signaling (color-coded badges)
- Functional bug fixes: photo upload handler in create flow, `NO_VOTES_CAST` / `NO_ACTIVE_QUOTES` error mapping, generate-charge idempotency guard
- Code refactor: type `metadata` fields (remove `any`), extract `DecisionActions`, `DecisionHero`, `DecisionCard`
- Empty states + loading skeletons pass

### Out of scope
- Voting UI in panel (APK only)
- Backend spec changes
- New endpoints (client-side composition acceptable for "Pendientes acción" chip if no dedicated endpoint)
- Tests beyond TypeScript strict + manual QA (no e2e required)

## 3. Actors & permissions

- **Admin** (`profiles.app_role='admin'`): full access all buildings; uses `BuildingContext` to scope view (global vs specific building)
- **Board** (`buildingRoles` entry with `role='board'`): manages decisions in their building; uses contextual building routing
- **Resident**: not a target of this surface (uses APK)

All UI gated behind existing `usePermissions()` hooks:
- `canManageDecisions(buildingId)` — admin OR board of building
- `canUploadQuote(buildingId)` — same
- `canDeleteQuoteAsOwner(quote, status)` — uploader + RECEPTION phase

Users without `canManageDecisions` see detail in read-only (no primary CTA, no overflow).

## 4. Architecture approach

**Refactor-in-place, not rewrite**. The existing `decisionsService` is typed and covers 15/16 endpoints. The 8 dialogs (Extend, Cancel, Finalize, ResolveTiebreak, GenerateCharge, QuoteUpload, QuoteDelete, AuditLogDrawer) are functional and stay. The detail page and list page are rewritten; shared pure logic is extracted to `lib/utils/`.

### Component ownership

```
app/(dashboard)/decisions/
  page.tsx                            (REWRITE — list, card grid + chips)
  [id]/page.tsx                       (REWRITE — hero + stacked sections)

components/decisions/
  DecisionCard.tsx                    (NEW — list item)
  DecisionHero.tsx                    (NEW — detail hero w/ gradient + countdown + CTA slot)
  DecisionActions.tsx                 (NEW — primary CTA + overflow, fase-aware)
  TallyChart.tsx                      (NEW — horizontal bars, handles empty states)
  PhotoLightbox.tsx                   (NEW — decision photo viewer)
  CountdownBadge.tsx                  (NEW — color-coded pill)
  UrgencyChip.tsx                     (NEW — list filter chip with count)
  ActionFilterChips.tsx               (NEW — list triage chips)
  QuoteCard.tsx                       (REWRITE — states: normal / winner / tiebreak / deleted / yours)

  DecisionDialog.tsx                  (EDIT — photo submit handler)
  DecisionStatusBadge.tsx             (KEEP)
  VotesList.tsx                       (KEEP — add refresh button)
  AuditLogDrawer.tsx                  (KEEP)
  ExtendDeadlinesDialog.tsx           (KEEP)
  CancelDecisionDialog.tsx            (KEEP)
  FinalizeConfirmDialog.tsx           (KEEP)
  ResolveTiebreakDialog.tsx           (KEEP)
  GenerateChargeDialog.tsx            (KEEP — add submitting lock)
  QuoteUploadDialog.tsx               (KEEP)
  QuoteDeleteDialog.tsx               (KEEP)

lib/utils/
  decision-countdown.ts               (NEW — formatCountdown)
  decision-phase.ts                   (NEW — getPhaseTheme)
  decision-actions.ts                 (NEW — resolvePrimaryAction)
  decision-errors.ts                  (EDIT — +NO_VOTES_CAST, +NO_ACTIVE_QUOTES)

lib/services/
  decisions.service.ts                (EDIT — type metadata, verify uploadPhoto)

lib/types/
  decision.ts                         (NEW or REVIEW)
```

**Not touched**: Axios client, BuildingContext, sidebar nav, theme tokens, hooks/usePermissions, Sonner setup.

## 5. List page — `/decisions`

### Layout

```
Header:    "Presupuestos" · building label     [+ Crear decisión]
Toolbar:   [🔍 Búsqueda…]  [Chip: Activas·N] [Chip: Pendientes acción·N] [Chip: Archivadas·N]
Grid:      DecisionCard × N (3 col desktop / 2 col tablet / 1 col mobile)
Paginator: (standard pattern — PR #19/#33 shape)
```

### Filter chips — logic

- **Activas** = `status in (RECEPTION, VOTING)`
- **Pendientes acción** = `status = TIEBREAK_PENDING` OR `(status = VOTING AND voting_deadline < now + 24h)` OR `(status = RESOLVED AND resulting_id IS NULL)`
- **Archivadas** = `status = CANCELLED` OR `(status = RESOLVED AND resulting_id IS NOT NULL)`

Chips are mutually exclusive (radio-style). Default on mount: **Activas**. Selected chip persists in URL query param `?view=activas|pendientes|archivadas` for back-nav preservation.

**Server composition**: chips map to `status` filter query param on `GET /decisions`. "Pendientes acción" requires client-side logic since it spans statuses — either two parallel calls (`?status=TIEBREAK_PENDING` + `?status=VOTING` + `?status=RESOLVED`) merged and filtered client-side, or a single `?status=all` fetch filtered locally. Decision: fetch `status in (VOTING, TIEBREAK_PENDING, RESOLVED)` and apply client predicate; acceptable for V1 volumes. If list volumes grow, coordinate with backend to add `?requires_action=true` param.

### DecisionCard anatomy

```
┌─ card (bg per phase) ─────────────────────────┐
│ [64x64 photo or icon]  FASE · RONDA           │
│                        ⏱ countdown (colored)  │
│                                                │
│ Title (h3)                                     │
│ Edificio X (if global view only)               │
│                                                │
│ Metadata row (fase-dependent):                 │
│   RECEPTION:  📋 N cotizaciones                │
│   VOTING:     📋 N cotizaciones                │
│                🗳 M/K aptos · bar [▓▓░░]       │
│   TIEBREAK:   ⚠ Empate en ronda N              │
│   RESOLVED:   🏆 Vendor name · amount          │
│                + "Pendiente cargo" si sin id   │
│   CANCELLED:  ✕ Cancelada · reason truncated   │
└────────────────────────────────────────────────┘
```

### Phase color coding (card bg + left border)

| Phase | Treatment |
|-------|-----------|
| RECEPTION | `bg-stone-50` + `border-l-4 border-amber-800` |
| VOTING | `bg-gradient-to-br from-amber-600 to-amber-900 text-white` |
| TIEBREAK_PENDING | `bg-amber-50 border-2 border-amber-400 ring-2 ring-amber-200` |
| RESOLVED | `bg-emerald-50 border-l-4 border-emerald-700` (if charged) / `bg-amber-50 border-l-4 border-amber-500` (if pending charge) |
| CANCELLED | `bg-stone-100 opacity-60` + strikethrough title |

Dark mode: tokens use theme-aware classes (`bg-card`, `bg-muted`, `border-border`, gradients via CSS variables). All hardcoded colors above resolve to light/dark variants via Tailwind's `dark:` modifier.

### CountdownBadge

Input: `deadline: Date`. Output: pill with urgency class.

| Remaining | Class | Label |
|-----------|-------|-------|
| `> 7d` | `bg-stone-100 text-stone-700` | "Cierra DD MMM" |
| `1d ≤ x ≤ 7d` | `bg-amber-100 text-amber-900` | "⏱ Nd Nh" |
| `< 24h` | `bg-red-100 text-red-800` | "⏱ Nh Nm" |
| Expired + open | `bg-red-600 text-white` | "⚠ Pendiente finalize" |
| Expired + closed | — | hidden |

### Empty states per chip

- Activas vacío: "Ninguna decisión activa. ¿Creamos una?" + CTA "Crear decisión"
- Pendientes vacío: "✓ Todo al día, nada pendiente."
- Archivadas vacío: "Sin historial aún."

### Loading

6 skeleton cards with shimmer (reuse TableSkeleton shimmer pattern via dedicated `DecisionCardSkeleton`).

### Click behavior

Card click → push `/decisions/{id}?fromView={chip}`. Detail page reads `fromView` for back-button preservation.

## 6. Detail page — `/decisions/[id]`

### Layout

```
[← Volver a Presupuestos (respecting fromView)]

┌─ DecisionHero (gradient warm per phase) ──────┐
│ FASE · RONDA N [de M]                    [•••]│
│ Title (h2)                                     │
│ Edificio X                                     │
│                                                │
│ ⏱ CountdownBadge · Absolute date              │
│ Participation (VOTING only):                   │
│   M/K aptos · [▓▓▓▓░░░] 57%                   │
│                                                │
│                     [Primary CTA (fase-aware)] │
└────────────────────────────────────────────────┘

── Descripción ──
Texto del decision. [Photo thumb 96x96 → lightbox]

── Deadlines ──
📅 Recepción: cerrada · 22 Abr 18:00
🗳 Votación:   24 Abr 18:00  [CountdownBadge]

── Cotizaciones (N) ──
QuoteCard grid (2 col desktop / 1 col mobile)
+ [Subir cotización] button (if RECEPTION + permission)

── Resultado de votación ── (hidden in RECEPTION)
TallyChart + [🔄 Actualizar]
timestamp "Actualizado hace X"

── Votos emitidos ── (hidden in RECEPTION)
VotesList (existing) + [🔄 Actualizar]

── Cargo ── (RESOLVED with resulting_id only)
INVOICE #... / ASSESSMENT batch ... · [Ver en billing/petty-cash →]

── Auditoría ──
[Ver auditoría] button → opens AuditLogDrawer
```

Max width `5xl`, single column, `space-y-6` between sections.

### Hero gradient per phase

| Phase | Gradient |
|-------|----------|
| RECEPTION | `from-amber-700 to-amber-900` |
| VOTING | `from-amber-600 to-orange-800` |
| TIEBREAK_PENDING | `from-yellow-500 to-amber-700` + `ring-2 ring-amber-300` |
| RESOLVED | `from-emerald-700 to-emerald-900` |
| CANCELLED | `from-stone-600 to-stone-800` + title strikethrough |

Text always white. Contrast verified in both light and dark modes.

### Primary CTA matrix (`resolvePrimaryAction`)

| Phase | Condition | Primary CTA | Action |
|-------|-----------|-------------|--------|
| RECEPTION | 0 active quotes | "Subir primera cotización" | open `QuoteUploadDialog` |
| RECEPTION | ≥1 active quote | "Finalizar recepción → Abrir votación" | open `FinalizeConfirmDialog` |
| VOTING | `deadline > now` | "Finalizar votación ahora" (outline tone) | `FinalizeConfirmDialog` |
| VOTING | `deadline ≤ now` | "Finalizar votación" (solid prominent) | `FinalizeConfirmDialog` |
| TIEBREAK_PENDING | — | "Resolver empate" | `ResolveTiebreakDialog` |
| RESOLVED | `resulting_id IS NULL` | "Generar cargo" | `GenerateChargeDialog` |
| RESOLVED | `resulting_id NOT NULL` | "Ver cargo →" | link to billing/petty-cash |
| CANCELLED | — | none; show info banner | — |

Users without `canManageDecisions` see no primary CTA regardless of phase.

### Overflow menu (•••) per phase

| Phase | Items |
|-------|-------|
| RECEPTION | 🕐 Extender deadlines · 📎 Subir cotización · 📜 Ver auditoría · ─── · ✕ Cancelar (red) |
| VOTING | 🕐 Extender deadlines · 📜 Ver auditoría · ─── · ✕ Cancelar (red) |
| TIEBREAK_PENDING | 📜 Ver auditoría · ─── · ✕ Cancelar (red) |
| RESOLVED | 📜 Ver auditoría |
| CANCELLED | 📜 Ver auditoría |

Uses existing `DropdownMenu` from `components/ui/`. Keyboard accessible, ESC closes.

### Charge deep-link

- `resulting_type === 'INVOICE'` → `/billing/invoices/{resulting_id}`
- `resulting_type === 'ASSESSMENT'` → route to petty-cash assessment view (verify exact path; route may be `/finances/petty-cash/assessments/{resulting_id}` — confirm during implementation)

### Mobile

- Hero: stack primary CTA below title; overflow stays icon-only
- Grid of quotes collapses to 1 col
- Tally bars overflow-x scroll if many quotes
- Action rail is row-wrapped

## 7. QuoteCard redesign

### Anatomy

```
┌ QuoteCard ──────────────────────────────────┐
│ [🏆 GANADORA] [⚖ Empatada] [Ronda 1]        │  ← state badges (conditional)
│                                              │
│ Vendor name                                  │
│ $ amount                                     │
│                                              │
│ Notes (collapsed if > 200 chars, "Ver más")  │
│                                              │
│ 📎 filename.pdf · 2.3MB                      │
│ [Ver archivo ↗]                              │
│                                              │
│ Subido por Juan P · hace 3 días   [•••]      │  ← overflow: delete
└──────────────────────────────────────────────┘
```

### Visual states

| State | Treatment |
|-------|-----------|
| Normal | `bg-card border border-border/50 rounded-xl` |
| **Winner** (RESOLVED, `id === winner_quote_id`) | `ring-2 ring-emerald-500 bg-gradient-to-br from-emerald-50/50 to-card` + 🏆 badge |
| **Tied** (TIEBREAK_PENDING round 2+, quote participates) | `ring-1 ring-amber-400 bg-amber-50/30` + ⚖ "Empatada" badge |
| **Not in round 2** (TIEBREAK_PENDING, quote not in tied set) | `opacity-30 pointer-events-none` + chip "No en ronda 2" |
| **Deleted** (`deleted_at NOT NULL`) | `opacity-50 grayscale-[30%]` + strikethrough title + "Eliminada" badge + reason tooltip |
| **Yours** (`uploader_user_id === auth.uid()`) | `border-l-4 border-amber-700` + "Tuya" chip |

### Overflow (•••) — conditional render

- Uploader in RECEPTION → "Eliminar cotización" (no reason required)
- Admin/board any phase → "Eliminar cotización" (reason required via `QuoteDeleteDialog`)
- Otherwise hidden

### File preview flow

1. Click "Ver archivo"
2. Button shows spinner
3. Call `decisionsService.listQuotes(decisionId)` to get fresh signed URL
4. Find quote by ID, extract current `file_url`
5. If MIME = image/*: open in `PhotoLightbox`
6. If MIME = application/pdf: `window.open(url, '_blank')`
7. On URL expired error: toast "Link expirado, reintentá"

## 8. TallyChart

### Anatomy (VOTING state)

```
Resultados — Ronda N [de M]       [🔄 Actualizar]
12/24 aptos votaron (50%)

Ascensores Premium SA         ████████░░░░░░  8 votos · 67%
$1.250.000

Elevadores Norte              ███░░░░░░░░░░░  3 votos · 25%
$890.000

Fábrica del Sur               █░░░░░░░░░░░░░  1 voto · 8%
$1.100.000

Actualizado hace 12s
```

### Anatomy (RESOLVED state)

- Same structure
- Winner: 🏆 icon + emerald ring + bold percentage
- Bars animate from 0 to final value on mount (CSS transition)

### Empty states

| Condition | Empty state |
|-----------|-------------|
| RECEPTION (no voting yet) | Section not rendered |
| VOTING + 0 votes | "Aún no hay votos emitidos." |
| RESOLVED + `NO_VOTES_CAST` audit reason | "Nadie votó. Resolvé manual eligiendo ganador o cancelá la decisión." + CTA to open `ResolveTiebreakDialog` or `CancelDecisionDialog` |
| RESOLVED + `NO_ACTIVE_QUOTES` audit reason | "Todas las cotizaciones fueron eliminadas. Cancelá esta decisión." + CTA |
| TIEBREAK_PENDING | Shows only tied quotes + alert "⚖ Empate — resolvé manual o reintentá ronda" |

### Data source

- Fetches `GET /decisions/:id/results` for tally breakdown
- Bars derived from `results.per_quote: { quote_id, vote_count, percentage }[]`
- No auto-poll. Manual refresh via 🔄 button (explicit user decision).
- Refresh button re-fetches both `getById` and `getResults` for consistency.

### Accessibility

Each bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemax={total_votes}`, `aria-label="{vendor}: {votes} de {total} votos"`. Live region `aria-live="polite"` updates when refresh fires.

## 9. PhotoLightbox

- Trigger: click on decision photo thumb (hero or descripción section)
- Overlay: `bg-black/80 backdrop-blur-md` fixed fullscreen
- Image centered: `max-h-[90vh] max-w-[90vw] object-contain`
- Close affordances: ESC key / click overlay / × button top-right
- Focus trap while open (`aria-modal="true"`)
- Re-fetches signed URL on open via `decisionsService.getById(id)` to avoid expired links
- Loading state: spinner while image loads
- Error state: "No se pudo cargar la imagen" + retry button

## 10. Functional fixes

### 10.1 Photo upload handler

Current bug: `DecisionDialog` has `photo` field in form but no submit handler.

Fix in `DecisionDialog.tsx`:
```
onSubmit(data):
  1. decisionsService.create(payload) → { id }
  2. if data.photo:
       try: decisionsService.uploadPhoto(id, formDataWithPhoto)
       catch: toast.warning("Decisión creada. Foto falló, reintentá desde el detail.")
  3. router.push(`/decisions/${id}`)
```

Client-side validation for photo:
- MIME ∈ [image/jpeg, image/png, image/webp]
- Size ≤ 5MB
- Preview thumb in form before submit

Optional follow-up (same PR): "Cambiar foto" action in detail overflow → opens dedicated dialog calling `uploadPhoto` with existing decision id. Deferred unless trivial.

### 10.2 Error mapping

`lib/utils/decision-errors.ts` additions:

```
case 'NO_VOTES_CAST':
  return 'La votación cerró sin votos. Resolvé manual eligiendo ganador o cancelá la decisión.';
case 'NO_ACTIVE_QUOTES':
  return 'No quedan cotizaciones activas. Cancelá esta decisión para cerrarla.';
```

Audit full coverage against V1 codes: `DECISION_NO_ACTIVE_QUOTES`, `QUOTE_DELETED`, `QUOTE_NOT_IN_TIEBREAK`, `DECISION_ALREADY_CHARGED`, `DECISION_WRONG_STATUS`, `QUOTE_INVALID_MIME`, `QUOTE_FILE_TOO_LARGE`, `NO_VOTES_CAST`, `NO_ACTIVE_QUOTES`. Extend switch if any missing.

### 10.3 Generate-charge idempotency guard

In `GenerateChargeDialog.tsx`:
- Local state `submitting: boolean`
- Set true on submit click, false on success/error
- Submit button: `disabled={submitting}` + spinner icon
- Catch `DECISION_ALREADY_CHARGED` → toast friendly + close dialog + re-fetch decision

In detail page: button hidden when `resulting_id != null` (already present; verify).

### 10.4 Deadline validation

Already covered in `ExtendDeadlinesDialog` + `DecisionDialog` via Zod. Verify:
- `new_reception_deadline > now()`
- `new_voting_deadline > new_reception_deadline`
- In VOTING state: disable `reception_deadline` field

### 10.5 Reason-required audit

Confirmed present in 4 dialogs. Spot-check `QuoteDeleteDialog` branching:
- Uploader in RECEPTION → reason optional
- Admin/board any phase → reason required (min 5 chars Zod)

## 11. Code quality

### 11.1 TypeScript

Target: zero `any` in `decisions.service.ts`. Replace with:
- `metadata: Record<string, unknown>` for generic audit payloads
- Dedicated union types for `DecisionStatus`, `ChargeType`, `AuditAction` (exported from `lib/types/decision.ts`)

`tsc --noEmit` passes as merge gate.

### 11.2 Extraction targets

Before/after:
- `app/(dashboard)/decisions/[id]/page.tsx`: 430 lines → ~250 lines (hero, actions, quote list extracted)
- `DecisionActions.tsx`: owns primary CTA computation + overflow menu + callback wiring
- `DecisionHero.tsx`: owns gradient, title, countdown, participation bar, CTA slot
- `DecisionCard.tsx`: owns list card render

Pure utilities (easily testable):
- `decision-countdown.ts`: `formatCountdown(deadline: Date) → { label, urgency }`
- `decision-phase.ts`: `getPhaseTheme(status) → { gradientClass, labelEs, icon }`
- `decision-actions.ts`: `resolvePrimaryAction(decision) → { label, variant, onClickKey } | null`

### 11.3 String / typo audit

Run `rg -n decission components/decisions app/\\(dashboard\\)/decisions lib/services/decisions.service.ts` and fix any code-level artifacts of the original commit message typo.

## 12. Phasing

Single PR to `feature/ui-refinement-and-theme-system`, committed in 6 sequential phases so the user can test each slice in isolation:

| Commit | Subject | Files touched |
|--------|---------|---------------|
| 1 | `fix(decisions): photo upload handler + error mapping + charge idempotency` | DecisionDialog, decision-errors, GenerateChargeDialog |
| 2 | `refactor(decisions): type metadata, extract DecisionActions & DecisionHero` | decisions.service, lib/types/decision, detail page, new DecisionActions + DecisionHero + lib/utils/decision-* |
| 3 | `feat(decisions/list): card grid + filter chips + urgency badges` | list page, DecisionCard, ActionFilterChips, UrgencyChip, CountdownBadge |
| 4 | `feat(decisions/detail): hero + overflow menu + fase-aware primary CTA` | detail page consumes new components |
| 5 | `feat(decisions/detail): TallyChart + QuoteCard states + PhotoLightbox + round-2 filter` | TallyChart, QuoteCard rewrite, PhotoLightbox |
| 6 | `chore(decisions): empty states + loading skeletons + accessibility pass` | Skeleton components, empty states per section, aria polish |

PR opens after commit 6. User may open PR earlier for incremental review.

## 13. Testing & verification

Panel has no established test culture. Strategy:

- **TypeScript strict** — `bun run tsc --noEmit` zero errors, each commit
- **Build** — `bun run build` passes pre-merge (user runs; Claude never auto-builds)
- **Optional unit tests** — if `bun test`/`vitest` configured, add for pure utils: `formatCountdown`, `resolvePrimaryAction`, `getPhaseTheme`
- **Manual QA checklist** — per-commit checklist below, user-executed

### QA checklist

**Commit 1**:
- [ ] Crear decision con foto → aparece en detail hero
- [ ] Crear sin foto → fallback icon
- [ ] Error backend `NO_VOTES_CAST` → toast ES amigable
- [ ] Error backend `NO_ACTIVE_QUOTES` → toast ES amigable
- [ ] Double-click "Generar cargo" → 1 request, botón disabled in-flight

**Commit 2**:
- [ ] `tsc --noEmit` zero new errors
- [ ] Detail page visual regression zero (identical to pre-refactor)
- [ ] Dialogs open/close correctly
- [ ] `rg "\\bany\\b" lib/services/decisions.service.ts` → zero hits

**Commit 3**:
- [ ] Chip counts correct
- [ ] Activas default on mount
- [ ] Photo thumb or icon fallback per card
- [ ] Countdown red when `<24h`
- [ ] Click card → correct detail id
- [ ] Empty state per chip (3 variants)
- [ ] Building name shown only in global view
- [ ] Responsive: 1/2/3 cols

**Commit 4**:
- [ ] Hero gradient per phase (5 variants)
- [ ] Primary CTA changes per matrix
- [ ] Overflow items correct per phase
- [ ] Cancel red + divider in overflow
- [ ] "Generar cargo" hidden when resulting_id != null
- [ ] "Ver cargo →" deep-links correctly
- [ ] Volver preserves chip

**Commit 5**:
- [ ] Winner has 🏆 + emerald ring in RESOLVED
- [ ] Deleted quote opacity + strikethrough + reason tooltip
- [ ] TIEBREAK: non-tied quotes `opacity-30`
- [ ] Photo click → lightbox opens, ESC closes, overlay closes
- [ ] "Ver archivo" re-signs URL (1 listQuotes call before opening)
- [ ] Tally bars animate on load
- [ ] Refresh button in tally + votes sections triggers re-fetch
- [ ] `NO_VOTES_CAST` empty state with CTA
- [ ] `NO_ACTIVE_QUOTES` empty state with CTA

**Commit 6**:
- [ ] List loading: 6 skeleton cards shimmer
- [ ] Detail loading: hero + sections skeleton
- [ ] Empty quotes in detail: CTA "Subir primera"
- [ ] Empty votes: neutral message

### Accessibility smoke

- Lightbox: focus trap, `aria-modal`, ESC closes
- Overflow menu: keyboard navigable, ESC closes
- Tally bars: `role="progressbar"` + `aria-valuenow`
- Urgency not color-only (icon + text too)

### Light/dark mode

- Hero gradients: white text contrast verified both themes
- Quote card winner emerald ring visible in dark
- Borders + hover states readable in light
- Toggle probed per commit

## 14. Open questions deferred to implementation plan

1. Exact route for assessment deep-link (`/finances/petty-cash/...` — verify on first encounter)
2. Whether `bun test` runner is configured (decides if pure-util tests are added)
3. Whether to add "Cambiar foto" post-creation in detail overflow (scope creep; default: skip)
4. Whether backend can add `?requires_action=true` list filter (optimization, deferred)

## 15. Non-goals (explicit)

- No new backend endpoints
- No voting UI in panel
- No changes to APK
- No changes to sidebar nav
- No theme token changes
- No new test runner introduction
- No refactor of unrelated modules (billing, payments, petty-cash)
