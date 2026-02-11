'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { buildingsService } from '@/lib/services/buildings.service';

interface BuildingContextType {
    selectedBuildingId: string | null;
    setSelectedBuildingId: (id: string | null) => void;
    availableBuildings: Array<{ id: string; name?: string }>;
}

const BuildingContext = createContext<BuildingContextType | undefined>(undefined);

export function BuildingProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
    const [availableBuildings, setAvailableBuildings] = useState<Array<{ id: string; name?: string }>>([]);

    // Fetch building details based on role
    useEffect(() => {
        const fetchBuildings = async () => {
            try {
                if (user?.role === 'admin') {
                    // Super Admin sees all buildings
                    const allBuildings = await buildingsService.getBuildings();
                    setAvailableBuildings(allBuildings.map(b => ({ id: b.id, name: b.name })));
                } else if (user?.units) {
                    // Board Members see unique buildings where they have board role
                    const boardBuildingsMap = new Map<string, { id: string; name?: string }>();
                    user.units.forEach(unit => {
                        const role = unit.building_role?.toLowerCase();
                        if (role === 'board' && unit.building_id) {
                            if (!boardBuildingsMap.has(unit.building_id)) {
                                boardBuildingsMap.set(unit.building_id, {
                                    id: unit.building_id,
                                    name: unit.building_name
                                });
                            }
                        }
                    });

                    const initialList = Array.from(boardBuildingsMap.values());

                    // Enrich missing names
                    const enrichedList = await Promise.all(initialList.map(async (b) => {
                        if (!b.name || b.name === 'Unknown Building') {
                            try {
                                const details = await buildingsService.getBuildingById(b.id);
                                return { id: b.id, name: details.name };
                            } catch (e) {
                                return { id: b.id, name: b.name || 'Unknown Building' };
                            }
                        }
                        return b;
                    }));

                    setAvailableBuildings(enrichedList);
                } else {
                    setAvailableBuildings([]);
                }
            } catch (error) {
                console.error('Failed to fetch buildings for context:', error);
                setAvailableBuildings([]);
            }
        };

        fetchBuildings();
    }, [user]);

    // Auto-select first building
    useEffect(() => {
        if (!selectedBuildingId && availableBuildings.length > 0) {
            // Try to use primary unit's building first if resident/board
            const primaryUnit = user?.units?.find(u => u.is_primary);
            const primaryId = primaryUnit?.building_id;

            const hasPrimaryAccess = primaryId && availableBuildings.some(b => b.id === primaryId);

            setSelectedBuildingId(hasPrimaryAccess ? primaryId : availableBuildings[0].id);
        }
    }, [availableBuildings, selectedBuildingId, user]);

    // Validate selection
    useEffect(() => {
        if (selectedBuildingId && availableBuildings.length > 0 && !availableBuildings.some(b => b.id === selectedBuildingId)) {
            // If selected building is no longer available, switch to first available
            setSelectedBuildingId(availableBuildings[0].id);
        }
    }, [availableBuildings, selectedBuildingId]);

    return (
        <BuildingContext.Provider
            value={{
                selectedBuildingId,
                setSelectedBuildingId,
                availableBuildings
            }}
        >
            {children}
        </BuildingContext.Provider>
    );
}

export function useBuildingContext() {
    const context = useContext(BuildingContext);
    if (context === undefined) {
        throw new Error('useBuildingContext must be used within a BuildingProvider');
    }
    return context;
}
