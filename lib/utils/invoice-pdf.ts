import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APTO_LOGO_BASE64 } from './logo-base64';
import { getGranadaCoproprietor } from '@/lib/data/granada-coproprietors';
import { formatCurrency } from './format';
import type { Invoice, Unit, Building } from '@/types/models';

export interface InvoicePdfPaymentDetails {
    paymentMethod?: string;
    paymentDate?: string;
    currency?: 'USD' | 'VES';
    rateType?: 'EUR_BCV' | 'USD_BCV' | 'CUSTOM';
    exchangeRate?: number;
    amountVes?: number;
    amountUsd?: number;
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
export function parseInvoicePaymentInfo(invoice: Invoice, explicitDetails?: InvoicePdfPaymentDetails): InvoicePdfPaymentDetails {
    const details: InvoicePdfPaymentDetails = {
        paymentMethod: explicitDetails?.paymentMethod || 'PAGO_MOVIL',
        paymentDate: explicitDetails?.paymentDate || invoice.issue_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        currency: explicitDetails?.currency || 'USD',
        rateType: explicitDetails?.rateType || 'EUR_BCV',
        exchangeRate: explicitDetails?.exchangeRate,
        amountVes: explicitDetails?.amountVes,
        amountUsd: explicitDetails?.amountUsd || invoice.amount,
    };

    // If explicit details were not provided with VES info, try to parse from description
    if (!details.amountVes && invoice.description) {
        // Regex to extract e.g.: "Pagado en Bs: 2,260.00 (Tasa EUR: 45.20 Bs. - Fecha: 15/10/2026)"
        const bsMatch = invoice.description.match(/Pagado en Bs:\s*([0-9.,]+)/i) || invoice.description.match(/Bs\.?\s*([0-9.,]+)/i);
        const rateMatch = invoice.description.match(/Tasa\s*(?:EUR|Euro|USD|Dólar)?:\s*([0-9.,]+)/i);
        const isEuro = /euro|eur/i.test(invoice.description);

        if (bsMatch) {
            details.currency = 'VES';
            details.rateType = isEuro ? 'EUR_BCV' : 'USD_BCV';
            const rawBs = bsMatch[1].replace(/\./g, '').replace(',', '.');
            details.amountVes = parseFloat(rawBs) || undefined;
        }

        if (rateMatch) {
            const rawRate = rateMatch[1].replace(/\./g, '').replace(',', '.');
            details.exchangeRate = parseFloat(rawRate) || undefined;
        }
    }

    // Default calculation if rate is known but amountVes missing
    if (details.currency === 'VES' && details.exchangeRate && !details.amountVes) {
        details.amountVes = Number((invoice.amount * details.exchangeRate).toFixed(2));
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
    const coprop = getGranadaCoproprietor(unitName);
    const aptoNumber = coprop?.apto || unitName.replace('-', '');
    const ownerName = coprop?.propietario || invoice.user?.name || 'Copropietario';
    const aliquot = coprop?.aliquot ?? (invoice.unit?.aliquot || unit?.aliquot || 0);

    const paymentInfo = parseInvoicePaymentInfo(invoice, options.paymentDetails);
    const isPaid = invoice.status === 'PAID';

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
    doc.text('FACTURA / RECIBO', pageWidth - margin, 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(248, 250, 252);
    doc.text(`N°: ${referenceNumber}`, pageWidth - margin, 18, { align: 'right' });
    doc.text(`Período: ${invoice.period || '--'}`, pageWidth - margin, 23, { align: 'right' });

    let currentY = 35;

    // ── Status Banner (Paid / Cancelled) ──────────────────────────────────────
    if (isPaid) {
        doc.setFillColor(236, 253, 245); // Emerald 50
        doc.setDrawColor(16, 185, 129); // Emerald 500
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, currentY, contentWidth, 11, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(5, 150, 105); // Emerald 600
        doc.text('ESTADO DEL DOCUMENTO: TOTALMENTE PAGADO / SOLVENTE', margin + 4, currentY + 7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Pagado el: ${paymentDateStr}`, pageWidth - margin - 4, currentY + 7, { align: 'right' });

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
    doc.text(`Apartamento ${aptoNumber} ${unitName ? `(${unitName})` : ''}`, margin + 4, currentY + 17);

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
    doc.text(coprop?.phone || '--', margin + 155, currentY + 17);

    currentY += 31;

    // ── Table of Invoiced Items ──────────────────────────────────────────────
    const baseBudgetMatch = invoice.description?.match(/Base:\s*\$([0-9.,]+)/i);
    const baseBudgetStr = baseBudgetMatch ? `$${baseBudgetMatch[1]}` : (aliquot > 0 ? `$${((invoice.amount / (aliquot / 100))).toFixed(2)}` : '--');

    // Clean description to remove appended payment notes in the main description column
    const cleanDescription = (invoice.description || 'Cuota Especial de Condominio').split(' | Pago')[0];

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['CONCEPTO / DESCRIPCIÓN DEL TRABAJO O CUOTA', 'PERÍODO', 'BASE PRESUP.', 'MONTO (USD)']],
        body: [
            [
                cleanDescription,
                invoice.period || '--',
                baseBudgetStr,
                `$${invoice.amount.toFixed(2)}`,
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
    doc.roundedRect(margin, currentY, contentWidth, 38, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('LIQUIDACIÓN DEL PAGO Y DETALLE DE LA TASA DE CAMBIO', margin + 4, currentY + 6);

    const rateLabel = paymentInfo.rateType === 'EUR_BCV'
        ? 'Tasa Euro Oficial BCV'
        : paymentInfo.rateType === 'USD_BCV'
        ? 'Tasa Dólar Oficial BCV'
        : 'Tasa Personalizada';

    const methodLabel = paymentInfo.paymentMethod === 'PAGO_MOVIL'
        ? 'Pago Móvil'
        : paymentInfo.paymentMethod === 'TRANSFER'
        ? 'Transferencia Bancaria'
        : 'Efectivo / Zelle';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    // Row 1
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

    // Row 2
    if (paymentInfo.currency === 'VES' || paymentInfo.exchangeRate) {
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
    }

    // Row 3: Totals comparison
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Abono a Factura (Ref. USD):', margin + 4, currentY + 30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`$${invoice.amount.toFixed(2)} USD`, margin + 48, currentY + 30);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Saldo Restante:', margin + 85, currentY + 30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    const balanceRemaining = Math.max(0, invoice.amount - (isPaid ? invoice.amount : (invoice.paid_amount || 0)));
    doc.text(`$${balanceRemaining.toFixed(2)} USD (${balanceRemaining === 0 ? 'SOLVENTE' : 'PENDIENTE'})`, margin + 110, currentY + 30);

    currentY += 44;

    // ── Official Notes / Condominium Conditions ──────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('OBSERVACIONES LEGALES:', margin, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const notes = [
        '• Este comprobante certifica la recepción conforme del pago correspondiente a la cuota especial descrita arriba.',
        '• Los pagos realizados en bolívares se calculan con base en la tasa oficial vigente al momento efectivo del pago fijada por el BCV (o tasa euro según acuerdo de asamblea).',
        '• Conserve este recibo oficial como comprobante de solvencia de la unidad para el período y concepto señalados.',
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
    const filename = `Factura_Apto_${aptoNumber}_${invoice.period || 'Cobro'}.pdf`;
    doc.save(filename);
}
