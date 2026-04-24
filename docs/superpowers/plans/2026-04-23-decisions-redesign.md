# Decisions Module Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `decisions` module (Presupuestos y Votaciones) in the Next.js panel admin: card-grid list with triage chips, hero + stacked detail with fase-aware primary CTA + overflow menu, polished quote cards + tally chart + photo lightbox, plus small audit gap fixes (error mapping, photo client-side validation) and code cleanup (type `metadata: any`, extract components).

**Architecture:** Refactor-in-place on the existing module. Keep all 8 dialogs + AuditLogDrawer + VotesList + DecisionStatusBadge. Extract pure logic (countdown, phase theme, primary action resolver) to `lib/utils/`. Introduce presentational components `DecisionCard`, `DecisionHero`, `DecisionActions`, `CountdownBadge`, `UrgencyChip`, `ActionFilterChips`, `PhotoLightbox`. Rewrite `QuoteCard` and `TallyCard`. Types stay in existing `/types/models.ts`.

**Tech Stack:** Next.js 16.1.6 · React 19 · TypeScript 5 · Tailwind 4 (Warm Architecture tokens in `app/globals.css`) · Radix UI primitives via `components/ui/*` · react-hook-form + zod · date-fns · Sonner · Axios service layer.

**Spec:** `docs/superpowers/specs/2026-04-23-decisions-redesign-design.md`

**Target branch:** `feature/ui-refinement-and-theme-system` (single PR, 6 sequential commits).

---

## File Structure Map

### Create (new files)

| Path | Responsibility |
|------|----------------|
| `lib/utils/decision-countdown.ts` | Pure: `formatCountdown(deadline: string, isDeadlinePassed: boolean) → { label, urgency }` |
| `lib/utils/decision-phase.ts` | Pure: `getPhaseTheme(status: DecisionStatus) → { gradientClass, label, icon, tone }` |
| `lib/utils/decision-actions.ts` | Pure: `resolvePrimaryAction(decision, activeQuoteCount) → { kind, label } \| null` |
| `components/decisions/CountdownBadge.tsx` | Presentational pill for countdown + urgency |
| `components/decisions/UrgencyChip.tsx` | Single filter chip with label + count + selected state |
| `components/decisions/ActionFilterChips.tsx` | Container for 3 UrgencyChips (Activas / Pendientes acción / Archivadas) |
| `components/decisions/DecisionHero.tsx` | Hero section (gradient + title + countdown + participation + CTA slot) |
| `components/decisions/DecisionActions.tsx` | Primary CTA + `•••` overflow menu, fase-aware |
| `components/decisions/DecisionCard.tsx` | List-page card |
| `components/decisions/DecisionCardSkeleton.tsx` | Loading skeleton for card grid |
| `components/decisions/PhotoLightbox.tsx` | Overlay viewer for decision photo with fresh-signed-URL fetch |

### Edit (existing files)

| Path | Change |
|------|--------|
| `lib/utils/decision-errors.ts` | +2 codes: `NO_VOTES_CAST`, `NO_ACTIVE_QUOTES` |
| `lib/services/decisions.service.ts` | Replace `metadata: any` (lines 39, 106, 141, 168) with typed interface |
| `components/decisions/DecisionDialog.tsx` | Add client-side MIME + 5MB validation + preview thumb for `photo` field |
| `components/decisions/QuoteCard.tsx` | Rewrite: new visual states (winner / tied / not-in-round-2 / deleted / yours) + lightbox for image MIMEs |
| `components/decisions/TallyCard.tsx` | Rewrite: horizontal bar chart + refresh button + empty states for NO_VOTES_CAST / NO_ACTIVE_QUOTES / TIEBREAK |
| `components/decisions/VotesList.tsx` | Add refresh button in header |
| `app/(dashboard)/decisions/page.tsx` | Rewrite: card grid + `ActionFilterChips` + search |
| `app/(dashboard)/decisions/[id]/page.tsx` | Rewrite: compose `DecisionHero` + `DecisionActions` + stacked sections + `PhotoLightbox` + preserve `fromView` query |

### Not touched

`DecisionStatusBadge`, `ExtendDeadlinesDialog`, `CancelDecisionDialog`, `FinalizeConfirmDialog`, `ResolveTiebreakDialog`, `GenerateChargeDialog`, `QuoteUploadDialog`, `QuoteDeleteDialog`, `AuditLogDrawer`, `lib/hooks/usePermissions.tsx`, `lib/contexts/BuildingContext.tsx`, `components/ui/*`, `components/layout/Sidebar.tsx`, `types/models.ts`, theme tokens in `app/globals.css`.

---

## Phase 1 — Error mapping + photo validation

**Commit subject:** `fix(decisions): extend error mapping and validate photo client-side`

### Task 1.1: Add missing error codes

**Files:**
- Modify: `lib/utils/decision-errors.ts`

- [ ] **Step 1: Add `NO_VOTES_CAST` and `NO_ACTIVE_QUOTES` entries**

In `lib/utils/decision-errors.ts`, append these two entries to the `ERROR_MESSAGES` object BEFORE the closing `};` of the 422 block (after `TIEBREAK_MANUAL_NOT_ALLOWED` on line 49–50):

