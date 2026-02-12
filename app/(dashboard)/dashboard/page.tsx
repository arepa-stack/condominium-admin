'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { usePermissions } from '@/lib/hooks/usePermissions';

export default function DashboardPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { isSuperAdmin, buildingId } = usePermissions();
    const buildingIdParam = searchParams.get('buildingId');

    useEffect(() => {
        // If not a super admin and no building is explicitly selected in URL,
        // redirect to the user's current building dashboard
        if (!isSuperAdmin && !buildingIdParam && buildingId) {
            router.replace(`/buildings/${buildingId}/dashboard`);
        }
    }, [isSuperAdmin, buildingIdParam, buildingId, router]);

    // If we are not super admin and not on a specific building view,
    // we should not show the DashboardView at all (it will either redirect or show nothing/loading)
    if (!isSuperAdmin && !buildingIdParam) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return <DashboardView buildingId={buildingIdParam || undefined} showBuildingFilter={!!buildingIdParam} />;
}
