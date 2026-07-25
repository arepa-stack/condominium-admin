import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PettyCashPaymentReportItem } from '@/types/models';
import { APTO_LOGO_BASE64 } from './logo-base64';

export interface GeneratePettyCashPdfOptions {
    buildingName: string;
    buildingCode?: string;
    startDate?: string;
    endDate?: string;
    unitName?: string;
    typeLabel?: string;
    category?: string;
    excludeReversed?: boolean;
}

export function generatePettyCashPDF(
    items: PettyCashPaymentReportItem[],
    options: GeneratePettyCashPdfOptions
): void {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    // ── Header Section ────────────────────────────────────────────────────────
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, pageWidth, 26, 'F');

    // Logo
    try {
        doc.addImage(APTO_LOGO_BASE64, 'PNG', margin, 5.5, 15, 15);
    } catch {
        // Fallback if image fails to render
    }

    const headerTextX = margin + 18;

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('REPORTE DE CAJA CHICA', headerTextX, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(226, 232, 240);
    const buildingInfo = options.buildingCode
        ? `${options.buildingName} (${options.buildingCode})`
        : options.buildingName;
    doc.text(buildingInfo, headerTextX, 19);

    const todayStr = new Date().toLocaleDateString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Emisión: ${todayStr}`, pageWidth - margin, 19, { align: 'right' });

    // ── Filters & Subtitle ───────────────────────────────────────────────────
    let currentY = 33;
    doc.setTextColor(51, 65, 85); // Slate 700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Filtros del Reporte:', margin, currentY);

    doc.setFont('helvetica', 'normal');
    const filterDetails: string[] = [];
    if (options.startDate || options.endDate) {
        filterDetails.push(
            `Rango: ${options.startDate || 'Inicio'} hasta ${options.endDate || 'Hoy'}`
        );
    } else {
        filterDetails.push('Rango: Histórico completo');
    }
    if (options.unitName && options.unitName !== 'all') {
        filterDetails.push(`Unidad: ${options.unitName}`);
    } else {
        filterDetails.push('Unidades: Todas');
    }
    if (options.typeLabel && options.typeLabel !== 'Todos los tipos') {
        filterDetails.push(`Tipo: ${options.typeLabel}`);
    }
    if (options.category && options.category !== 'all') {
        filterDetails.push(`Categoría: ${options.category}`);
    }

    doc.setFontSize(8);
    doc.text(filterDetails.join('  |  '), margin, currentY + 5);

    currentY += 12;

    // ── Financial Summary Cards ──────────────────────────────────────────────
    let totalIncome = 0;
    let totalCollection = 0;
    let totalExpense = 0;
    let totalReversal = 0;

    for (const item of items) {
        if (item.is_reversed) continue;
        const absAmount = Math.abs(item.amount || 0);
        if (item.type === 'income') totalIncome += absAmount;
        else if (item.type === 'collection') totalCollection += absAmount;
        else if (item.type === 'expense') totalExpense += absAmount;
        else if (item.type === 'reversal') totalReversal += item.amount;
    }

    const netAmount = totalIncome + totalCollection - totalExpense + totalReversal;

    doc.setFillColor(241, 245, 249); // Slate 100
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 16, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    const cardWidth = (pageWidth - margin * 2) / 4;
    
    // Card 1: Ingresos Directos
    doc.text('INGRESOS DIRECTOS', margin + 4, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129); // Emerald 500
    doc.text(`$${totalIncome.toFixed(2)}`, margin + 4, currentY + 11);

    // Card 2: Cobros por Cuota
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('COBROS CUOTAS', margin + cardWidth + 4, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129);
    doc.text(`$${totalCollection.toFixed(2)}`, margin + cardWidth + 4, currentY + 11);

    // Card 3: Egresos / Gastos
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('EGRESOS / GASTOS', margin + cardWidth * 2 + 4, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(225, 29, 72); // Rose 600
    doc.text(`$${Math.abs(totalExpense).toFixed(2)}`, margin + cardWidth * 2 + 4, currentY + 11);

    // Card 4: Balance Neto del Reporte
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('BALANCE NETO', margin + cardWidth * 3 + 4, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(netAmount >= 0 ? 16 : 225, netAmount >= 0 ? 185 : 29, netAmount >= 0 ? 129 : 72);
    doc.text(`$${netAmount.toFixed(2)}`, margin + cardWidth * 3 + 4, currentY + 11);

    currentY += 21;

    // ── Table Setup ─────────────────────────────────────────────────────────
    const tableHeaders = [
        'Fecha',
        'Tipo',
        'Unidad',
        'Propietario / Pagador',
        'Nº Recibo / Ref.',
        'Concepto / Descripción',
        'Monto ($)',
    ];

    const tableRows = items.map((item) => {
        const dateStr = item.date
            ? new Date(item.date).toLocaleDateString('es-VE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
              })
            : '—';

        let typeLabel = item.type;
        if (item.type === 'collection') typeLabel = 'Cobro Cuota';
        else if (item.type === 'income') typeLabel = 'Ingreso Directo';
        else if (item.type === 'expense') typeLabel = 'Egreso';
        else if (item.type === 'reversal') typeLabel = 'Reversa';

        if (item.is_reversed) {
            typeLabel += ' (Revertido)';
        }

        const unitStr = item.unit_name || '—';
        const ownerStr = item.owner_name || '—';
        let refStr = item.receipt_number || item.payment_reference;
        if (!refStr && item.description) {
            const match = item.description.match(/pago\s+([a-zA-Z0-9-]+)/i);
            if (match && match[1]) {
                const cleanRef = match[1].split('-')[0].toUpperCase();
                refStr = `REC-${cleanRef}`;
            }
        }
        if (!refStr && item.id) {
            refStr = `REC-${item.id.split('-')[0].toUpperCase()}`;
        }
        if (!refStr) {
            refStr = '—';
        }
        const conceptStr = item.assessment_description || item.description || '—';
        const amountFormatted = item.amount != null ? `$${item.amount.toFixed(2)}` : '$0.00';

        return [
            dateStr,
            typeLabel,
            unitStr,
            ownerStr,
            refStr,
            conceptStr,
            amountFormatted,
        ];
    });

    autoTable(doc, {
        startY: currentY,
        head: [tableHeaders],
        body: tableRows,
        margin: { left: margin, right: margin, bottom: 18 },
        theme: 'striped',
        headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'left',
        },
        bodyStyles: {
            fontSize: 7.5,
            textColor: [51, 65, 85],
        },
        columnStyles: {
            0: { cellWidth: 20 }, // Fecha
            1: { cellWidth: 24 }, // Tipo
            2: { cellWidth: 18 }, // Unidad
            3: { cellWidth: 32 }, // Propietario
            4: { cellWidth: 24 }, // Recibo/Ref
            5: { cellWidth: 'auto' }, // Concepto
            6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }, // Monto
        },
        didDrawPage: (data) => {
            // Footer on every page
            const totalPages = (doc as any).internal.getNumberOfPages();
            const currentPage = data.pageNumber;
            const footerY = pageHeight - 8;

            // "Apto By Nibs" - Apto bold, Nibs lighter
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59); // Slate 800
            doc.text('Apto', margin, footerY);

            const aptoWidth = doc.getTextWidth('Apto');

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text(' By ', margin + aptoWidth, footerY);

            const byWidth = doc.getTextWidth(' By ');

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // Slate 400 (lighter)
            doc.text('Nibs', margin + aptoWidth + byWidth, footerY);

            // Page numbers
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(
                `Página ${currentPage} de ${totalPages}`,
                pageWidth - margin,
                footerY,
                { align: 'right' }
            );
        },
    });

    const fileDateStr = new Date().toISOString().split('T')[0];
    const fileName = `caja_chica_${options.buildingName.replace(/\s+/g, '_').toLowerCase()}_${fileDateStr}.pdf`;
    doc.save(fileName);
}

