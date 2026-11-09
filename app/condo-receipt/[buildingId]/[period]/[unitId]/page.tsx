'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { condoReceiptsService, type UnitReceipt } from '@/lib/services/condo-receipts.service';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const num = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const periodLabel = (period: string) => `${MONTHS[Number(period.slice(5, 7)) - 1]} - ${period.slice(0, 4)}`;
const ddmmyyyy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** Printable "aviso de cobro" of one unit, or of every unit when unitId is "all". */
export default function CondoReceiptPrintPage() {
    const { buildingId, period, unitId } = useParams<{ buildingId: string; period: string; unitId: string }>();
    const [receipts, setReceipts] = useState<UnitReceipt[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const ids = unitId === 'all'
                ? (await condoReceiptsService.getReceipt(buildingId, period)).units.map(u => u.unit_id)
                : [unitId];
            setReceipts(await Promise.all(ids.map(id => condoReceiptsService.getUnitReceipt(buildingId, period, id))));
        })().catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar el recibo'));
    }, [buildingId, period, unitId]);

    if (error) return <p className="p-8 text-destructive">{error}</p>;
    if (!receipts) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-zinc-100 py-6 print:bg-white print:py-0">
            <div className="mx-auto mb-4 flex max-w-[210mm] justify-end print:hidden">
                <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
            </div>
            {receipts.map(r => <Notice key={r.unit.id} r={r} />)}
        </div>
    );
}

