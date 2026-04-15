'use client';

import { Badge } from '@/components/ui/badge';
import { Crown, User, Search, Building2 } from 'lucide-react';

interface BuildingRoleBadgeProps {
    buildingRole: string;
    className?: string;
}

export function BuildingRoleBadge({ buildingRole, className = '' }: BuildingRoleBadgeProps) {
    const getRoleConfig = (role: string) => {
        const normalizedRole = role?.toLowerCase();
        switch (normalizedRole) {
            case 'board':
                return {
                    icon: Crown,
                    label: '🏛️ Directiva',
                    className: 'bg-chart-2/15 text-chart-2 border-chart-2/30 hover:bg-chart-2/25'
                };
            case 'owner':
                return {
                    icon: Crown,
                    label: '👑 Propietario',
                    className: 'bg-chart-2/15 text-chart-2 border-chart-2/30 hover:bg-chart-2/25'
                };
            case 'auditor':
                return {
                    icon: Search,
                    label: '🔍 Auditor',
                    className: 'bg-chart-3/15 text-chart-3 border-chart-3/30 hover:bg-chart-3/25'
                };
            case 'admin-local':
                return {
                    icon: Building2,
                    label: '🏢 Admin Local',
                    className: 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                };
            default: // Resident
                return {
                    icon: User,
                    label: '👤 Residente',
                    className: 'bg-chart-1/15 text-chart-1 border-chart-1/30 hover:bg-chart-1/25'
                };
        }
    };

    const config = getRoleConfig(buildingRole);
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={`transition-all duration-200 ${config.className} ${className}`}
        >
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
        </Badge>
    );
}
