'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center animate-pulse">
                    <div className="w-5 h-5 rounded bg-primary/30" />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className="h-2 w-24 skeleton rounded-full" />
                    <div className="h-2 w-16 skeleton rounded-full" />
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Sidebar />
            <div className="lg:pl-72 transition-all duration-300">
                <Header />
                <main className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-threshold">
                    {children}
                </main>
            </div>
        </div>
    );
}
