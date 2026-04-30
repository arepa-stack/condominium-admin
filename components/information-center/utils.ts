import {
    ANNOUNCEMENT_CATEGORIES,
    INFORMATION_CENTER_ATTACHMENT_MAX_BYTES,
    INFORMATION_CENTER_ATTACHMENT_MIME_ALLOWED,
} from '@/lib/utils/constants';
import type { AnnouncementCategory } from '@/types/models';

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
    INFO: 'Información',
    URGENT: 'Urgente',
    FINANCIAL: 'Finanzas',
    MAINTENANCE: 'Mantenimiento',
    NEWS: 'Noticias',
};

export const announcementCategoryOptions = ANNOUNCEMENT_CATEGORIES.map((value) => ({
    value,
    label: ANNOUNCEMENT_CATEGORY_LABELS[value],
}));

export function formatDate(value?: string | null) {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
    if (!value) return 'Pendiente';
    return new Intl.DateTimeFormat('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

export function validateInformationCenterAttachment(file: File | null | undefined) {
    if (!file) return null;

    if (!INFORMATION_CENTER_ATTACHMENT_MIME_ALLOWED.includes(file.type as never)) {
        return 'El adjunto debe ser PDF o imagen JPG, PNG o WEBP.';
    }

    if (file.size > INFORMATION_CENTER_ATTACHMENT_MAX_BYTES) {
        return 'El adjunto no puede superar 5 MB.';
    }

    return null;
}
