import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APTO_LOGO_BASE64 } from './logo-base64';
import { getUnitInfo, unitAliquot } from '@/lib/utils/unit-display';
import { formatCurrency } from './format';
import type { Invoice, Unit } from '@/types/models';

export interface InvoicePdfPaymentDetails {
    paymentMethod?: string;
    paymentDate?: string;
    currency?: 'USD' | 'VES';
    rateType?: 'EUR_BCV' | 'USD_BCV' | 'CUSTOM';
    exchangeRate?: number;
    amountVes?: number;
    amountUsd?: number;
    paidAmountUsd?: number;
    totalAmountUsd?: number;
    remainingBalanceUsd?: number;
}

export interface GenerateInvoicePdfOptions {
    invoice: Invoice;
    buildingName?: string;
    unit?: Unit | null;
    paymentDetails?: InvoicePdfPaymentDetails;
}

/**
 * Extracts exchange rate and payment details if present in the invoice description or payment details
 */
/**
 * Robustly parses a Venezuelan formatted or standard decimal number string into float
 */
export function parseFormattedNumber(str: string): number {
    if (!str) return 0;
    const clean = str.trim();
    if (clean.includes(',') && clean.includes('.')) {
        return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
    }
    if (clean.includes(',')) {
        return parseFloat(clean.replace(',', '.')) || 0;
    }
    return parseFloat(clean) || 0;
}

/**
 * How the invoice was paid, from its approved payments (null when the API sent none: invoices
 * paid before payments carried their currency fall back to the description notes).
 * Several Bs payments add up; their rate is the average weighted by the USD each applied.
 */
export function paidFromPayments(invoice: Invoice): Pick<InvoicePdfPaymentDetails,
    'currency' | 'amountVes' | 'exchangeRate' | 'paymentMethod' | 'paymentDate'> | null {
    const payments = invoice.payments ?? [];
    if (payments.length === 0) return null;
    const last = [...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date)).at(-1)!;
    const ves = payments.filter((p) => p.original_currency === 'VES' && p.exchange_rate && p.amount_ves != null);
    if (ves.length === 0) {
        return { currency: 'USD', paymentMethod: last.method, paymentDate: last.payment_date.slice(0, 10) };
    }
    const amountVes = ves.reduce((s, p) => s + p.amount_ves!, 0);
    const usd = ves.reduce((s, p) => s + p.allocated_amount, 0);
    return {
        currency: 'VES',
        amountVes: Math.round(amountVes * 100) / 100,
        exchangeRate: ves.length === 1 ? ves[0].exchange_rate! : amountVes / usd,
        paymentMethod: last.method,
        paymentDate: last.payment_date.slice(0, 10),
    };
}

