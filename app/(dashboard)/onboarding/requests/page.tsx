'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeletons';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
    Inbox,
    Eye,
    Phone,
    Mail,
    UserCheck,
    Archive,
    MoreHorizontal,
    Building2,
    MapPin,
    Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LeadDialog } from '@/components/leads/LeadDialog';
import { leadsService, type Lead, type LeadStatus } from '@/lib/services/leads.service';

const STATUS_LABEL: Record<LeadStatus, string> = {
    new: 'Nueva',
    viewed: 'Vista',
    contacted: 'Contactada',
    archived: 'Archivada',
};

const STATUS_VARIANT: Record<LeadStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    new: 'default',
    viewed: 'secondary',
    contacted: 'default',
    archived: 'outline',
};

export default function SolicitudesPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fetchLeads = useCallback(async () => {
        try {
            setIsLoading(true);
            const params = filterStatus !== 'all' ? { status: filterStatus as LeadStatus } : undefined;
            const data = await leadsService.getLeads(params);
            setLeads(data);

            // Auto-mark new leads as viewed so the sidebar badge resets
            const newIds = data.filter(l => l.status === 'new').map(l => l.id);
            if (newIds.length > 0) {
                await Promise.allSettled(
                    newIds.map(id => leadsService.updateLeadStatus(id, 'viewed'))
                );
            }
        } catch {
            toast.error('Error al cargar las solicitudes');
        } finally {
            setIsLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    const handleView = (lead: Lead) => {
        setSelectedLead(lead);
        setIsDialogOpen(true);
    };

    const handleQuickStatus = async (lead: Lead, status: Exclude<LeadStatus, 'new'>) => {
        try {
            await leadsService.updateLeadStatus(lead.id, status);
            toast.success('Estado actualizado');
            fetchLeads();
        } catch {
            toast.error('Error al actualizar el estado');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display tracking-tight">
                        Solicitudes
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Empresas y edificios interesados en la plataforma
                    </p>
                </div>
            </div>

            <FilterBar>
                <div className="w-full md:w-52">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="new">Nuevas</SelectItem>
                            <SelectItem value="viewed">Vistas</SelectItem>
                            <SelectItem value="contacted">Contactadas</SelectItem>
                            <SelectItem value="archived">Archivadas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </FilterBar>

            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden">
                {isLoading ? (
                    <TableSkeleton rows={5} columns={6} />
                ) : leads.length === 0 ? (
                    <EmptyState
                        icon={Inbox}
                        message="No hay solicitudes que coincidan con los filtros"
                        variant="inline"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Contacto</TableHead>
                                    <TableHead>Edificio / Ubicación</TableHead>
                                    <TableHead>Residentes</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leads.map((lead) => (
                                    <TableRow key={lead.id} className={lead.status === 'new' ? 'bg-primary/5' : ''}>
                                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                            {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: es })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium text-sm">{lead.full_name}</div>
                                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                                            <div className="text-xs text-muted-foreground">{lead.contact}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm font-medium">
                                                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                                {lead.building_name}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                <MapPin className="h-3 w-3 shrink-0" />
                                                {lead.location}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm">
                                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                                {lead.estimated_users}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={STATUS_VARIANT[lead.status]} className="text-[10px]">
                                                {lead.status === 'new' && (
                                                    <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current inline-block" />
                                                )}
                                                {STATUS_LABEL[lead.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    title="Ver detalle"
                                                    onClick={() => handleView(lead)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <a href={`mailto:${lead.email}`}>
                                                                <Mail className="mr-2 h-4 w-4" />
                                                                Enviar email
                                                            </a>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild>
                                                            <a
                                                                href={`https://wa.me/${lead.contact.replace(/\D/g, '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                <Phone className="mr-2 h-4 w-4" />
                                                                WhatsApp
                                                            </a>
                                                        </DropdownMenuItem>
                                                        {lead.status !== 'contacted' && (
                                                            <DropdownMenuItem
                                                                onClick={() => handleQuickStatus(lead, 'contacted')}
                                                                className="text-chart-1"
                                                            >
                                                                <UserCheck className="mr-2 h-4 w-4" />
                                                                Marcar contactada
                                                            </DropdownMenuItem>
                                                        )}
                                                        {lead.status !== 'archived' && (
                                                            <DropdownMenuItem
                                                                onClick={() => handleQuickStatus(lead, 'archived')}
                                                                className="text-muted-foreground"
                                                            >
                                                                <Archive className="mr-2 h-4 w-4" />
                                                                Archivar
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            <LeadDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                lead={selectedLead}
                onStatusUpdated={fetchLeads}
            />
        </div>
    );
}
