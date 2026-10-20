import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from './format';
import { getGranadaCoproprietor } from '@/lib/data/granada-coproprietors';
import { parseFormattedNumber } from './invoice-pdf';
import type { Invoice } from '@/types/models';

export interface BillingReportExportOptions {
    buildingName?: string;
    budgetTitle?: string;
    statusFilterLabel?: string;
    invoices: Invoice[];
    summary: {
        totalAmount: number;
        totalPaid: number;
        totalPending: number;
        progress: number;
        count: number;
    };
    /**
     * When true, hides sensitive personal data (owner names, emails, phones)
     * and only displays apartment numbers (e.g. "Apto 03").
     */
    hideSensitiveData?: boolean;
}

export interface BillingExcelExportOptions {
    buildingName?: string;
    budgetTitle?: string;
    invoices: Invoice[];
    /**
     * When true, hides sensitive personal data (owner names, emails, phones)
     * and only displays apartment numbers (e.g. "Apto 03").
     */
    hideSensitiveData?: boolean;
}

/**
 * Extracts normalized payment method information from an invoice
 */
function getPaymentMethodInfo(invoice: Invoice) {
    if (!invoice.paid_amount || invoice.paid_amount <= 0) {
        return { label: 'Sin Pago', detail: '--' };
    }

    const desc = invoice.description || '';
    const isExplicitCash = /efectivo|cash/i.test(desc);
    const hasBs = /en bs|bs\.?\s*[0-9]|tasa/i.test(desc);

    if (isExplicitCash || !hasBs) {
        return {
            label: 'Efectivo (USD)',
            detail: `$${invoice.paid_amount.toFixed(2)} USD`,
        };
    }

    const rateMatch = desc.match(/Tasa[^:]*:\s*([0-9.,]+)/i);
    const rate = rateMatch ? parseFormattedNumber(rateMatch[1]) : null;
    const bsMatch = desc.match(/Pagado en Bs:\s*([0-9.,]+)/i) || desc.match(/Abono en Bs:\s*([0-9.,]+)/i);
    const bsFormatted = bsMatch ? bsMatch[1] : null;

    return {
        label: 'Bolívares (VES)',
        detail: rate ? `Tasa: ${rate.toFixed(4)} Bs.` : bsFormatted ? `Bs. ${bsFormatted}` : 'Tasa BCV',
    };
}

/**
 * Generates and downloads a complete PDF report of all filtered invoices (regardless of pagination).
 * Supports public/bulletin-board mode (hideSensitiveData = true) to protect owner privacy.
 */