export function parseInvoicePaymentInfo(invoice: Invoice, explicitDetails?: InvoicePdfPaymentDetails): InvoicePdfPaymentDetails {
    const totalAmount = explicitDetails?.totalAmountUsd ?? invoice.amount ?? 0;
    
    // Determine actual paid amount in USD
    let paidAmount = explicitDetails?.paidAmountUsd;
    if (paidAmount === undefined) {
        if (invoice.paid_amount !== undefined && invoice.paid_amount > 0) {
            paidAmount = invoice.paid_amount;
        } else if (invoice.status === 'PAID') {
            paidAmount = totalAmount;
        } else {
            paidAmount = totalAmount;
        }
    }

    const remainingBalance = Math.max(0, totalAmount - paidAmount);

    const details: InvoicePdfPaymentDetails = {
        paymentMethod: explicitDetails?.paymentMethod || 'PAGO_MOVIL',
        paymentDate: explicitDetails?.paymentDate || invoice.issue_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        currency: explicitDetails?.currency || 'USD',
        rateType: explicitDetails?.rateType || 'EUR_BCV',
        exchangeRate: explicitDetails?.exchangeRate,
        amountVes: explicitDetails?.amountVes,
        amountUsd: paidAmount,
        paidAmountUsd: paidAmount,
        totalAmountUsd: totalAmount,
        remainingBalanceUsd: remainingBalance,
    };

    // Without explicit details, the invoice's payments say how it was paid; older invoices only
    // have it in the description notes.
    const fromPayments = explicitDetails?.currency ? null : paidFromPayments(invoice);
    if (fromPayments) {
        Object.assign(details, fromPayments, { rateType: 'CUSTOM' });
    } else if (!details.amountVes && invoice.description) {
        const bsMatch = invoice.description.match(/Pagado en Bs:\s*([0-9.,]+)/i) || 
                        invoice.description.match(/Abono en Bs:\s*([0-9.,]+)/i) ||
                        invoice.description.match(/Bs\.?\s*([0-9.,]+)/i);
        const rateMatch = invoice.description.match(/Tasa[^:]*:\s*([0-9.,]+)/i);
        const isEuro = /euro|eur/i.test(invoice.description);
        const dateMatch = invoice.description.match(/Fecha:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
        if (dateMatch && !explicitDetails?.paymentDate) {
            details.paymentDate = dateMatch[1];
        }

        const hasBs = Boolean(bsMatch || /en bs|abono en bs|pagado en bs|tasa euro|tasa bcv/i.test(invoice.description));
        const isExplicitCash = !hasBs && /efectivo|cash/i.test(invoice.description);

        if (!hasBs && isExplicitCash) {
            details.currency = 'USD';
            details.paymentMethod = 'CASH';
            details.exchangeRate = undefined;
            details.amountVes = undefined;
        } else if (bsMatch) {
            details.currency = 'VES';
            details.paymentMethod = 'PAGO_MOVIL';
            details.rateType = isEuro ? 'EUR_BCV' : 'USD_BCV';
            details.amountVes = parseFormattedNumber(bsMatch[1]) || undefined;

            if (rateMatch) {
                details.exchangeRate = parseFormattedNumber(rateMatch[1]) || undefined;
            }
        } else {
            details.currency = 'USD';
            details.paymentMethod = 'CASH';
            details.exchangeRate = undefined;
            details.amountVes = undefined;
        }
    }

    // Default calculation if rate is known but amountVes missing
    if (details.currency === 'VES' && details.exchangeRate && !details.amountVes) {
        details.amountVes = Number((paidAmount * details.exchangeRate).toFixed(2));
    }

    return details;
}

/**
 * Generates and downloads the official Condominium Invoice / Payment Receipt PDF
 */
export function generateInvoicePDF(options: GenerateInvoicePdfOptions): void {
    const { invoice, buildingName = 'Edificio Granada', unit } = options;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const unitName = invoice.unit?.name || unit?.name || '';
    const unitInfo = getUnitInfo({ name: unitName }, invoice.user);
    const aptoNumber = unitInfo.unitName;
    const ownerName = unitInfo.ownerName || 'Copropietario';
    const aliquot = unitAliquot(unit?.aliquot) ?? unitAliquot(invoice.unit?.aliquot) ?? 0;

    const paymentInfo = parseInvoicePaymentInfo(invoice, options.paymentDetails);
    const totalAmount = paymentInfo.totalAmountUsd ?? invoice.amount ?? 0;
    const paidAmount = paymentInfo.paidAmountUsd ?? 0;
    const remainingBalance = paymentInfo.remainingBalanceUsd ?? Math.max(0, totalAmount - paidAmount);
    const isFullPaid = remainingBalance <= 0.001;

    const referenceNumber = invoice.receipt_number || invoice.number || `REC-${new Date().getFullYear()}-${aptoNumber.padStart(3, '0')}`;
    const issueDateStr = invoice.issue_date
        ? new Date(invoice.issue_date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const paymentDateStr = paymentInfo.paymentDate
        ? new Date(paymentInfo.paymentDate + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : issueDateStr;

    // ── Header Banner ────────────────────────────────────────────────────────
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Logo
    try {
        doc.addImage(APTO_LOGO_BASE64, 'PNG', margin, 5.5, 17, 17);
    } catch {
        // Fallback if logo fails
    }

    const headerTextX = margin + 21;
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(buildingName.toUpperCase(), headerTextX, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text('ADMINISTRACIÓN DE CONDOMINIO | COMPROBANTE OFICIAL DE PAGO Y FACTURA', headerTextX, 18);
    doc.text(`Fecha de Impresión: ${new Date().toLocaleDateString('es-VE')}`, headerTextX, 23);

    // Document Title & Reference on Top-Right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(isFullPaid ? 'FACTURA / RECIBO' : 'RECIBO DE ABONO PARCIAL', pageWidth - margin, 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(248, 250, 252);
    doc.text(`N°: ${referenceNumber}`, pageWidth - margin, 18, { align: 'right' });
    doc.text(`Período: ${invoice.period || '--'}`, pageWidth - margin, 23, { align: 'right' });

    let currentY = 35;

    // ── Status Banner (Paid vs Partial) ──────────────────────────────────────
    if (isFullPaid) {
        doc.setFillColor(236, 253, 245); // Emerald 50
        doc.setDrawColor(16, 185, 129); // Emerald 500
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, currentY, contentWidth, 11, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(5, 150, 105); // Emerald 600
        doc.text('ESTADO DEL DOCUMENTO: TOTALMENTE PAGADO / SOLVENTE', margin + 4, currentY + 7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Pagado el: ${paymentDateStr}`, pageWidth - margin - 4, currentY + 7, { align: 'right' });

        currentY += 15;
    } else {
        // Partial Payment Banner (Amber / Warning)
        doc.setFillColor(254, 243, 199); // Amber 100
        doc.setDrawColor(245, 158, 11); // Amber 500
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, currentY, contentWidth, 11, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(180, 83, 9); // Amber 700
        doc.text(`ESTADO: ABONO PARCIAL REGISTRADO — SALDO RESTANTE: $${remainingBalance.toFixed(2)} USD`, margin + 4, currentY + 7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Abonado el: ${paymentDateStr}`, pageWidth - margin - 4, currentY + 7, { align: 'right' });

        currentY += 15;
    }

    // ── Apartment & Owner Info Box ────────────────────────────────────────────
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, 26, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('DATOS DEL INMUEBLE Y PROPIETARIO', margin + 4, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500

    // Column 1
    doc.text('Apartamento / Unidad:', margin + 4, currentY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Apartamento ${aptoNumber}`, margin + 4, currentY + 17);

    // Column 2
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Propietario / Titular:', margin + 55, currentY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(ownerName, margin + 55, currentY + 17);

    // Column 3
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Alícuota Legal:', margin + 125, currentY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${aliquot.toFixed(6)}%`, margin + 125, currentY + 17);

    // Column 4
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Teléfono de Contacto:', margin + 155, currentY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(unitInfo.phone || '--', margin + 155, currentY + 17);

    currentY += 31;

    // ── Table of Invoiced Items ──────────────────────────────────────────────
    const baseBudgetMatch = invoice.description?.match(/Base:\s*\$([0-9.,]+)/i);
    const baseBudgetStr = baseBudgetMatch ? `$${baseBudgetMatch[1]}` : (aliquot > 0 ? `$${((totalAmount / (aliquot / 100))).toFixed(2)}` : '--');

    // Clean description to remove appended payment notes in the main description column
    const cleanDescription = (invoice.description || 'Cuota Especial de Condominio').split(' | Pagado')[0].split(' | Abono')[0];

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['CONCEPTO / DESCRIPCIÓN DEL TRABAJO O CUOTA', 'PERÍODO', 'BASE PRESUP.', 'MONTO TOTAL (USD)']],
        body: [
            [
                cleanDescription,
                invoice.period || '--',
                baseBudgetStr,
                `$${totalAmount.toFixed(2)}`,
            ],
        ],
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'left',
        },
        columnStyles: {
            0: { cellWidth: 105, fontSize: 8 },
            1: { cellWidth: 25, halign: 'center', fontSize: 8 },
            2: { cellWidth: 25, halign: 'right', fontSize: 8 },
            3: { cellWidth: 27, halign: 'right', fontStyle: 'bold', fontSize: 8.5 },
        },
        styles: {
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
        },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 30;
    currentY = finalY + 6;

    // ── Payment & Exchange Rate Settlement Box ────────────────────────────────
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, 42, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('LIQUIDACIÓN DEL PAGO Y DETALLE DE LA TASA DE CAMBIO', margin + 4, currentY + 6);

    const rateLabel = paymentInfo.rateType === 'EUR_BCV'
        ? 'Tasa Euro Oficial BCV'
        : paymentInfo.rateType === 'USD_BCV'
        ? 'Tasa Dólar Oficial BCV'
        : 'Tasa Personalizada';

    const methodLabel = paymentInfo.currency === 'USD' || paymentInfo.paymentMethod === 'CASH'
        ? 'Efectivo (Dólares)'
        : paymentInfo.paymentMethod === 'TRANSFER'
        ? 'Transferencia Bancaria'
        : 'Pago Móvil en Bolívares';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    // Row 1: Method, date, currency
    doc.text('Moneda de Pago:', margin + 4, currentY + 13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(paymentInfo.currency === 'VES' ? 'Bolívares (VES)' : 'Dólares (USD)', margin + 35, currentY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Método de Pago:', margin + 70, currentY + 13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(methodLabel, margin + 98, currentY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Fecha Efectiva de Pago:', margin + 135, currentY + 13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(paymentDateStr, margin + 172, currentY + 13);

    // Row 2: Exchange rate and VES amount OR Cash confirmation
    if (paymentInfo.currency === 'VES' && paymentInfo.exchangeRate) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Tasa de Cambio Aplicada:', margin + 4, currentY + 21);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const rateFormatted = paymentInfo.exchangeRate != null ? `${paymentInfo.exchangeRate.toFixed(4)} Bs.` : 'Consultada al día';
        doc.text(`${rateLabel}: ${rateFormatted}`, margin + 45, currentY + 21);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Monto Cancelado en Bs.:', margin + 115, currentY + 21);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129); // Green
        doc.setFontSize(9);
        const vesFormatted = paymentInfo.amountVes != null
            ? `Bs. ${paymentInfo.amountVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '--';
        doc.text(vesFormatted, margin + 155, currentY + 21);
    } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Modalidad de Liquidación:', margin + 4, currentY + 21);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text('Pago recibido íntegramente en Efectivo (Dólares USD) sin conversión cambiaria.', margin + 45, currentY + 21);
    }

    // Row 3: Total vs Paid vs Remaining
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Monto Total Cuota:', margin + 4, currentY + 30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`$${totalAmount.toFixed(2)} USD`, margin + 35, currentY + 30);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Abonado Hoy (USD):', margin + 65, currentY + 30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Green
    doc.text(`$${paidAmount.toFixed(2)} USD`, margin + 98, currentY + 30);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Saldo Restante:', margin + 128, currentY + 30);
    doc.setFont('helvetica', 'bold');
    if (isFullPaid) {
        doc.setTextColor(16, 185, 129);
        doc.text('$0.00 USD (SOLVENTE)', margin + 152, currentY + 30);
    } else {
        doc.setTextColor(225, 29, 72); // Rose/Red
        doc.text(`$${remainingBalance.toFixed(2)} USD (DEBE RESTO)`, margin + 152, currentY + 30);
    }

    // Progress bar representation inside settlement box
    const progressPercent = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 100;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Progreso de pago de la cuota: ${progressPercent}% cancelado ($${paidAmount.toFixed(2)} de $${totalAmount.toFixed(2)} USD)`, margin + 4, currentY + 38);

    currentY += 48;

    // ── Official Notes / Condominium Conditions ──────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('OBSERVACIONES LEGALES:', margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const notes = [
        isFullPaid
            ? '• Este comprobante certifica la recepción conforme del pago total correspondiente a la cuota especial descrita arriba.'
            : `• Este comprobante certifica un ABONO PARCIAL de $${paidAmount.toFixed(2)} USD a la cuota especial. El saldo restante de $${remainingBalance.toFixed(2)} USD queda pendiente para su liquidación.`,
        '• Los pagos realizados en bolívares se calculan con base en la tasa oficial vigente al momento efectivo del pago fijada por el BCV (o tasa euro según acuerdo de asamblea).',
        '• Conserve este recibo oficial como comprobante de su abono y para el control de solvencia de la unidad.',
    ];
    let noteY = currentY + 4;
    notes.forEach((n) => {
        doc.text(n, margin, noteY);
        noteY += 3.8;
    });

    currentY = noteY + 12;

    // ── Signatures Section ───────────────────────────────────────────────────
    const sigWidth = 70;
    const sig1X = margin + 12;
    const sig2X = pageWidth - margin - sigWidth - 12;

    doc.setDrawColor(148, 163, 184); // Slate 400
    doc.setLineWidth(0.4);
    doc.line(sig1X, currentY, sig1X + sigWidth, currentY);
    doc.line(sig2X, currentY, sig2X + sigWidth, currentY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('ADMINISTRACIÓN DEL CONDOMINIO', sig1X + sigWidth / 2, currentY + 4, { align: 'center' });
    doc.text('COPROPIETARIO / PAGADOR', sig2X + sigWidth / 2, currentY + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(buildingName, sig1X + sigWidth / 2, currentY + 8, { align: 'center' });
    doc.text(`Apto. ${aptoNumber} - ${ownerName}`, sig2X + sigWidth / 2, currentY + 8, { align: 'center' });

    // ── Footer ───────────────────────────────────────────────────────────────
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
        `${buildingName} • Documento emitido electrónicamente por el Sistema de Gestión de Condominio`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
    );

    // Save PDF
    const filename = `Recibo_Apto_${aptoNumber}_${invoice.period || 'Cobro'}_${isFullPaid ? 'Total' : 'Abono'}.pdf`;
    doc.save(filename);
}
