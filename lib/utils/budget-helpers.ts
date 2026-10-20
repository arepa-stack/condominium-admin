import { getGranadaCoproprietor } from '@/lib/data/granada-coproprietors';
import type { Invoice, Decision, Unit } from '@/types/models';

export interface ActiveBudgetOption {
  id: string;
  title: string;
  baseBudget?: number;
  period?: string;
  details?: string;
  source: 'invoice_campaign' | 'decision';
  invoiceCount?: number;
}

export interface BudgetInvoiceGroup {
  id: string;
  title: string;
  baseBudget?: number;
  details?: string;
  isBudget: boolean;
  invoices: Invoice[];
  totalAmount: number;
  totalPaid: number;
  totalAliquot: number;
  count: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  progress: number;
}

/**
 * Normalizes an invoice description to extract the concept or budget name and base amount.
 */
export function parseBudgetFromDescription(
  desc?: string,
  invoice?: Partial<Invoice>
): {
  title: string;
  baseBudget?: number;
  details?: string;
  isBudget: boolean;
} {
  const isEarthquakeOrRepairs = (str?: string) =>
    Boolean(str && /terremoto|reparaci[oó]n.*pintura|reparaciones mayores|pintura/i.test(str));

  if (!desc || !desc.trim()) {
    // If description is empty but invoice belongs to the special quota period (2026-10) or amounts match
    if (
      invoice &&
      (invoice.period === '2026-10' ||
        (invoice.year === 2026 && invoice.month === 10) ||
        (invoice.amount && [114.18, 100.67, 122.77, 184.16].includes(Math.round(invoice.amount * 100) / 100)))
    ) {
      return {
        title: 'Cuota Especial: Reparaciones Mayores y Pintura',
        baseBudget: 3100,
        isBudget: true,
      };
    }
    return { title: 'Facturas Generales / Sin Concepto', isBudget: false };
  }

  const raw = desc.trim();

  // Pattern 1: Title - Base: $3100.00 (Alícuota: 3.6832%) | Details
  const baseMatch = raw.match(/(?:Base|Presupuesto):\s*\$?([0-9.,]+)/i);
  if (baseMatch) {
    const parsedBase = parseFloat(baseMatch[1].replace(/,/g, ''));
    const parts = raw.split(/[-–—]\s*(?:Base|Presupuesto):/i);
    let title = parts[0]?.trim() || 'Presupuesto Especial';

    if (isEarthquakeOrRepairs(title) || isEarthquakeOrRepairs(raw)) {
      title = 'Cuota Especial: Reparaciones Mayores y Pintura';
    } else if (/cisterna/i.test(title)) {
      title = 'Cisterna de agua';
    }

    // Extract optional details after '|'
    const detailsMatch = raw.split(/\|\s*/);
    const details = detailsMatch.length > 1 ? detailsMatch.slice(1).join(' | ').trim() : undefined;

    return {
      title,
      baseBudget: !isNaN(parsedBase) && parsedBase > 0 ? parsedBase : (isEarthquakeOrRepairs(title) ? 3100 : undefined),
      details,
      isBudget: true,
    };
  }

  // Pattern 2: Strip individual apartment suffixes like "Apto 23", "Apartamento 14", "Unidad 2"
  let cleaned = raw.replace(/\s+(?:apto|apartamento|unidad)\s+([0-9a-zA-Z-]+)$/i, '').trim();

  // Pattern 3: Normalize common phrases
  if (isEarthquakeOrRepairs(cleaned)) {
    cleaned = 'Cuota Especial: Reparaciones Mayores y Pintura';
    return {
      title: cleaned,
      baseBudget: 3100,
      isBudget: true,
    };
  } else if (/cisterna/i.test(cleaned)) {
    cleaned = 'Cisterna de agua';
  }

  return {
    title: cleaned,
    isBudget: false,
  };
}

/**
 * Groups a list of invoices into budget and concept groups with aggregated financial metrics.
 */
