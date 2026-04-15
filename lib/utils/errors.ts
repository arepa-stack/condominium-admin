/**
 * Extrae un mensaje legible de errores (p. ej. Axios transformado a Error en el interceptor).
 */
export function getErrorMessage(error: unknown, fallback = 'Ocurrió un error'): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'string' && error) {
        return error;
    }
    return fallback;
}
