import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Wand2, User as UserIcon, DollarSign, AlertTriangle, AlertCircle } from 'lucide-react';
import { unitsService } from '@/lib/services/units.service';
import { usersService } from '@/lib/services/users.service';
import { billingService } from '@/lib/services/billing.service';
import type { Unit, User, Invoice } from '@/types/models';
import { toast } from 'sonner';
import { CreateUnitDialog } from './CreateUnitDialog';
import { BatchUnitWizard } from './BatchUnitWizard';
import { UnitDetailsSheet } from './UnitDetailsSheet';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/format';

interface UnitsTabProps {
    buildingId: string;
    invoices?: Invoice[];
    users?: User[];
}

export function UnitsTab({ buildingId, invoices: initialInvoices, users: initialUsers }: UnitsTabProps) {
    const [units, setUnits] = useState<Unit[]>([]);
    const [users, setUsers] = useState<User[]>(initialUsers || []);
    const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>(initialInvoices?.filter(i => i.status === 'PENDING') || []);
    const [isLoading, setIsLoading] = useState(!initialInvoices || !initialUsers);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isBatchOpen, setIsBatchOpen] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const promises: any[] = [unitsService.getUnits(buildingId)];

            if (!initialUsers) {
                promises.push(usersService.getUsers({ building_id: buildingId }));
            }
            if (!initialInvoices) {
                promises.push(billingService.getInvoices({ building_id: buildingId, status: 'PENDING' }));
            }

            const results = await Promise.all(promises);
            setUnits(results[0]);
            if (!initialUsers) setUsers(results[1]);
            if (!initialInvoices) setPendingInvoices(results[initialUsers ? 1 : 2]);

        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch units data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (buildingId) {
            fetchData();
        }
    }, [buildingId, initialInvoices, initialUsers]);

    // Map debt to units for display
    const unitDebts = useMemo(() => {
        const debtMap = new Map<string, number>();

        pendingInvoices.forEach(inv => {
            // Robust matching: Try ID first, then name
            let targetUnitId = inv.unit_id;

            // If inv.unit_id doesn't match a unit ID, maybe it's the unit name?
            if (!units.some(u => u.id === targetUnitId)) {
                const matchedByName = units.find(u =>
                    u.name === inv.unit?.name ||
                    u.name === inv.unit_id
                );
                if (matchedByName) {
                    targetUnitId = matchedByName.id;
                }
            }

            if (targetUnitId) {
                const currentDebt = debtMap.get(targetUnitId) || 0;
                const remaining = inv.amount - (inv.paid_amount || 0);
                debtMap.set(targetUnitId, currentDebt + remaining);
            }
        });
        return debtMap;
    }, [pendingInvoices, units]);

    // Helper to find resident for a unit
    const getUnitResident = (unit: Unit) => {
        return users.find(u => u.unit_id === unit.id || u.unit === unit.name);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Units ({units.length})</h3>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Unit
                    </Button>
                    <Button onClick={() => setIsBatchOpen(true)} className="bg-primary">
                        <Wand2 className="mr-2 h-4 w-4" />
                        Auto-Generate
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Unit Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Floor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Current Resident</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Aliquot (%)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Debt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading units...</td>
                                    </tr>
                                ) : units.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No units found. Create one or use the generator!</td>
                                    </tr>
                                ) : (
                                    units.map((unit) => {
                                        const resident = getUnitResident(unit);
                                        const debt = unitDebts.get(unit.id) || 0;
                                        return (
                                            <tr
                                                key={unit.id}
                                                className="hover:bg-accent/50 cursor-pointer transition-colors"
                                                onClick={() => setSelectedUnit(unit)}
                                            >
                                                <td className="px-6 py-4 font-medium text-primary">{unit.name}</td>
                                                <td className="px-6 py-4">
                                                    {unit.floor || (
                                                        <span className="text-red-400 font-bold flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" />
                                                            N/A
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {resident ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                                                                <UserIcon className="h-3 w-3" />
                                                            </div>
                                                            <span className="text-sm font-medium">{resident.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm italic">Vacant</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {unit.aliquot > 0 ? (
                                                        <span>{unit.aliquot}%</span>
                                                    ) : (
                                                        <span className="text-yellow-500 font-bold flex items-center gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            0%
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            "font-bold text-sm",
                                                            debt > 0 ? "text-red-500" : "text-emerald-500"
                                                        )}>
                                                            {formatCurrency(debt)}
                                                        </span>
                                                        {debt > 0 && (
                                                            <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" title="Payment pending" />
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <CreateUnitDialog
                buildingId={buildingId}
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={fetchData}
            />

            <BatchUnitWizard
                buildingId={buildingId}
                isOpen={isBatchOpen}
                onClose={() => setIsBatchOpen(false)}
                onSuccess={fetchData}
            />

            <UnitDetailsSheet
                unit={selectedUnit}
                open={!!selectedUnit}
                onOpenChange={(open) => !open && setSelectedUnit(null)}
            />
        </div>
    );
}