```typescript
    TIEBREAK_MANUAL_NOT_ALLOWED:
        'El desempate manual no está habilitado en este momento.',
    NO_VOTES_CAST:
        'La votación cerró sin votos. Resolvé manual eligiendo ganador o cancelá la decisión.',
    NO_ACTIVE_QUOTES:
        'No quedan cotizaciones activas. Cancelá esta decisión para cerrarla.',
};
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Smoke-check the mapper**

Run:
```bash
rg -n "NO_VOTES_CAST|NO_ACTIVE_QUOTES" lib/utils/decision-errors.ts
```
Expected: both codes appear in the object.

### Task 1.2: Photo client-side validation in create dialog

**Files:**
- Modify: `components/decisions/DecisionDialog.tsx`

The Zod schema currently only validates `photo: z.instanceof(File).optional()`. Add MIME + size refinements AND a preview thumbnail in the form.

- [ ] **Step 1: Extend the Zod schema with photo refinements**

Replace the schema block in `components/decisions/DecisionDialog.tsx` (lines 38–69). Find:
```typescript
const schema = z
    .object({
        building_id: z.string().min(1, 'Selecciona un edificio'),
        title: z
            .string()
            .min(5, 'El título debe tener al menos 5 caracteres')
            .max(200, 'El título no puede superar 200 caracteres'),
        description: z.string().optional(),
        reception_deadline: z.string().min(1, 'La fecha límite de recepción es obligatoria'),
        voting_deadline: z.string().min(1, 'La fecha límite de votación es obligatoria'),
        tiebreak_duration_hours: z.coerce.number().int().min(1).max(720),
        photo: z.instanceof(File).optional(),
    })
    .superRefine((val, ctx) => {
```

Replace with:
```typescript
const DECISION_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const DECISION_PHOTO_MIME_ALLOWED = [
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

const schema = z
    .object({
        building_id: z.string().min(1, 'Selecciona un edificio'),
        title: z
            .string()
            .min(5, 'El título debe tener al menos 5 caracteres')
            .max(200, 'El título no puede superar 200 caracteres'),
        description: z.string().optional(),
        reception_deadline: z.string().min(1, 'La fecha límite de recepción es obligatoria'),
        voting_deadline: z.string().min(1, 'La fecha límite de votación es obligatoria'),
        tiebreak_duration_hours: z.coerce.number().int().min(1).max(720),
        photo: z
            .instanceof(File)
            .optional()
            .refine(
                (f) =>
                    !f ||
                    (DECISION_PHOTO_MIME_ALLOWED as readonly string[]).includes(f.type),
                'Solo se aceptan JPEG, PNG o WebP.',
            )
            .refine(
                (f) => !f || f.size <= DECISION_PHOTO_MAX_BYTES,
                'La foto supera el tamaño máximo de 5 MB.',
            ),
    })
    .superRefine((val, ctx) => {
```

- [ ] **Step 2: Add a preview thumbnail below the photo input**

The photo `FormField` is at lines 268–287. Find:
```typescript
<FormField
    control={form.control}
    name="photo"
    render={({ field: { onChange, value: _value, ...rest } }) => (
        <FormItem>
            <FormLabel>Foto de referencia (opcional)</FormLabel>
            <FormControl>
                <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => onChange(e.target.files?.[0] ?? undefined)}
                    {...rest}
                />
            </FormControl>
            <FormMessage />
        </FormItem>
    )}
/>
```

Replace with:
```typescript
<FormField
    control={form.control}
    name="photo"
    render={({ field: { onChange, value, ...rest } }) => {
        const file = value as File | undefined;
        const previewUrl = file ? URL.createObjectURL(file) : null;
        return (
            <FormItem>
                <FormLabel>Foto de referencia (opcional)</FormLabel>
                <FormControl>
                    <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => onChange(e.target.files?.[0] ?? undefined)}
                        {...rest}
                    />
                </FormControl>
                {previewUrl && file && (
                    <div className="mt-2 flex items-center gap-3 rounded-md border border-border/50 bg-muted/30 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="h-16 w-16 rounded object-cover"
                            onLoad={() => URL.revokeObjectURL(previewUrl)}
                        />
                        <div className="min-w-0 text-xs text-muted-foreground">
                            <p className="truncate font-medium text-foreground">
                                {file.name}
                            </p>
                            <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                )}
                <FormMessage />
            </FormItem>
        );
    }}
/>
```

- [ ] **Step 3: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Manual smoke (run dev server if available)**

1. Open `/decisions` and click "Nueva decisión"
2. Pick a PNG ≤5MB → preview shows, file name + size visible
3. Try a `.gif` → Zod error "Solo se aceptan JPEG, PNG o WebP"
4. Try an image >5MB → Zod error "supera el tamaño máximo de 5 MB"
5. Submit with a valid image → decision created, photo uploaded

### Task 1.3: Commit Phase 1

- [ ] **Step 1: Stage and commit**

```bash
git add lib/utils/decision-errors.ts components/decisions/DecisionDialog.tsx
git commit -m "fix(decisions): extend error mapping and validate photo client-side"
```

---

## Phase 2 — Typing cleanup + pure utilities + CountdownBadge

**Commit subject:** `refactor(decisions): type paginated metadata and extract pure utilities`

### Task 2.1: Type the paginated metadata envelope in decisions.service.ts

**Files:**
- Modify: `lib/services/decisions.service.ts`

The 4 `metadata: any` usages on lines 39, 106, 141, 168 share an identical raw shape. Extract a named interface.

- [ ] **Step 1: Add `RawPaginationMetadata` interface at the top of the file**

In `lib/services/decisions.service.ts`, after the imports (after line 16) and before `interface ListDecisionsParams` (line 18), insert:

```typescript
interface RawPaginationMetadata {
    total?: number;
    page?: number;
    limit?: number;
    total_pages?: number;
    totalPages?: number;
    has_next_page?: boolean;
    has_prev_page?: boolean;
}
```

- [ ] **Step 2: Replace the 4 `metadata: any` usages**

Find (line 39):
```typescript
        const { data } = await apiClient.get<{ items: Decision[]; metadata: any }>(P, { params });
```
Replace with:
```typescript
        const { data } = await apiClient.get<{ items: Decision[]; metadata: RawPaginationMetadata }>(P, { params });
```

Find (line 106):
```typescript
        const { data } = await apiClient.get<{ items: DecisionQuote[]; metadata: any }>(
```
Replace with:
```typescript
        const { data } = await apiClient.get<{ items: DecisionQuote[]; metadata: RawPaginationMetadata }>(
```

Find (line 141):
```typescript
        const { data } = await apiClient.get<{ items: DecisionVote[]; metadata: any }>(
```
Replace with:
```typescript
        const { data } = await apiClient.get<{ items: DecisionVote[]; metadata: RawPaginationMetadata }>(
```

Find (line 168):
```typescript
        const { data } = await apiClient.get<{ items: DecisionAuditEntry[]; metadata: any }>(
```
Replace with:
```typescript
        const { data } = await apiClient.get<{ items: DecisionAuditEntry[]; metadata: RawPaginationMetadata }>(
```

- [ ] **Step 3: Verify there are no remaining `any` usages in this file**

Run:
```bash
rg -n "\\bany\\b" lib/services/decisions.service.ts
```
Expected: no hits (or only hits inside comments if any).

- [ ] **Step 4: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors. Comparisons like `meta.page < (meta.total_pages ?? meta.totalPages)` remain valid because all fields are optional numbers.

### Task 2.2: Create `decision-countdown.ts` utility

**Files:**
- Create: `lib/utils/decision-countdown.ts`

- [ ] **Step 1: Write the utility**

Create `lib/utils/decision-countdown.ts` with:
```typescript
import { differenceInHours, differenceInMinutes, formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';

export type CountdownUrgency = 'safe' | 'warn' | 'danger' | 'expired';

export interface CountdownResult {
    label: string;
    urgency: CountdownUrgency;
    isExpired: boolean;
}

/**
 * Computes a human label + urgency level for a decision phase deadline.
 *
 * - `safe`: more than 7 days remaining
 * - `warn`: between 24h and 7 days remaining
 * - `danger`: less than 24h remaining (and not expired)
 * - `expired`: deadline has passed (caller decides how to render based on isDeadlinePassed flag from backend)
 */
export function formatCountdown(
    deadlineIso: string,
    isDeadlinePassedFromBackend: boolean = false,
): CountdownResult {
    const deadline = new Date(deadlineIso);
    const now = new Date();
    const minutesLeft = differenceInMinutes(deadline, now);
    const hoursLeft = differenceInHours(deadline, now);
    const isExpired = minutesLeft <= 0 || isDeadlinePassedFromBackend;

    if (isExpired) {
        return {
            label: 'Plazo vencido',
            urgency: 'expired',
            isExpired: true,
        };
    }

    const distance = formatDistanceStrict(deadline, now, {
        locale: es,
        addSuffix: false,
    });

    if (hoursLeft < 24) {
        return { label: `⏱ ${distance}`, urgency: 'danger', isExpired: false };
    }

    if (hoursLeft < 24 * 7) {
        return { label: `⏱ ${distance}`, urgency: 'warn', isExpired: false };
    }

    return { label: `En ${distance}`, urgency: 'safe', isExpired: false };
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 2.3: Create `decision-phase.ts` utility

**Files:**
- Create: `lib/utils/decision-phase.ts`

- [ ] **Step 1: Write the utility**

Create `lib/utils/decision-phase.ts`:
```typescript
import type { DecisionStatus } from '@/types/models';
import { Clock, Vote, AlertTriangle, CheckCircle2, XCircle, LucideIcon } from 'lucide-react';

export interface PhaseTheme {
    label: string;
    icon: LucideIcon;
    /**
     * Tailwind class for a gradient background that reads on white text.
     * Used on Hero and list Card variants where white text sits on the gradient.
     */
    gradientClass: string;
    /**
     * Muted tone class for non-gradient surfaces (chips, card borders),
     * using theme tokens so it respects dark mode.
     */
    toneClass: string;
    /** Short tone identifier for programmatic decisions. */
    tone: 'amber' | 'hot' | 'warning' | 'success' | 'muted';
}

const THEMES: Record<DecisionStatus, PhaseTheme> = {
    RECEPTION: {
        label: 'Recepción',
        icon: Clock,
        gradientClass: 'bg-gradient-to-br from-amber-700 to-amber-900',
        toneClass: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
        tone: 'amber',
    },
    VOTING: {
        label: 'Votación',
        icon: Vote,
        gradientClass: 'bg-gradient-to-br from-amber-600 to-orange-800',
        toneClass: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
        tone: 'hot',
    },
    TIEBREAK_PENDING: {
        label: 'Empate pendiente',
        icon: AlertTriangle,
        gradientClass: 'bg-gradient-to-br from-yellow-500 to-amber-700',
        toneClass: 'bg-yellow-50 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200',
        tone: 'warning',
    },
    RESOLVED: {
        label: 'Resuelta',
        icon: CheckCircle2,
        gradientClass: 'bg-gradient-to-br from-emerald-700 to-emerald-900',
        toneClass: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
        tone: 'success',
    },
    CANCELLED: {
        label: 'Cancelada',
        icon: XCircle,
        gradientClass: 'bg-gradient-to-br from-stone-600 to-stone-800',
        toneClass: 'bg-stone-100 text-stone-700 dark:bg-stone-900/60 dark:text-stone-300',
        tone: 'muted',
    },
};

export function getPhaseTheme(status: DecisionStatus): PhaseTheme {
    return THEMES[status];
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 2.4: Create `decision-actions.ts` utility

**Files:**
- Create: `lib/utils/decision-actions.ts`

- [ ] **Step 1: Write the utility**

Create `lib/utils/decision-actions.ts`:
```typescript
import type { Decision } from '@/types/models';

export type PrimaryActionKind =
    | 'upload-first-quote'
    | 'finalize-reception'
    | 'finalize-voting-early'
    | 'finalize-voting-now'
    | 'resolve-tiebreak'
    | 'generate-charge'
    | 'view-charge'
    | null;

export interface PrimaryAction {
    kind: Exclude<PrimaryActionKind, null>;
    label: string;
    /**
     * 'solid'  = primary, prominent (CTA color)
     * 'outline' = optional-early action (less prominent)
     * 'link'   = navigation action (e.g. "Ver cargo →")
     */
    variant: 'solid' | 'outline' | 'link';
}

/**
 * Decides the primary CTA to show in the decision detail hero, based on the
 * current phase + derived signals (active quote count, deadline passed, charge generated).
 *
 * Returns `null` when no primary action applies (e.g. CANCELLED, or user has no manage permission).
 * The caller is responsible for gating `null` by permissions (this function doesn't know about roles).
 */
export function resolvePrimaryAction(
    decision: Decision,
    activeQuoteCount: number,
): PrimaryAction | null {
    switch (decision.status) {
        case 'RECEPTION':
            if (activeQuoteCount === 0) {
                return {
                    kind: 'upload-first-quote',
                    label: 'Subir primera cotización',
                    variant: 'solid',
                };
            }
            return {
                kind: 'finalize-reception',
                label: 'Finalizar recepción → Abrir votación',
                variant: 'solid',
            };
        case 'VOTING':
            if (decision.is_deadline_passed) {
                return {
                    kind: 'finalize-voting-now',
                    label: 'Finalizar votación',
                    variant: 'solid',
                };
            }
            return {
                kind: 'finalize-voting-early',
                label: 'Finalizar votación ahora',
                variant: 'outline',
            };
        case 'TIEBREAK_PENDING':
            return {
                kind: 'resolve-tiebreak',
                label: 'Resolver empate',
                variant: 'solid',
            };
        case 'RESOLVED':
            if (!decision.resulting_id) {
                return {
                    kind: 'generate-charge',
                    label: 'Generar cargo',
                    variant: 'solid',
                };
            }
            return {
                kind: 'view-charge',
                label: 'Ver cargo →',
                variant: 'link',
            };
        case 'CANCELLED':
            return null;
    }
}

/**
 * Returns the deep-link route for a resolved decision's charge.
 * Falls back to `/decisions/{id}` if resulting_id/type missing.
 */
export function getChargeDeepLink(decision: Decision): string {
    if (!decision.resulting_id || !decision.resulting_type) {
        return `/decisions/${decision.id}`;
    }
    if (decision.resulting_type === 'INVOICE') {
        return `/billing/invoices/${decision.resulting_id}`;
    }
    // ASSESSMENT — route prefix is confirmed during Phase 4 QA; default kept consistent with finances module
    return `/finances/petty-cash/assessments/${decision.resulting_id}`;
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 2.5: Create `CountdownBadge` component

**Files:**
- Create: `components/decisions/CountdownBadge.tsx`

- [ ] **Step 1: Write the component**

Create `components/decisions/CountdownBadge.tsx`:
```typescript
import { cn } from '@/lib/utils';
import { formatCountdown } from '@/lib/utils/decision-countdown';
import { AlertTriangle } from 'lucide-react';

interface CountdownBadgeProps {
    deadline: string;
    isDeadlinePassed?: boolean;
    /**
     * When true the badge is shown even if the phase is already closed.
     * Default false — expired+closed returns hidden.
     */
    renderWhenClosed?: boolean;
    /** Extra classes (e.g. text size overrides on hero). */
    className?: string;
}

const URGENCY_CLASSES = {
    safe: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
    danger: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
    expired: 'bg-red-600 text-white',
} as const;

export function CountdownBadge({
    deadline,
    isDeadlinePassed = false,
    renderWhenClosed = false,
    className,
}: CountdownBadgeProps) {
    const { label, urgency, isExpired } = formatCountdown(deadline, isDeadlinePassed);

    if (isExpired && !isDeadlinePassed && !renderWhenClosed) {
        return null;
    }

    const tone =
        urgency === 'expired'
            ? 'Pendiente finalize'
            : label;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                URGENCY_CLASSES[urgency],
                className,
            )}
        >
            {urgency === 'expired' && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
            <span>{urgency === 'expired' ? `⚠ ${tone}` : tone}</span>
        </span>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 2.6: Commit Phase 2

- [ ] **Step 1: Stage and commit**

```bash
git add lib/services/decisions.service.ts \
        lib/utils/decision-countdown.ts \
        lib/utils/decision-phase.ts \
        lib/utils/decision-actions.ts \
        components/decisions/CountdownBadge.tsx
git commit -m "refactor(decisions): type paginated metadata and extract pure utilities"
```

---

## Phase 3 — Detail page: Hero + Actions + fase-aware CTA

**Commit subject:** `feat(decisions/detail): hero with gradient and fase-aware primary CTA + overflow`

### Task 3.1: Create `DecisionActions` component

**Files:**
- Create: `components/decisions/DecisionActions.tsx`

- [ ] **Step 1: Write the component**

Create `components/decisions/DecisionActions.tsx`:
```typescript
'use client';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    resolvePrimaryAction,
    getChargeDeepLink,
    type PrimaryAction,
} from '@/lib/utils/decision-actions';
import type { Decision } from '@/types/models';
import { Clock, FileText, History, MoreHorizontal, Upload, XCircle } from 'lucide-react';
import Link from 'next/link';

export interface DecisionActionsHandlers {
    onUploadQuote: () => void;
    onExtendDeadlines: () => void;
    onFinalize: () => void;
    onResolveTiebreak: () => void;
    onGenerateCharge: () => void;
    onCancel: () => void;
    onOpenAuditLog: () => void;
}

interface DecisionActionsProps {
    decision: Decision;
    activeQuoteCount: number;
    /** If false, both primary CTA and overflow are hidden (read-only mode). */
    canManage: boolean;
    handlers: DecisionActionsHandlers;
    /** Applies on the primary CTA only — caller can size it to match the hero layout. */
    primaryClassName?: string;
}

function dispatchPrimary(
    action: PrimaryAction,
    decision: Decision,
    handlers: DecisionActionsHandlers,
) {
    switch (action.kind) {
        case 'upload-first-quote':
            handlers.onUploadQuote();
            return;
        case 'finalize-reception':
        case 'finalize-voting-early':
        case 'finalize-voting-now':
            handlers.onFinalize();
            return;
        case 'resolve-tiebreak':
            handlers.onResolveTiebreak();
            return;
        case 'generate-charge':
            handlers.onGenerateCharge();
            return;
        case 'view-charge':
            // handled via Link below
            return;
    }
}

export function DecisionActions({
    decision,
    activeQuoteCount,
    canManage,
    handlers,
    primaryClassName,
}: DecisionActionsProps) {
    if (!canManage) return null;

    const primary = resolvePrimaryAction(decision, activeQuoteCount);
    const isTerminal =
        decision.status === 'CANCELLED' || decision.status === 'RESOLVED';
    const canExtend =
        decision.status === 'RECEPTION' || decision.status === 'VOTING';
    const canUploadFromOverflow =
        decision.status === 'RECEPTION' && activeQuoteCount > 0;
    const canCancel = !isTerminal;

    return (
        <div className="flex items-center gap-2">
            {primary && primary.kind === 'view-charge' && (
                <Button asChild className={primaryClassName}>
                    <Link href={getChargeDeepLink(decision)}>{primary.label}</Link>
                </Button>
            )}
            {primary && primary.kind !== 'view-charge' && (
                <Button
                    variant={primary.variant === 'outline' ? 'outline' : 'default'}
                    onClick={() => dispatchPrimary(primary, decision, handlers)}
                    className={cn(
                        primary.variant === 'solid'
                            ? 'bg-white text-amber-800 hover:bg-white/90'
                            : 'border-white/40 bg-transparent text-white hover:bg-white/10',
                        primaryClassName,
                    )}
                >
                    {primary.label}
                </Button>
            )}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Más acciones"
                        className="text-white hover:bg-white/10"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    {canExtend && (
                        <DropdownMenuItem onSelect={handlers.onExtendDeadlines}>
                            <Clock className="mr-2 h-4 w-4" /> Extender deadlines
                        </DropdownMenuItem>
                    )}
                    {canUploadFromOverflow && (
                        <DropdownMenuItem onSelect={handlers.onUploadQuote}>
                            <Upload className="mr-2 h-4 w-4" /> Subir cotización
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={handlers.onOpenAuditLog}>
                        <History className="mr-2 h-4 w-4" /> Ver auditoría
                    </DropdownMenuItem>
                    {canCancel && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={handlers.onCancel}
                                className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                            >
                                <XCircle className="mr-2 h-4 w-4" /> Cancelar decisión
                            </DropdownMenuItem>
                        </>
                    )}
                    {primary?.kind === 'view-charge' && (
                        <DropdownMenuItem disabled>
                            <FileText className="mr-2 h-4 w-4" />
                            Cargo ya generado
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 3.2: Create `DecisionHero` component

**Files:**
- Create: `components/decisions/DecisionHero.tsx`

- [ ] **Step 1: Write the component**

Create `components/decisions/DecisionHero.tsx`:
```typescript
'use client';

import { CountdownBadge } from '@/components/decisions/CountdownBadge';
import { cn } from '@/lib/utils';
import { getPhaseTheme } from '@/lib/utils/decision-phase';
import type { Decision, DecisionTally } from '@/types/models';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { useState } from 'react';

interface DecisionHeroProps {
    decision: Decision;
    tally: DecisionTally | null;
    /** Optional slot to render primary CTA + overflow on the right side of the hero. */
    actionsSlot?: React.ReactNode;
    /** Invoked when the photo thumbnail is clicked. Host page shows the lightbox. */
    onPhotoClick?: () => void;
    buildingLabel?: string;
}

export function DecisionHero({
    decision,
    tally,
    actionsSlot,
    onPhotoClick,
    buildingLabel,
}: DecisionHeroProps) {
    const theme = getPhaseTheme(decision.status);
    const Icon = theme.icon;
    const [photoError, setPhotoError] = useState(false);

    const titleClass = cn(
        'text-2xl font-semibold leading-tight text-white',
        decision.status === 'CANCELLED' && 'line-through opacity-90',
    );

    const showParticipation =
        (decision.status === 'VOTING' || decision.status === 'TIEBREAK_PENDING') &&
        tally &&
        tally.total_apartments > 0;

    const roundLabel =
        decision.current_round > 1
            ? `· Ronda ${decision.current_round}`
            : '';

    return (
        <section
            className={cn(
                'relative overflow-hidden rounded-xl p-6 text-white shadow-lg',
                theme.gradientClass,
                decision.status === 'TIEBREAK_PENDING' && 'ring-2 ring-amber-300/80',
            )}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                    {decision.photo_url && !photoError && (
                        <button
                            type="button"
                            onClick={onPhotoClick}
                            aria-label="Ver foto de la decisión"
                            className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-white/30 bg-white/10 transition hover:ring-2 hover:ring-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={decision.photo_url}
                                alt="Foto de la decisión"
                                className="h-full w-full object-cover"
                                onError={() => setPhotoError(true)}
                            />
                        </button>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/80">
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                                {theme.label} {roundLabel}
                            </span>
                        </div>
                        <h2 className={titleClass}>{decision.title}</h2>
                        {buildingLabel && (
                            <p className="mt-1 text-sm text-white/80">{buildingLabel}</p>
                        )}
                    </div>
                </div>
                {actionsSlot && (
                    <div className="flex items-center gap-2">{actionsSlot}</div>
                )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/90">
                {decision.status === 'RECEPTION' && (
                    <CountdownBadge
                        deadline={decision.reception_deadline}
                        isDeadlinePassed={decision.is_deadline_passed}
                    />
                )}
                {(decision.status === 'VOTING' ||
                    decision.status === 'TIEBREAK_PENDING') && (
                    <CountdownBadge
                        deadline={decision.voting_deadline}
                        isDeadlinePassed={decision.is_deadline_passed}
                    />
                )}
                {decision.status === 'RESOLVED' && decision.finalized_at && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                        ✓ Finalizada
                    </span>
                )}
                {decision.status === 'CANCELLED' && decision.cancel_reason && (
                    <span className="text-xs text-white/80">
                        Motivo: {decision.cancel_reason}
                    </span>
                )}
            </div>

            {showParticipation && (
                <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-white/85">
                        <span>
                            {tally.total_votes}/{tally.total_apartments} aptos votaron
                        </span>
                        <span>{Math.round(tally.participation_pct)}%</span>
                    </div>
                    <Progress
                        value={Math.min(100, tally.participation_pct)}
                        className="h-2 bg-white/20 [&>div]:bg-white"
                    />
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors. If the `Progress` component doesn't accept the child selector override, fall back to removing `[&>div]:bg-white` — visually fine with default primary tint.

### Task 3.3: Integrate hero + actions into the detail page

**Files:**
- Modify: `app/(dashboard)/decisions/[id]/page.tsx`

The detail page currently inlines the header card, status badges, deadlines, and action toolbar. Replace those with `DecisionHero` (wrapping `DecisionActions` via the `actionsSlot`), preserving the rest of the page as-is for now (content sections handled in Phase 5).

- [ ] **Step 1: Add new imports**

At the top of `app/(dashboard)/decisions/[id]/page.tsx`, add (or merge with existing imports):

```typescript
import { DecisionHero } from '@/components/decisions/DecisionHero';
import { DecisionActions } from '@/components/decisions/DecisionActions';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
```

Remove any now-unused imports (`DecisionStatusBadge` stays for section badges in the body; `Badge`, `CheckCircle2`, `Clock`, `AlertTriangle` imports from lucide-react can be evaluated for removal after the replacement).

- [ ] **Step 2: Replace the existing header card + action toolbar**

In the JSX return, find the section currently rendering the status header + action buttons (approximately lines 128–305 in the current file — the block that starts with the "Volver" link through the closing of the action toolbar). Replace only the status-header Card and the action toolbar with the hero composition, KEEPING the "Volver" link above:

```typescript
{/* existing Back button stays as-is */}
<div className="mb-4">
    <Button asChild variant="ghost" size="sm">
        <Link href={`/decisions${fromView ? `?view=${fromView}` : ''}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Presupuestos
        </Link>
    </Button>
</div>

<DecisionHero
    decision={decision}
    tally={tally}
    buildingLabel={
        availableBuildings.find((b) => b.id === decision.building_id)?.name ??
        undefined
    }
    onPhotoClick={() => setLightboxOpen(true)}
    actionsSlot={
        <DecisionActions
            decision={decision}
            activeQuoteCount={quotes.filter((q) => !q.deleted_at).length}
            canManage={canManageDecisions(decision.building_id)}
            handlers={{
                onUploadQuote: () => setQuoteUploadOpen(true),
                onExtendDeadlines: () => setExtendOpen(true),
                onFinalize: () => setFinalizeOpen(true),
                onResolveTiebreak: () => setTiebreakOpen(true),
                onGenerateCharge: () => setChargeOpen(true),
                onCancel: () => setCancelOpen(true),
                onOpenAuditLog: () => setAuditOpen(true),
            }}
        />
    }
/>
```

- [ ] **Step 3: Read and preserve `fromView` query param**

Near the top of the component body (after `useParams`), add:
```typescript
const searchParams = useSearchParams();
const fromView = searchParams.get('view') || '';
```

Import:
```typescript
import { useParams, useSearchParams } from 'next/navigation';
```

- [ ] **Step 4: Add `lightboxOpen` state (placeholder used by Phase 5 component)**

Near the other `useState` declarations add:
```typescript
const [lightboxOpen, setLightboxOpen] = useState(false);
```

It does nothing visible yet; Phase 5 wires the lightbox. For now the click is a harmless state toggle.

- [ ] **Step 5: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors. Any unused-import warnings should be cleaned up.

- [ ] **Step 6: Manual visual check**

1. Open a decision in any of the 5 phases.
2. Hero shows: gradient per phase, title, countdown (where applicable), participation bar (in VOTING/TIEBREAK), primary CTA per matrix, `•••` overflow with phase-appropriate items.
3. Board member on other building sees no actions.
4. Cancel visible red + separator in overflow for non-terminal phases.
5. "Ver cargo →" links out to billing/petty-cash when RESOLVED and resulting_id present.
6. Photo thumb visible and clickable (lightbox not yet functional, OK).

### Task 3.4: Commit Phase 3

- [ ] **Step 1: Stage and commit**

```bash
git add components/decisions/DecisionActions.tsx \
        components/decisions/DecisionHero.tsx \
        app/\(dashboard\)/decisions/\[id\]/page.tsx
git commit -m "feat(decisions/detail): hero with gradient and fase-aware primary CTA + overflow"
```

---

## Phase 4 — List page: card grid + urgency chips

**Commit subject:** `feat(decisions/list): card grid with triage chips and urgency signaling`

### Task 4.1: Create `UrgencyChip` component

**Files:**
- Create: `components/decisions/UrgencyChip.tsx`

- [ ] **Step 1: Write the component**

Create `components/decisions/UrgencyChip.tsx`:
```typescript
'use client';

import { cn } from '@/lib/utils';

interface UrgencyChipProps {
    label: string;
    count?: number;
    selected?: boolean;
    onClick: () => void;
    tone?: 'default' | 'danger' | 'neutral';
}

const TONE_CLASSES = {
    default: {
        selected: 'bg-primary text-primary-foreground border-primary',
        idle: 'bg-card text-foreground border-border hover:bg-muted/50',
    },
    danger: {
        selected: 'bg-red-600 text-white border-red-600',
        idle:
            'bg-card text-red-800 border-red-300 hover:bg-red-50 dark:text-red-300 dark:border-red-900/50 dark:hover:bg-red-950/30',
    },
    neutral: {
        selected: 'bg-stone-700 text-white border-stone-700',
        idle: 'bg-card text-muted-foreground border-border hover:bg-muted/50',
    },
} as const;

export function UrgencyChip({
    label,
    count,
    selected = false,
    onClick,
    tone = 'default',
}: UrgencyChipProps) {
    const palette = TONE_CLASSES[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                selected ? palette.selected : palette.idle,
            )}
        >
            <span>{label}</span>
            {typeof count === 'number' && (
                <span
                    className={cn(
                        'inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 text-[10px] font-semibold',
                        selected
                            ? 'bg-white/25 text-white'
                            : 'bg-muted text-muted-foreground',
                    )}
                >
                    {count}
                </span>
            )}
        </button>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 4.2: Create `ActionFilterChips` container

**Files:**
- Create: `components/decisions/ActionFilterChips.tsx`

- [ ] **Step 1: Write the container**

Create `components/decisions/ActionFilterChips.tsx`:
```typescript
'use client';

import type { Decision } from '@/types/models';
import { UrgencyChip } from '@/components/decisions/UrgencyChip';
import { differenceInHours } from 'date-fns';

export type DecisionView = 'activas' | 'pendientes' | 'archivadas';

interface ActionFilterChipsProps {
    decisions: Decision[];
    selected: DecisionView;
    onChange: (view: DecisionView) => void;
}

export function filterByView(decisions: Decision[], view: DecisionView): Decision[] {
    const now = new Date();
    return decisions.filter((d) => {
        const isOpen = d.status === 'RECEPTION' || d.status === 'VOTING';
        const isTiebreak = d.status === 'TIEBREAK_PENDING';
        const resolvedNeedsCharge =
            d.status === 'RESOLVED' && !d.resulting_id;
        const resolvedCharged =
            d.status === 'RESOLVED' && !!d.resulting_id;
        const cancelled = d.status === 'CANCELLED';

        const votingCloseSoon =
            d.status === 'VOTING' &&
            differenceInHours(new Date(d.voting_deadline), now) < 24 &&
            !d.is_deadline_passed;

        const requiresAction =
            isTiebreak || resolvedNeedsCharge || votingCloseSoon || d.is_deadline_passed;

        if (view === 'activas') return isOpen || isTiebreak;
        if (view === 'pendientes') return requiresAction;
        return cancelled || resolvedCharged; // archivadas
    });
}

export function ActionFilterChips({
    decisions,
    selected,
    onChange,
}: ActionFilterChipsProps) {
    const activasCount = filterByView(decisions, 'activas').length;
    const pendientesCount = filterByView(decisions, 'pendientes').length;
    const archivadasCount = filterByView(decisions, 'archivadas').length;

    return (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filtro de decisiones">
            <UrgencyChip
                label="Activas"
                count={activasCount}
                selected={selected === 'activas'}
                onClick={() => onChange('activas')}
            />
            <UrgencyChip
                label="Pendientes acción"
                count={pendientesCount}
                selected={selected === 'pendientes'}
                onClick={() => onChange('pendientes')}
                tone="danger"
            />
            <UrgencyChip
                label="Archivadas"
                count={archivadasCount}
                selected={selected === 'archivadas'}
                onClick={() => onChange('archivadas')}
                tone="neutral"
            />
        </div>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 4.3: Create `DecisionCard`

**Files:**
- Create: `components/decisions/DecisionCard.tsx`

- [ ] **Step 1: Write the component**

Create `components/decisions/DecisionCard.tsx`:
```typescript
'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CountdownBadge } from '@/components/decisions/CountdownBadge';
import { getPhaseTheme } from '@/lib/utils/decision-phase';
import { formatCurrency } from '@/lib/utils/format';
import type { Decision, DecisionTallyEntry } from '@/types/models';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Trophy, Vote } from 'lucide-react';

interface DecisionCardProps {
    decision: Decision;
    /** Winner entry from the tally (optional — only present for RESOLVED when we have tally data). */
    winnerTally?: DecisionTallyEntry | null;
    /** Shown under title in admin global view. Pass undefined when the user is board of a specific building. */
    buildingLabel?: string;
    /** Preserve triage chip state on back-nav. */
    hrefSuffix?: string;
}

export function DecisionCard({
    decision,
    winnerTally,
    buildingLabel,
    hrefSuffix = '',
}: DecisionCardProps) {
    const theme = getPhaseTheme(decision.status);
    const PhaseIcon = theme.icon;

    const isLivingPhase =
        decision.status === 'RECEPTION' || decision.status === 'VOTING';
    const isVoting = decision.status === 'VOTING';
    const isResolvedCharged =
        decision.status === 'RESOLVED' && !!decision.resulting_id;
    const isResolvedPendingCharge =
        decision.status === 'RESOLVED' && !decision.resulting_id;
    const isCancelled = decision.status === 'CANCELLED';
    const isTiebreak = decision.status === 'TIEBREAK_PENDING';

    const useGradient = isVoting; // list cards match detail hero palette on the "hot" phase only

    const shell = cn(
        'group block overflow-hidden rounded-xl border transition hover:shadow-md',
        isCancelled && 'bg-stone-100 opacity-70 dark:bg-stone-900/60',
        !isCancelled &&
            !useGradient &&
            'border-border/60 bg-card hover:border-border',
        useGradient &&
            'border-transparent bg-gradient-to-br from-amber-600 to-amber-900 text-white hover:shadow-lg',
        isTiebreak && 'ring-2 ring-amber-400/70',
    );

    const titleClass = cn(
        'text-base font-semibold leading-snug',
        useGradient ? 'text-white' : 'text-foreground',
        isCancelled && 'line-through',
    );

    const deadlineIso =
        decision.status === 'RECEPTION'
            ? decision.reception_deadline
            : decision.status === 'VOTING' || decision.status === 'TIEBREAK_PENDING'
              ? decision.voting_deadline
              : null;

    return (
        <Link href={`/decisions/${decision.id}${hrefSuffix}`} className={shell}>
            <div className="flex flex-col gap-3 p-4">
                {/* Header row: phase/round + countdown */}
                <div className="flex items-start justify-between gap-2">
                    <div
                        className={cn(
                            'inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider',
                            useGradient ? 'text-white/85' : 'text-muted-foreground',
                        )}
                    >
                        <PhaseIcon className="h-3 w-3" aria-hidden="true" />
                        <span>
                            {theme.label}
                            {decision.current_round > 1 &&
                                ` · R${decision.current_round}`}
                        </span>
                    </div>
                    {deadlineIso && (
                        <CountdownBadge
                            deadline={deadlineIso}
                            isDeadlinePassed={decision.is_deadline_passed}
                        />
                    )}
                </div>

                {/* Photo thumb */}
                <div className="flex items-start gap-3">
                    <div
                        className={cn(
                            'flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg',
                            useGradient
                                ? 'bg-white/10'
                                : 'bg-muted',
                        )}
                    >
                        {decision.photo_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={decision.photo_url}
                                alt=""
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <Vote
                                className={cn(
                                    'h-6 w-6',
                                    useGradient ? 'text-white/70' : 'text-muted-foreground',
                                )}
                                aria-hidden="true"
                            />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className={titleClass}>{decision.title}</h3>
                        {buildingLabel && (
                            <p
                                className={cn(
                                    'mt-0.5 text-xs',
                                    useGradient ? 'text-white/80' : 'text-muted-foreground',
                                )}
                            >
                                {buildingLabel}
                            </p>
                        )}
                    </div>
                </div>

                {/* Phase-specific metadata */}
                <div
                    className={cn(
                        'space-y-1.5 text-xs',
                        useGradient ? 'text-white/90' : 'text-muted-foreground',
                    )}
                >
                    {isLivingPhase && (
                        <p>📋 {decision.quote_count} cotización{decision.quote_count === 1 ? '' : 'es'}</p>
                    )}
                    {isTiebreak && (
                        <p className="inline-flex items-center gap-1 text-amber-900 dark:text-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            Empate en ronda {decision.current_round} — resolvé manual
                        </p>
                    )}
                    {isResolvedPendingCharge && winnerTally && (
                        <p className="text-amber-800 dark:text-amber-300">
                            <Trophy className="mr-1 inline h-3 w-3" />
                            {winnerTally.provider_name} — {formatCurrency(winnerTally.amount)}
                            <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                                Pendiente cargo
                            </span>
                        </p>
                    )}
                    {isResolvedCharged && winnerTally && (
                        <p>
                            <Trophy className="mr-1 inline h-3 w-3" />
                            {winnerTally.provider_name} — {formatCurrency(winnerTally.amount)}
                        </p>
                    )}
                    {isCancelled && decision.cancel_reason && (
                        <p className="line-clamp-2">Motivo: {decision.cancel_reason}</p>
                    )}
                </div>
            </div>
        </Link>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors. If `formatCurrency` lives elsewhere than `lib/utils/format`, adjust the import (search with `rg -n "export.*formatCurrency" lib/`).

### Task 4.4: Create `DecisionCardSkeleton`

**Files:**
- Create: `components/decisions/DecisionCardSkeleton.tsx`

- [ ] **Step 1: Write the component**

Create `components/decisions/DecisionCardSkeleton.tsx`:
```typescript
import { Skeleton } from '@/components/ui/skeletons';

export function DecisionCardSkeleton() {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <div className="flex items-start gap-3">
                <Skeleton className="h-14 w-14 rounded-lg" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <Skeleton className="h-3 w-2/3" />
        </div>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 4.5: Rewrite the list page

**Files:**
- Modify: `app/(dashboard)/decisions/page.tsx`

- [ ] **Step 1: Replace the entire file**

Overwrite `app/(dashboard)/decisions/page.tsx` with:
```typescript
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Paginator } from '@/components/ui/paginator';
import { EmptyState } from '@/components/ui/empty-state';
import { ActionFilterChips, filterByView, type DecisionView } from '@/components/decisions/ActionFilterChips';
import { DecisionCard } from '@/components/decisions/DecisionCard';
import { DecisionCardSkeleton } from '@/components/decisions/DecisionCardSkeleton';
import { DecisionDialog } from '@/components/decisions/DecisionDialog';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { toast } from 'sonner';
import { Plus, Search, Vote } from 'lucide-react';
import type { Decision, PaginationMetadata } from '@/types/models';

const PAGE_LIMIT = 24; // 8 rows × 3 columns at desktop

export default function DecisionsListPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const viewFromUrl = (searchParams.get('view') as DecisionView) || 'activas';

    const { isSuperAdmin } = usePermissions();
    const { selectedBuildingId, availableBuildings } = useBuildingContext();

    const [allDecisions, setAllDecisions] = useState<Decision[]>([]);
    const [metadata, setMetadata] = useState<PaginationMetadata | null>(null);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<DecisionView>(viewFromUrl);
    const [titleInput, setTitleInput] = useState('');
    const [search, setSearch] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const effectiveBuildingId = isSuperAdmin ? selectedBuildingId : selectedBuildingId;

    // Load a broad page so client-side chip filtering is stable. Adjust if data grows.
    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await decisionsService.list({
                building_id: effectiveBuildingId ?? undefined,
                search: search || undefined,
                page,
                limit: PAGE_LIMIT,
            });
            setAllDecisions(res.data);
            setMetadata(res.metadata);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
            setAllDecisions([]);
            setMetadata(null);
        } finally {
            setIsLoading(false);
        }
    }, [effectiveBuildingId, search, page]);

    useEffect(() => {
        load();
    }, [load]);

    // Sync view → URL (?view=) so back-nav from detail preserves it
    useEffect(() => {
        const current = searchParams.get('view') || 'activas';
        if (current !== view) {
            const sp = new URLSearchParams(searchParams.toString());
            sp.set('view', view);
            router.replace(`/decisions?${sp.toString()}`, { scroll: false });
        }
    }, [view, searchParams, router]);

    const filtered = useMemo(
        () => filterByView(allDecisions, view),
        [allDecisions, view],
    );

    const canCreate = isSuperAdmin || !!effectiveBuildingId;

    const emptyMessage: Record<DecisionView, { title: string; description: string; showCta: boolean }> = {
        activas: {
            title: 'Ninguna decisión activa',
            description: '¿Creamos una?',
            showCta: true,
        },
        pendientes: {
            title: '✓ Todo al día',
            description: 'No hay decisiones pendientes de acción.',
            showCta: false,
        },
        archivadas: {
            title: 'Sin historial aún',
            description: 'Acá vas a ver decisiones cerradas o canceladas.',
            showCta: false,
        },
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">Presupuestos</h1>
                    <p className="text-sm text-muted-foreground">
                        Decisiones con cotizaciones competitivas y votación de apartamentos.
                    </p>
                </div>
                {canCreate && (
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva decisión
                    </Button>
                )}
            </header>

            {isSuperAdmin && !effectiveBuildingId && (
                <Card className="border-amber-400/40 bg-amber-50/50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    Vista global: se listan decisiones de todos los edificios.
                </Card>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ActionFilterChips
                    decisions={allDecisions}
                    selected={view}
                    onChange={(v) => {
                        setPage(1);
                        setView(v);
                    }}
                />
                <form
                    className="relative w-full sm:w-64"
                    onSubmit={(e) => {
                        e.preventDefault();
                        setPage(1);
                        setSearch(titleInput.trim());
                    }}
                >
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        placeholder="Buscar por título…"
                        className="pl-9"
                    />
                </form>
            </div>

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <DecisionCardSkeleton key={i} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={Vote}
                    title={emptyMessage[view].title}
                    description={emptyMessage[view].description}
                    action={
                        emptyMessage[view].showCta && canCreate ? (
                            <Button onClick={() => setIsCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Crear decisión
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((decision) => (
                        <DecisionCard
                            key={decision.id}
                            decision={decision}
                            buildingLabel={
                                isSuperAdmin
                                    ? availableBuildings.find(
                                          (b) => b.id === decision.building_id,
                                      )?.name
                                    : undefined
                            }
                            hrefSuffix={`?view=${view}`}
                        />
                    ))}
                </div>
            )}

            {metadata && metadata.totalPages > 1 && (
                <Paginator
                    page={metadata.page}
                    totalPages={metadata.totalPages}
                    onChange={(p) => setPage(p)}
                />
            )}

            {canCreate && (
                <DecisionDialog
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    buildingId={effectiveBuildingId ?? undefined}
                    availableBuildings={availableBuildings}
                    onCreated={() => load()}
                />
            )}
        </div>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

If `EmptyState`'s `action` prop or `Paginator`'s prop names don't match (e.g., prop is `onPageChange` not `onChange`), adjust using the actual component signature. The existing list page's imports (from the pre-rewrite file) are the reference for prop names.

- [ ] **Step 3: Manual visual check**

1. `/decisions` loads with 3 chips: Activas selected, counts visible.
2. Default tab Activas renders cards for RECEPTION + VOTING + TIEBREAK_PENDING items.
3. Click "Pendientes acción" → only cards that need attention (tiebreak, deadline <24h, resolved-no-charge) appear; chip count updates.
4. Click "Archivadas" → RESOLVED+charged + CANCELLED appear.
5. Click a card → detail page, URL includes `?view=activas` (or whichever chip was active).
6. Back button on detail respects the chip.
7. Empty state visible for an empty chip.
8. Search filter reloads when submitted.
9. Responsive grid: 1 col mobile, 2 tablet, 3 desktop.
10. Light/dark mode both legible.

### Task 4.6: Commit Phase 4

- [ ] **Step 1: Stage and commit**

```bash
git add components/decisions/UrgencyChip.tsx \
        components/decisions/ActionFilterChips.tsx \
        components/decisions/DecisionCard.tsx \
        components/decisions/DecisionCardSkeleton.tsx \
        app/\(dashboard\)/decisions/page.tsx
git commit -m "feat(decisions/list): card grid with triage chips and urgency signaling"
```

---

## Phase 5 — Detail content: QuoteCard + TallyCard + Lightbox + refresh

**Commit subject:** `feat(decisions/detail): quote card states, tally chart, photo lightbox, refresh controls`

### Task 5.1: Rewrite `QuoteCard`

**Files:**
- Modify: `components/decisions/QuoteCard.tsx`

- [ ] **Step 1: Replace the component**

Overwrite `components/decisions/QuoteCard.tsx` with:
```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { decisionsService } from '@/lib/services/decisions.service';
import { QuoteDeleteDialog } from '@/components/decisions/QuoteDeleteDialog';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DecisionQuote, DecisionStatus } from '@/types/models';
import { ExternalLink, Loader2, MoreVertical, Trophy, Trash2 } from 'lucide-react';
import { formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';

interface QuoteCardProps {
    quote: DecisionQuote;
    decisionId: string;
    decisionStatus: DecisionStatus;
    currentRound: number;
    isWinner: boolean;
    /** IDs of quotes still eligible in the current (tiebreak) round. When empty, every quote is eligible. */
    tiebreakEligibleIds?: string[];
    canDelete: boolean;
    isSelfDelete: boolean;
    isOwnedByMe?: boolean;
    onDeleted: (quoteId: string) => void;
    onRequestImagePreview?: (url: string, filename: string) => void;
}

const IMAGE_MIME_PREFIX = 'image/';

function isProbablyImage(url: string): boolean {
    const lower = url.toLowerCase();
    return (
        lower.includes('.png') ||
        lower.includes('.jpg') ||
        lower.includes('.jpeg') ||
        lower.includes('.webp')
    );
}

export function QuoteCard({
    quote,
    decisionId,
    decisionStatus,
    currentRound,
    isWinner,
    tiebreakEligibleIds,
    canDelete,
    isSelfDelete,
    isOwnedByMe,
    onDeleted,
    onRequestImagePreview,
}: QuoteCardProps) {
    const [loadingFile, setLoadingFile] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [notesExpanded, setNotesExpanded] = useState(false);

    const isDeleted = !!quote.deleted_at;
    const isTiebreakPhase = decisionStatus === 'TIEBREAK_PENDING';
    const isInTiebreakSet =
        !isTiebreakPhase ||
        !tiebreakEligibleIds ||
        tiebreakEligibleIds.length === 0 ||
        tiebreakEligibleIds.includes(quote.id);
    const dimmedOutOfRound = isTiebreakPhase && !isInTiebreakSet && !isDeleted;
    const notesLong = (quote.notes ?? '').length > 200;

    const shell = cn(
        'relative rounded-xl border p-4 transition',
        isDeleted && 'opacity-50 grayscale-[30%]',
        !isDeleted && isWinner &&
            'ring-2 ring-emerald-500 border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-card dark:from-emerald-950/30 dark:to-card',
        !isDeleted && !isWinner && isTiebreakPhase && isInTiebreakSet &&
            'ring-1 ring-amber-400 bg-amber-50/40 dark:bg-amber-950/20',
        !isDeleted && !isWinner && !isInTiebreakSet &&
            'border-border/60 bg-card pointer-events-none',
        !isDeleted && !isWinner && !isTiebreakPhase &&
            'border-border/60 bg-card',
        !isDeleted && isOwnedByMe && 'border-l-4 border-l-amber-700',
        dimmedOutOfRound && 'opacity-30',
    );

    const handleViewFile = async () => {
        setLoadingFile(true);
        try {
            const quotes = await decisionsService.listQuotes(decisionId, { limit: 50 });
            const fresh = (quotes?.data ?? []).find((q) => q.id === quote.id);
            const url = fresh?.file_url ?? quote.file_url;
            if (!url) {
                toast.error('No se encontró el archivo de esta cotización.');
                return;
            }
            if (isProbablyImage(url) && onRequestImagePreview) {
                onRequestImagePreview(url, `${quote.provider_name}.img`);
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setLoadingFile(false);
        }
    };

    return (
        <>
            <div className={shell}>
                {/* badges row */}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    {isWinner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            <Trophy className="h-3 w-3" /> Ganadora
                        </span>
                    )}
                    {isTiebreakPhase && isInTiebreakSet && !isWinner && (
                        <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                            ⚖ Empatada
                        </span>
                    )}
                    {isTiebreakPhase && !isInTiebreakSet && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            No en ronda {currentRound}
                        </span>
                    )}
                    {isDeleted && (
                        <span
                            className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-950/60 dark:text-red-200"
                            title={quote.deletion_reason ?? 'Eliminada'}
                        >
                            Eliminada
                        </span>
                    )}
                    {isOwnedByMe && !isDeleted && (
                        <span className="inline-flex items-center rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                            Tuya
                        </span>
                    )}
                </div>

                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <h3
                            className={cn(
                                'text-base font-semibold text-foreground',
                                isDeleted && 'line-through',
                            )}
                        >
                            {quote.provider_name}
                        </h3>
                        <p className="mt-0.5 text-lg font-semibold text-primary">
                            {formatCurrency(quote.amount)}
                        </p>
                    </div>
                    {canDelete && !isDeleted && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Más acciones de cotización"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onSelect={() => setDeleteOpen(true)}
                                    className="text-red-600 focus:text-red-700 dark:text-red-400"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {quote.notes && (
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                        {notesLong && !notesExpanded
                            ? `${quote.notes.slice(0, 200)}…`
                            : quote.notes}
                        {notesLong && (
                            <button
                                type="button"
                                className="ml-1 text-primary underline-offset-2 hover:underline"
                                onClick={() => setNotesExpanded((s) => !s)}
                            >
                                {notesExpanded ? 'Ver menos' : 'Ver más'}
                            </button>
                        )}
                    </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewFile}
                        disabled={loadingFile || isDeleted}
                    >
                        {loadingFile ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        )}
                        Ver archivo
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        {quote.uploader.name} · hace{' '}
                        {formatDistanceStrict(new Date(quote.created_at), new Date(), {
                            locale: es,
                            addSuffix: false,
                        })}
                    </p>
                </div>

                {isDeleted && quote.deletion_reason && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        Motivo: {quote.deletion_reason}
                    </p>
                )}
            </div>

            {canDelete && (
                <QuoteDeleteDialog
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    decisionId={decisionId}
                    quoteId={quote.id}
                    requireReason={!isSelfDelete}
                    onDeleted={() => onDeleted(quote.id)}
                />
            )}
        </>
    );
}
```

Note: `QuoteDeleteDialog`'s existing props are preserved — if it doesn't accept `requireReason`, pass the reason-required flag via whatever prop it actually exposes (verify with `rg -n "interface.*QuoteDeleteDialogProps" components/decisions/QuoteDeleteDialog.tsx`). Minor prop-name adjustments are acceptable.

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 5.2: Rewrite `TallyCard`

**Files:**
- Modify: `components/decisions/TallyCard.tsx`

- [ ] **Step 1: Replace the component**

Overwrite `components/decisions/TallyCard.tsx` with:
```typescript
'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';
import type { Decision, DecisionTally, DecisionTallyEntry } from '@/types/models';
import { AlertTriangle, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';

interface TallyCardProps {
    decision: Decision;
    tally: DecisionTally | null;
    lastUpdatedAt: Date | null;
    isRefreshing: boolean;
    onRefresh: () => void;
    /** Invoked when user chooses an empty-state CTA. Host page decides which dialog to open. */
    onResolveManual?: () => void;
    onCancel?: () => void;
}

function barClasses(entry: DecisionTallyEntry, winnerId: string | null) {
    if (winnerId && entry.quote_id === winnerId) {
        return 'bg-emerald-500';
    }
    return 'bg-amber-600 dark:bg-amber-500';
}

export function TallyCard({
    decision,
    tally,
    lastUpdatedAt,
    isRefreshing,
    onRefresh,
    onResolveManual,
    onCancel,
}: TallyCardProps) {
    const isTiebreak = decision.status === 'TIEBREAK_PENDING';
    const noVotes = tally !== null && tally.total_votes === 0;
    const noActiveQuotes = tally !== null && tally.tallies.length === 0;

    // Identify NO_VOTES_CAST / NO_ACTIVE_QUOTES edge states in RESOLVED+TIEBREAK_PENDING
    const showNoVotesEmptyState =
        tally !== null &&
        noVotes &&
        (decision.status === 'TIEBREAK_PENDING' || decision.status === 'RESOLVED');

    const showNoActiveQuotesEmptyState =
        tally !== null &&
        noActiveQuotes &&
        (decision.status === 'TIEBREAK_PENDING' || decision.status === 'RESOLVED');

    return (
        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <header className="mb-4 flex items-start justify-between gap-2">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Resultado de votación
                        {tally && tally.round > 1 && (
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                · Ronda {tally.round}
                            </span>
                        )}
                    </h2>
                    {tally && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            {tally.total_votes}/{tally.total_apartments} aptos votaron
                            {' · '}
                            {Math.round(tally.participation_pct)}% participación
                        </p>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    aria-label="Actualizar resultados"
                >
                    {isRefreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                </Button>
            </header>

            {showNoActiveQuotesEmptyState ? (
                <div className="rounded-lg bg-muted/40 p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                        No quedan cotizaciones activas
                    </div>
                    <p className="text-muted-foreground">
                        Todas las cotizaciones fueron eliminadas. Cancelá esta decisión para
                        cerrarla.
                    </p>
                    {onCancel && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCancel}
                            className="mt-3"
                        >
                            Cancelar decisión
                        </Button>
                    )}
                </div>
            ) : showNoVotesEmptyState ? (
                <div className="rounded-lg bg-muted/40 p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                        Nadie votó
                    </div>
                    <p className="text-muted-foreground">
                        Resolvé manual eligiendo ganador, o cancelá la decisión.
                    </p>
                    <div className="mt-3 flex gap-2">
                        {onResolveManual && (
                            <Button variant="default" size="sm" onClick={onResolveManual}>
                                Resolver manual
                            </Button>
                        )}
                        {onCancel && (
                            <Button variant="outline" size="sm" onClick={onCancel}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                </div>
            ) : !tally || tally.tallies.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Aún no hay votos emitidos.
                </p>
            ) : (
                <ol className="space-y-3" aria-live="polite">
                    {tally.tallies.map((entry, index) => {
                        const isWinner =
                            tally.winner_quote_id === entry.quote_id &&
                            decision.status === 'RESOLVED';
                        const isTied =
                            isTiebreak && tally.is_tied && entry.votes > 0;
                        return (
                            <li
                                key={entry.quote_id}
                                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm"
                            >
                                <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                                    {isWinner && (
                                        <Trophy
                                            className="h-3.5 w-3.5 text-emerald-600"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="truncate">
                                        {entry.provider_name}
                                    </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {formatCurrency(entry.amount)}
                                </span>
                                <div
                                    className="col-span-2 flex items-center gap-3"
                                    role="progressbar"
                                    aria-valuenow={entry.votes}
                                    aria-valuemin={0}
                                    aria-valuemax={tally.total_votes || 1}
                                    aria-label={`${entry.provider_name}: ${entry.votes} de ${tally.total_votes} votos`}
                                >
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={cn(
                                                'h-full rounded-full transition-[width] duration-500 ease-out',
                                                barClasses(entry, tally.winner_quote_id),
                                            )}
                                            style={{
                                                width: `${Math.min(100, entry.pct)}%`,
                                            }}
                                        />
                                    </div>
                                    <span
                                        className={cn(
                                            'w-24 text-right text-xs tabular-nums',
                                            isWinner && 'font-semibold text-emerald-700 dark:text-emerald-400',
                                            isTied && 'text-amber-800 dark:text-amber-200',
                                        )}
                                    >
                                        {entry.votes} voto{entry.votes === 1 ? '' : 's'} ·{' '}
                                        {Math.round(entry.pct)}%
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            {isTiebreak && tally && tally.tallies.length > 0 && tally.is_tied && (
                <p className="mt-4 flex items-center gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    Empate detectado — se abrió ronda {decision.current_round}. Votá nuevamente o resolvé manual.
                </p>
            )}

            {lastUpdatedAt && (
                <p className="mt-3 text-right text-[11px] text-muted-foreground">
                    Actualizado hace{' '}
                    {formatDistanceStrict(lastUpdatedAt, new Date(), {
                        locale: es,
                        addSuffix: false,
                    })}
                </p>
            )}
        </section>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 5.3: Create `PhotoLightbox`

**Files:**
- Create: `components/decisions/PhotoLightbox.tsx`

- [ ] **Step 1: Write the component**

Create `components/decisions/PhotoLightbox.tsx`:
```typescript
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoLightboxProps {
    open: boolean;
    url: string | null;
    alt: string;
    onClose: () => void;
}

export function PhotoLightbox({ open, url, alt, onClose }: PhotoLightboxProps) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open || !url) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
                <X className="h-5 w-5" />
            </button>
            <div
                onClick={(e) => e.stopPropagation()}
                className={cn('max-h-[90vh] max-w-[90vw]')}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={url}
                    alt={alt}
                    className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                />
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 5.4: Wire lightbox + refresh + TallyCard into detail page

**Files:**
- Modify: `app/(dashboard)/decisions/[id]/page.tsx`

- [ ] **Step 1: Add new state + fetch helpers**

Near the top of the component, after existing `useState` calls, add:
```typescript
const [tallyRefreshing, setTallyRefreshing] = useState(false);
const [lastTallyAt, setLastTallyAt] = useState<Date | null>(null);
const [photoUrl, setPhotoUrl] = useState<string | null>(null);
const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
```

The existing `lightboxOpen` + `setLightboxOpen` from Phase 3 stays.

- [ ] **Step 2: Replace the existing `loadTally` logic with an explicit refresh handler**

Find the callback that re-fetches tally (currently inline after `decisionsService.getResults(id)`). Replace with:
```typescript
const refreshTally = useCallback(async () => {
    if (!decision) return;
    setTallyRefreshing(true);
    try {
        const [detail, results] = await Promise.all([
            decisionsService.getById(decision.id),
            decisionsService.getResults(decision.id),
        ]);
        setDecision(detail.decision);
        setQuotes(detail.quotes);
        setTally(results);
        setLastTallyAt(new Date());
    } catch (err) {
        toast.error(getDecisionErrorMessage(err));
    } finally {
        setTallyRefreshing(false);
    }
}, [decision]);
```

And replace the original mount load to also set `lastTallyAt`:
```typescript
useEffect(() => {
    if (tally) setLastTallyAt(new Date());
}, [tally]);
```

- [ ] **Step 3: Open the photo lightbox on photo click**

Remove any placeholder that sets `lightboxOpen` alone. Instead, `onPhotoClick` should open the lightbox with the decision's photo URL (re-fetch the decision so the signed URL is fresh):
```typescript
const openPhotoLightbox = async () => {
    if (!decision) return;
    try {
        const refreshed = await decisionsService.getById(decision.id);
        setDecision(refreshed.decision);
        setPhotoUrl(refreshed.decision.photo_url);
        setLightboxOpen(true);
    } catch (err) {
        toast.error(getDecisionErrorMessage(err));
    }
};
```

Update the `DecisionHero`'s `onPhotoClick` to call `openPhotoLightbox`.

- [ ] **Step 4: Wire QuoteCard → image preview via lightbox**

Where `QuoteCard` is rendered (inside the quotes grid), pass:
```typescript
<QuoteCard
    key={q.id}
    quote={q}
    decisionId={decision.id}
    decisionStatus={decision.status}
    currentRound={decision.current_round}
    isWinner={decision.winner_quote_id === q.id}
    tiebreakEligibleIds={
        decision.status === 'TIEBREAK_PENDING' && tally
            ? tally.tallies.map((e) => e.quote_id)
            : []
    }
    canDelete={
        canManageDecisions(decision.building_id) ||
        canDeleteQuoteAsOwner(q, decision.status)
    }
    isSelfDelete={canDeleteQuoteAsOwner(q, decision.status)}
    isOwnedByMe={q.uploader?.id === user?.id}
    onDeleted={() => refreshTally()}
    onRequestImagePreview={(url) => {
        setLightboxImageUrl(url);
        setLightboxOpen(true);
    }}
/>
```

Use whichever local name for `user` the page already has from `usePermissions()` or auth context. If it doesn't have one, skip `isOwnedByMe` (pass `false` or leave undefined).

- [ ] **Step 5: Render `TallyCard` + `VotesList` refresh + `PhotoLightbox`**

Replace the current `<TallyCard tally={tally} />` usage (and its conditional wrapper) with:
```typescript
{decision.status !== 'RECEPTION' && (
    <TallyCard
        decision={decision}
        tally={tally}
        lastUpdatedAt={lastTallyAt}
        isRefreshing={tallyRefreshing}
        onRefresh={refreshTally}
        onResolveManual={() => setTiebreakOpen(true)}
        onCancel={() => setCancelOpen(true)}
    />
)}
```

Render the lightbox once at the bottom of the return:
```typescript
<PhotoLightbox
    open={lightboxOpen}
    url={lightboxImageUrl ?? photoUrl}
    alt="Archivo adjunto"
    onClose={() => {
        setLightboxOpen(false);
        setLightboxImageUrl(null);
    }}
/>
```

Add imports at the top:
```typescript
import { PhotoLightbox } from '@/components/decisions/PhotoLightbox';
```

- [ ] **Step 6: Add refresh button to VotesList call site**

Unless `VotesList` itself owns its refresh UX (verify the component), pass a page-level handler that simply re-mounts the list. Simplest path: bump a `votesKey` state used as `key` on `<VotesList>`. Add:
```typescript
const [votesKey, setVotesKey] = useState(0);
```
And change the JSX:
```typescript
<div>
    <div className="mb-2 flex justify-end">
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setVotesKey((k) => k + 1)}
        >
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Actualizar votos
        </Button>
    </div>
    <VotesList
        key={votesKey}
        decisionId={decision.id}
        currentRound={decision.current_round}
    />
</div>
```
Import `RefreshCw` from `lucide-react`.

(A cleaner approach is exposing a refresh callback inside `VotesList`, but remounting via key is a no-op change to the component.)

- [ ] **Step 7: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 8: Manual visual check**

1. Open a RESOLVED decision with a winner → winner quote has emerald ring + 🏆.
2. Open a TIEBREAK_PENDING round 2 decision → tied quotes show "Empatada", others dimmed "No en ronda N".
3. Delete a quote → card shows opacity + strikethrough + reason tooltip.
4. Upload an image quote → click "Ver archivo" → lightbox opens with image.
5. Upload a PDF quote → click "Ver archivo" → opens in new tab.
6. Open a decision with a photo → click thumb → lightbox opens with decision photo.
7. ESC closes lightbox. Click on overlay closes it. × button closes it.
8. In tally section: click 🔄 Actualizar → spinner, then refreshed timestamp.
9. NO_VOTES_CAST empty state → shows CTA "Resolver manual" + "Cancelar".
10. NO_ACTIVE_QUOTES empty state → shows CTA "Cancelar decisión".

### Task 5.5: Commit Phase 5

- [ ] **Step 1: Stage and commit**

```bash
git add components/decisions/QuoteCard.tsx \
        components/decisions/TallyCard.tsx \
        components/decisions/PhotoLightbox.tsx \
        app/\(dashboard\)/decisions/\[id\]/page.tsx
git commit -m "feat(decisions/detail): quote card states, tally chart, photo lightbox, refresh controls"
```

---

## Phase 6 — Polish: empty states + skeletons + accessibility

**Commit subject:** `chore(decisions): empty states, loading skeletons, accessibility pass`

### Task 6.1: Detail page loading skeleton

**Files:**
- Modify: `app/(dashboard)/decisions/[id]/page.tsx`

- [ ] **Step 1: Replace the current `isLoading ? <Skeleton />` block with a shaped skeleton**

Find the block that handles `isLoading` for detail (before the decision-null guard). Replace with:
```typescript
if (isLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-32" />
            <div className="rounded-xl bg-gradient-to-br from-stone-200 to-stone-300 p-6 dark:from-stone-800 dark:to-stone-900">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-6 w-2/3" />
                <Skeleton className="mt-4 h-8 w-40" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>
    );
}
```

- [ ] **Step 2: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 6.2: Empty states in detail content

**Files:**
- Modify: `app/(dashboard)/decisions/[id]/page.tsx`

- [ ] **Step 1: Empty quote list in detail with CTA**

Find the quote-list section (where `quotes.length === 0` fallback renders). Replace with:
```typescript
{(() => {
    const activeQuotes = quotes.filter((q) => !q.deleted_at);
    if (activeQuotes.length === 0) {
        return (
            <Card className="border-dashed p-8 text-center">
                <Vote
                    className="mx-auto mb-3 h-8 w-8 text-muted-foreground"
                    aria-hidden="true"
                />
                <p className="mb-2 font-medium">Sin cotizaciones todavía</p>
                <p className="mb-4 text-sm text-muted-foreground">
                    {decision.status === 'RECEPTION'
                        ? 'Subí la primera para avanzar.'
                        : 'Ya no hay cotizaciones activas.'}
                </p>
                {decision.status === 'RECEPTION' &&
                    canUploadQuote(decision.building_id) && (
                        <Button onClick={() => setQuoteUploadOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Subir primera
                        </Button>
                    )}
            </Card>
        );
    }
    return (
        <div className="grid gap-4 md:grid-cols-2">
            {quotes.map((q) => (
                /* the QuoteCard props wiring from Phase 5 stays identical */
                /* see Phase 5 Step 4 for full props */
                null /* placeholder — existing render stays */
            ))}
        </div>
    );
})()}
```

Replace `null /* placeholder */` with the full `<QuoteCard>` JSX from Phase 5 Step 4. The wrapping IIFE (`(() => { ... })()`) is just to scope the `activeQuotes` variable; if your lint rules prefer a function variable, extract it.

- [ ] **Step 2: Imports**

Make sure `Vote` is imported from `lucide-react` and `Card` from `@/components/ui/card` at the top of the file.

- [ ] **Step 3: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 6.3: Accessibility polish

**Files:**
- Modify: `components/decisions/DecisionHero.tsx`
- Modify: `components/decisions/DecisionActions.tsx`
- Modify: `components/decisions/PhotoLightbox.tsx` (already included)
- Modify: `components/decisions/TallyCard.tsx` (already has aria — verify)

- [ ] **Step 1: Confirm progress bar semantics in DecisionHero**

Inside `DecisionHero.tsx`, ensure the `<Progress>` receives `aria-label="Participación"`:
```typescript
<Progress
    value={Math.min(100, tally.participation_pct)}
    aria-label="Participación"
    className="h-2 bg-white/20 [&>div]:bg-white"
/>
```

- [ ] **Step 2: Confirm `aria-pressed` on filter chips**

`UrgencyChip` already uses `aria-pressed={selected}`; no change needed (sanity-check by reading the file).

- [ ] **Step 3: Focus trap sanity check on lightbox**

Per Phase 5, `PhotoLightbox` already handles ESC and click-outside. Add one more: auto-focus the close button when the lightbox opens so keyboard users can immediately close it. In `PhotoLightbox.tsx`, change the close button to use a ref:
```typescript
const closeBtnRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
    if (open) {
        closeBtnRef.current?.focus();
    }
}, [open]);

// on the button:
<button ref={closeBtnRef} ... />
```

Add `import { useRef, useEffect } from 'react';` if not already imported.

- [ ] **Step 4: Verify with TypeScript**

Run:
```bash
bunx tsc --noEmit
```
Expected: no new errors.

### Task 6.4: Clean up dead/decission typo

**Files:**
- Project-wide (should be none)

- [ ] **Step 1: Search for typo**

Run:
```bash
rg -n decission components/decisions app/\(dashboard\)/decisions lib/services/decisions.service.ts lib/utils/decision-errors.ts
```
Expected: no hits. If any hits appear (e.g. comment text), replace `decission` with `decisión` and re-run.

- [ ] **Step 2: Search for remaining `any` in the decisions slice**

Run:
```bash
rg -n "\\bany\\b" lib/services/decisions.service.ts lib/utils/decision-*.ts components/decisions
```
Expected: hits only in intentional `unknown`/`Record<string, unknown>` contexts (acceptable) or zero.

### Task 6.5: Final lint + commit

- [ ] **Step 1: Lint (non-blocking)**

Run:
```bash
bun run lint
```
Fix any new warnings introduced by this PR. Pre-existing warnings outside the decisions slice can be left untouched.

- [ ] **Step 2: Commit Phase 6**

```bash
git add app/\(dashboard\)/decisions/\[id\]/page.tsx \
        components/decisions/DecisionHero.tsx \
        components/decisions/DecisionActions.tsx \
        components/decisions/PhotoLightbox.tsx \
        components/decisions/TallyCard.tsx
git commit -m "chore(decisions): empty states, loading skeletons, accessibility pass"
```

---

## Post-Plan: Pull Request

- [ ] **Step 1: Push branch**

```bash
git push -u origin feature/ui-refinement-and-theme-system
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(decisions): redesign + audit gap fixes" --body "$(cat <<'EOF'
## Summary
- Card-grid list page with triage chips (Activas / Pendientes acción / Archivadas) and urgency countdowns
- Hero + stacked detail page with fase-aware primary CTA and overflow menu
- Polished QuoteCard states (winner, tiebreak, deleted, yours, not-in-round) and rewritten TallyCard with horizontal bars + refresh
- Photo lightbox with ESC + overlay close + focus trap
- Client-side photo validation (MIME + 5MB + preview) on create
- Error mapping extended with NO_VOTES_CAST and NO_ACTIVE_QUOTES
- metadata: any → typed in decisions.service.ts
- Extracted DecisionHero, DecisionActions, DecisionCard + pure utils (countdown, phase, actions)

Spec: docs/superpowers/specs/2026-04-23-decisions-redesign-design.md

## Test plan
- [ ] List page: all 3 chips work, counts update, search works, cards render per phase
- [ ] Detail page: hero gradient per phase (5 variants), primary CTA matrix, overflow menu per phase
- [ ] QuoteCard: winner, tiebreak round filter, deleted, self-delete, image lightbox, PDF new tab
- [ ] TallyCard: refresh button, NO_VOTES_CAST + NO_ACTIVE_QUOTES empty states
- [ ] Light/dark mode both legible
- [ ] Mobile responsive 1/2/3 columns
- [ ] tsc clean, lint clean
EOF
)"
```

---

## Self-Review Checklist (run after writing plan)

- [x] Spec coverage: all §4-§13 of the spec are addressed across Phases 1-6. Voting UI explicitly out of scope. ✓
- [x] Open questions from §14: Phase 3 Task 3.4 QA confirms assessment route; `decision-actions.ts` includes default assumption and flags it; bun test not introduced (no runner). ✓
- [x] Placeholder scan: no TBD/TODO in code blocks. The "existing render stays" note in Task 6.2 Step 1 is a stitching instruction, not a placeholder — Phase 5 Step 4 defines the full JSX. ✓
- [x] Type consistency: `formatCountdown`, `getPhaseTheme`, `resolvePrimaryAction`, `getChargeDeepLink`, `filterByView`, `DecisionView`, `PrimaryAction`, `PrimaryActionKind`, `DecisionActionsHandlers`, `CountdownResult`, `PhaseTheme`, `CountdownUrgency` — all defined once, used consistently across phases. ✓
- [x] File paths: all absolute within repo, backticks used consistently. ✓
- [x] Commit discipline: each phase is one commit; 6 commits total; `fix → refactor → feat → feat → feat → chore` progression. ✓

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-decisions-redesign.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Pick one when ready.
