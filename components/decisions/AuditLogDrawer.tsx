'use client';

import { useEffect, useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Paginator } from '@/components/ui/paginator';
import { TableSkeleton } from '@/components/ui/skeletons';
import { Badge } from '@/components/ui/badge';
import { decisionsService } from '@/lib/services/decisions.service';
import { formatDate } from '@/lib/utils/format';
import { toast } from 'sonner';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import type { DecisionAuditEntry, DecisionAuditEvent, PaginationMetadata } from '@/types/models';

const EVENT_LABELS: Record<DecisionAuditEvent, string> = {
    CREATED: 'Creación',
    DEADLINE_EXTENDED: 'Plazo extendido',
    CANCELLED: 'Cancelada',
    QUOTE_DELETED: 'Cotización eliminada',
    FINALIZED: 'Fase finalizada',
    TIEBREAK_OPENED: 'Empate — ronda 2',
    WINNER_SET_MANUAL: 'Ganador manual',
    CHARGE_GENERATED: 'Cargo generado',
    PHASE_ADVANCED: 'Fase avanzada',
};

const PAGE_SIZE = 20;

interface AuditLogDrawerProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    decisionId: string;
}

export function AuditLogDrawer({ open, onOpenChange, decisionId }: AuditLogDrawerProps) {
    const [entries, setEntries] = useState<DecisionAuditEntry[]>([]);
    const [metadata, setMetadata] = useState<PaginationMetadata | null>(null);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!open) return;

        const load = async () => {
            setIsLoading(true);
            try {
                const res = await decisionsService.getAuditLog(decisionId, {
                    page,
                    limit: PAGE_SIZE,
                });
                setEntries(res.data);
                setMetadata(res.metadata);
            } catch (err) {
                toast.error(getDecisionErrorMessage(err));
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [open, decisionId, page]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle>Historial de auditoría</SheetTitle>
                </SheetHeader>

                {isLoading ? (
                    <TableSkeleton rows={5} columns={3} />
                ) : entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                        No hay eventos registrados.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="border border-border/50 rounded-lg p-4 space-y-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <Badge variant="outline">
                                        {EVENT_LABELS[entry.event] ?? entry.event}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDate(entry.created_at, 'dd/MM/yyyy HH:mm')}
                                    </span>
                                </div>
                                <p className="text-sm">
                                    <span className="font-medium">
                                        {entry.actor?.name ?? 'Usuario eliminado'}
                                    </span>
                                </p>
                                {Object.keys(entry.payload).length > 0 && (
                                    <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                        {JSON.stringify(entry.payload, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))}

                        {metadata && metadata.totalPages > 1 && (
                            <Paginator metadata={metadata} onPageChange={setPage} />
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
