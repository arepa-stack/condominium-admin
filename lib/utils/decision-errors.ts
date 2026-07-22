/**
 * Traduce los error codes del módulo Decisions a mensajes en español
 * para mostrar en toasts. La clave coincide con el `message` que devuelve el backend.
 */
const ERROR_MESSAGES: Record<string, string> = {
    // 400
    DECISION_INVALID_DEADLINES:
        'Las fechas límite son inválidas. Verifica que la votación sea posterior a la recepción.',
    DECISION_INVALID_PHOTO: 'La foto del decision no es válida.',
    QUOTE_INVALID_MIME:
        'Tipo de archivo no permitido. Solo se aceptan PDF, JPEG, PNG o WebP.',
    QUOTE_FILE_TOO_LARGE: 'El archivo supera el tamaño máximo de 5 MB.',
    QUOTE_INVALID_AMOUNT: 'El monto de la cotización debe ser mayor a cero.',

    // 401
    UNAUTHORIZED: 'No estás autenticado. Inicia sesión para continuar.',

    // 403
    DECISION_FORBIDDEN_BUILDING:
        'No tienes acceso a este edificio.',
    DECISION_FORBIDDEN_ROLE:
        'Tu rol no tiene permiso para realizar esta acción.',

    // 404
    DECISION_NOT_FOUND: 'La decisión no fue encontrada.',
    QUOTE_NOT_FOUND: 'La cotización no fue encontrada.',

    // 409
    DECISION_ALREADY_FINALIZED:
        'Esta decisión ya fue finalizada en esta fase.',
    VOTE_ALREADY_CAST: 'Ya existe un voto registrado para este apartamento en esta ronda.',
    DECISION_ALREADY_CHARGED:
        'Ya se generó un cargo para esta decisión. No se puede volver a generar.',

    // 422
    DECISION_DEADLINE_NOT_YET_PASSED:
        'El plazo límite todavía no ha vencido. No puedes finalizar esta fase aún.',
    DECISION_NO_ACTIVE_QUOTES:
        'No hay cotizaciones activas. Agrega al menos una cotización antes de avanzar.',
    QUOTE_DELETED: 'La cotización seleccionada fue eliminada y ya no está disponible.',
    QUOTE_NOT_IN_TIEBREAK:
        'La cotización elegida no forma parte del desempate activo.',
    VOTE_BUILDING_MISMATCH:
        'El apartamento seleccionado no pertenece al edificio de esta decisión.',
    VOTE_UNIT_NOT_OWNED:
        'No tienes una unidad asignada en este edificio para votar.',
    DECISION_WRONG_STATUS:
        'La decisión no se encuentra en el estado correcto para esta operación.',
    TIEBREAK_MANUAL_NOT_ALLOWED:
        'El desempate manual no está habilitado en este momento.',

    // Terminal-state codes: backend emite estos cuando la fase cierra sin votos o
    // sin quotes activos (distinto de DECISION_NO_ACTIVE_QUOTES, que es precondition al finalizar).
    NO_VOTES_CAST:
        'La votación cerró sin votos. Resolvé manual eligiendo ganador o cancelá la decisión.',
    NO_ACTIVE_QUOTES:
        'No quedan cotizaciones activas. Cancelá esta decisión para cerrarla.',
};

/**
 * Devuelve un mensaje de error amigable en español dado el código o mensaje
 * de error que devuelve el backend. Si no encuentra una traducción, devuelve
 * el propio mensaje original o un genérico.
 */
export function getDecisionErrorMessage(errorOrCode: unknown): string {
    if (!errorOrCode) return 'Ocurrió un error inesperado.';

    const raw =
        typeof errorOrCode === 'string'
            ? errorOrCode
            : (errorOrCode as { message?: string })?.message ?? String(errorOrCode);

    return ERROR_MESSAGES[raw] ?? raw ?? 'Ocurrió un error inesperado.';
}
