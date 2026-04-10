'use client';

import { useParams } from 'next/navigation';
import { PettyCashPage } from '@/components/petty-cash/PettyCashPage';

export default function BuildingPettyCashPage() {
    const params = useParams();
    const buildingId = params.id as string;

    if (!buildingId) {
        return (
            <div className="p-6 text-muted-foreground">
                Edificio no especificado.
            </div>
        );
    }

    return <PettyCashPage buildingId={buildingId} variant="building" />;
}
