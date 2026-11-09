'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Paperclip, Plus, Printer, ReceiptText, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ExpenseCodeCatalog } from './ExpenseCodeCatalog';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import {
    condoReceiptsService,
    type CondoReceipt,
    type ExpenseCode,
    type ExpenseCurrency,
    type PeriodExpenses,
} from '@/lib/services/condo-receipts.service';

const num = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bs = (n: number) => `Bs ${num.format(n)}`;
const usd = (n: number) => `$ ${num.format(n)}`;
const today = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => today().slice(0, 7);
const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const EMPTY_EXPENSE = { code_id: '', detail: '', amount: '', currency: 'VES' as ExpenseCurrency, expense_date: today(), invoice: null as File | null };

export function CondoReceiptsPage({ buildingId: propBuildingId }: { buildingId?: string }) {
    const { selectedBuildingId } = useBuildingContext();
    const buildingId = propBuildingId || selectedBuildingId || undefined;

    const [period, setPeriod] = useState(currentPeriod);
    const [codes, setCodes] = useState<ExpenseCode[]>([]);
    const [data, setData] = useState<PeriodExpenses | null>(null);
    const [receipt, setReceipt] = useState<CondoReceipt | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);

    const [expense, setExpense] = useState(EMPTY_EXPENSE);
    const [fileInputKey, setFileInputKey] = useState(0);
    const [reservePercent, setReservePercent] = useState('10');
    const [confirm, setConfirm] = useState<'generate' | 'void' | null>(null);

    const load = useCallback(async () => {
        if (!buildingId || !period) return;
        setLoading(true);
        try {
            const [codeList, expenses] = await Promise.all([
                condoReceiptsService.listCodes(buildingId),
                condoReceiptsService.listExpenses(buildingId, period),
            ]);
            setCodes(codeList);
            setData(expenses);
            setReceipt(expenses.closed ? await condoReceiptsService.getReceipt(buildingId, period) : null);
        } catch (error) {
            toast.error(errorMessage(error, 'No se pudieron cargar los gastos'));
        } finally {
            setLoading(false);
        }
    }, [buildingId, period]);

    useEffect(() => { load(); }, [load]);

    const codeOptions = useMemo(
        () => codes.map(c => ({ value: c.id, label: `${c.code} · ${c.description}` })),
        [codes],
    );

    if (!buildingId) {
        return (
            <EmptyState
                icon={ReceiptText}
                title="Selecciona un edificio"
                message="Elige un edificio en el selector de la barra lateral para cargar sus gastos y generar el recibo."
            />
        );
    }

    const run = async (action: () => Promise<unknown>, success: string, fallback: string) => {
        setBusy(true);
        try {
            await action();
            toast.success(success);
            await load();
            return true;
        } catch (error) {
            toast.error(errorMessage(error, fallback));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const addExpense = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!expense.code_id) { toast.error('Elige el código del gasto'); return; }
        const ok = await run(
            () => condoReceiptsService.addExpense(buildingId, period, expense),
            'Gasto registrado',
            'No se pudo registrar el gasto',
        );
        if (ok) {
            setExpense({ ...EMPTY_EXPENSE, code_id: expense.code_id, currency: expense.currency, expense_date: expense.expense_date });
            setFileInputKey(k => k + 1);
        }
    };

    const openPrint = (unitId: string) =>
        window.open(`/condo-receipt/${buildingId}/${period}/${unitId}`, '_blank', 'noopener');

    const closed = data?.closed ?? false;

    return (
        <div className="max-w-6xl space-y-6 animate-fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight flex items-center gap-3">
                        <ReceiptText className="h-8 w-8 text-primary" />
                        Recibo de condominio
                    </h1>
                    <p className="text-muted-foreground">
                        Carga los gastos del mes con su factura y al cierre genera el recibo de cada apartamento por alícuota.
                    </p>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="period">Período</Label>
                    <Input id="period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="w-44" />
                </div>
            </div>

            {loading && !data ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <>
                    {!closed && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Registrar gasto</CardTitle>
                                <CardDescription>Adjunta la factura como soporte (PDF o imagen, máx. 10 MB).</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={addExpense} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <Label>Código</Label>
                                        <SearchableSelect
                                            options={codeOptions}
                                            value={expense.code_id}
                                            onValueChange={v => setExpense(p => ({ ...p, code_id: v }))}
                                            placeholder={codes.length ? 'Busca por código o descripción' : 'Primero carga los códigos abajo'}
                                            searchPlaceholder="Ej. limpieza, agua, 6.1.2.18…"
                                            emptyText="Ningún código coincide"
                                            clearValue=""
                                            disabled={busy || codes.length === 0}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="expense_date">Fecha</Label>
                                        <Input id="expense_date" type="date" required value={expense.expense_date} disabled={busy}
                                            onChange={e => setExpense(p => ({ ...p, expense_date: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <Label htmlFor="detail">Detalle (opcional)</Label>
                                        <Input id="detail" placeholder="Bolsas negras, guantes…" value={expense.detail} disabled={busy}
                                            onChange={e => setExpense(p => ({ ...p, detail: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="amount">Monto</Label>
                                        <div className="flex gap-2">
                                            <Input id="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required
                                                value={expense.amount} disabled={busy}
                                                onChange={e => setExpense(p => ({ ...p, amount: e.target.value }))} />
                                            <Select value={expense.currency} onValueChange={v => setExpense(p => ({ ...p, currency: v as ExpenseCurrency }))} disabled={busy}>
                                                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="VES">Bs</SelectItem>
                                                    <SelectItem value="USD">USD</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <Label htmlFor="invoice">Factura</Label>
                                        <Input key={fileInputKey} id="invoice" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
                                            disabled={busy} onChange={e => setExpense(p => ({ ...p, invoice: e.target.files?.[0] ?? null }))} />
                                    </div>
                                    <div className="flex items-end">
                                        <Button type="submit" disabled={busy} className="w-full gap-2">
                                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                            Agregar gasto
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    Gastos del período
                                    {closed && <Badge variant="secondary">Cerrado</Badge>}
                                </CardTitle>
                                <CardDescription>
                                    {data?.totals.count ?? 0} gastos · {bs(data?.totals.ves ?? 0)} + {usd(data?.totals.usd ?? 0)}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {data?.expenses.length ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Código</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                            <TableHead className="w-24" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.expenses.map(e => (
                                            <TableRow key={e.id}>
                                                <TableCell className="whitespace-nowrap">{e.expense_date}</TableCell>
                                                <TableCell className="font-mono">{e.code}</TableCell>
                                                <TableCell>
                                                    <div>{e.code_description}</div>
                                                    {e.detail && <div className="text-xs text-muted-foreground">{e.detail}</div>}
                                                </TableCell>
                                                <TableCell className="text-right whitespace-nowrap">{e.currency === 'USD' ? usd(e.amount) : bs(e.amount)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {e.invoice_url && (
                                                            <Button asChild variant="ghost" size="icon" title="Ver factura">
                                                                <a href={e.invoice_url} target="_blank" rel="noopener noreferrer"><Paperclip className="h-4 w-4" /></a>
                                                            </Button>
                                                        )}
                                                        {!closed && (
                                                            <Button variant="ghost" size="icon" title="Eliminar" disabled={busy}
                                                                onClick={() => run(() => condoReceiptsService.deleteExpense(buildingId, e.id), 'Gasto eliminado', 'No se pudo eliminar')}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground py-6 text-center">No hay gastos cargados en este período.</p>
                            )}
                        </CardContent>
                    </Card>

                    {closed && receipt ? (
                        <Card>
                            <CardHeader className="flex flex-row items-start justify-between gap-4">
                                <div>
                                    <CardTitle>Recibo generado</CardTitle>
                                    <CardDescription>
                                        Total {bs(receipt.total_bs)} ({usd(receipt.total_usd)}) · tasa {num.format(receipt.exchange_rate)} Bs/$ del {receipt.rate_date} · reserva {receipt.reserve_percent}%
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="gap-2" onClick={() => openPrint('all')}>
                                        <Printer className="h-4 w-4" /> Imprimir todos
                                    </Button>
                                    <Button variant="outline" className="gap-2 text-destructive" disabled={busy} onClick={() => setConfirm('void')}>
                                        <Undo2 className="h-4 w-4" /> Anular
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Unidad</TableHead>
                                            <TableHead>N° control</TableHead>
                                            <TableHead className="text-right">Alícuota</TableHead>
                                            <TableHead className="text-right">Bs</TableHead>
                                            <TableHead className="text-right">$</TableHead>
                                            <TableHead className="w-16" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {receipt.units.map(u => (
                                            <TableRow key={u.unit_id}>
                                                <TableCell className="font-medium">{u.unit_name}</TableCell>
                                                <TableCell className="font-mono">{u.control_number}</TableCell>
                                                <TableCell className="text-right">{u.aliquot}</TableCell>
                                                <TableCell className="text-right">{num.format(u.total_bs)}</TableCell>
                                                <TableCell className="text-right">{num.format(u.total_usd)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" title="Ver recibo" onClick={() => openPrint(u.unit_id)}>
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={3}>Total</TableCell>
                                            <TableCell className="text-right">{num.format(receipt.units.reduce((s, u) => s + u.total_bs, 0))}</TableCell>
                                            <TableCell className="text-right">{num.format(receipt.units.reduce((s, u) => s + u.total_usd, 0))}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Generar recibo del mes</CardTitle>
                                <CardDescription>
                                    Agrupa los gastos por código, los convierte a Bs con la tasa de hoy, suma el fondo de reserva y crea la
                                    deuda de cada apartamento según su alícuota. El período queda cerrado.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-wrap items-end gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="reserve">Fondo de reserva (%)</Label>
                                    <Input id="reserve" type="number" min="0" max="100" step="0.01" className="w-32"
                                        value={reservePercent} onChange={e => setReservePercent(e.target.value)} />
                                </div>
                                <Button className="gap-2" disabled={busy || !data?.expenses.length} onClick={() => setConfirm('generate')}>
                                    <ReceiptText className="h-4 w-4" /> Generar recibos
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    <ExpenseCodeCatalog
                        codes={codes}
                        busy={busy}
                        onLoadStandard={() => run(() => condoReceiptsService.loadStandardCodes(buildingId), 'Catálogo estándar cargado', 'No se pudo cargar el catálogo')}
                        onAdd={(code, description) => run(() => condoReceiptsService.createCode(buildingId, code, description), 'Código agregado', 'No se pudo agregar el código')}
                    />
                </>
            )}

            <ConfirmDialog
                open={confirm === 'generate'}
                onOpenChange={open => !open && setConfirm(null)}
                title={`Generar recibos de ${period}`}
                description="Se creará la deuda de cada apartamento y no podrás modificar los gastos del período salvo que anules el recibo."
                confirmLabel="Generar"
                loading={busy}
                onConfirm={async () => {
                    await run(() => condoReceiptsService.generate(buildingId, period, Number(reservePercent) || 0), 'Recibos generados', 'No se pudieron generar los recibos');
                    setConfirm(null);
                }}
            />
            <ConfirmDialog
                open={confirm === 'void'}
                onOpenChange={open => !open && setConfirm(null)}
                title={`Anular recibo de ${period}`}
                description="Se cancelan las facturas del período y se reabre para corregir gastos. Solo es posible si ningún apartamento ha pagado."
                confirmLabel="Anular"
                variant="destructive"
                loading={busy}
                onConfirm={async () => {
                    await run(() => condoReceiptsService.void(buildingId, period), 'Recibo anulado', 'No se pudo anular el recibo');
                    setConfirm(null);
                }}
            />
        </div>
    );
}
