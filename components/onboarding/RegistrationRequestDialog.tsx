'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    User, 
    Mail, 
    Phone, 
    CreditCard, 
    Building2, 
    Home, 
    QrCode, 
    UserPlus,
    CheckCircle,
    XCircle,
    Clock,
    Loader2
} from 'lucide-react';
import type { RegistrationRequest } from '@/types/models';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RegistrationRequestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    request: RegistrationRequest | null;
    onApprove: (id: string) => Promise<void>;
    onReject: (id: string, reason?: string) => Promise<void>;
}

export function RegistrationRequestDialog({
    open,
    onOpenChange,
    request,
    onApprove,
    onReject
}: RegistrationRequestDialogProps) {
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!request) return null;

    const handleApprove = async () => {
        setIsLoading(true);
        try {
            await onApprove(request.id);
            onOpenChange(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async () => {
        setIsLoading(true);
        try {
            await onReject(request.id, rejectionReason);
            onOpenChange(false);
            setIsRejecting(false);
            setRejectionReason('');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) {
                setIsRejecting(false);
                setRejectionReason('');
            }
            onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Detalle de Solicitud
                    </DialogTitle>
                    <DialogDescription>
                        Información del residente que solicita acceso.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Status Banner */}
                    <div className={`p-3 rounded-lg flex items-center gap-3 border ${
                        request.status === 'pending' ? 'bg-secondary/10 border-secondary/20 text-secondary-foreground' :
                        request.status === 'approved' ? 'bg-chart-1/10 border-chart-1/20 text-chart-1' :
                        'bg-destructive/10 border-destructive/20 text-destructive'
                    }`}>
                        {request.status === 'pending' && <Clock className="h-5 w-5" />}
                        {request.status === 'approved' && <CheckCircle className="h-5 w-5" />}
                        {request.status === 'rejected' && <XCircle className="h-5 w-5" />}
                        <div className="flex-1">
                            <p className="text-sm font-semibold">
                                {request.status === 'pending' ? 'Solicitud Pendiente' : 
                                 request.status === 'approved' ? 'Solicitud Aprobada' : 'Solicitud Rechazada'}
                            </p>
                            <p className="text-xs opacity-80">
                                Recibida el {format(new Date(request.created_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Personal Info */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nombre Completo</Label>
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    {request.first_name} {request.last_name}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    {request.email}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Documento de Identidad</Label>
                                <div className="flex items-center gap-2 text-sm">
                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                    {request.document_id}
                                </div>
                            </div>
                            {request.phone && (
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Teléfono</Label>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        {request.phone}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Assignment Info */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Edificio</Label>
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    {request.building_name || '---'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Unidad Solicitada</Label>
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Home className="h-4 w-4 text-primary" />
                                    {request.unit_name || '---'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Origen</Label>
                                <div>
                                    <Badge variant="outline" className="gap-1 font-normal text-[10px]">
                                        {request.source === 'qr' ? (
                                            <><QrCode className="h-3 w-3" /> Registro vía QR</>
                                        ) : (
                                            <><Mail className="h-3 w-3" /> Invitación por Email</>
                                        )}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {request.rejection_reason && (
                        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                            <Label className="text-[10px] text-destructive uppercase font-bold tracking-wider">Motivo del rechazo</Label>
                            <p className="text-sm mt-1">{request.rejection_reason}</p>
                        </div>
                    )}

                    {isRejecting && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <Label htmlFor="reason" className="text-sm font-medium text-destructive">Motivo del Rechazo (Opcional)</Label>
                            <Textarea 
                                id="reason" 
                                placeholder="Ej: Documentación incompleta, unidad incorrecta..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="resize-none"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    {request.status === 'pending' && !isRejecting && (
                        <>
                            <Button variant="ghost" onClick={() => setIsRejecting(true)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <XCircle className="mr-2 h-4 w-4" /> Rechazar
                            </Button>
                            <Button onClick={handleApprove} disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Aprobar Residente
                            </Button>
                        </>
                    )}
                    {isRejecting && (
                        <>
                            <Button variant="ghost" onClick={() => setIsRejecting(false)}>Cancelar</Button>
                            <Button variant="destructive" onClick={handleReject} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar Rechazo
                            </Button>
                        </>
                    )}
                    {(request.status !== 'pending' || (!isRejecting && request.status === 'pending')) && (
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
