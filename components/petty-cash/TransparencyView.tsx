'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
    TrendingUp,
    Users,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Archive,
} from 'lucide-react';
import { formatMoney } from '@/lib/utils/format';
import type { PettyCashTransparency, PettyCashTransparencyBatch } from '@/types/models';

interface TransparencyViewProps {
    transparency: PettyCashTransparency | null;
    period: string;
}

export function TransparencyView({ transparency, period }: TransparencyViewProps) {
    if (!transparency || transparency.assessments.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6">
            <Card className="border-border bg-card/50 p-4 backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                            Recaudación total · {period}
                        </h3>
                    </div>
                    <span className="text-2xl font-black text-foreground">
                        {Math.round(transparency.collection_percentage)}%
                    </span>
                </div>
                <Progress value={transparency.collection_percentage} className="h-4" />
                <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase text-muted-foreground">
                    <span>
                        Recaudado: {formatMoney(transparency.total_collected)}
                    </span>
                    <span>Meta: {formatMoney(transparency.total_to_collect)}</span>
                </div>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                        Progreso por prorrateo
                    </h2>
                </div>
                <div className="space-y-3">
                    {transparency.assessments.map((batch) => (
                        <BatchCard key={batch.id} batch={batch} />
                    ))}
                </div>
            </div>
        </div>
    );
}

interface BatchCardProps {
    batch: PettyCashTransparencyBatch;
}

function BatchCard({ batch }: BatchCardProps) {
    const [expanded, setExpanded] = useState(false);
    const isLegacy = batch.id === '__legacy__';

    return (
        <Card
            className={
                isLegacy
                    ? 'border-amber-500/30 bg-amber-500/5 p-4'
                    : 'border-border bg-muted/30 p-4'
            }
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        {isLegacy && (
                            <Archive className="h-4 w-4 shrink-0 text-amber-500" />
                        )}
                        <h3 className="font-bold text-foreground truncate">
                            {batch.description}
                        </h3>
                        {batch.category && (
                            <Badge variant="secondary" className="border-border/50">
                                {batch.category}
                            </Badge>
                        )}
                        {isLegacy && (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                                Legacy
                            </Badge>
                        )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1">
                            <Progress
                                value={batch.collection_percentage}
                                className="h-2"
                            />
                        </div>
                        <span className="text-sm font-black tabular-nums text-foreground">
                            {Math.round(batch.collection_percentage)}%
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {formatMoney(batch.total_collected)} /{' '}
                        {formatMoney(batch.total_to_collect)} · {batch.units.length}{' '}
                        {batch.units.length === 1 ? 'unidad' : 'unidades'}
                    </p>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded((v) => !v)}
                    className="shrink-0"
                >
                    {expanded ? (
                        <>
                            <ChevronUp className="mr-1 h-4 w-4" />
                            Ocultar
                        </>
                    ) : (
                        <>
                            <ChevronDown className="mr-1 h-4 w-4" />
                            Ver unidades
                        </>
                    )}
                </Button>
            </div>

            {expanded && (
                <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {batch.units.map((u) => {
                        const progress =
                            u.expected_amount > 0
                                ? (u.covered_amount / u.expected_amount) * 100
                                : 0;
                        return (
                            <div
                                key={u.unit_id}
                                className="rounded-lg border border-border bg-background/30 p-3"
                            >
                                <div className="mb-2 flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                            Unidad
                                        </p>
                                        <p className="text-sm font-black text-foreground">
                                            {u.unit_name}
                                        </p>
                                    </div>
                                    {u.status === 'PAID' ? (
                                        <CheckCircle2 className="h-4 w-4 text-chart-1" />
                                    ) : (
                                        <StatusBadge status={u.status} />
                                    )}
                                </div>
                                <Progress
                                    value={progress}
                                    className="h-1.5"
                                    indicatorClassName={
                                        u.status === 'PAID'
                                            ? 'bg-chart-1'
                                            : u.status === 'PARTIAL'
                                                ? 'bg-chart-2'
                                                : 'bg-primary'
                                    }
                                />
                                <div className="mt-1 flex justify-between text-[10px] font-medium text-foreground">
                                    <span>{formatMoney(u.covered_amount)}</span>
                                    <span className="text-muted-foreground">
                                        / {formatMoney(u.expected_amount)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
