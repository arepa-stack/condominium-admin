'use client';

import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    Building2,
    Home,
    FileText,
    LogOut,
    Menu,
    Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { getEffectiveRole } from '@/lib/utils/roles';
import { formatUserRole } from '@/lib/utils/format';

type NavAccess = 'admin-only' | 'board-or-admin';

const navigation: Array<{
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
    access: NavAccess;
}> = [
    { name: 'Panel', href: '/dashboard', icon: LayoutDashboard, access: 'board-or-admin' },
    { name: 'Edificios', href: '/buildings', icon: Building2, access: 'admin-only' },
    { name: 'Unidades', href: '/units', icon: Home, access: 'board-or-admin' },
    { name: 'Usuarios', href: '/users', icon: Users, access: 'board-or-admin' },
    { name: 'Facturación', href: '/billing', icon: FileText, access: 'board-or-admin' },
    { name: 'Finanzas', href: '/finances', icon: Wallet, access: 'board-or-admin' },
];

export function Sidebar() {
    const pathname = usePathname();
    const params = useParams();
    const { logout } = useAuth();
    const router = useRouter();
    const { user, isSuperAdmin, isBoardMember, displayName } = usePermissions();
    const { selectedBuildingId, setSelectedBuildingId, availableBuildings } = useBuildingContext();
    const [open, setOpen] = useState(false);
    const buildingId = params?.id as string;

    // Sync context with URL if user deep-links into a specific building
    useEffect(() => {
        if (buildingId && buildingId !== selectedBuildingId) {
            setSelectedBuildingId(buildingId);
        }
    }, [buildingId, selectedBuildingId, setSelectedBuildingId]);

    // Filter navigation based on user role and adjust hrefs for contextual routing
    const filteredNavigation = navigation
        .filter(item => {
            if (!user) return false;
            if (item.access === 'admin-only') return isSuperAdmin;
            return isSuperAdmin || isBoardMember;
        })
        .map(item => {
            // Dashboard is handled specifically: /dashboard is global, /buildings/[id]/dashboard is contextual
            if (item.href === '/dashboard') {
                return buildingId
                    ? { ...item, href: `/buildings/${buildingId}/dashboard` }
                    : item;
            }

            // Other functional pages: if in building context, use contextual route
            const contextualPages = ['/units', '/users', '/billing'];
            const activeBuildingId = buildingId || selectedBuildingId;
            if (activeBuildingId && contextualPages.includes(item.href)) {
                return { ...item, href: `/buildings/${activeBuildingId}${item.href}` };
            }

            return item;
        });

    const renderSidebarContent = () => (
        <div className="flex h-full flex-col justify-between py-6 bg-sidebar">
            <div className="px-4">
                {/* Brand */}
                <div className="flex items-center gap-3 px-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/20">
                        <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-foreground">
                        Condominio
                    </span>
                </div>

                {/* Building Selector for Management Roles */}
                {(isSuperAdmin || isBoardMember) && availableBuildings.length > 0 && (
                    <div className="px-2 mb-6">
                        {availableBuildings.length > 1 ? (
                            <Select
                                value={selectedBuildingId || 'all'}
                                onValueChange={(id) => {
                                    if (id === 'all') {
                                        setSelectedBuildingId(null);
                                        // If in a building context, go to global equivalent
                                        if (pathname.includes('/buildings/')) {
                                            const parts = pathname.split('/');
                                            const action = parts[parts.length - 1];
                                            router.push(`/${action === 'dashboard' ? 'dashboard' : action}`);
                                        } else {
                                            router.push('/dashboard');
                                        }
                                        return;
                                    }

                                    setSelectedBuildingId(id);
                                    // If we are in global, go to contextual dashboard
                                    if (pathname === '/dashboard' || pathname === '/') {
                                        router.push(`/buildings/${id}/dashboard`);
                                    } else if (pathname.includes('/buildings/')) {
                                        // Switch building while maintaining action
                                        const parts = pathname.split('/');
                                        const action = parts[parts.length - 1];
                                        router.push(`/buildings/${id}/${action}`);
                                    } else {
                                        // Global page to contextual page if applicable
                                        const contextualPages = ['units', 'users', 'billing'];
                                        const currentAction = pathname.replace('/', '');
                                        if (contextualPages.includes(currentAction)) {
                                            router.push(`/buildings/${id}/${currentAction}`);
                                        }
                                    }
                                }}
                            >
                                <SelectTrigger className="w-full bg-sidebar-accent/50 border-border/50 text-xs font-medium uppercase tracking-wider h-9">
                                    <div className="flex items-center gap-2 truncate">
                                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <SelectValue placeholder="Seleccionar edificio" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {isSuperAdmin && (
                                        <SelectItem value="all" className="font-semibold text-primary">
                                            <div className="flex items-center gap-2">
                                                <LayoutDashboard className="h-4 w-4" />
                                                Vista global
                                            </div>
                                        </SelectItem>
                                    )}
                                    {availableBuildings.map(building => (
                                        <SelectItem key={building.id} value={building.id}>
                                            {building.name || 'Edificio sin nombre'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="px-3 py-2 bg-primary/5 rounded-lg border border-primary/15 flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-semibold text-primary uppercase tracking-wider truncate">
                                    {availableBuildings[0].name || 'Edificio sin nombre'}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <nav className="space-y-0.5">
                    {filteredNavigation.map((item) => {
                        let isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                        // Special case: "Buildings" should only be active on the buildings list page, 
                        // not while inside a specific building's context
                        if (item.name === 'Edificios') {
                            isActive = pathname === '/buildings' || pathname === '/buildings/';
                        }
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={cn(
                                    'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                                    isActive
                                        ? 'bg-primary/10 text-primary border border-primary/15'
                                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                                )}
                            >
                                <item.icon className={cn(
                                    "h-[18px] w-[18px] transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground/70"
                                )} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* User Profile */}
            <div className="px-4 space-y-3">
                <div className="rounded-lg p-3 border border-border/50 bg-sidebar-accent/30">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/15 text-primary font-semibold text-sm">
                            {displayName[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">{displayName}</p>
                            <p className="text-xs text-muted-foreground truncate capitalize">
                                {user ? formatUserRole(getEffectiveRole(user, selectedBuildingId || undefined)) : ''}
                            </p>
                        </div>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 hover:bg-destructive/10 hover:text-destructive text-muted-foreground text-sm"
                    onClick={logout}
                >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                </Button>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Sheet */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden fixed top-4 left-4 z-40">
                        <Menu className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 border-r-border/30 w-72">
                    {renderSidebarContent()}
                </SheetContent>
            </Sheet>

            {/* Desktop Sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col border-r border-border/30 z-20">
                {renderSidebarContent()}
            </div>
        </>
    );
}
