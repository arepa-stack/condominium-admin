'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chargeConceptsService } from '@/lib/services/charge-concepts.service';
import { CONCEPT_KIND_LABELS } from '@/lib/utils/charge-concepts';
import type { ChargeConcept } from '@/types/models';

const NONE = 'none';

interface ChargeConceptSelectProps {
    buildingId?: string;
    value: string | null;
    onChange: (concept: ChargeConcept | null) => void;
    disabled?: boolean;
    /** Hide the "no concept" option when a concept is mandatory. */
    required?: boolean;
    onConceptsLoaded?: (concepts: ChargeConcept[]) => void;
}

/** Active charge concepts of a building; closed concepts cannot be billed. */
export function ChargeConceptSelect({ buildingId, value, onChange, disabled, required, onConceptsLoaded }: ChargeConceptSelectProps) {
    const [concepts, setConcepts] = useState<ChargeConcept[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!buildingId) {
            setConcepts([]);
            onConceptsLoaded?.([]);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        chargeConceptsService.list(buildingId, 'ACTIVE')
            .then((data) => {
                if (cancelled) return;
                setConcepts(data);
                onConceptsLoaded?.(data);
            })
            .catch(() => {
                if (cancelled) return;
                setConcepts([]);
                onConceptsLoaded?.([]);
                toast.error('No se pudieron cargar los conceptos de cobro');
            })
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
        // onConceptsLoaded is a notification; reloading on every new callback identity is not wanted
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buildingId]);

    const placeholder = isLoading
        ? 'Cargando conceptos...'
        : concepts.length === 0 ? 'No hay conceptos activos' : 'Selecciona un concepto';

    return (
        <Select
            value={value ?? (required ? '' : NONE)}
            onValueChange={(id) => onChange(concepts.find(c => c.id === id) ?? null)}
            disabled={disabled || !buildingId || isLoading}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {!required && <SelectItem value={NONE}>Sin concepto</SelectItem>}
                {concepts.map((concept) => (
                    <SelectItem key={concept.id} value={concept.id}>
                        {concept.name} · {CONCEPT_KIND_LABELS[concept.kind]}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
