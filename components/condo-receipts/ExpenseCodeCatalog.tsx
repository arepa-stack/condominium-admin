'use client';

import { useMemo, useState } from 'react';
import { ListPlus, Plus, Search, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ExpenseCode } from '@/lib/services/condo-receipts.service';

/** Parent accounts of the chart of accounts (group 6) used to group the catalog. */
const GROUPS: Record<string, string> = {
    '6.1.1': 'Gastos de personal',
    '6.1.2': 'Gastos generales de administración',
};
const OTHER_GROUP = 'Otros códigos';

/** Lowercase without accents, so "energia" finds "ENERGÍA". */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const groupOf = (code: string) => {
    const prefix = code.split('.').slice(0, 3).join('.');
    return GROUPS[prefix] ? `${prefix} · ${GROUPS[prefix]}` : OTHER_GROUP;
};

/** Sub-accounts (6.1.2.18.1) sit one level below their account (6.1.2.18). */
const isSubAccount = (code: string) => code.split('.').length > 4;

interface Props {
    codes: ExpenseCode[];
    busy: boolean;
    onLoadStandard: () => void;
    onAdd: (code: string, description: string) => Promise<boolean>;
}

export function ExpenseCodeCatalog({ codes, busy, onLoadStandard, onAdd }: Props) {
    const [query, setQuery] = useState('');
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState({ code: '', description: '' });

    const groups = useMemo(() => {
        const q = fold(query.trim());
        const map = new Map<string, ExpenseCode[]>();
        for (const c of codes) {
            if (q && !fold(`${c.code} ${c.description}`).includes(q)) continue;
            const name = groupOf(c.code);
            map.set(name, [...(map.get(name) ?? []), c]);
        }
        // Known groups first (in code order), "Otros" last.
        return [...map.entries()].sort(([a], [b]) => (a === OTHER_GROUP ? 1 : b === OTHER_GROUP ? -1 : a.localeCompare(b)));
    }, [codes, query]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (await onAdd(draft.code, draft.description)) {
            setDraft({ code: '', description: '' });
            setAdding(false);
        }
    };

    return (
        <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
                <div className="space-y-1.5">
                    <CardTitle>Códigos de gasto <span className="text-muted-foreground font-normal text-base">({codes.length})</span></CardTitle>
                    <CardDescription className="max-w-2xl">
                        Plan de cuentas del edificio. Cada gasto se agrupa por su código en el recibo; el detalle de cada compra va en el gasto.
                        La línea <span className="font-mono">6.1.2.99</span> Fondo de reserva la agrega el recibo.
                    </CardDescription>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="gap-2" disabled={busy} onClick={onLoadStandard}>
                        <ListPlus className="h-4 w-4" /> Catálogo estándar
                    </Button>
                    <Button variant={adding ? 'secondary' : 'outline'} size="sm" className="gap-2" onClick={() => setAdding(a => !a)}>
                        {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {adding ? 'Cancelar' : 'Nuevo código'}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {adding && (
                    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="new_code">Código</Label>
                            <Input id="new_code" className="w-36 font-mono" placeholder="6.1.2.18.4" required maxLength={20} autoFocus
                                value={draft.code} onChange={e => setDraft(p => ({ ...p, code: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-56">
                            <Label htmlFor="new_desc">Descripción</Label>
                            <Input id="new_desc" placeholder="MANTENIMIENTO PORTÓN ELÉCTRICO" required maxLength={160}
                                value={draft.description} onChange={e => setDraft(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <Button type="submit" disabled={busy} className="gap-2"><Plus className="h-4 w-4" /> Guardar</Button>
                    </form>
                )}

                {codes.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        El edificio no tiene códigos. Usa <b>Catálogo estándar</b> para cargar el plan de cuentas.
                    </p>
                ) : (
                    <>
                        <div className="relative max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-9" placeholder="Buscar por código o descripción" value={query} onChange={e => setQuery(e.target.value)} />
                        </div>

                        <div className="max-h-[420px] overflow-y-auto rounded-lg border divide-y">
                            {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</p>}
                            {groups.map(([name, items]) => (
                                <section key={name}>
                                    <h3 className="sticky top-0 z-10 bg-muted/80 backdrop-blur px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {name} <span className="font-normal">· {items.length}</span>
                                    </h3>
                                    <ul className="md:columns-2 md:gap-0">
                                        {items.map(c => (
                                            <li key={c.id} className={cn('flex break-inside-avoid items-baseline gap-3 px-4 py-1.5 text-sm hover:bg-muted/40')}>
                                                <span className={cn('w-20 shrink-0 font-mono text-xs text-muted-foreground', isSubAccount(c.code) && 'pl-3')}>{c.code}</span>
                                                <span className="truncate" title={c.description}>{c.description}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
