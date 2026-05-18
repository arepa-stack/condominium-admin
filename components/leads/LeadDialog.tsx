'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2, Mail, Phone, MapPin, Users, Calendar, Archive, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Lead, LeadStatus } from '@/lib/services/leads.service';
import { leadsService } from '@/lib/services/leads.service';
import { toast } from 'sonner';

interface LeadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lead: Lead | null;
    onStatusUpdated?: () => void;
}

const STATUS_LABELS: Record<LeadStatus, string> = {
    new: 'Nueva',
    viewed: 'Vista',
    contacted: 'Contactada',
    archived: 'Archivada',
};

const STATUS_VARIANTS: Record<LeadStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    new: 'default',
    viewed: 'secondary',
    contacted: 'default',
    archived: 'outline',
};

export function LeadDialog({ open, onOpenChange, lead, onStatusUpdated }: LeadDialogProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<Exclude<LeadStatus, 'new'> | ''>('');

    if (!lead) return null;

    const handleStatusChange = async () => {
        if (!pendingStatus) return;
        setIsSaving(true);
        try {
            await leadsService.updateLeadStatus(lead.id, pendingStatus);
            toast.success('Estado actualizado');
            setPendingStatus('');
            onStatusUpdated?.();
            onOpenChange(false);
        } catch {
            toast.error('Error al actualizar el estado');
        } finally {
            setIsSaving(false);
        }
    };

    const formattedDate = format(new Date(lead.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {lead.building_name}
                    </DialogTitle>
                    <DialogDescription>
                        Solicitud de demo / descarga — {formattedDate}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Estado actual</span>
                        <Badge variant={STATUS_VARIANTS[lead.status]}>
                            {STATUS_LABELS[lead.status]}
                        </Badge>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">{lead.full_name}</p>
                                <p className="text-xs text-muted-foreground">Contacto</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">{lead.email}</p>
                                <p className="text-xs text-muted-foreground">Email</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">{lead.contact}</p>
                                <p className="text-xs text-muted-foreground">Teléfono / WhatsApp</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">{lead.location}</p>
                                <p className="text-xs text-muted-foreground">Ubicación</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">{lead.estimated_users}</p>
                                <p className="text-xs text-muted-foreground">Residentes estimados</p>
                            </div>
                        </div>
                        {lead.contacted_at && (
                            <div className="flex items-start gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium">
                                        {format(new Date(lead.contacted_at), "d 'de' MMMM yyyy", { locale: es })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Fecha de contacto</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="flex items-center gap-2">
                        <a
                            href={`mailto:${lead.email}`}
                            className="flex-1"
                        >
                            <Button variant="outline" className="w-full gap-2" size="sm">
                                <Mail className="h-4 w-4" />
                                Enviar email
                            </Button>
                        </a>
                        <a
                            href={`https://wa.me/${lead.contact.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1"
                        >
                            <Button variant="outline" className="w-full gap-2" size="sm">
                                <Phone className="h-4 w-4" />
                                WhatsApp
                            </Button>
                        </a>
                    </div>

                    {lead.status !== 'archived' && (
                        <div className="flex items-center gap-2">
                            <Select
                                value={pendingStatus}
                                onValueChange={(v) => setPendingStatus(v as Exclude<LeadStatus, 'new'>)}
                            >
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Cambiar estado..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {lead.status !== 'viewed' && (
                                        <SelectItem value="viewed">Marcar como vista</SelectItem>
                                    )}
                                    {lead.status !== 'contacted' && (
                                        <SelectItem value="contacted">
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="h-3.5 w-3.5" />
                                                Marcar como contactada
                                            </div>
                                        </SelectItem>
                                    )}
                                    <SelectItem value="archived">
                                        <div className="flex items-center gap-2">
                                            <Archive className="h-3.5 w-3.5" />
                                            Archivar
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={handleStatusChange}
                                disabled={!pendingStatus || isSaving}
                                size="sm"
                            >
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
