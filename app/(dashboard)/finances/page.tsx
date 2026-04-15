'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import PaymentsPage from '../payments/page';
import { PettyCashPage } from '@/components/petty-cash/PettyCashPage';
import { usePermissions } from '@/lib/hooks/usePermissions';

export default function FinancesPage() {
    const { buildingId } = usePermissions();
    const [activeTab, setActiveTab] = useState('payments');

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Gestión Financiera</h1>
                <p className="text-muted-foreground">Administra la cobranza de unidades y el fondo de caja chica.</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="payments">Cobranza y Pagos</TabsTrigger>
                    <TabsTrigger value="petty-cash">Caja Chica</TabsTrigger>
                </TabsList>

                <TabsContent value="payments" className="space-y-6">
                    <PaymentsPage />
                </TabsContent>

                <TabsContent value="petty-cash" className="space-y-6">
                    {buildingId ? (
                        <PettyCashPage buildingId={buildingId} />
                    ) : (
                        <Card className="p-8 text-center text-muted-foreground border-dashed">
                            Selecciona un edificio para ver los movimientos de caja chica.
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
