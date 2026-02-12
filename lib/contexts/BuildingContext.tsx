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
                const userRole = (user?.role as string || '').toLowerCase();
                if (userRole === 'admin' || userRole === 'superadmin') {
                    // Admins see all buildings
                    const allBuildings = await buildingsService.getBuildings();
                    setAvailableBuildings(allBuildings.map(b => ({ id: b.id, name: b.name })));
                } else if (user?.buildingRoles && user.buildingRoles.length > 0) {
                    // Non-admins see buildings where they have a 'board' role
                    const boardBuildingsMap = new Map<string, { id: string; name?: string }>();

                    user.buildingRoles.forEach(br => {
                        if (br.role?.toLowerCase() === 'board') {
                            boardBuildingsMap.set(br.building_id, {
                                id: br.building_id,
                                name: 'Loading...'
                            });
                        }
                    });

                    const initialList = Array.from(boardBuildingsMap.values());

                    // Enrich names
                    const enrichedList = await Promise.all(initialList.map(async (b) => {
                        let name = user.units?.find(u => u.building_id === b.id)?.building_name;
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
                } else if (user?.role?.toLowerCase() === 'board') {
                    // Fallback for legacy board members who don't have buildingRoles populated yet
                    const buildingId = (user as any).building_id;
                    const buildingName = (user as any).building_name || (user as any).building?.name;

                    if (buildingId) {
                        setAvailableBuildings([{ id: buildingId, name: buildingName || 'My Building' }]);
                    } else if (user.units && user.units.length > 0) {
                        // Fallback to units if building_id is missing but units exist
                        const fromUnits = user.units.map(u => ({ id: u.building_id, name: u.building_name }));
                        // Unique by ID
                        const unique = Array.from(new Map(fromUnits.map(item => [item.id, item])).values());
                        setAvailableBuildings(unique);
                    } else {
                        setAvailableBuildings([]);
                    }
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
        // SuperAdmins should start in "Global Mode" (null)
        const userRole = (user?.role as string || '').toLowerCase();
        if (userRole === 'admin' || userRole === 'superadmin') return;

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
