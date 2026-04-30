'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
    BookOpen,
    BriefcaseBusiness,
    Eye,
    FileText,
    Info,
    Megaphone,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
    Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Paginator } from '@/components/ui/paginator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeletons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { informationCenterService } from '@/lib/services/information-center.service';
import type {
    Announcement,
    AnnouncementCategory,
    BoardMember,
    PaginatedResponse,
    PaginationMetadata,
    RecommendedService,
    Rule,
    RuleCategory,
} from '@/types/models';
import {
    AnnouncementDialog,
    AnnouncementMetricsDialog,
    RecommendedServiceDialog,
    RuleCategoryDialog,
    RuleDialog,
} from './InformationCenterDialogs';
import {
    ANNOUNCEMENT_CATEGORY_LABELS,
    announcementCategoryOptions,
    formatDate,
} from './utils';

const PAGE_LIMIT = 20;

type TabValue = 'announcements' | 'rules' | 'services' | 'board';

function isBoardRole(role: string) {
    const normalizedRole = role.trim().toLowerCase();
    return normalizedRole === 'board' || normalizedRole === 'junta';
}

export function InformationCenterPage() {
    const pathname = usePathname();
    const params = useParams<{ id?: string }>();
    const { selectedBuildingId, availableBuildings } = useBuildingContext();
    const { isSuperAdmin, canManageBuilding } = usePermissions();
    const [tab, setTab] = useState<TabValue>('announcements');

    const urlBuildingId = pathname.startsWith('/buildings/') ? params?.id : undefined;
    const effectiveBuildingId = urlBuildingId || selectedBuildingId || undefined;
    const canManage = canManageBuilding(effectiveBuildingId);
    const selectedBuildingName = useMemo(
        () => availableBuildings.find((building) => building.id === effectiveBuildingId)?.name,
        [availableBuildings, effectiveBuildingId],
    );

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-primary/15 bg-primary/10 p-3">
                        <Info className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Centro de información</h1>
                        <p className="text-sm text-muted-foreground">
                            Cartelera, reglas, servicios recomendados y junta del condominio.
                        </p>
                    </div>
                </div>
                {isSuperAdmin && !effectiveBuildingId && (
                    <Card className="border-amber-400/40 bg-amber-50/50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        Vista global: al crear contenido deberás seleccionar el edificio. Para ver datos de un
                        edificio específico, elegilo en el selector lateral.
                    </Card>
                )}
                {effectiveBuildingId && (
                    <p className="text-sm text-muted-foreground">
                        Gestionando contenido de {selectedBuildingName || 'edificio seleccionado'}.
                    </p>
                )}
            </header>

            <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-auto">
                    <TabsTrigger value="announcements" className="gap-2">
                        <Megaphone className="h-4 w-4" />
                        Anuncios
                    </TabsTrigger>
                    <TabsTrigger value="rules" className="gap-2">
                        <BookOpen className="h-4 w-4" />
                        Reglas
                    </TabsTrigger>
                    <TabsTrigger value="services" className="gap-2">
                        <BriefcaseBusiness className="h-4 w-4" />
                        Servicios
                    </TabsTrigger>
                    <TabsTrigger value="board" className="gap-2">
                        <Users className="h-4 w-4" />
                        Junta
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="announcements" className="mt-6">
                    <AnnouncementsSection
                        buildingId={effectiveBuildingId}
                        availableBuildings={availableBuildings}
                        canManage={canManage}
                    />
                </TabsContent>
                <TabsContent value="rules" className="mt-6">
                    <RulesSection
                        buildingId={effectiveBuildingId}
                        availableBuildings={availableBuildings}
                        canManage={canManage}
                    />
                </TabsContent>
                <TabsContent value="services" className="mt-6">
                    <ServicesSection
                        buildingId={effectiveBuildingId}
                        availableBuildings={availableBuildings}
                        canManage={canManage}
                    />
                </TabsContent>
                <TabsContent value="board" className="mt-6">
                    <BoardSection buildingId={effectiveBuildingId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function AnnouncementsSection({
    buildingId,
    availableBuildings,
    canManage,
}: {
    buildingId?: string;
    availableBuildings: Array<{ id: string; name?: string }>;
    canManage: boolean;
}) {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [metadata, setMetadata] = useState<PaginationMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<'all' | AnnouncementCategory>('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [metricsOpen, setMetricsOpen] = useState(false);
    const [selected, setSelected] = useState<Announcement | null>(null);

    const load = useCallback(async () => {
        if (!buildingId) {
            setAnnouncements([]);
            setMetadata(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const response: PaginatedResponse<Announcement> =
                await informationCenterService.listAnnouncements({
                    building_id: buildingId,
                    page,
                    limit: PAGE_LIMIT,
                    search: search || undefined,
                    category: category === 'all' ? undefined : category,
                });
            setAnnouncements(response.data);
            setMetadata(response.metadata);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los anuncios');
            setAnnouncements([]);
            setMetadata(null);
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, category, page, search]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setPage(1);
    }, [buildingId]);

    const onDelete = async (announcement: Announcement) => {
        if (!window.confirm(`¿Eliminar el anuncio "${announcement.title}"?`)) return;
        try {
            await informationCenterService.deleteAnnouncement(announcement.id);
            toast.success('Anuncio eliminado correctamente');
            load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el anuncio');
        }
    };

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Cartelera</h2>
                    <p className="text-sm text-muted-foreground">Avisos activos y métricas de lectura.</p>
                </div>
                {canManage && (
                    <Button
                        onClick={() => {
                            setSelected(null);
                            setDialogOpen(true);
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo anuncio
                    </Button>
                )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                <form
                    className="relative flex-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        setPage(1);
                        setSearch(searchInput.trim());
                    }}
                >
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Buscar anuncios..."
                        className="pl-9"
                    />
                </form>
                <Select
                    value={category}
                    onValueChange={(value) => {
                        setPage(1);
                        setCategory(value as 'all' | AnnouncementCategory);
                    }}
                >
                    <SelectTrigger className="w-full sm:w-56">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {announcementCategoryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <TableSkeleton rows={6} columns={6} />
            ) : announcements.length === 0 ? (
                <EmptyState
                    icon={Megaphone}
                    title="Sin anuncios"
                    message="No hay anuncios que coincidan con los filtros actuales."
                    action={
                        canManage ? (
                            <Button onClick={() => setDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Crear anuncio
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Lecturas</TableHead>
                            <TableHead>Vence</TableHead>
                            <TableHead>Adjunto</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {announcements.map((announcement) => (
                            <TableRow key={announcement.id}>
                                <TableCell className="max-w-md whitespace-normal">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{announcement.title}</span>
                                        {announcement.is_pinned && <Badge variant="warning">Fijado</Badge>}
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                        {announcement.content_preview || announcement.content}
                                    </p>
                                </TableCell>
                                <TableCell>
                                    <CategoryBadge category={announcement.category} />
                                </TableCell>
                                <TableCell>
                                    {announcement.metrics?.reads_count ?? 0} /{' '}
                                    {announcement.metrics?.reactions_count ?? 0} entendidos
                                </TableCell>
                                <TableCell>{formatDate(announcement.expires_at)}</TableCell>
                                <TableCell>
                                    {announcement.attachment_url ? (
                                        <a
                                            className="text-primary underline-offset-4 hover:underline"
                                            href={announcement.attachment_url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Ver archivo
                                        </a>
                                    ) : (
                                        <span className="text-muted-foreground">Sin adjunto</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onSelect={() => {
                                                    setSelected(announcement);
                                                    setMetricsOpen(true);
                                                }}
                                            >
                                                <Eye className="h-4 w-4" />
                                                Métricas
                                            </DropdownMenuItem>
                                            {canManage && (
                                                <>
                                                    <DropdownMenuItem
                                                        onSelect={() => {
                                                            setSelected(announcement);
                                                            setDialogOpen(true);
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onSelect={() => onDelete(announcement)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Eliminar
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <Paginator metadata={metadata} isLoading={isLoading} onPageChange={setPage} />

            <AnnouncementDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                announcement={selected}
                buildingId={buildingId}
                availableBuildings={availableBuildings}
                onSuccess={load}
            />
            <AnnouncementMetricsDialog open={metricsOpen} onOpenChange={setMetricsOpen} announcement={selected} />
        </section>
    );
}

function RulesSection({
    buildingId,
    availableBuildings,
    canManage,
}: {
    buildingId?: string;
    availableBuildings: Array<{ id: string; name?: string }>;
    canManage: boolean;
}) {
    const [categories, setCategories] = useState<RuleCategory[]>([]);
    const [rules, setRules] = useState<Rule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<RuleCategory | null>(null);
    const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

    const load = useCallback(async () => {
        if (!buildingId) {
            setCategories([]);
            setRules([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const [categoryData, ruleData] = await Promise.all([
                informationCenterService.listRuleCategories({
                    building_id: buildingId,
                    include_inactive: true,
                }),
                informationCenterService.listRules({
                    building_id: buildingId,
                    include_unpublished: true,
                }),
            ]);
            setCategories(categoryData);
            setRules(ruleData);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las reglas');
            setCategories([]);
            setRules([]);
        } finally {
            setIsLoading(false);
        }
    }, [buildingId]);

    useEffect(() => {
        load();
    }, [load]);

    const onDeleteRule = async (rule: Rule) => {
        if (!window.confirm(`¿Eliminar la regla "${rule.title}"?`)) return;
        try {
            await informationCenterService.deleteRule(rule.id);
            toast.success('Regla eliminada correctamente');
            load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la regla');
        }
    };

    const categoryNameById = useMemo(
        () => new Map(categories.map((categoryItem) => [categoryItem.id, categoryItem.name])),
        [categories],
    );

    return (
        <section className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Reglas del condominio</h2>
                    <p className="text-sm text-muted-foreground">Categorías y normas publicadas o en borrador.</p>
                </div>
                {canManage && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedCategory(null);
                                setCategoryDialogOpen(true);
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Categoría
                        </Button>
                        <Button
                            onClick={() => {
                                setSelectedRule(null);
                                setRuleDialogOpen(true);
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Regla
                        </Button>
                    </div>
                )}
            </div>

            {isLoading ? (
                <TableSkeleton rows={6} columns={5} />
            ) : (
                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
                    <Card className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">Categorías</h3>
                            <Badge variant="secondary">{categories.length}</Badge>
                        </div>
                        {categories.length === 0 ? (
                            <EmptyState
                                variant="inline"
                                icon={BookOpen}
                                message="Aún no hay categorías de reglas."
                            />
                        ) : (
                            <div className="space-y-2">
                                {categories.map((categoryItem) => (
                                    <div
                                        key={categoryItem.id}
                                        className="flex items-start justify-between gap-3 rounded-lg border border-border/50 p-3"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{categoryItem.name}</p>
                                                {!categoryItem.is_active && (
                                                    <Badge variant="outline">Inactiva</Badge>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {categoryItem.description || 'Sin descripción'}
                                            </p>
                                        </div>
                                        {canManage && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setSelectedCategory(categoryItem);
                                                    setCategoryDialogOpen(true);
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {rules.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title="Sin reglas"
                            message="No hay reglas registradas para el filtro actual."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Regla</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Adjunto</TableHead>
                                    <TableHead className="w-12" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.map((rule) => (
                                    <TableRow key={rule.id}>
                                        <TableCell className="max-w-md whitespace-normal">
                                            <p className="font-medium">{rule.title}</p>
                                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                {rule.content}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            {rule.category_id
                                                ? categoryNameById.get(rule.category_id) || 'Sin categoría'
                                                : 'Sin categoría'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={rule.is_published ? 'success' : 'outline'}>
                                                {rule.is_published ? 'Publicada' : 'Borrador'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {rule.attachment_url ? (
                                                <a
                                                    className="text-primary underline-offset-4 hover:underline"
                                                    href={rule.attachment_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Ver archivo
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground">Sin adjunto</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {canManage && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onSelect={() => {
                                                                setSelectedRule(rule);
                                                                setRuleDialogOpen(true);
                                                            }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            onSelect={() => onDeleteRule(rule)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            )}

            <RuleCategoryDialog
                open={categoryDialogOpen}
                onOpenChange={setCategoryDialogOpen}
                category={selectedCategory}
                buildingId={buildingId}
                availableBuildings={availableBuildings}
                onSuccess={load}
            />
            <RuleDialog
                open={ruleDialogOpen}
                onOpenChange={setRuleDialogOpen}
                rule={selectedRule}
                categories={categories}
                buildingId={buildingId}
                availableBuildings={availableBuildings}
                onSuccess={load}
            />
        </section>
    );
}

function ServicesSection({
    buildingId,
    availableBuildings,
    canManage,
}: {
    buildingId?: string;
    availableBuildings: Array<{ id: string; name?: string }>;
    canManage: boolean;
}) {
    const [services, setServices] = useState<RecommendedService[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selected, setSelected] = useState<RecommendedService | null>(null);

    const load = useCallback(async () => {
        if (!buildingId) {
            setServices([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const data = await informationCenterService.listRecommendedServices({
                building_id: buildingId,
                include_inactive: true,
            });
            setServices(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los servicios');
            setServices([]);
        } finally {
            setIsLoading(false);
        }
    }, [buildingId]);

    useEffect(() => {
        load();
    }, [load]);

    const onDelete = async (service: RecommendedService) => {
        if (!window.confirm(`¿Desactivar el servicio "${service.name}"?`)) return;
        try {
            await informationCenterService.deleteRecommendedService(service.id);
            toast.success('Servicio desactivado correctamente');
            load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo desactivar el servicio');
        }
    };

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Servicios recomendados</h2>
                    <p className="text-sm text-muted-foreground">Contactos útiles disponibles para residentes.</p>
                </div>
                {canManage && (
                    <Button
                        onClick={() => {
                            setSelected(null);
                            setDialogOpen(true);
                        }}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo servicio
                    </Button>
                )}
            </div>
            {isLoading ? (
                <TableSkeleton rows={6} columns={6} />
            ) : services.length === 0 ? (
                <EmptyState
                    icon={BriefcaseBusiness}
                    title="Sin servicios"
                    message="Aún no hay servicios recomendados registrados."
                    action={
                        canManage ? (
                            <Button onClick={() => setDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Crear servicio
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Servicio</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {services.map((service) => (
                            <TableRow key={service.id}>
                                <TableCell className="max-w-md whitespace-normal">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">{service.name}</p>
                                        {service.is_recommended && <Badge variant="info">Recomendado</Badge>}
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                        {service.description || service.availability || 'Sin descripción'}
                                    </p>
                                </TableCell>
                                <TableCell>{service.category}</TableCell>
                                <TableCell>
                                    <div className="text-sm">
                                        <p>{service.phone || 'Sin teléfono'}</p>
                                        <p className="text-xs text-muted-foreground">{service.email || 'Sin email'}</p>
                                    </div>
                                </TableCell>
                                <TableCell>{service.rating ?? 'Sin rating'}</TableCell>
                                <TableCell>
                                    <Badge variant={service.is_active ? 'success' : 'outline'}>
                                        {service.is_active ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {canManage && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        setSelected(service);
                                                        setDialogOpen(true);
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onSelect={() => onDelete(service)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Desactivar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
            <RecommendedServiceDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                service={selected}
                buildingId={buildingId}
                availableBuildings={availableBuildings}
                onSuccess={load}
            />
        </section>
    );
}

function BoardSection({ buildingId }: { buildingId?: string }) {
    const [members, setMembers] = useState<BoardMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!buildingId) {
            setMembers([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const data = await informationCenterService.getCurrentBoard(buildingId);
            setMembers(data.filter((member) => isBoardRole(member.role)));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo cargar la junta');
            setMembers([]);
        } finally {
            setIsLoading(false);
        }
    }, [buildingId]);

    useEffect(() => {
        load();
    }, [load]);

    if (isLoading) return <TableSkeleton rows={4} columns={4} />;

    if (members.length === 0) {
        return (
            <EmptyState
                icon={Users}
                title="Sin junta registrada"
                message="No hay miembros de junta disponibles para el edificio actual."
            />
        );
    }

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold">Junta actual</h2>
                <p className="text-sm text-muted-foreground">Información de contacto de los miembros activos.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((member) => (
                    <Card key={member.member_id} className="p-5">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                {member.profile.name[0]?.toUpperCase() || 'J'}
                            </div>
                            <div className="min-w-0">
                                <p className="font-semibold">{member.profile.name}</p>
                                <p className="text-xs text-muted-foreground">{member.unit?.name || 'Sin unidad'}</p>
                            </div>
                        </div>
                        <div className="mt-4 space-y-1 text-sm">
                            <p className="truncate">{member.profile.email}</p>
                            <p className="text-muted-foreground">{member.profile.phone || 'Sin teléfono'}</p>
                        </div>
                    </Card>
                ))}
            </div>
        </section>
    );
}

function CategoryBadge({ category }: { category: AnnouncementCategory }) {
    const variant =
        category === 'URGENT'
            ? 'destructive'
            : category === 'MAINTENANCE'
              ? 'warning'
              : category === 'NEWS'
                ? 'info'
                : 'secondary';

    return <Badge variant={variant}>{ANNOUNCEMENT_CATEGORY_LABELS[category]}</Badge>;
}
