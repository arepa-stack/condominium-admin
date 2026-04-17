'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { buildingsService } from '@/lib/services/buildings.service';
import { isAdmin } from '@/lib/utils/roles';

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

    useEffect(() => {
        const fetchBuildings = async () => {
            try {
                if (isAdmin(user)) {
                    const allBuildings = await buildingsService.getBuildings();
                    setAvailableBuildings(allBuildings.map(b => ({ id: b.id, name: b.name })));
                    return;
                }

                const boardBuildingsMap = new Map<string, { id: string; name?: string }>();

                user?.buildingRoles?.forEach(br => {
                    if (br.role?.toLowerCase() === 'board') {
                        boardBuildingsMap.set(br.building_id, {
                            id: br.building_id,
                            name: 'Loading...'
                        });
                    }
                });

                if (boardBuildingsMap.size === 0) {
                    setAvailableBuildings([]);
                    return;
                }

                const initialList = Array.from(boardBuildingsMap.values());

                const enrichedList = await Promise.all(initialList.map(async (b) => {
                    let name = user?.units?.find(u => u.building_id === b.id)?.building_name;
                    if (!name || name === 'Unknown Building') {
                        try {
                            const details = await buildingsService.getBuildingById(b.id);
                            name = details.name;
                        } catch (e) {
                            name = 'Unknown Building';
                        }
                    }
                    return { id: b.id, name };
                }));

                setAvailableBuildings(enrichedList);
            } catch (error) {
                console.error('Failed to fetch buildings for context:', error);
                setAvailableBuildings([]);
            }
        };

        fetchBuildings();
    }, [user]);

    useEffect(() => {
        // SuperAdmins start in "Global Mode" (null)
        if (isAdmin(user)) return;

        if (!selectedBuildingId && availableBuildings.length > 0) {
            const primaryUnit = user?.units?.find(u => u.is_primary);
            const primaryId = primaryUnit?.building_id;

            const hasPrimaryAccess = primaryId && availableBuildings.some(b => b.id === primaryId);

            setSelectedBuildingId(hasPrimaryAccess ? primaryId : availableBuildings[0].id);
        }
    }, [availableBuildings, selectedBuildingId, user]);

    useEffect(() => {
        if (selectedBuildingId && availableBuildings.length > 0 && !availableBuildings.some(b => b.id === selectedBuildingId)) {
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
