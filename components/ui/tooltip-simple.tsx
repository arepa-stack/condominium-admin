'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
    return (
        <div className="group relative flex items-center justify-center">
            {children}
            <div className={cn(
                "absolute bottom-full mb-2 scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50",
                "bg-popover/95 backdrop-blur-sm border border-border/50 text-popover-foreground text-[10px] font-medium px-2 py-1 rounded shadow-xl whitespace-nowrap",
                className
            )}>
                {content}
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-popover/95" />
            </div>
        </div>
    );
}
