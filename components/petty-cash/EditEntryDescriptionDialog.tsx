'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { PettyCashEntry } from '@/types/models';

interface EditEntryDescriptionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry: PettyCashEntry | null;
    isSubmitting: boolean;
    onConfirm: (entryId: string, description: string) => Promise<void>;
}

export function EditEntryDescriptionDialog({
    open,
    onOpenChange,
    entry,
    isSubmitting,
    onConfirm,
}: EditEntryDescriptionDialogProps) {
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (entry) {
            setDescription(entry.description);
        } else {
            setDescription('');
        }
    }, [entry]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!entry?.id || !description.trim()) return;
        await onConfirm(entry.id, description.trim());
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar descripción</DialogTitle>
                    <DialogDescription>
                        Modifica la descripción de este movimiento de caja chica.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-entry-description">Descripción</Label>
                        <Input
                            id="edit-entry-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Descripción del movimiento..."
                            disabled={isSubmitting}
                            autoFocus
                        />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !description.trim() || description.trim() === entry?.description}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar cambios
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
