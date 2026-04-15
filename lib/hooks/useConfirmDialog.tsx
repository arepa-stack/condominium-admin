'use client';

import { useState, useCallback, useRef } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export type ConfirmOptions = {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    /** Usa estilo destructivo para acciones irreversibles */
    variant?: 'default' | 'destructive';
};

/**
 * Diálogo de confirmación accesible (reemplazo de window.confirm).
 * Renderizá `ConfirmDialog` una vez en el árbol del componente.
 */
export function useConfirmDialog() {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({
        title: '',
        description: '',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        variant: 'default',
    });
    const resolverRef = useRef<((value: boolean) => void) | null>(null);
    const settledRef = useRef(false);

    const finish = useCallback((value: boolean) => {
        if (settledRef.current) return;
        settledRef.current = true;
        const resolve = resolverRef.current;
        resolverRef.current = null;
        setOpen(false);
        resolve?.(value);
    }, []);

    const confirm = useCallback((opts: ConfirmOptions) => {
        settledRef.current = false;
        setOptions({
            title: opts.title,
            description: opts.description,
            confirmText: opts.confirmText ?? 'Confirmar',
            cancelText: opts.cancelText ?? 'Cancelar',
            variant: opts.variant ?? 'default',
        });
        setOpen(true);
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
        });
    }, []);

    const onOpenChange = useCallback(
        (next: boolean) => {
            if (!next) {
                finish(false);
            }
        },
        [finish]
    );

    const handleConfirmClick = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            finish(true);
        },
        [finish]
    );

    const ConfirmDialog = (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{options.title}</AlertDialogTitle>
                    <AlertDialogDescription>{options.description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{options.cancelText}</AlertDialogCancel>
                    <AlertDialogAction
                        type="button"
                        onClick={handleConfirmClick}
                        className={cn(
                            options.variant === 'destructive' &&
                                'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive'
                        )}
                    >
                        {options.confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return { confirm, ConfirmDialog };
}
