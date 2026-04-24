'use client';

import { useRef } from 'react';
import QRCode from 'react-qr-code';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';
import { Copy, Download, QrCode } from 'lucide-react';
import type { Building } from '@/types/models';

interface BuildingQrDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    building: Building | null;
}

export function BuildingQrDialog({
    open,
    onOpenChange,
    building
}: BuildingQrDialogProps) {
    const qrRef = useRef<HTMLDivElement>(null);

    if (!building) return null;

    // Use APP_WEB_URL from env if available, otherwise fallback to current origin
    const appWebUrl = process.env.NEXT_PUBLIC_APP_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const qrUrl = `${appWebUrl}/register?code=${building.building_code || building.id}`; // Fallback to ID if code not present in older data

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(qrUrl);
            toast.success('Enlace copiado al portapapeles');
        } catch (err) {
            toast.error('Error al copiar el enlace');
        }
    };

    const handleDownload = () => {
        if (!qrRef.current) return;
        
        const svg = qrRef.current.querySelector('svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            if (ctx) {
                // Background white
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                
                const pngFile = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                downloadLink.download = `QR-${building.building_code || building.name}.png`;
                downloadLink.href = `${pngFile}`;
                downloadLink.click();
            }
        };
        
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md text-center">
                <DialogHeader>
                    <DialogTitle className="flex justify-center items-center gap-2">
                        <QrCode className="h-5 w-5 text-primary" />
                        Código QR de Registro
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Comparte este código con los residentes para que soliciten acceso al edificio <strong>{building.name}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center py-6 space-y-6">
                    <div 
                        ref={qrRef} 
                        className="bg-white p-4 rounded-xl border-4 border-primary/20 shadow-lg inline-block"
                    >
                        <QRCode
                            value={qrUrl}
                            size={200}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="H"
                        />
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                        Código: <strong className="text-foreground">{building.building_code || 'No asignado'}</strong>
                    </p>

                    <div className="w-full space-y-2 text-left">
                        <p className="text-xs text-muted-foreground">URL Pública</p>
                        <div className="flex items-center gap-2">
                            <Input 
                                value={qrUrl} 
                                readOnly 
                                className="bg-muted/50 text-xs"
                            />
                            <Button size="icon" variant="outline" onClick={handleCopyLink} title="Copiar enlace">
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center gap-2 pb-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                    <Button onClick={handleDownload} className="gap-2">
                        <Download className="h-4 w-4" />
                        Descargar QR
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
