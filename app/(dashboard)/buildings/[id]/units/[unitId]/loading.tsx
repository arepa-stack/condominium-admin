import { Loader2 } from 'lucide-react';

export default function UnitDetailLoading() {
    return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse text-sm font-medium">
                Cargando detalles de la unidad...
            </p>
        </div>
    );
}
