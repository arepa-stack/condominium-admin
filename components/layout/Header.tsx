'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User as UserIcon } from 'lucide-react';
import { formatUserRole } from '@/lib/utils/format';
import { getEffectiveRole } from '@/lib/utils/roles';
import { BuildingSelector } from './BuildingSelector';
import { buildingsService } from '@/lib/services/buildings.service';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import type { Building } from '@/types/models';

export function Header() {
    const { logout } = useAuth();
    const { displayName, buildingName, isBoardMember, user } = usePermissions();
    const { selectedBuildingId } = useBuildingContext();

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <header className="h-14 border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between pl-16 pr-6 lg:px-8">
            {/* Context breadcrumb for orientation */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Panel de administración</span>
                <span className="text-muted-foreground/25 px-0.5">/</span>
                <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-[300px]">
                    {buildingName || 'Vista general'}
                </span>
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-accent/50 rounded-lg px-3 py-2 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-foreground">{displayName}</p>
                        <p className="text-xs text-muted-foreground">
                            {user && formatUserRole(getEffectiveRole(user, selectedBuildingId || undefined))}
                        </p>
                    </div>
                    <Avatar className="h-8 w-8 border border-border/50 transition-colors hover:border-primary/30">
                        <AvatarFallback className="bg-primary/8 text-primary font-semibold text-xs">
                            {displayName ? getInitials(displayName) : 'U'}
                        </AvatarFallback>
                    </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card border-border/50">
                    <DropdownMenuLabel>
                        <div>
                            <p className="font-medium text-foreground">{displayName}</p>
                            <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border/50" />
                    <DropdownMenuItem className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                        <UserIcon className="mr-2 h-4 w-4" />
                        Perfil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border/50" />
                    <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar sesión
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
