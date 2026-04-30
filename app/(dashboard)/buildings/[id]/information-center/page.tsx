'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import InformationCenterRoute from '../../../information-center/page';

export default function BuildingInformationCenterPage() {
    const { id } = useParams<{ id: string }>();
    const { selectedBuildingId, setSelectedBuildingId } = useBuildingContext();

    useEffect(() => {
        if (id && selectedBuildingId !== id) {
            setSelectedBuildingId(id);
        }
    }, [id, selectedBuildingId, setSelectedBuildingId]);

    return <InformationCenterRoute />;
}
