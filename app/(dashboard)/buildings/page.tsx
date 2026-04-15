'use client';

import { useEffect, useState } from 'react';
import { buildingsService } from '@/lib/services/buildings.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Building2 } from 'lucide-react';
import { BuildingDialog } from '@/components/buildings/BuildingDialog';
import type { Building } from '@/types/models';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { getErrorMessage } from '@/lib/utils/errors';
import { useRouter } from 'next/navigation';

export default function BuildingsPage() {
    const { isSuperAdmin, isBoardMember, user: currentUser, getBoardBuildings } = usePermissions();
    const { confirm, ConfirmDialog } = useConfirmDialog();
    const router = useRouter();
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

    const fetchBuildings = async () => {
        try {
            setIsLoading(true);
            const data = await buildingsService.getBuildings();

            // Filter by board buildings if not admin
            if (!isSuperAdmin) {
                const boardBuildingIds = getBoardBuildings();
                setBuildings(data.filter(b => boardBuildingIds.includes(b.id)));
            } else {
                setBuildings(data);
            }
        } catch (error) {
            console.error('Failed to fetch buildings:', error);
            toast.error('Error al cargar los edificios');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Wait for permissions to be resolved before redirecting
        if (!isSuperAdmin && !isBoardMember) {
            return;
        }

        const boardBuildings = getBoardBuildings();

        // Direct redirect for single-building board members
        if (!isSuperAdmin && boardBuildings.length === 1) {
            router.push(`/buildings/${boardBuildings[0]}/dashboard`);
            return;
        }

        // Fetch buildings for admin or multi-building board
        if (isSuperAdmin || boardBuildings.length > 0) {
            fetchBuildings();
        }
    }, [isSuperAdmin, isBoardMember, router]);

    const handleCreate = () => {
        setSelectedBuilding(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (building: Building) => {
        setSelectedBuilding(building);
        setIsDialogOpen(true);
    };

    const handleDelete = async (buildingId: string) => {
        const ok = await confirm({
            title: 'Eliminar edificio',
            description: '¿Seguro que querés eliminar este edificio? Esta acción no se puede deshacer.',
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            variant: 'destructive',
        });
        if (!ok) return;
        try {
            await buildingsService.deleteBuilding(buildingId);
            toast.success('Edificio eliminado');
            fetchBuildings();
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error, 'Error al eliminar el edificio'));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Edificios</h1>
                    <p className="text-muted-foreground mt-1">Gestioná los complejos residenciales</p>
                </div>
                {isSuperAdmin && (
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Agregar edificio
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <p className="text-muted-foreground col-span-full text-center py-8">Cargando edificios...</p>
                ) : buildings.length === 0 ? (
                    <Card className="col-span-full border-dashed">
                        <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-lg font-medium text-foreground">No se encontraron edificios</p>
                            <p className="text-muted-foreground mb-4">Empezá creando tu primer edificio.</p>
                            <Button onClick={handleCreate}>Crear edificio</Button>
                        </CardContent>
                    </Card>
                ) : (
                    buildings.map((building) => (
                        <Card key={building.id} className="hover:shadow-lg transition-shadow duration-200">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="bg-primary/10 p-3 rounded-lg">
                                        <Building2 className="h-6 w-6 text-primary" />
                                    </div>
                                    {isSuperAdmin && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(building)}
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(building.id)}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <h3 className="font-semibold text-xl mb-2">{building.name}</h3>
                                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                                    {building.address}
                                </p>
                                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                    <span className="text-sm text-muted-foreground">
                                        {building.total_units || 0} Unidades
                                    </span>
                                    <Button variant="outline" size="sm" onClick={() => router.push(`/buildings/${building.id}/dashboard`)}>
                                        Ver panel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <BuildingDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                building={selectedBuilding}
                onSuccess={fetchBuildings}
            />
            {ConfirmDialog}
        </div>
    );
}
