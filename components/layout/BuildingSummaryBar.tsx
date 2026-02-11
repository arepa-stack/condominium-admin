'use client';

import { useEffect, useState } from 'react';
import { buildingsService } from '@/lib/services/buildings.service';
import { billingService } from '@/lib/services/billing.service';
import { paymentsService } from '@/lib/services/payments.service';
import { formatCurrency } from '@/lib/utils/format';
import { Building2, Wallet, Clock, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Building } from '@/types/models';

interface BuildingSummaryBarProps {
    buildingId: string;
}

export function BuildingSummaryBar({ buildingId }: BuildingSummaryBarProps) {
    const [building, setBuilding] = useState<Building | null>(null);
    const [stats, setStats] = useState({
        totalDebt: 0,
        pendingPayments: 0,
        solvencyRate: 0
    });
    const [isBuildingLoading, setIsBuildingLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(true);

    useEffect(() => {
        const fetchBuildingInfo = async () => {
            if (!buildingId) return;
            try {
                setIsBuildingLoading(true);
                const data = await buildingsService.getBuildingById(buildingId);
                setBuilding(data);
            } catch (error) {
                console.error('Failed to fetch building info:', error);
            } finally {
                setIsBuildingLoading(false);
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

                const debt = (invoices || []).reduce((acc, inv) => acc + (Number(inv.amount || 0) - Number(inv.paid_amount || 0)), 0);
                setStats({
                    totalDebt: debt,
                    pendingPayments: (pendingPayments || []).length,
                    solvencyRate: 0
                });
            } catch (error) {
                console.error('Failed to fetch building stats:', error);
            } finally {
                setIsStatsLoading(false);
            }
        };

        fetchBuildingInfo();
        fetchStats();
    }, [buildingId]);

    if (!building && !isBuildingLoading) return null;

    return (
        <Card className="mb-6 bg-card/50 backdrop-blur-xl border-white/5 overflow-hidden shadow-2xl">
            <div className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                        <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">
                            {isBuildingLoading ? 'Loading building...' : building?.name}
                        </h2>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                            {isBuildingLoading ? '...' : building?.address}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-8 md:gap-12">
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Wallet className="w-3 h-3 text-red-400" />
                            Total Debt
                        </p>
                        <p className="text-lg font-bold text-red-500 tabular-nums">
                            {isStatsLoading ? '...' : formatCurrency(stats.totalDebt)}
                        </p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-3 h-3 text-yellow-400" />
                            Pending Payments
                        </p>
                        <p className="text-lg font-bold text-yellow-500 tabular-nums">
                            {isStatsLoading ? '...' : stats.pendingPayments}
                        </p>
                    </div>

                    <div className="space-y-1 invisible md:visible">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                            Quick Actions
                        </p>
                        <div className="flex gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500/50" />
                            <div className="w-2 h-2 rounded-full bg-primary/20 border border-primary/50" />
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
