'use client';

import { useParams } from 'next/navigation';
import { CondoReceiptsPage } from '@/components/condo-receipts/CondoReceiptsPage';

export default function BuildingCondoReceiptsPage() {
    const { id } = useParams<{ id: string }>();
    return <CondoReceiptsPage buildingId={id} />;
}
