'use client';

import { Badge } from '@/components/ui/badge';
import { Crown, User } from 'lucide-react';

interface BuildingRoleBadgeProps {
    buildingRole: string;
    className?: string;
}

export function BuildingRoleBadge({ buildingRole, className = '' }: BuildingRoleBadgeProps) {
    const role = buildingRole?.toLowerCase() as 'board' | 'resident' | 'owner';

    const roleConfig = {
        board: {
            icon: Crown,
            label: '🏛️ Board',
            className: 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30 hover:from-purple-500/30 hover:to-indigo-500/30',
        },
        owner: {
            icon: Crown,
            label: '👑 Owner',
            className: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30 hover:from-amber-500/30 hover:to-yellow-500/30',
        },
        resident: {
            icon: User,
            label: '👤 Resident',
            className: 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted/70',
        },
    };

    const config = roleConfig[role] || roleConfig.resident;
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
