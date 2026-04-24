'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface PhotoLightboxProps {
    open: boolean;
    url: string | null;
    alt: string;
    onClose: () => void;
}

export function PhotoLightbox({ open, url, alt, onClose }: PhotoLightboxProps) {
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (open) {
            closeBtnRef.current?.focus();
        }
    }, [open]);

    if (!open || !url) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            onClick={onClose}
        >
            <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
                <X className="h-5 w-5" />
            </button>
            <div
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] max-w-[90vw]"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={url}
                    alt={alt}
                    className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                />
            </div>
        </div>
    );
}
