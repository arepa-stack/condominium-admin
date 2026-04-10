'use client';

import { useCallback, useEffect, useState } from 'react';
import { PettyCashPage } from '@/components/petty-cash/PettyCashPage';
import { buildingsService } from '@/lib/services/buildings.service';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { Building } from '@/types/models';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GlobalPettyCashPage() {
    const { isSuperAdmin, buildingId: contextBuildingId } = usePermissions();
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [filterBuildingId, setFilterBuildingId] = useState<string>('all');

    const loadBuildings = useCallback(async () => {
        if (!isSuperAdmin) return;
        try {
            const data = await buildingsService.getBuildings();
            setBuildings(data);
        } catch (e) {
            console.error(e);
            toast.error('No se pudieron cargar los edificios');
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        loadBuildings();
    }, [loadBuildings]);

    useEffect(() => {
        if (!isSuperAdmin && contextBuildingId) {
            setFilterBuildingId(contextBuildingId);
        }
    }, [isSuperAdmin, contextBuildingId]);

    const activeBuildingId = isSuperAdmin
        ? filterBuildingId !== 'all'
            ? filterBuildingId
            : ''
        : contextBuildingId || '';

    return (
        <div className="space-y-6">
            {isSuperAdmin && (
                <Card className="border-border/50 bg-card p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div className="w-full min-w-[200px] flex-1 md:max-w-sm">
                            <Select
                                value={filterBuildingId}
                                onValueChange={setFilterBuildingId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar edificio" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos / seleccionar…</SelectItem>
                                    {buildings.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Card>
            )}

            {!activeBuildingId ? (
                <p className="text-muted-foreground">
                    {isSuperAdmin
                        ? 'Selecciona un edificio para ver la caja chica.'
                        : 'No tienes un edificio asignado para esta vista.'}
                </p>
            ) : (
                <PettyCashPage buildingId={activeBuildingId} variant="default" />
            )}
        </div>
    );
}
