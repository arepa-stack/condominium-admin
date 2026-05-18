'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { leadsService } from '@/lib/services/leads.service';

const POLL_INTERVAL_MS = 30_000;

export function useUnreadLeadsCount() {
    const [count, setCount] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchCount = useCallback(async () => {
        try {
            const c = await leadsService.getUnreadCount();
            setCount(c);
        } catch {
            // Silently ignore — sidebar badge is not critical
        }
    }, []);

    useEffect(() => {
        fetchCount();
        timerRef.current = setInterval(fetchCount, POLL_INTERVAL_MS);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [fetchCount]);

    return count;
}
