'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Building2, Users, CreditCard, DollarSign, TrendingUp, ArrowLeft, Search, FileText, Plus, FileSpreadsheet, ArrowUpRight } from 'lucide-react';
import { InvoiceDialog } from '@/components/billing/InvoiceDialog';
import { ExcelInvoiceLoader } from '@/components/billing/ExcelInvoiceLoader';
import { UserDialog } from '@/components/users/UserDialog';
import { UnitsTab } from '@/components/buildings/UnitsTab';
import { BuildingQrDialog } from '@/components/buildings/BuildingQrDialog';

import { buildingsService } from '@/lib/services/buildings.service';
import { usersService } from '@/lib/services/users.service';
import { paymentsService } from '@/lib/services/payments.service';
import { billingService } from '@/lib/services/billing.service';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { isBoardInBuilding as isBoardInBuildingHelper, getEffectiveRole } from '@/lib/utils/roles';
import { toast } from 'sonner';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Building, User, Payment, Invoice } from '@/types/models';



interface DashboardViewProps {
    buildingId?: string;
    showBuildingFilter?: boolean;
}

export function DashboardView({ buildingId, showBuildingFilter = false }: DashboardViewProps) {
    const { isSuperAdmin, user, buildingId: permissionsBuildingId, buildingName, isBoardInBuilding } = usePermissions();
    const router = useRouter();

    const effectiveBuildingId = buildingId || (!isSuperAdmin ? permissionsBuildingId : undefined);

    const [buildings, setBuildings] = useState<Building[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentBuildingName, setCurrentBuildingName] = useState<string>('');

    // Search State
    const [searchUsers, setSearchUsers] = useState('');
    const [searchPayments, setSearchPayments] = useState('');
    const [searchInvoices, setSearchInvoices] = useState('');
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [isExcelLoaderOpen, setIsExcelLoaderOpen] = useState(false);
    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

    
    // Quick Actions - Handler for query params
    const searchParams = useSearchParams();
    const openParam = searchParams.get('open');

    useEffect(() => {
        if (openParam === 'invoice') {
            setIsInvoiceDialogOpen(true);
        } else if (openParam === 'excel') {
            setIsExcelLoaderOpen(true);
        } else if (openParam === 'resident') {
            setSelectedUser(null);
            setIsUserDialogOpen(true);
        } else if (openParam === 'qr') {
            setIsQrDialogOpen(true);
        }
    }, [openParam]);



    // Check if user has access to this building
    useEffect(() => {
        if (effectiveBuildingId && !isBoardInBuilding(effectiveBuildingId)) {
            toast.error('No tenés acceso a este edificio');
            router.push('/dashboard');
        }
    }, [effectiveBuildingId, isBoardInBuilding, router]);

    const fetchData = useCallback(async (signal?: AbortSignal) => {
        try {
            setIsLoading(true);

            // Security: If not a super admin, we MUST have a building filter.
            // If it's missing, it means we are in a transition state or no building is assigned.
            if (!isSuperAdmin && !effectiveBuildingId) {
                setBuildings([]);
                setUsers([]);
                setPayments([]);
                setInvoices([]);
                setIsLoading(false);
                return;
            }

            // Prepare filters
            const query: any = effectiveBuildingId ? { building_id: effectiveBuildingId } : {};

            const promises: [Promise<Building[]>, Promise<User[]>, Promise<Payment[]>, Promise<Invoice[]>] = [
                isSuperAdmin ? buildingsService.getBuildings() : Promise.resolve([]),
                usersService.getUsers(query),
                paymentsService.getPayments(query),
                billingService.getInvoices(query)
            ];

            const [buildingsData, usersData, paymentsData, invoicesData] = await Promise.all(promises);

            if (signal?.aborted) return;

            setBuildings(buildingsData);
            setUsers(usersData);
            setPayments(paymentsData);
            setInvoices(invoicesData);

            if (effectiveBuildingId) {
                // Try to find in profile first
                if (!isSuperAdmin && user?.building_name) {
                    setCurrentBuildingName(user.building_name);
                } else {
                    // Check if we have it in buildingsData (Super Admin list)
                    const b = buildingsData.find(b => b.id === effectiveBuildingId);
                    if (b) {
                        setCurrentBuildingName(b.name);
                    } else {
                        // Fetch directly if still missing
                        try {
                            const specificBuilding = await buildingsService.getBuildingById(effectiveBuildingId);
                            if (signal?.aborted) return;
                            setCurrentBuildingName(specificBuilding.name);
                        } catch (e) {
                            console.error('Failed to fetch building details', e);
                        }
                    }
                }
            }

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return;
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isSuperAdmin, user, effectiveBuildingId]);

    useEffect(() => {
        const controller = new AbortController();
        fetchData(controller.signal);
        return () => controller.abort();
    }, [fetchData]);

    if (isLoading) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="space-y-2">
                    <div className="h-8 w-48 skeleton rounded" />
                    <div className="h-4 w-32 skeleton rounded" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 skeleton rounded-xl" />
                    ))}
                </div>
                <div className="h-64 skeleton rounded-xl" />
            </div>
        );
    }

    const pendingPayments = payments.filter(p => p.status === 'PENDING');
    const approvedPayments = payments.filter(p => p.status === 'APPROVED');
    const totalRevenue = approvedPayments.reduce((sum, p) => sum + p.amount, 0);

    // Debt Calculation
    const pendingInvoices = invoices.filter(i => i.status === 'PENDING');
    const totalDebt = pendingInvoices.reduce((sum, i) => sum + (Number(i.amount || 0) - Number(i.paid_amount || 0)), 0);

    const isFilteredView = !!effectiveBuildingId;

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchUsers.toLowerCase()) ||
        user.email.toLowerCase().includes(searchUsers.toLowerCase()) ||
        user.unit?.toLowerCase().includes(searchUsers.toLowerCase())
    );

    const filteredPayments = payments.filter(payment =>
        searchPayments === '' ||
        payment.amount.toString().includes(searchPayments) ||
        payment.method.toLowerCase().includes(searchPayments.toLowerCase()) ||
        payment.user?.name.toLowerCase().includes(searchPayments.toLowerCase())
    );

    const filteredInvoices = invoices.filter(inv =>
        searchInvoices === '' ||
        inv.number?.toLowerCase().includes(searchInvoices.toLowerCase()) ||
        inv.user?.name?.toLowerCase().includes(searchInvoices.toLowerCase()) ||
        inv.unit?.name?.toLowerCase().includes(searchInvoices.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-threshold">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
                        {isFilteredView ? (currentBuildingName || buildingName || 'Panel del edificio') : 'Panel global'}
                    </h1>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2">
                        {isFilteredView ? (
                            <>
                                <Building2 className="h-4 w-4" />
                                <span>Resumen de gestión del edificio</span>
                            </>
                        ) : (
                            <>
                                <TrendingUp className="h-4 w-4" />
                                <span>{isSuperAdmin ? 'Administración del sistema' : 'Resumen de la cuenta'}</span>
                            </>
                        )}
                    </p>
                </div>
                {isFilteredView && isSuperAdmin && showBuildingFilter && (
                    <Button variant="outline" onClick={() => router.push('/dashboard')} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Volver al resumen
                    </Button>
                )}
                {effectiveBuildingId && !showBuildingFilter && isSuperAdmin && (
                    <Button variant="outline" onClick={() => router.push('/buildings')} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Volver a Edificios
                    </Button>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
                {!isFilteredView && isSuperAdmin && (
                    <Link href="/buildings" className="block">
                        <StatsCard
                            title="Total de edificios"
                            value={buildings.length}
                            icon={Building2}
                            description="Edificios activos"
                            className="h-full border-primary/15 bg-primary/5 cursor-pointer"
                        />
                    </Link>
                )}
                <StatsCard
                    title={isSuperAdmin ? 'Total de usuarios' : 'Total de residentes'}
                    value={users.length}
                    icon={Users}
                    description={isFilteredView ? 'En este edificio' : 'Todos los usuarios'}
                />
                <StatsCard
                    title="Deuda total"
                    value={formatCurrency(totalDebt)}
                    icon={FileText}
                    description={`${pendingInvoices.length} facturas pendientes`}
                    className="border-destructive/15 bg-destructive/5"
                />
                <StatsCard
                    title="Pagos pendientes"
                    value={pendingPayments.length}
                    icon={CreditCard}
                    description="Esperando aprobación"
                    className="border-chart-2/15 bg-chart-2/5"
                />
                {(!isFilteredView && isSuperAdmin) && (
                    <StatsCard
                        title="Ingresos totales"
                        value={formatCurrency(totalRevenue)}
                        icon={DollarSign}
                        description="Cobros verificados"
                    />
                )}
            </div>

            {/* Dashboard Content (Tabs for Building View) */}
            {isFilteredView ? (
                <Tabs defaultValue="residents" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="residents">Residentes</TabsTrigger>
                        <TabsTrigger value="invoices">Facturas</TabsTrigger>
                        <TabsTrigger value="payments">Pagos</TabsTrigger>
                        <TabsTrigger value="units">Unidades</TabsTrigger>
                    </TabsList>

                    {/* Residents Tab */}
                    <TabsContent value="residents" className="space-y-4">
                        <Card className="border-border/50 bg-card">
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
                                <CardTitle className="text-foreground">Residentes</CardTitle>
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar residentes..."
                                        className="pl-8 w-full"
                                        value={searchUsers}
                                        onChange={(e) => setSearchUsers(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredUsers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <Users className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-muted-foreground max-w-[250px] mb-6">
                                            {searchUsers 
                                                ? 'Ningún residente coincide con la búsqueda' 
                                                : 'No hay residentes registrados en este edificio todavía.'}
                                        </p>
                                        {!searchUsers && (
                                            <Button 
                                                onClick={() => {
                                                    setSelectedUser(null);
                                                    setIsUserDialogOpen(true);
                                                }}
                                                className="gap-2"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Añadir residente
                                            </Button>
                                        )}
                                    </div>
                                ) : (

                                    <div className="space-y-4 pt-4">
                                        {filteredUsers.map((user) => {
                                            const effectiveRole = getEffectiveRole(user, effectiveBuildingId);
                                            const isBoardHere = effectiveRole === 'board';
                                            const isAdminUser = effectiveRole === 'admin';
                                            return (
                                            <div
                                                key={user.id}
                                                onClick={() => {
                                                    const unitId = user.unit_id || (user.units && user.units.length > 0 ? user.units[0].unit_id : null);
                                                    const bId = effectiveBuildingId || (user.units && user.units.length > 0 ? user.units[0].building_id : null);

                                                    if (bId && unitId) {
                                                        router.push(`/buildings/${bId}/units/${unitId}`);
                                                    } else {
                                                        const basePath = bId
                                                            ? `/buildings/${bId}/payments`
                                                            : '/payments';
                                                        router.push(`${basePath}?user_id=${user.id}`);
                                                    }
                                                }}
                                                className={cn(
                                                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl transition-all duration-300 cursor-pointer gap-4 sm:gap-0",
                                                    isBoardHere
                                                        ? "bg-primary/[0.07] border-primary/30 shadow-sm hover:shadow-md ring-1 ring-primary/5"
                                                        : "bg-card border-border/60 hover:bg-accent/30 hover:shadow-md"
                                                )}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isBoardHere ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                        <Users className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-foreground flex items-center gap-2">
                                                            {user.name}
                                                            {isBoardHere && (
                                                                <Badge variant="default" className="text-[10px] h-5 px-2">
                                                                    Directiva
                                                                </Badge>
                                                            )}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {user.email} {user.unit ? `• Unidad ${user.unit}` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-left sm:text-right pl-14 sm:pl-0">
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            isBoardHere
                                                                ? 'capitalize bg-primary/10 text-primary border-primary/20'
                                                                : isAdminUser
                                                                    ? 'capitalize bg-chart-2/10 text-chart-2 border-chart-2/20'
                                                                    : 'capitalize'
                                                        }
                                                    >
                                                        {effectiveRole}
                                                    </Badge>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="invoices" className="space-y-4">
                        <Card className="border-border/50 bg-card">
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-foreground">Facturas recientes</CardTitle>
                                        {effectiveBuildingId && (
                                            <Link href={`/billing?building_id=${effectiveBuildingId}`} passHref>
                                                <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2">
                                                    Ver todas <ArrowUpRight className="h-3 w-3" />
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground font-normal">Gestioná las deudas del edificio</p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                                    {(isSuperAdmin || (effectiveBuildingId && isBoardInBuildingHelper(user, effectiveBuildingId))) && (
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setIsExcelLoaderOpen(true)}
                                                className="gap-2 border-green-600/20 text-green-600 hover:bg-green-50 hover:text-green-700"
                                            >
                                                <FileSpreadsheet className="h-4 w-4" />
                                                Importar Excel
                                            </Button>
                                            <Button size="sm" onClick={() => setIsInvoiceDialogOpen(true)} className="gap-2 w-full sm:w-auto">
                                                <Plus className="h-4 w-4" />
                                                Crear factura
                                            </Button>
                                        </div>
                                    )}
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar facturas..."
                                            className="pl-8 w-full"
                                            value={searchInvoices}
                                            onChange={(e) => setSearchInvoices(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredInvoices.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">
                                        No se encontraron facturas.
                                    </p>
                                ) : (
                                    <div className="space-y-4 pt-4">
                                        {filteredInvoices.slice(0, 10).map((inv) => (
                                            <div
                                                key={inv.id}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-all duration-200 gap-4 sm:gap-0"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-foreground truncate">
                                                        {inv.number ? `Factura ${inv.number}` : `Factura #${inv.id.slice(0, 8)}`}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <span className="shrink-0">{inv.unit?.name || 'Sin unidad asignada'}</span>
                                                        <span>•</span>
                                                        <span>{inv.period || `${inv.year}-${inv.month}`}</span>
                                                        {inv.tag === 'PETTY_CASH' && (
                                                            <>
                                                                <span>•</span>
                                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                                                                    Caja Chica
                                                                </Badge>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 justify-between sm:justify-end">
                                                    <p className="font-semibold text-foreground">
                                                        {formatCurrency(inv.amount)}
                                                    </p>
                                                    <Badge
                                                        variant={
                                                            inv.status === 'PAID'
                                                                ? 'default'
                                                                : inv.status === 'PENDING'
                                                                    ? 'secondary'
                                                                    : 'destructive'
                                                        }
                                                        className={cn(
                                                            "font-medium",
                                                            inv.status === 'PAID'
                                                                ? 'bg-chart-1/20 text-chart-1 border-chart-1/30'
                                                                : inv.status === 'PENDING'
                                                                    ? 'bg-chart-2/20 text-chart-2 border-chart-2/30'
                                                                    : 'bg-destructive/20 text-destructive border-destructive/30'
                                                        )}
                                                    >
                                                        {inv.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Payments Tab */}
                    <TabsContent value="payments" className="space-y-4">
                        <Card className="border-border/50 bg-card">
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
                                <CardTitle className="text-foreground">Pagos recientes</CardTitle>
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar pagos..."
                                        className="pl-8 w-full"
                                        value={searchPayments}
                                        onChange={(e) => setSearchPayments(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredPayments.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">
                                        {searchPayments ? 'Ningún pago coincide con la búsqueda' : 'Todavía no hay pagos'}
                                    </p>
                                ) : (
                                    <div className="space-y-4 pt-4">
                                        {filteredPayments.slice(0, 10).map((payment) => (
                                            <div
                                                key={payment.id}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-all duration-200 gap-4 sm:gap-0"
                                            >
                                                <div>
                                                    <p className="font-medium text-foreground">
                                                        Pago #{payment.id.slice(0, 8)}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {formatDate(payment.payment_date)} • {payment.method}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Por: {payment.user?.name || 'Desconocido'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4 justify-between sm:justify-end">
                                                    <p className="font-semibold text-foreground">
                                                        {formatCurrency(payment.amount)}
                                                    </p>
                                                    <Badge
                                                        variant={
                                                            payment.status === 'APPROVED'
                                                                ? 'default'
                                                                : payment.status === 'PENDING'
                                                                    ? 'secondary'
                                                                    : 'destructive'
                                                        }
                                                        className={cn(
                                                            "font-medium",
                                                            payment.status === 'APPROVED'
                                                                ? 'bg-chart-1/20 text-chart-1 border-chart-1/30'
                                                                : payment.status === 'PENDING'
                                                                    ? 'bg-chart-2/20 text-chart-2 border-chart-2/30'
                                                                    : 'bg-destructive/20 text-destructive border-destructive/30'
                                                        )}
                                                    >
                                                        {payment.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Units Tab */}
                    <TabsContent value="units" className="space-y-4">
                        {effectiveBuildingId && (
                            <UnitsTab
                                buildingId={effectiveBuildingId}
                                invoices={invoices}
                                users={users}
                            />
                        )}
                    </TabsContent>
                </Tabs>
            ) : (
                /* Global Activity (Non - filtered) */
                <Card className="border-border/50 bg-card">
                    <CardHeader>
                        <CardTitle className="text-foreground">Pagos recientes (Global)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {payments.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">Todavía no hay pagos</p>
                        ) : (
                            <div className="space-y-4">
                                {payments.slice(0, 5).map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-all duration-200 gap-4 sm:gap-0"
                                    >
                                        <div>
                                            <p className="font-medium text-foreground">
                                                Payment #{payment.id.slice(0, 8)}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatDate(payment.payment_date)} • {payment.method}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 justify-between sm:justify-end">
                                            <p className="font-semibold text-foreground">
                                                {formatCurrency(payment.amount)}
                                            </p>
                                            <Badge
                                                variant={
                                                    payment.status === 'APPROVED'
                                                        ? 'default'
                                                        : payment.status === 'PENDING'
                                                            ? 'secondary'
                                                            : 'destructive'
                                                }
                                                className={cn(
                                                    "font-medium",
                                                    payment.status === 'APPROVED'
                                                        ? 'bg-chart-1/20 text-chart-1 border-chart-1/30'
                                                        : payment.status === 'PENDING'
                                                            ? 'bg-chart-2/20 text-chart-2 border-chart-2/30'
                                                            : 'bg-destructive/20 text-destructive border-destructive/30'
                                                )}
                                            >
                                                {payment.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <InvoiceDialog
                open={isInvoiceDialogOpen}
                onOpenChange={setIsInvoiceDialogOpen}
                buildingId={effectiveBuildingId as string}
                onSuccess={fetchData}
            />

            <ExcelInvoiceLoader
                open={isExcelLoaderOpen}
                onOpenChange={setIsExcelLoaderOpen}
                buildingId={effectiveBuildingId as string}
                buildings={buildings}
                onSuccess={fetchData}
            />

            <UserDialog
                open={isUserDialogOpen}
                onOpenChange={setIsUserDialogOpen}
                user={selectedUser}
                buildings={isSuperAdmin ? buildings : (buildings.length > 0 ? buildings : (effectiveBuildingId ? [{ id: effectiveBuildingId, name: currentBuildingName || buildingName || 'Edificio Actual', address: '' }] : []))}
                onSuccess={fetchData}
                defaultBuildingId={effectiveBuildingId}
            />

            <BuildingQrDialog
                open={isQrDialogOpen}
                onOpenChange={setIsQrDialogOpen}
                building={effectiveBuildingId ? (buildings.find(b => b.id === effectiveBuildingId) || { id: effectiveBuildingId, name: currentBuildingName || buildingName || 'Edificio Actual', address: '' } as Building) : null}
            />

        </div>

    );
}
