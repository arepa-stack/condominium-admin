'use client';

import { DashboardView } from '@/components/dashboard/DashboardView';
import { useParams } from 'next/navigation';

export default function BuildingDashboardPage() {
    const params = useParams();
    const buildingId = typeof params.id === 'string' ? params.id : undefined;

    return <DashboardView buildingId={buildingId} showBuildingFilter={false} />;
}
