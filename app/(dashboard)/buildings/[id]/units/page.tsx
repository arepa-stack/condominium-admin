'use client';

import { useEffect, useState, useCallback } from 'react';
import { unitsService } from '@/lib/services/units.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Home,
    Building2,
    Eye,
    Search,
    MapPin,
    Users,
    AlertCircle,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/hooks/usePermissions';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Unit, Building } from '@/types/models';

export default function BuildingUnitsPage() {
    const { isSuperAdmin, user } = usePermissions();
    const params = useParams();
    const buildingId = params.id as string;

    const [units, setUnits] = useState<Unit[]>([]);
    const [building, setBuilding] = useState<Building | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');



    const fetchData = useCallback(async () => {
        if (!user || !buildingId) return;

        try {
            setIsLoading(true);
            console.log('[DEBUG] Fetching units for building:', buildingId);

            // Using Promise.allSettled to ensure list loads even if building metadata fails
            const [unitsResult, buildingResult] = await Promise.allSettled([
                unitsService.getUnits(buildingId),
                buildingsService.getBuildingById(buildingId)
            ]);

            if (unitsResult.status === 'fulfilled') {
                console.log('[DEBUG] Units loaded:', unitsResult.value.length);
                setUnits(unitsResult.value);
            } else {
                console.error('[DEBUG] Failed to load units:', unitsResult.reason);
                toast.error('Failed to load units list');
            }

            if (buildingResult.status === 'fulfilled') {
                setBuilding(buildingResult.value);
            }
        } catch (error) {
            console.error('Unexpected error in fetchData:', error);
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredUnits = units.filter(unit => {
        const matchesSearch = unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            unit.floor?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });



    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight text-white">Units</h1>
                    <p className="text-muted-foreground mt-1">Manage and view apartment details for {building?.name}</p>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4 border-white/5 bg-card/50 backdrop-blur-xl">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search unit by name or floor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-md border border-white/5 bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-white placeholder:text-muted-foreground"
                        />
                    </div>
                </div>
            </Card>

            {/* Units Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i} className="animate-pulse border-white/5 bg-card/50">
                            <CardContent className="h-32 bg-muted/10" />
                        </Card>
                    ))
                ) : filteredUnits.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-card/30 rounded-2xl border border-dashed border-white/5">
                        <Home className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-muted-foreground">No units found</p>
                    </div>
                ) : (
                    filteredUnits.map((unit) => {
                        return (
                            <Card
                                key={unit.id}
                                className="group hover:scale-[1.02] transition-all duration-300 border-white/5 bg-card/40 backdrop-blur-sm overflow-hidden hover:bg-card/60"
                            >
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors border border-primary/20 shadow-inner">
                                            <Home className="h-5 w-5 text-primary" />
                                        </div>
                                        <Link href={`/buildings/${buildingId}/units/${unit.id}`}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                                            >
                                                <Eye className="h-4 w-4 text-primary" />
                                            </Button>
                                        </Link>
                                    </div>

                                    <h3 className="font-bold text-lg text-white mb-1">
                                        Unit {unit.name}
                                    </h3>

                                    <div className="space-y-1.5 mb-5">
                                        {unit.floor ? (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <MapPin className="h-3.5 w-3.5 text-primary/50" />
                                                <span>Floor {unit.floor}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded-full w-fit border border-red-400/20">
                                                <AlertCircle className="h-3 w-3" />
                                                <span>Missing Floor</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {unit.aliquot > 0 ? (
                                                <>
                                                    <div className="h-1 w-1 rounded-full bg-primary/50" />
                                                    <span>Aliquot {unit.aliquot}%</span>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-full w-fit border border-yellow-500/20">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    <span>0% Aliquot</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <Link href={`/buildings/${buildingId}/units/${unit.id}`}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full text-xs bg-white/5 border-white/5 hover:bg-primary/20 hover:border-primary/50 hover:text-primary transition-all duration-300"
                                        >
                                            Configure Details
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>


        </div>
    );
}