export function groupInvoicesByBudget(invoices: Invoice[]): BudgetInvoiceGroup[] {
  const groupsMap = new Map<string, BudgetInvoiceGroup>();

  for (const invoice of invoices) {
    const { title, baseBudget, details, isBudget } = parseBudgetFromDescription(invoice.description, invoice);
    const key = title.toLowerCase().replace(/[^a-z0-9]/g, '-');

    let group = groupsMap.get(key);
    if (!group) {
      group = {
        id: key,
        title,
        baseBudget,
        details,
        isBudget,
        invoices: [],
        totalAmount: 0,
        totalPaid: 0,
        totalAliquot: 0,
        count: 0,
        paidCount: 0,
        partialCount: 0,
        pendingCount: 0,
        progress: 0,
      };
      groupsMap.set(key, group);
    }

    group.invoices.push(invoice);
    group.totalAmount += invoice.amount || 0;
    group.totalPaid += invoice.paid_amount || 0;
    group.count += 1;

    if (invoice.status === 'PAID') {
      group.paidCount += 1;
    } else if (invoice.status === 'PARTIAL' || (invoice.paid_amount > 0 && invoice.paid_amount < invoice.amount)) {
      group.partialCount += 1;
    } else {
      group.pendingCount += 1;
    }

    if (baseBudget && !group.baseBudget) {
      group.baseBudget = baseBudget;
    }
    if (details && !group.details) {
      group.details = details;
    }
    if (isBudget) {
      group.isBudget = true;
    }

    // Accumulate unit aliquot
    const unitName = invoice.unit?.name || '';
    const coprop = getGranadaCoproprietor(unitName);
    const aliquot = coprop?.aliquot ?? (invoice.unit?.aliquot || 0);
    group.totalAliquot += aliquot;
  }

  // Calculate percentages, sort invoices by apartment number, and sort groups: budgets first, then largest invoice count
  const result = Array.from(groupsMap.values()).map((g) => {
    const progress = g.totalAmount > 0 ? (g.totalPaid / g.totalAmount) * 100 : 0;
    const sortedInvoices = [...g.invoices].sort((a, b) => {
      const copropA = getGranadaCoproprietor(a.unit?.name || '');
      const copropB = getGranadaCoproprietor(b.unit?.name || '');
      const aptoA = copropA?.apto || a.unit?.name || '';
      const aptoB = copropB?.apto || b.unit?.name || '';
      return aptoA.localeCompare(aptoB, undefined, { numeric: true });
    });
    return {
      ...g,
      invoices: sortedInvoices,
      progress: Math.min(100, Math.round(progress * 10) / 10),
    };
  });

  result.sort((a, b) => {
    // Budgets with base come first
    if (a.isBudget && !b.isBudget) return -1;
    if (!a.isBudget && b.isBudget) return 1;
    // Then sort by number of invoices descending
    return b.count - a.count;
  });

  return result;
}

/**
 * Extracts active budget options from existing invoices and decisions.
 */
export function extractActiveBudgets(
  invoices: Invoice[],
  decisions: Decision[] = []
): ActiveBudgetOption[] {
  const optionsMap = new Map<string, ActiveBudgetOption>();

  // 1. From existing invoice campaigns
  for (const inv of invoices) {
    const parsed = parseBudgetFromDescription(inv.description, inv);
    if (parsed.isBudget && parsed.title) {
      const key = parsed.title.toLowerCase();
      if (!optionsMap.has(key)) {
        optionsMap.set(key, {
          id: `camp-${key}`,
          title: parsed.title,
          baseBudget: parsed.baseBudget,
          period: inv.period,
          details: parsed.details,
          source: 'invoice_campaign',
          invoiceCount: 1,
        });
      } else {
        const existing = optionsMap.get(key)!;
        existing.invoiceCount = (existing.invoiceCount || 0) + 1;
        if (parsed.baseBudget && !existing.baseBudget) {
          existing.baseBudget = parsed.baseBudget;
        }
      }
    }
  }

  // 2. From decisions in the building
  for (const dec of decisions) {
    // Include active or resolved decisions
    if (['RECEPTION', 'VOTING', 'TIEBREAK_PENDING', 'RESOLVED'].includes(dec.status)) {
      const key = dec.title.toLowerCase();
      if (!optionsMap.has(key)) {
        optionsMap.set(key, {
          id: `dec-${dec.id}`,
          title: dec.title,
          details: dec.description || undefined,
          source: 'decision',
          invoiceCount: 0,
        });
      }
    }
  }

  // Also include standard common concepts if not already there
  const standardConcepts: { title: string; defaultBase?: number }[] = [
    { title: 'Cuota Especial: Reparaciones Mayores y Pintura', defaultBase: 3100 },
    { title: 'Cisterna de agua' },
  ];

  for (const std of standardConcepts) {
    const key = std.title.toLowerCase();
    if (!optionsMap.has(key)) {
      optionsMap.set(key, {
        id: `std-${key}`,
        title: std.title,
        baseBudget: std.defaultBase,
        source: 'invoice_campaign',
        invoiceCount: 0,
      });
    } else if (std.defaultBase && !optionsMap.get(key)!.baseBudget) {
      optionsMap.get(key)!.baseBudget = std.defaultBase;
    }
  }

  return Array.from(optionsMap.values());
}

/**
 * Calculates proportional amount for a unit given a base budget.
 */
export function calculateUnitAmountForBudget(unit: Unit, baseBudget: number): {
  amount: number;
  aliquot: number;
} {
  const coprop = getGranadaCoproprietor(unit.name);
  const aliquot = coprop?.aliquot ?? (unit.aliquot || 0);

  if (aliquot > 0 && baseBudget > 0) {
    const calc = parseFloat((baseBudget * (aliquot / 100)).toFixed(2));
    return { amount: calc, aliquot };
  }

  return { amount: 0, aliquot };
}
