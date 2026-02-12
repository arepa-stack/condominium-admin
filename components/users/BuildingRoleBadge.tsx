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
                    icon: Crown, // Re-added icon
                    label: '🏛️ Board',
                    className: 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30 hover:from-purple-500/30 hover:to-indigo-500/30'
                };
            case 'owner':
                return {
                    icon: Crown, // Re-added icon
                    label: '👑 Owner',
                    className: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30 hover:from-amber-500/30 hover:to-yellow-500/30'
                };
            case 'auditor':
                return {
                    icon: Search, // Icon for auditor
                    label: '🔍 Auditor',
                    className: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border-blue-500/30 hover:from-blue-500/30 hover:to-cyan-500/30'
                };
            case 'admin-local':
                return {
                    icon: Building2, // Icon for admin-local
                    label: '🏢 Admin Local',
                    className: 'bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-300 border-indigo-500/30 hover:from-indigo-500/30 hover:to-violet-500/30'
                };
            default: // Default to resident
                return {
                    icon: User, // Re-added icon
                    label: '👤 Resident',
                    className: 'bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted/70'
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
