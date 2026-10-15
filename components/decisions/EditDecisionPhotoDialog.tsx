'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, UploadCloud, Trash2, Image as ImageIcon } from 'lucide-react';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import type { Decision } from '@/types/models';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

interface EditDecisionPhotoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    decision: Decision;
    onUpdated: (newPhotoUrl: string | null) => void;
}

export function EditDecisionPhotoDialog({
    open,
    onOpenChange,
    decision,
    onUpdated,
}: EditDecisionPhotoDialogProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedFile]);

    useEffect(() => {
        if (!open) {
            setSelectedFile(null);
            setPreviewUrl(null);
            setIsDragging(false);
            setIsSubmitting(false);
            setIsDeleting(false);
        }
    }, [open]);

    const handleFileValidation = (file: File): boolean => {
        if (!ALLOWED_MIMES.includes(file.type)) {
            toast.error('Formato no permitido. Solo se aceptan imágenes JPEG, PNG o WebP.');
            return false;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            toast.error('La imagen no puede superar los 5 MB.');
            return false;
        }
        return true;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (handleFileValidation(file)) {
            setSelectedFile(file);
        }
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        if (handleFileValidation(file)) {
            setSelectedFile(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setIsSubmitting(true);
        try {
            const res = await decisionsService.uploadPhoto(decision.id, selectedFile);
            toast.success('Imagen del presupuesto actualizada.');
            onUpdated(res.photo_url);
            onOpenChange(false);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await decisionsService.deletePhoto(decision.id);
            toast.success('Imagen eliminada correctamente.');
            onUpdated(null);
            onOpenChange(false);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Editar imagen del presupuesto</DialogTitle>
                    <DialogDescription>
                        Sube una nueva foto o imagen representativa para esta decisión / presupuesto.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Current Photo preview if available */}
                    {decision.photo_url && !selectedFile && (
                        <div className="rounded-lg border border-border p-3 bg-muted/40">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                Imagen actual:
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="h-16 w-16 overflow-hidden rounded-md border bg-muted flex-shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={decision.photo_url}
                                        alt="Imagen actual"
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">
                                        Selecciona una nueva imagen abajo para reemplazarla, o elimínala.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isDeleting || isSubmitting}
                                        onClick={handleDelete}
                                        className="mt-2 h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        {isDeleting ? (
                                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                        ) : (
                                            <Trash2 className="mr-1.5 h-3 w-3" />
                                        )}
                                        Eliminar imagen
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* New photo preview if selected */}
                    {selectedFile && previewUrl ? (
                        <div className="rounded-lg border border-border p-4 bg-muted/30">
                            <p className="text-xs font-medium text-foreground mb-2">
                                Nueva imagen seleccionada:
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="h-24 w-24 overflow-hidden rounded-lg border bg-muted flex-shrink-0 shadow-sm">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={previewUrl}
                                        alt="Vista previa"
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate text-foreground">
                                        {selectedFile.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedFile(null)}
                                        className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Cambiar archivo
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Dropzone */
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                                isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <div className="rounded-full bg-primary/10 p-3 text-primary mb-3">
                                {decision.photo_url ? (
                                    <UploadCloud className="h-6 w-6" />
                                ) : (
                                    <ImageIcon className="h-6 w-6" />
                                )}
                            </div>
                            <p className="text-sm font-medium text-foreground">
                                Haz clic para elegir o arrastra una imagen aquí
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                JPEG, PNG o WebP (máx. 5 MB)
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting || isDeleting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleUpload}
                        disabled={!selectedFile || isSubmitting || isDeleting}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar imagen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
