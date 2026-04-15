'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    description?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
}

export function StatsCard({
    title,
    value,
    icon: Icon,
    description,
    trend,
    className,
}: StatsCardProps) {
    const [displayValue, setDisplayValue] = useState<string | number>(0);

    useEffect(() => {
        // Animate number values
        if (typeof value === 'number') {
            let start = 0;
            const duration = 800;
            const increment = value / (duration / 16);

            const timer = setInterval(() => {
                start += increment;
                if (start >= value) {
                    setDisplayValue(value);
                    clearInterval(timer);
                } else {
                    setDisplayValue(Math.floor(start));
                }
            }, 16);

            return () => clearInterval(timer);
        } else {
            setDisplayValue(value);
        }
    }, [value]);

    return (
        <Card className={cn(
            'card-hover border-border/40 bg-card relative overflow-hidden',
            className
        )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className="p-2 bg-primary/8 rounded-lg">
                    <Icon className="h-4 w-4 text-primary" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-card-foreground tabular-nums">
                    {displayValue}
                </div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1.5">{description}</p>
                )}
                {trend && (
                    <p className={cn(
                        'text-xs mt-2 flex items-center gap-1 font-medium',
                        trend.isPositive ? 'text-chart-1' : 'text-destructive'
                    )}>
                        <span className="text-sm">
                            {trend.isPositive ? '↑' : '↓'}
                        </span>
                        {Math.abs(trend.value)}%
                        <span className="text-muted-foreground font-normal">vs last month</span>
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
