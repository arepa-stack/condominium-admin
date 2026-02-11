import { useState, useMemo } from 'react'; // Added useMemo
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { unitsService } from '@/lib/services/units.service';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react'; // Added Loader2 for loading state

interface BatchUnitWizardProps {
    buildingId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function BatchUnitWizard({ buildingId, isOpen, onClose, onSuccess }: BatchUnitWizardProps) {
    const [step, setStep] = useState(1);
    const [floorsCount, setFloorsCount] = useState<number>(0);
    const [unitsPerFloorObj, setUnitsPerFloorObj] = useState<string>(''); // e.g. "A, B, C"
    const [defaultAliquot, setDefaultAliquot] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);

    // Derived states
    const floors = useMemo(() => Array.from({ length: floorsCount }, (_, i) => (i + 1).toString()), [floorsCount]);
    const unitsPerFloor = useMemo(() => unitsPerFloorObj.split(',').map(s => s.trim()).filter(Boolean), [unitsPerFloorObj]);

    const previewCount = floors.length * unitsPerFloor.length;

    // Preview sample: "1-A" to "10-C" logic as per prompt?
    // Prompt says: "This will create 40 units: 1-A to 10-D"
    // Let's assume standard naming: Floor + Separator + Letter/Number? Or just Floor + Letter? 
    // Prompt Example Payload: floors: ["1",..], unitsPerFloor: ["A",...].
    // Let's assume Backend handles combination. 
    // We just send the arrays.

    const handleNext = () => {
        if (step === 1 && floorsCount > 0) setStep(2);
        else if (step === 2 && unitsPerFloor.length > 0) setStep(3);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleGenerate = async () => {
        try {
            setIsLoading(true);
            await unitsService.batchCreateUnits(buildingId, {
                floors,
                unitsPerFloor,
                aliquot: defaultAliquot
            });
            toast.success(`Successfully generated ${previewCount} units!`);
            onSuccess();
            onClose();
            // Reset
            setStep(1);
            setFloorsCount(0);
            setUnitsPerFloorObj('');
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate units. Some might already exist.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Batch Generate Units</DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Progress Indicator */}
                    <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                        <span className={step === 1 ? "font-bold text-primary" : ""}>1. Floors</span>
                        <span className="border-t w-8" />
                        <span className={step === 2 ? "font-bold text-primary" : ""}>2. Letters/Numbers</span>
                        <span className="border-t w-8" />
                        <span className={step === 3 ? "font-bold text-primary" : ""}>3. Confirm</span>
                    </div>

                    {step === 1 && (
                        <div className="space-y-4">
                            <Label>How many floors?</Label>
                            <Input
                                type="number"
                                min="1"
                                placeholder="e.g. 10"
                                value={floorsCount || ''}
                                onChange={e => setFloorsCount(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-muted-foreground">
                                We will generate floors 1 to {floorsCount || 'N'}.
                            </p>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <Label>Units per floor (Letters or Numbers)</Label>
                            <Input
                                placeholder="e.g. A, B, C, D"
                                value={unitsPerFloorObj}
                                onChange={e => setUnitsPerFloorObj(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Separate with commas. E.g. "A, B, C" or "101, 102, 103"
                            </p>
                            <div className="bg-muted p-2 rounded text-xs">
                                Preview: 1-{unitsPerFloor[0] || '?'}, 1-{unitsPerFloor[1] || '?'}, ...
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 text-center py-2">
                            <div className="space-y-1">
                                <div className="text-5xl font-black text-primary tracking-tighter">
                                    {previewCount}
                                </div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                                    Units to be created
                                </p>
                            </div>

                            <div className="space-y-3 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                                <Label className="text-xs uppercase font-bold text-primary/70 tracking-wider">Default Aliquot (%)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 2.5"
                                        value={defaultAliquot || ''}
                                        onChange={e => setDefaultAliquot(parseFloat(e.target.value) || 0)}
                                        className="text-center font-bold text-lg bg-background/50 border-white/10"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">%</div>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">
                                    Assigning {defaultAliquot}% to {previewCount} units = {(defaultAliquot * previewCount).toFixed(2)}% total building aliquot.
                                </p>
                            </div>

                            <div className="text-sm border border-white/5 p-5 rounded-2xl bg-white/5 space-y-2 text-left">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Floors:</span>
                                    <span className="font-bold text-white">{floors.length} (1 - {floors.length})</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Units per floor:</span>
                                    <span className="font-bold text-white italic">{unitsPerFloor.join(', ')}</span>
                                </div>
                                <div className="pt-2 border-t border-white/5 text-[10px] text-muted-foreground italic flex items-center gap-2">
                                    <div className="h-1 w-1 rounded-full bg-primary" />
                                    Example: 1-{unitsPerFloor[0] || 'A'} to {floors.length}-{unitsPerFloor[unitsPerFloor.length - 1] || 'Z'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between">
                    {/* Override default right-align to verify layout */}
                    <div className="flex gap-2 w-full justify-between">
                        <div className="flex gap-2">
                            {step > 1 && (
                                <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                                    Back
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                                Cancel
                            </Button>
                            {step < 3 ? (
                                <Button onClick={handleNext} disabled={step === 1 ? floorsCount <= 0 : unitsPerFloor.length <= 0}>
                                    Next
                                </Button>
                            ) : (
                                <Button onClick={handleGenerate} disabled={isLoading} className="bg-primary">
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    ⚡ Generate
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