export function generateBillingReportPDF({
    buildingName = 'Residencias Granada',
    budgetTitle = 'Todos los Presupuestos',
    statusFilterLabel = 'Todos los Estados',
    invoices,
    summary,
    hideSensitiveData = false,
}: BillingReportExportOptions): void {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Header Background: Dark navy slate
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, pageWidth, 24, 'F');

    // Title & Building
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(buildingName.toUpperCase(), margin, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    const subtitleText = hideSensitiveData
        ? 'REPORTE DE COBRANZA - MODO CARTELERA / PÚBLICO (DATOS SENSIBLES PROTEGIDOS)'
        : 'REPORTE GENERAL DE COBRANZA Y FACTURACIÓN (ADMINISTRATIVO)';
    doc.text(subtitleText, margin, 17);

    // Metadata on the right
    const dateStr = new Date().toLocaleDateString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    doc.text(`Fecha de Emisión: ${dateStr}`, pageWidth - margin, 10, { align: 'right' });
    doc.text(`Total Registros: ${invoices.length} facturas`, pageWidth - margin, 17, { align: 'right' });

    // Filter information bar
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, 28, pageWidth - margin * 2, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Campaña / Presupuesto: ${budgetTitle}`, margin + 4, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const privacyNotice = hideSensitiveData
        ? 'Modo Cartelera (Solo Apto - Nombres y contactos omitidos)'
        : 'Modo Completo Administrativo';
    doc.text(`Filtro: ${statusFilterLabel}  |  Privacidad: ${privacyNotice}`, margin + 4, 40);

    // Financial totals summary boxes on filter bar right side
    const summaryX = pageWidth - margin - 130;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Total Facturado: `, summaryX, 34);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(summary.totalAmount), summaryX + 28, 34);

    doc.setFont('helvetica', 'normal');
    doc.text(`Total Cobrado: `, summaryX + 55, 34);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // Green
    doc.text(`${formatCurrency(summary.totalPaid)} (${summary.progress}%)`, summaryX + 78, 34);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`Saldo Restante: `, summaryX, 40);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(217, 119, 6); // Amber
    doc.text(formatCurrency(summary.totalPending), summaryX + 28, 40);

    if (hideSensitiveData) {
        // --- MODE: PUBLIC / BULLETIN BOARD (ONLY APARTMENT NUMBER, NO NAMES) ---
        const tableData = invoices.map((inv) => {
            const coprop = getGranadaCoproprietor(inv.unit?.name || '');
            const apto = coprop?.apto ? `Apto ${coprop.apto}` : (inv.unit?.name ? `Apto ${inv.unit.name}` : '--');
            const aliquot = coprop?.aliquot ? `${coprop.aliquot.toFixed(4)}%` : '--';
            const payment = getPaymentMethodInfo(inv);
            const remaining = Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0));
            const progressPct = inv.amount > 0 ? Math.round(((inv.paid_amount || 0) / inv.amount) * 100) : 0;

            const statusLabel =
                inv.status === 'PAID'
                    ? 'PAGADO'
                    : inv.status === 'PARTIAL'
                    ? 'PARCIAL'
                    : inv.status === 'CANCELLED'
                    ? 'CANCELADO'
                    : 'PENDIENTE';

            return [
                apto,
                aliquot,
                inv.period || '--',
                formatCurrency(inv.amount || 0),
                payment.label === 'Sin Pago' ? '--' : `${payment.label}\n${payment.detail}`,
                formatCurrency(inv.paid_amount || 0),
                formatCurrency(remaining),
                `${progressPct}%`,
                statusLabel,
            ];
        });

        autoTable(doc, {
            startY: 48,
            head: [[
                'Apartamento',
                'Alícuota',
                'Período',
                'Cuota Total',
                'Forma de Pago',
                'Abonado',
                'Saldo Debe',
                'Progreso',
                'Estado',
            ]],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'left',
            },
            columnStyles: {
                0: { cellWidth: 26, fontStyle: 'bold', halign: 'center', fontSize: 8 }, // Apartamento
                1: { cellWidth: 24, halign: 'center', fontSize: 7.5 },                   // Alícuota
                2: { cellWidth: 22, halign: 'center', fontSize: 7.5 },                   // Período
                3: { cellWidth: 28, halign: 'right', fontStyle: 'bold', fontSize: 7.5 },  // Cuota Total
                4: { cellWidth: 70, fontSize: 7.5 },                                     // Forma de Pago
                5: { cellWidth: 28, halign: 'right', fontStyle: 'bold', fontSize: 7.5 },  // Abonado
                6: { cellWidth: 28, halign: 'right', fontSize: 7.5 },                    // Saldo Debe
                7: { cellWidth: 20, halign: 'center', fontSize: 7.5 },                   // Progreso
                8: { cellWidth: 23, halign: 'center', fontStyle: 'bold', fontSize: 7.5 }, // Estado
            },
            styles: {
                fontSize: 7.5,
                cellPadding: 2.2,
                lineColor: [226, 232, 240],
                lineWidth: 0.15,
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
            didDrawPage: (data) => {
                const pageNumber = (doc as any).internal.getNumberOfPages();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Página ${data.pageNumber} de ${pageNumber} • ${buildingName} • Reporte Público para Cartelera`,
                    pageWidth / 2,
                    doc.internal.pageSize.getHeight() - 6,
                    { align: 'center' }
                );
            },
        });
    } else {
        // --- MODE: ADMINISTRATIVE COMPLETE (INCLUDES COPROPRIETOR NAMES) ---
        const tableData = invoices.map((inv) => {
            const coprop = getGranadaCoproprietor(inv.unit?.name || '');
            const apto = coprop?.apto ? `Apto ${coprop.apto}` : (inv.unit?.name || '--');
            const propietario = inv.user?.name || coprop?.propietario || 'Copropietario';
            const aliquot = coprop?.aliquot ? `${coprop.aliquot.toFixed(4)}%` : '--';
            const payment = getPaymentMethodInfo(inv);
            const remaining = Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0));
            const progressPct = inv.amount > 0 ? Math.round(((inv.paid_amount || 0) / inv.amount) * 100) : 0;

            const statusLabel =
                inv.status === 'PAID'
                    ? 'PAGADO'
                    : inv.status === 'PARTIAL'
                    ? 'PARCIAL'
                    : inv.status === 'CANCELLED'
                    ? 'CANCELADO'
                    : 'PENDIENTE';

            return [
                apto,
                propietario,
                aliquot,
                inv.period || '--',
                formatCurrency(inv.amount || 0),
                payment.label === 'Sin Pago' ? '--' : `${payment.label}\n${payment.detail}`,
                formatCurrency(inv.paid_amount || 0),
                formatCurrency(remaining),
                `${progressPct}%`,
                statusLabel,
            ];
        });

        autoTable(doc, {
            startY: 48,
            head: [[
                'Apto',
                'Propietario / Titular',
                'Alícuota',
                'Período',
                'Cuota Total',
                'Forma de Pago',
                'Abonado',
                'Saldo Debe',
                'Progreso',
                'Estado',
            ]],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: [255, 255, 255],
                fontSize: 7.5,
                fontStyle: 'bold',
                halign: 'left',
            },
            columnStyles: {
                0: { cellWidth: 15, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
                1: { cellWidth: 55, fontSize: 7.5 },
                2: { cellWidth: 18, halign: 'center', fontSize: 7.5 },
                3: { cellWidth: 18, halign: 'center', fontSize: 7.5 },
                4: { cellWidth: 22, halign: 'right', fontStyle: 'bold', fontSize: 7.5 },
                5: { cellWidth: 42, fontSize: 7 },
                6: { cellWidth: 22, halign: 'right', fontStyle: 'bold', fontSize: 7.5 },
                7: { cellWidth: 22, halign: 'right', fontSize: 7.5 },
                8: { cellWidth: 18, halign: 'center', fontSize: 7.5 },
                9: { cellWidth: 22, halign: 'center', fontStyle: 'bold', fontSize: 7.5 },
            },
            styles: {
                fontSize: 7,
                cellPadding: 2,
                lineColor: [226, 232, 240],
                lineWidth: 0.15,
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252],
            },
            didDrawPage: (data) => {
                const pageNumber = (doc as any).internal.getNumberOfPages();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `Página ${data.pageNumber} de ${pageNumber} • ${buildingName} • Reporte Administrativo`,
                    pageWidth / 2,
                    doc.internal.pageSize.getHeight() - 6,
                    { align: 'center' }
                );
            },
        });
    }

    const cleanBudget = budgetTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const prefix = hideSensitiveData ? 'Reporte_Cartelera' : 'Reporte_Administrativo';
    const fileName = `${prefix}_${cleanBudget}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
}

/**
 * Exports all filtered invoices into a clean Excel-compatible CSV file (with BOM for Spanish accents).
 * Supports public/bulletin-board mode (hideSensitiveData = true) to omit names, emails, and phones.
 */
export function exportBillingReportExcel({
    buildingName = 'Residencias Granada',
    budgetTitle = 'Todos los Presupuestos',
    invoices,
    hideSensitiveData = false,
}: BillingExcelExportOptions): void {
    let headers: string[];
    let rows: string[];

    if (hideSensitiveData) {
        // --- MODE: PUBLIC / BULLETIN BOARD (ANONYMIZED) ---
        headers = [
            'Apartamento',
            'Alícuota (%)',
            'Período',
            'Monto Cuota USD',
            'Monto Pagado USD',
            'Saldo Restante USD',
            'Progreso (%)',
            'Forma de Pago',
            'Detalle Liquidación',
            'Estado',
            'Concepto',
            'Fecha Emisión',
        ];

        rows = invoices.map((inv) => {
            const coprop = getGranadaCoproprietor(inv.unit?.name || '');
            const apto = coprop?.apto ? `Apto ${coprop.apto}` : (inv.unit?.name ? `Unidad ${inv.unit.name}` : '');
            const aliquot = coprop?.aliquot ? coprop.aliquot.toFixed(6) : '';
            const payment = getPaymentMethodInfo(inv);
            const remaining = Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0));
            const progressPct = inv.amount > 0 ? Math.round(((inv.paid_amount || 0) / inv.amount) * 100) : 0;
            const concept = budgetTitle !== 'all' ? budgetTitle : 'Cuota de Condominio';

            return [
                `"${apto}"`,
                `"${aliquot}"`,
                `"${inv.period || ''}"`,
                (inv.amount || 0).toFixed(2),
                (inv.paid_amount || 0).toFixed(2),
                remaining.toFixed(2),
                progressPct,
                `"${payment.label}"`,
                `"${payment.detail.replace(/"/g, '""')}"`,
                `"${inv.status}"`,
                `"${concept.replace(/"/g, '""')}"`,
                `"${inv.issue_date || ''}"`,
            ].join(';');
        });
    } else {
        // --- MODE: ADMINISTRATIVE COMPLETE ---
        headers = [
            'Apartamento',
            'Unidad',
            'Propietario',
            'Correo Electrónico',
            'Teléfono',
            'Alícuota (%)',
            'Período',
            'Monto Cuota USD',
            'Monto Pagado USD',
            'Saldo Restante USD',
            'Progreso (%)',
            'Forma de Pago',
            'Detalle Liquidación',
            'Estado',
            'Descripción / Concepto',
            'Fecha Emisión',
        ];

        rows = invoices.map((inv) => {
            const coprop = getGranadaCoproprietor(inv.unit?.name || '');
            const apto = coprop?.apto ? `Apto ${coprop.apto}` : (inv.unit?.name || '');
            const unitName = inv.unit?.name || '';
            const propietario = inv.user?.name || coprop?.propietario || 'Copropietario';
            const email = inv.user?.email || coprop?.email || '';
            const phone = inv.user?.phone || coprop?.phone || '';
            const aliquot = coprop?.aliquot ? coprop.aliquot.toFixed(6) : '';
            const payment = getPaymentMethodInfo(inv);
            const remaining = Math.max(0, (inv.amount || 0) - (inv.paid_amount || 0));
            const progressPct = inv.amount > 0 ? Math.round(((inv.paid_amount || 0) / inv.amount) * 100) : 0;

            return [
                `"${apto}"`,
                `"${unitName}"`,
                `"${propietario.replace(/"/g, '""')}"`,
                `"${email.replace(/"/g, '""')}"`,
                `"${phone.replace(/"/g, '""')}"`,
                `"${aliquot}"`,
                `"${inv.period || ''}"`,
                (inv.amount || 0).toFixed(2),
                (inv.paid_amount || 0).toFixed(2),
                remaining.toFixed(2),
                progressPct,
                `"${payment.label}"`,
                `"${payment.detail.replace(/"/g, '""')}"`,
                `"${inv.status}"`,
                `"${(inv.description || '').replace(/"/g, '""')}"`,
                `"${inv.issue_date || ''}"`,
            ].join(';');
        });
    }

    // UTF-8 BOM so Excel opens with proper accents and Spanish characters
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanBudget = budgetTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const prefix = hideSensitiveData ? 'Reporte_Cartelera' : 'Reporte_Administrativo';
    link.setAttribute('href', url);
    link.setAttribute('download', `${prefix}_${cleanBudget}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
