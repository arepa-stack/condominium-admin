'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { directoryService } from '@/lib/services/directory.service';
import { getErrorMessage } from '@/lib/utils/errors';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Plus, Phone, Mail, Clock, Home, Edit, Trash2,
    Users, HardHat, ShieldCheck, Loader2,
} from 'lucide-react';
import { BoardMemberDialog } from '@/components/directory/BoardMemberDialog';
import { WorkerDialog } from '@/components/directory/WorkerDialog';
import type { BoardMember, Worker } from '@/types/models';

function initials(first: string, last: string) {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function contactButton(type: 'phone' | 'email' | 'whatsapp', value: string | null | undefined) {
    if (!value) return null;
    const clean = value.trim();
    if (!clean) return null;

    if (type === 'phone') {
        return (
            <a href={`tel:${clean}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                <Phone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{clean}</span>
            </a>
        );
    }
    if (type === 'whatsapp') {
        const digits = clean.replace(/\D/g, '');
        return (
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-green-500 transition-colors">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                <span className="hidden sm:inline">WhatsApp</span>
            </a>
        );
    }
    if (type === 'email') {
        return (
            <a href={`mailto:${clean}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                <Mail className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{clean}</span>
            </a>
        );
    }
    return null;
}

export default function DirectoryPage() {
    const params = useParams();
    const buildingId = params.id as string;
    const { isSuperAdmin, canManageBuilding } = usePermissions();
    const { confirm, ConfirmDialog } = useConfirmDialog();

    const canEdit = canManageBuilding(buildingId);

    const [activeTab, setActiveTab] = useState<'board' | 'workers'>('board');
    const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [showInactive, setShowInactive] = useState(false);

    // Board dialog
    const [isBoardDialogOpen, setIsBoardDialogOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<BoardMember | null>(null);

    // Worker dialog
    const [isWorkerDialogOpen, setIsWorkerDialogOpen] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

    const fetchData = useCallback(async () => {
        if (!buildingId) return;
        setIsLoading(true);
        try {
            const [board, work] = await Promise.all([
                canEdit
                    ? directoryService.getBoardMembers(buildingId)
                    : directoryService.getCurrentBoard(buildingId),
                canEdit
                    ? directoryService.getWorkers(buildingId)
                    : directoryService.getActiveWorkers(buildingId),
            ]);
            setBoardMembers(board);
            setWorkers(work);
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error, 'Error al cargar el directorio'));
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, canEdit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Handlers ──────────────────────────────────────────────────────

    const handleEditMember = (m: BoardMember) => { setSelectedMember(m); setIsBoardDialogOpen(true); };
    const handleNewMember = () => { setSelectedMember(null); setIsBoardDialogOpen(true); };

    const handleDeleteMember = async (m: BoardMember) => {
        const ok = await confirm({
            title: 'Dar de baja miembro',
            description: `¿Seguro que querés dar de baja a ${m.first_name} ${m.last_name}?`,
            confirmText: 'Dar de baja',
            variant: 'destructive',
        });
        if (!ok) return;
        try {
            await directoryService.deleteBoardMember(buildingId, m.id);
            toast.success('Miembro dado de baja');
            fetchData();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al dar de baja'));
        }
    };

    const handleEditWorker = (w: Worker) => { setSelectedWorker(w); setIsWorkerDialogOpen(true); };
    const handleNewWorker = () => { setSelectedWorker(null); setIsWorkerDialogOpen(true); };

    const handleDeleteWorker = async (w: Worker) => {
        const ok = await confirm({
            title: 'Dar de baja trabajador',
            description: `¿Seguro que querés dar de baja a ${w.first_name} ${w.last_name}?`,
            confirmText: 'Dar de baja',
            variant: 'destructive',
        });
        if (!ok) return;
        try {
            await directoryService.deleteWorker(buildingId, w.id);
            toast.success('Trabajador dado de baja');
            fetchData();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al dar de baja'));
        }
    };

    // ── Filtered lists ───────────────────────────────────────────────

    const visibleBoard = showInactive
        ? boardMembers
        : boardMembers.filter(m => m.is_active && m.is_current_board);

    const visibleWorkers = showInactive
        ? workers
        : workers.filter(w => w.is_active);

    // ── Render ────────────────────────────────────────────────────────

    const skeletonCards = Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="animate-pulse border-white/5 bg-card/50">
            <CardContent className="h-36 bg-muted/10" />
        </Card>
    ));

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Directorio</h1>
                    <p className="text-muted-foreground mt-1">Junta de condominio y personal residencial del edificio.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'board' | 'workers')} className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <TabsList className="grid w-full max-w-[360px] grid-cols-2">
                        <TabsTrigger value="board" className="gap-2"><ShieldCheck className="h-4 w-4" /> Junta Actual</TabsTrigger>
                        <TabsTrigger value="workers" className="gap-2"><HardHat className="h-4 w-4" /> Personal</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-3">
                        {canEdit && (
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
                                    className="rounded border-border bg-background" />
                                Mostrar inactivos
                            </label>
                        )}
                        {canEdit && activeTab === 'board' && (
                            <Button size="sm" onClick={handleNewMember} className="gap-2">
                                <Plus className="h-4 w-4" /> Agregar miembro
                            </Button>
                        )}
                        {canEdit && activeTab === 'workers' && (
                            <Button size="sm" onClick={handleNewWorker} className="gap-2">
                                <Plus className="h-4 w-4" /> Agregar trabajador
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Board Members ─────────────────────────────────────────── */}
                <TabsContent value="board" className="space-y-4">
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{skeletonCards}</div>
                    ) : visibleBoard.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                                <Users className="h-12 w-12 text-muted-foreground/20 mb-3" />
                                <p className="text-muted-foreground">No hay miembros de junta publicados actualmente.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {visibleBoard.map(m => (
                                <Card key={m.id} className="group hover:scale-[1.01] transition-all duration-200 border-white/5 bg-card/40 backdrop-blur-sm overflow-hidden hover:bg-card/60">
                                    <CardContent className="p-5">
                                        <div className="flex items-start gap-4">
                                            <Avatar className="h-14 w-14 border-2 border-primary/15">
                                                <AvatarImage src={m.photo_url ?? undefined} alt={`${m.first_name} ${m.last_name}`} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                    {initials(m.first_name, m.last_name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-white truncate">{m.first_name} {m.last_name}</h3>
                                                    {!m.is_active && <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Inactivo</Badge>}
                                                    {m.is_current_board && m.is_active && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Actual</Badge>}
                                                </div>
                                                <p className="text-sm text-primary font-medium">{m.role}</p>
                                                {m.apartment_number && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <Home className="h-3 w-3" /> Apto {m.apartment_number}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-white/5">
                                            {contactButton('phone', m.phone)}
                                            {contactButton('whatsapp', m.phone)}
                                            {contactButton('email', m.email)}
                                        </div>

                                        {canEdit && (
                                            <div className="flex justify-end gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditMember(m)}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDeleteMember(m)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ── Workers ──────────────────────────────────────────────── */}
                <TabsContent value="workers" className="space-y-4">
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{skeletonCards}</div>
                    ) : visibleWorkers.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                                <HardHat className="h-12 w-12 text-muted-foreground/20 mb-3" />
                                <p className="text-muted-foreground">No hay trabajadores activos publicados actualmente.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {visibleWorkers.map(w => (
                                <Card key={w.id} className="group hover:scale-[1.01] transition-all duration-200 border-white/5 bg-card/40 backdrop-blur-sm overflow-hidden hover:bg-card/60">
                                    <CardContent className="p-5">
                                        <div className="flex items-start gap-4">
                                            <Avatar className="h-14 w-14 border-2 border-primary/15">
                                                <AvatarImage src={w.photo_url ?? undefined} alt={`${w.first_name} ${w.last_name}`} />
                                                <AvatarFallback className="bg-chart-2/10 text-chart-2 font-bold">
                                                    {initials(w.first_name, w.last_name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-white truncate">{w.first_name} {w.last_name}</h3>
                                                    {!w.is_active && <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Inactivo</Badge>}
                                                </div>
                                                <p className="text-sm text-chart-2 font-medium">{w.role}</p>
                                                {w.work_schedule && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <Clock className="h-3 w-3" /> {w.work_schedule}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-white/5">
                                            {contactButton('phone', w.phone)}
                                            {contactButton('whatsapp', w.phone)}
                                        </div>

                                        {canEdit && (
                                            <div className="flex justify-end gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditWorker(w)}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => handleDeleteWorker(w)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            <BoardMemberDialog
                open={isBoardDialogOpen}
                onOpenChange={setIsBoardDialogOpen}
                buildingId={buildingId}
                member={selectedMember}
                onSuccess={fetchData}
            />
            <WorkerDialog
                open={isWorkerDialogOpen}
                onOpenChange={setIsWorkerDialogOpen}
                buildingId={buildingId}
                worker={selectedWorker}
                onSuccess={fetchData}
            />
            {ConfirmDialog}
        </div>
    );
}
