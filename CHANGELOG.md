# Recent Updates

## 2026-04-22 — Módulo Decisions (Presupuestos y Votaciones)

### Nuevos archivos
- `lib/utils/constants.ts` — `DECISIONS_API_PREFIX`, `DECISION_STATUSES`, `DECISION_QUOTE_MAX_BYTES`, `DECISION_QUOTE_MIME_ALLOWED`, ruta `DECISIONS`.
- `types/models.ts` — tipos `Decision`, `DecisionQuote`, `DecisionVote`, `DecisionTally`, `DecisionAuditEntry` y DTOs de creación/mutación.
- `lib/services/decisions.service.ts` — 16 métodos que cubren todo el catálogo de endpoints `/api/v1/decisions/*`.
- `lib/utils/decision-errors.ts` — mapa de error codes del backend a mensajes en español para toasts.
- `components/decisions/` — 12 componentes: `DecisionStatusBadge`, `DecisionDialog`, `ExtendDeadlinesDialog`, `CancelDecisionDialog`, `QuoteUploadDialog`, `QuoteCard`, `QuoteDeleteDialog`, `TallyCard`, `VotesList`, `FinalizeConfirmDialog`, `ResolveTiebreakDialog`, `GenerateChargeDialog`, `AuditLogDrawer`.
- `app/(dashboard)/decisions/page.tsx` — listado con filtros de estado/título y paginación.
- `app/(dashboard)/decisions/[id]/page.tsx` — detalle completo con barra de acciones contextual por estado.

### Modificados
- `lib/hooks/usePermissions.tsx` — añadidos `canManageDecisions`, `canUploadQuote`, `canDeleteQuoteAsOwner`.
- `components/layout/Sidebar.tsx` — entrada "Presupuestos" (icono `Vote`) entre Finanzas y Ajustes, incluida en páginas contextuales por edificio.

### Alcance V1
- Flujo completo: RECEPTION → VOTING → RESOLVED / TIEBREAK_PENDING → RESOLVED.
- Generación de cargo: INVOICE (billing) o ASSESSMENT (petty-cash).
- Voto: solo lectura en admin; la emisión de votos vive en la APK.
- Sin notificaciones, sin cron automático de transiciones (finalize explícito).

## ✨ New Features

- **Unit Management**: Comprehensive tools for managing units are now available. You can create single units, generate them in batches, and view detailed unit information.
- **Billing & Invoicing**: Added the ability to create invoices and load debts for specific units, streamlining the billing process.
- **Board Member Experience**: Enhanced permissions for board members and personalized building branding to provide a more tailored experience.

## 🐛 Fixes & Improvements

- **Stability**: Resolved critical UI issues including tab flickering and infinite loading loops that were affecting the building dashboard.
- **Data Integrity**: Fixed type mismatches in the Invoice Dialog and detail pages to ensure correct data handling.
- **Validation**: Improved aliquot validation when creating units to prevent errors.
- **General Polish**: Various UI fixes and service updates to facilitate a smoother user experience.
