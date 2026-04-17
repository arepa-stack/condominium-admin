'use client';

import { useEffect, useState } from 'react';
import { buildingsService } from '@/lib/services/buildings.service';
import { billingService } from '@/lib/services/billing.service';
import { paymentsService } from '@/lib/services/payments.service';
import { formatCurrency } from '@/lib/utils/format';
import { Building2, Wallet, Clock, CheckCircle2, Plus, FileSpreadsheet, Users, CreditCard } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip-simple';
import Link from 'next/link';

import type { Building } from '@/types/models';
import { usePathname } from 'next/navigation';


interface BuildingSummaryBarProps {
    buildingId: string;
}

export function BuildingSummaryBar({ buildingId }: BuildingSummaryBarProps) {
    const pathname = usePathname();
    const [building, setBuilding] = useState<Building | null>(null);

    const [stats, setStats] = useState({
        totalDebt: 0,
        pendingPayments: 0,
        solvencyRate: 0
    });
    const [isBuildingLoading, setIsBuildingLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        const fetchBuildingInfo = async () => {
            if (!buildingId) return;
            try {
                setIsBuildingLoading(true);
                const data = await buildingsService.getBuildingById(buildingId);
                if (signal.aborted) return;
                setBuilding(data);
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') return;
                console.error('Failed to fetch building info:', error);
            } finally {
                if (!signal.aborted) setIsBuildingLoading(false);
            }
        };

        const fetchStats = async () => {
            if (!buildingId) return;
            try {
                setIsStatsLoading(true);
                const [invoices, pendingPayments] = await Promise.all([
                    billingService.getInvoices({ building_id: buildingId, status: 'PENDING' }),
                    paymentsService.getAdminPayments({ building_id: buildingId, status: 'PENDING' })
                ]);

                if (signal.aborted) return;

                const debt = (invoices || []).reduce((acc, inv) => acc + (Number(inv.amount || 0) - Number(inv.paid_amount || 0)), 0);
                setStats({
                    totalDebt: debt,
                    pendingPayments: (pendingPayments || []).length,
                    solvencyRate: 0
                });
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') return;
                console.error('Failed to fetch building stats:', error);
            } finally {
                if (!signal.aborted) setIsStatsLoading(false);
            }
        };

        fetchBuildingInfo();
        fetchStats();

        return () => controller.abort();
    }, [buildingId]);

    if (!building && !isBuildingLoading) return null;

    return (
        <Card className="mb-6 bg-card border-border/40 overflow-hidden">
            <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/15">
                        <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {isBuildingLoading ? 'Cargando edificio...' : building?.name}
                        </h2>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                            {isBuildingLoading ? '...' : building?.address}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-8 md:gap-12">
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Wallet className="w-3 h-3 text-destructive" />
                            Deuda Total
                        </p>
                        <p className="text-lg font-bold text-destructive tabular-nums">
                            {isStatsLoading ? '...' : formatCurrency(stats.totalDebt)}
                        </p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-3 h-3 text-chart-2" />
                            Pagos por Aprobar
                        </p>
                        <p className="text-lg font-bold text-chart-2 tabular-nums">
                            {isStatsLoading ? '...' : stats.pendingPayments}
                        </p>
                    </div>

                    <div className="space-y-2 invisible md:visible">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-primary" />
                            Acciones Rápidas
                        </p>
                        <div className="flex items-center gap-2">
                            <Tooltip content="Nueva factura">
                                <Link href={`${pathname}?open=invoice`} scroll={false}>
                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all">
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>Factura</span>
                                    </Button>
                                </Link>
                            </Tooltip>
                            
                            <Tooltip content="Importar Excel">
                                <Link href={`${pathname}?open=excel`} scroll={false}>
                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-green-600/20 text-green-600 hover:bg-green-50 hover:text-green-700 transition-all">
                                        <FileSpreadsheet className="h-3.5 w-3.5" />
                                        <span>Excel</span>
                                    </Button>
                                </Link>
                            </Tooltip>

                            <Tooltip content="Añadir residente">
                                <Link href={`${pathname}?open=resident`} scroll={false}>
                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all">
                                        <Users className="h-3.5 w-3.5" />
                                        <span>Residente</span>
                                    </Button>
                                </Link>
                            </Tooltip>

                            <div className="w-px h-6 bg-border/40 mx-1" />

                            <Tooltip content="Gestionar Pagos">
                                <Link href={`/buildings/${buildingId}/payments`}>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                                        <CreditCard className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </Tooltip>

                            <Tooltip content="Ver Usuarios">
                                <Link href={`/buildings/${buildingId}/users`}>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                                        <Users className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </Tooltip>
                        </div>

                    </div>

                </div>
            </div>

            {/* Animated Loading Bar */}
            {(isBuildingLoading || isStatsLoading) && (
                <div className="h-1 w-full bg-transparent overflow-hidden">
                    <div className="h-full bg-primary animate-progress-indeterminate w-1/3" />
                </div>
            )}
        </Card>
    );
}
