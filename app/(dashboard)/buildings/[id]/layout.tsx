import { BuildingSummaryBar } from '@/components/layout/BuildingSummaryBar';

export default async function BuildingLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="space-y-6">
            <BuildingSummaryBar buildingId={id} />
            {children}
        </div>
    );
}
