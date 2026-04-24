import { Skeleton } from '@/components/ui/skeletons';

export function DecisionCardSkeleton() {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <div className="flex items-start gap-3">
                <Skeleton className="h-14 w-14 rounded-lg" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <Skeleton className="h-3 w-2/3" />
        </div>
    );
}
