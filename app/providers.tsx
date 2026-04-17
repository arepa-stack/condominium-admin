'use client';

import { AuthProvider } from '@/lib/hooks/useAuth';
import { Toaster } from 'sonner';
import { BuildingProvider } from '@/lib/contexts/BuildingContext';
import { ThemeProvider } from '@/components/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
        >
            <AuthProvider>
                <BuildingProvider>
                    {children}
                    <Toaster position="top-right" richColors />
                </BuildingProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
