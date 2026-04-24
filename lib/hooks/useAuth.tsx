'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/lib/services/auth.service';
import type { User } from '@/types/models';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check for existing token and validate
        const initAuth = async () => {
            const token = authService.getAccessToken();
            if (token) {
                try {
                    const userData = await authService.getCurrentUser();
                    setUser(userData);
                } catch (error) {
                    console.error('Failed to fetch user:', error);
                    authService.logout();
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (email: string, password: string) => {
        const response = await authService.login({ email, password });
        setUser(response.user);
        
        if (response.must_change_password || response.user.must_change_password) {
            router.push('/change-password-first-login');
        } else {
            router.push('/dashboard');
        }
    };

    const logout = () => {
        authService.logout();
        setUser(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
