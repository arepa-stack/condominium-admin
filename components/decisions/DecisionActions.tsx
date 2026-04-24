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
    onForceFinalizeReception: () => void;
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
    handlers: DecisionActionsHandlers,
) {
    switch (action.kind) {
        case 'upload-first-quote':
            handlers.onUploadQuote();
            return;
        case 'finalize-reception':
        case 'finalize-voting-now':
            handlers.onFinalize();
            return;
        case 'force-finalize-reception':
            handlers.onForceFinalizeReception();
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
                <Button
                    asChild
                    className={cn(
                        'bg-white text-emerald-800 hover:bg-white/90',
                        primaryClassName,
                    )}
                >
                    <Link href={getChargeDeepLink(decision)}>{primary.label}</Link>
                </Button>
            )}
            {primary && primary.kind !== 'view-charge' && (
                <Button
                    variant={primary.variant === 'outline' ? 'outline' : 'default'}
                    onClick={() => dispatchPrimary(primary, handlers)}
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
                            <Clock className="mr-2 h-4 w-4" /> Extender plazos
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
