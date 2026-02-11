'use client';

import { useEffect, useState, useCallback } from 'react';
import { unitsService } from '@/lib/services/units.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
    Home,
    Building2,
    Eye,
    Search,
    MapPin,
    Users
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/hooks/usePermissions';
import Link from 'next/link';
import type { Unit, Building } from '@/types/models';

export default function UnitsPage() {
    const { isSuperAdmin, buildingId, user } = usePermissions();
    const { availableBuildings } = useBuildingContext();

    const [units, setUnits] = useState<Unit[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterBuildingId, setFilterBuildingId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');



    const activeBuildingId = filterBuildingId !== 'all' ? filterBuildingId : undefined;

    const fetchData = useCallback(async () => {
        if (!user) return; // Wait for auth

        try {
            setIsLoading(true);

            // Fetch buildings first
            let buildingsData: Building[] = [];
            if (isSuperAdmin) {
                buildingsData = await buildingsService.getBuildings();
            } else {
                // For board members, format available buildings from context
                if (availableBuildings.length > 0) {
                    buildingsData = availableBuildings.map(b => ({
                        id: b.id,
                        name: b.name || 'Unknown Building',
                        address: '',
                        total_units: 0
                    } as Building));
                } else {
                    // Safety check: if availableBuildings is empty, units will be empty
                    // unless we are still loading user data
                    setUnits([]);
                    setBuildings([]);
                    setIsLoading(false);
                    return;
                }
            }
            setBuildings(buildingsData);

            // Fetch units
            let allUnits: Unit[] = [];
            if (activeBuildingId) {
                allUnits = await unitsService.getUnits(activeBuildingId);
            } else if (buildingsData.length > 0) {
                // Fetch for all available buildings
                const unitPromises = buildingsData.map(b => unitsService.getUnits(b.id));
                const results = await Promise.all(unitPromises);
                allUnits = results.flat();
            }

            setUnits(allUnits);
        } catch (error) {
            console.error('Failed to fetch units:', error);
            toast.error('Failed to load units');
        } finally {
            setIsLoading(false);
        }
    }, [isSuperAdmin, activeBuildingId, availableBuildings, user]);

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
                    <h1 className="text-3xl font-bold text-foreground">Units</h1>
                    <p className="text-muted-foreground mt-1">Manage and view apartment details</p>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4 border-border/50 bg-card">
                <div className="flex flex-wrap gap-4">
                    <div className="w-full md:w-64">
                        <SearchableSelect
                            options={[
                                { value: 'all', label: isSuperAdmin ? 'All Buildings' : 'My Buildings' },
                                ...buildings.map(b => ({
                                    value: b.id,
                                    label: b.name,
                                    icon: Building2
                                }))
                            ]}
                            value={filterBuildingId}
                            onValueChange={setFilterBuildingId}
                            placeholder="Select Building"
                            triggerIcon={Building2}
                        />
                    </div>
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search unit by name or floor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </Card>

            {/* Units Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="h-32 bg-muted/20" />
                        </Card>
                    ))
                ) : filteredUnits.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-muted/10 rounded-lg border border-dashed border-border/50">
                        <Home className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground">No units found</p>
                    </div>
                ) : (
                    filteredUnits.map((unit) => {
                        const building = buildings.find(b => b.id === unit.building_id);
                        return (
                            <Card
                                key={unit.id}
                                className="group hover:shadow-md transition-all duration-200 border-border/50 bg-card overflow-hidden"
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                            <Home className="h-5 w-5 text-primary" />
                                        </div>
                                        <Link href={`/buildings/${unit.building_id}/units/${unit.id}`}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Eye className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                            </Button>
                                        </Link>
                                    </div>

                                    <h3 className="font-semibold text-lg text-foreground mb-1">
                                        Unit {unit.name}
                                    </h3>

                                    <div className="space-y-1.5 mb-4">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Building2 className="h-3 w-3" />
                                            <span className="truncate">{building?.name || 'Loading building...'}</span>
                                        </div>
                                        {unit.floor && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                <span>Floor {unit.floor}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                                Details
                                            </span>
                                        </div>
                                        <Link href={`/buildings/${unit.building_id}/units/${unit.id}`}>
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0 text-xs"
                                            >
                                                Manage
                                            </Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>


        </div>
    );
}
