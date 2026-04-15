'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Building2, ChevronDown } from 'lucide-react';
import type { Building } from '@/types/models';

interface BuildingSelectorProps {
    buildings: Building[];
    selectedBuildingId?: string;
    onBuildingChange: (buildingId: string) => void;
    className?: string;
}

export function BuildingSelector({ buildings, selectedBuildingId, onBuildingChange, className = '' }: BuildingSelectorProps) {
    const { isSuperAdmin, getBoardBuildings } = usePermissions();
    const [isOpen, setIsOpen] = useState(false);

    // Filter buildings based on permissions
    const availableBuildings = isSuperAdmin
        ? buildings
        : buildings.filter(b => getBoardBuildings().includes(b.id));

    // Don't show selector if user only has access to one building
    if (availableBuildings.length <= 1) {
        return null;
    }

    const selectedBuilding = availableBuildings.find(b => b.id === selectedBuildingId);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className={`gap-2 bg-primary/10 border-primary/30 hover:bg-primary/20 ${className}`}
                >
                    <Building2 className="h-4 w-4" />
                    {selectedBuilding ? selectedBuilding.name : 'Seleccionar edificio'}
                    <ChevronDown className="h-4 w-4 ml-auto" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Seleccionar edificio</DialogTitle>
                    <DialogDescription>Elegí el edificio que querés gestionar.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Select value={selectedBuildingId} onValueChange={(value) => {
                        onBuildingChange(value);
                        setIsOpen(false);
                    }}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Elegí un edificio" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los edificios</SelectItem>
                            {availableBuildings.map((building) => (
                                <SelectItem key={building.id} value={building.id}>
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-primary" />
                                        <span>{building.name}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            {isSuperAdmin
                                ? `Como administrador tenés acceso a los ${buildings.length} edificios.`
                                : `Administrás ${availableBuildings.length} ${availableBuildings.length === 1 ? 'edificio' : 'edificios'} como miembro de la junta.`
                            }
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
