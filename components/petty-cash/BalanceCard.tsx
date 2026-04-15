'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PettyCashBalance } from '@/types/models';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { Wallet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BalanceCardProps {
    balance: PettyCashBalance | null;
    isLoading?: boolean;
    onRefresh?: () => void;
}

export function BalanceCard({ balance, isLoading, onRefresh }: BalanceCardProps) {
    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-xl md:max-w-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Saldo caja chica
                </CardTitle>
                <div className="flex items-center gap-2">
                    {onRefresh && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={onRefresh}
                            disabled={isLoading}
                            aria-label="Actualizar saldo"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    )}
                    <div className="rounded-lg bg-primary/15 p-2">
                        <Wallet className="h-5 w-5 text-primary" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading && !balance ? (
                    <div className="h-10 w-40 animate-pulse rounded bg-muted" />
                ) : balance ? (
                    <>
                        <p className="text-3xl font-bold tracking-tight text-foreground">
                            {formatMoney(balance.current_balance, balance.currency)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Actualizado:{' '}
                            {balance.updated_at ? formatDate(balance.updated_at) : '—'}
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No hay información de saldo para este edificio.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
