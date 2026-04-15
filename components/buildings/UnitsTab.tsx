import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeletons';
import { Plus, Wand2, User as UserIcon, AlertTriangle, AlertCircle, Home } from 'lucide-react';
import { unitsService } from '@/lib/services/units.service';
import { usersService } from '@/lib/services/users.service';
import { billingService } from '@/lib/services/billing.service';
import type { Unit, User, Invoice } from '@/types/models';
import { toast } from 'sonner';
import { CreateUnitDialog } from './CreateUnitDialog';
import { BatchUnitWizard } from './BatchUnitWizard';
import { UnitDetailsSheet } from './UnitDetailsSheet';
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
            toast.error('Error al cargar los datos de las unidades');
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
                <h3 className="text-lg font-medium">Unidades ({units.length})</h3>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar unidad
                    </Button>
                    <Button onClick={() => setIsBatchOpen(true)} className="bg-primary">
                        <Wand2 className="mr-2 h-4 w-4" />
                        Auto-generar
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <TableSkeleton rows={5} columns={5} />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Piso</TableHead>
                            <TableHead>Residente actual</TableHead>
                            <TableHead>Alícuota (%)</TableHead>
                            <TableHead>Deuda</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {units.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="p-0">
                                    <EmptyState icon={Home} message="No hay unidades. Creá una o usá el generador." variant="inline" />
                                </TableCell>
                            </TableRow>
                        ) : (
                            units.map((unit) => {
                                const resident = getUnitResident(unit);
                                const debt = unitDebts.get(unit.id) || 0;
                                return (
                                    <TableRow
                                        key={unit.id}
                                        className="cursor-pointer"
                                        onClick={() => setSelectedUnit(unit)}
                                    >
                                        <TableCell className="font-medium text-primary">{unit.name}</TableCell>
                                        <TableCell>
                                            {unit.floor || (
                                                <span className="text-destructive font-bold flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    N/D
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {resident ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                                                        <UserIcon className="h-3 w-3" />
                                                    </div>
                                                    <span className="text-sm font-medium">{resident.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm italic">Vacante</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {unit.aliquot > 0 ? (
                                                <span>{unit.aliquot}%</span>
                                            ) : (
                                                <span className="text-chart-2 font-bold flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    0%
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "font-bold text-sm",
                                                    debt > 0 ? "text-destructive" : "text-chart-1"
                                                )}>
                                                    {formatCurrency(debt)}
                                                </span>
                                                {debt > 0 && (
                                                    <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" title="Pago pendiente" />
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            )}

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
