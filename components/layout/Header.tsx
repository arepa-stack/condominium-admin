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
import { BuildingSelector } from './BuildingSelector';
import { buildingsService } from '@/lib/services/buildings.service';
import type { Building } from '@/types/models';

export function Header() {
    const { logout } = useAuth();
    const { displayName, buildingName, isBoardMember, user } = usePermissions();

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <header className="h-16 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30 flex items-center justify-between pl-16 pr-6 lg:px-8 shadow-sm">
            {/* Context breadcrumb for orientation */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Admin Panel</span>
                <span className="text-muted-foreground/30 px-1">/</span>
                <span className="text-sm font-semibold truncate max-w-[150px] sm:max-w-[300px]">
                    {buildingName || 'System Overview'}
                </span>
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-accent/50 rounded-lg px-3 py-2 transition-all duration-200 outline-none focus:ring-2 focus:ring-primary/20">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-foreground">{displayName}</p>
                        <p className="text-xs text-muted-foreground">
                            {user?.role && formatUserRole(user.role)}
                        </p>
                    </div>
                    <Avatar className="h-9 w-9 border-2 border-primary/20 transition-all hover:border-primary">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {displayName ? getInitials(displayName) : 'U'}
                        </AvatarFallback>
                    </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-xl">
                    <DropdownMenuLabel>
                        <div>
                            <p className="font-medium text-foreground">{displayName}</p>
                            <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                        <UserIcon className="mr-2 h-4 w-4" />
                        Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
