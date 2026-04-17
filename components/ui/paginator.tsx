'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMetadata } from '@/types/models';

interface PaginatorProps {
    metadata: PaginationMetadata | null | undefined;
    isLoading?: boolean;
    onPageChange: (page: number) => void;
    className?: string;
}

export function Paginator({
    metadata,
    isLoading,
    onPageChange,
    className,
}: PaginatorProps) {
    if (!metadata || metadata.totalPages <= 1) return null;

    const { page, totalPages, hasNextPage, hasPrevPage, total, limit } = metadata;
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div
            className={
                'flex flex-col items-center justify-between gap-2 p-4 sm:flex-row ' +
                (className ?? '')
            }
        >
            <p className="text-xs text-muted-foreground tabular-nums">
                Mostrando {from}–{to} de {total}
            </p>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasPrevPage || isLoading}
                    onClick={() => onPageChange(page - 1)}
                    className="gap-1"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">
                    Página {page} de {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNextPage || isLoading}
                    onClick={() => onPageChange(page + 1)}
                    className="gap-1"
                >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