function Notice({ r }: { r: UnitReceipt }) {
    const box = 'border border-zinc-500 rounded-md overflow-hidden';
    const head = 'bg-zinc-200 font-bold text-center px-2 py-1 border-b border-zinc-500';
    const p = r.payment_info;

    return (
        <article className="mx-auto mb-6 max-w-[210mm] bg-white p-6 text-[11px] leading-tight text-black shadow print:mb-0 print:shadow-none print:break-after-page">
            <header className="mb-3 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-lg font-black uppercase">{r.building.name}</h1>
                    <p className="text-zinc-700">{r.building.address}</p>
                </div>
                <div className={`${box} text-[10px]`}>
                    <div className={head}>TASA APLICADA</div>
                    <div className="px-3 py-1">{num.format(r.exchange_rate)} Bs/$ · {ddmmyyyy(r.rate_date)}</div>
                </div>
            </header>

            <div className="grid grid-cols-[1fr_auto] gap-3">
                <section className={box}>
                    <div className={`${head} text-base`}>AVISO DE COBRO</div>
                    <div className="space-y-1 p-2">
                        <Row label="N° CONTROL:" value={r.control_number} extra={<><b>PERIODO:</b> {periodLabel(r.period)}</>} />
                        <Row label="INMUEBLE:" value={r.building.name} />
                        <Row label="UNIDAD FAMILIAR:" value={r.unit.name} />
                        <Row label="PROPIETARIO:" value={r.unit.owners.join(' Y ') || '—'} />
                        <Row label="ALICUOTA:" value={String(r.unit.aliquot)} />
                    </div>
                    <div className="border-t border-zinc-500 bg-zinc-100 px-2 py-1 text-center font-bold">
                        FECHA DE IMPRESIÓN {new Date().toLocaleString('es-VE')}
                    </div>
                </section>

                <section className={`${box} min-w-64`}>
                    <div className={head}>BALANCE DE DEUDA PROPIETARIO</div>
                    <table className="w-full">
                        <tbody>
                            <tr className="border-b border-zinc-400">
                                <td className="px-2 py-1 font-bold">NETO A PAGAR</td>
                                <td className="px-2 text-right">Bs {num.format(r.net_bs)}</td>
                                <td className="px-2 text-right">$ {num.format(r.net_usd)}</td>
                            </tr>
                            <tr className="border-b border-zinc-400">
                                <td className="px-2 py-1 font-bold">DEUDA ACUMULADA</td>
                                <td className="px-2 text-right">Bs {num.format(r.debt_bs)}</td>
                                <td className="px-2 text-right">$ {num.format(r.debt_usd)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="px-2 py-1 text-center font-bold">RECIBOS PENDIENTES: {r.pending_invoices}</div>
                </section>
            </div>

            <table className="mt-3 w-full border border-zinc-500">
                <thead className="bg-zinc-200">
                    <tr className="border-b border-zinc-500 text-left">
                        <th className="px-2 py-1">CÓDIGO</th>
                        <th className="px-2">DESCRIPCIÓN DEL GASTO DEL CONDOMINIO</th>
                        <th className="px-2 text-right">% GASTO</th>
                        <th className="px-2 text-right">MONTO Bs</th>
                        <th className="px-2 text-right">CUOTA Bs</th>
                    </tr>
                </thead>
                <tbody>
                    {r.lines.map((l, i) => (
                        <tr key={i}>
                            <td className="px-2 font-mono">{l.code ?? ''}</td>
                            <td className="px-2 uppercase">{l.description}</td>
                            <td className="px-2 text-right">{num.format(l.percent)}</td>
                            <td className="px-2 text-right">{num.format(l.amount_bs)}</td>
                            <td className="px-2 text-right">{num.format(l.share_bs)}</td>
                        </tr>
                    ))}
                    <tr className="h-4"><td colSpan={5} /></tr>
                </tbody>
                <tfoot>
                    <tr className="border-t border-zinc-500 font-bold">
                        <td colSpan={2} className="px-2 py-1 text-right">TOTAL GENERAL :</td>
                        <td className="px-2 text-right">100%</td>
                        <td className="px-2 text-right">{num.format(r.total_bs)}</td>
                        <td className="px-2 text-right">Bs {num.format(r.net_bs)}</td>
                    </tr>
                </tfoot>
            </table>

            {p && (p.account_number || p.pago_movil_phone) && (
                <div className="mt-3 border border-zinc-500 bg-zinc-100 px-2 py-1 text-center font-bold">
                    FAVOR EFECTUAR DEPÓSITO O TRANSFERENCIA A NOMBRE DE: {p.account_holder ?? r.building.name}
                    {p.bank_name && <> · BANCO {p.bank_name}</>}
                    {p.account_number && <> · CUENTA N° {p.account_number}</>}
                    {p.rif && <> · RIF {p.rif}</>}
                    {p.pago_movil_phone && <> · PAGO MÓVIL {p.pago_movil_phone}</>}
                </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-3">
                <section className={box}>
                    <div className={`${head} text-left`}>INFORMACIÓN ADICIONAL</div>
                    <p className="p-2">
                        Reporte sus pagos desde la app del condominio.
                        {p?.email && <> Correo: <b>{p.email}</b>.</>}
                    </p>
                </section>
                <section className={box}>
                    <div className={head}>HISTÓRICO ÚLTIMOS 4 PAGOS</div>
                    <table className="w-full">
                        <tbody>
                            {r.last_payments.length === 0 && <tr><td className="p-2 text-center text-zinc-500">Sin pagos registrados</td></tr>}
                            {r.last_payments.map((pay, i) => (
                                <tr key={i}>
                                    <td className="px-2">{ddmmyyyy(pay.payment_date)}</td>
                                    <td className="px-2">PAGO CONDOMINIO</td>
                                    <td className="px-2 text-right">
                                        {pay.original_currency === 'VES' && pay.original_amount !== null
                                            ? `Bs ${num.format(pay.original_amount)}`
                                            : `$ ${num.format(pay.amount)}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>

            <footer className="mt-6 flex flex-wrap gap-6 border-t border-dashed border-zinc-500 pt-3">
                {['Fecha:', 'Efectivo:', 'Cheque:', 'Transferencia:', 'Depósito:', 'N°'].map(label => (
                    <span key={label}>{label} <span className="inline-block h-3 w-10 border border-zinc-500 align-middle" /></span>
                ))}
            </footer>
        </article>
    );
}

function Row({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
    return (
        <div className="flex gap-2">
            <span className="w-32 shrink-0 text-right font-bold">{label}</span>
            <span className="flex-1">{value}</span>
            {extra && <span>{extra}</span>}
        </div>
    );
}
