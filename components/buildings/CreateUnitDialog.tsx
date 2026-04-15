import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { unitsService } from '@/lib/services/units.service';
import { toast } from 'sonner';

const schema = z.object({
    name: z.string().min(1, 'El nombre de la unidad es obligatorio'),
    floor: z.string().min(1, 'El piso es obligatorio'),
    aliquot: z.any(), // Using any to bypass Zod/Resolver type mismatch during build
});

type FormData = z.infer<typeof schema>;

interface CreateUnitDialogProps {
    buildingId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateUnitDialog({ buildingId, isOpen, onClose, onSuccess }: CreateUnitDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            floor: '',
            aliquot: 0,
        },
    });

    const onSubmit = async (data: FormData) => {
        try {
            setIsLoading(true);
            await unitsService.createUnit(buildingId, data);
            toast.success('Unidad creada correctamente');
            onSuccess();
            onClose();
            form.reset();
        } catch (error) {
            console.error(error);
            toast.error('Error al crear la unidad');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Agregar unidad</DialogTitle>
                    <DialogDescription>Completá los datos de la nueva unidad del edificio.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre / Número de unidad</FormLabel>
                                    <FormControl>
                                        <Input placeholder="ej. 1A" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="floor"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Piso</FormLabel>
                                    <FormControl>
                                        <Input placeholder="ej. 1" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="aliquot"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Alícuota (%)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="ej. 1.5" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Creando...' : 'Crear unidad'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
