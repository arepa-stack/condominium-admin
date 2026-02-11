import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usersService } from '@/lib/services/users.service';
import { unitsService } from '@/lib/services/units.service';
import { Shield, User as UserIcon, Phone, Mail, Building2, Home } from 'lucide-react';
import type { User, Building, Unit } from '@/types/models';

interface UserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    buildings: Building[];
    onSuccess: () => void;
}

export function UserDialog({ open, onOpenChange, user, buildings, onSuccess }: UserDialogProps) {
    const [units, setUnits] = useState<Unit[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(false);

    // Different schemas for create vs edit
    const createSchema = z.object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address'),
        password: z.string().min(6, 'Password is required'),
        phone: z.string().optional(),
        building_id: z.string().min(1, 'Building is required'),
        unit_id: z.string().optional(),
        role: z.enum(['resident', 'board', 'admin']),
        status: z.enum(['active', 'pending', 'inactive', 'rejected']),
    });

    const editSchema = z.object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address'),
        password: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(['resident', 'board', 'admin']),
        status: z.enum(['active', 'pending', 'inactive', 'rejected']),
    });

    const schema = user ? editSchema : createSchema;
    type UserFormData = z.infer<typeof schema>;

    const form = useForm<UserFormData>({
        resolver: zodResolver(schema),
        defaultValues: user ? {
            name: '',
            email: '',
            password: '',
            phone: '',
            role: 'resident',
            status: 'active',
        } : {
            name: '',
            email: '',
            password: '',
            phone: '',
            building_id: '',
            unit_id: '',
            role: 'resident',
            status: 'active',
        },
    });

    const selectedBuildingId = form.watch('building_id');

    // Fetch units when building is selected (only for create mode)
    useEffect(() => {
        const fetchUnits = async () => {
            if (!user && selectedBuildingId) {
                setLoadingUnits(true);
                try {
                    const fetchedUnits = await unitsService.getUnits(selectedBuildingId);
                    setUnits(fetchedUnits);
                } catch (error) {
                    console.error('Failed to fetch units', error);
                    toast.error('Failed to load units for selected building');
                    setUnits([]);
                } finally {
                    setLoadingUnits(false);
                }
            } else {
                setUnits([]);
            }
        };
        fetchUnits();
    }, [selectedBuildingId, user]);

    // Reset form when user/dialog state changes
    useEffect(() => {
        if (user) {
            // Edit mode - profile only
            form.reset({
                name: user.name,
                email: user.email,
                password: '',
                phone: user.phone || '',
                role: user.role,
                status: user.status || 'active',
            });
        } else {
            // Create mode - includes building/unit
            form.reset({
                name: '',
                email: '',
                password: '',
                phone: '',
                building_id: '',
                unit_id: '',
                role: 'resident',
                status: 'active',
            });
        }
    }, [user, open, form]);

    const onSubmit = async (data: any) => {
        try {
            if (user) {
                // PATCH /users/:id - Only profile data
                const updateData: any = {
                    name: data.name,
                    phone: data.phone,
                    role: data.role,
                };

                if (data.password) {
                    updateData.password = data.password;
                }

                await usersService.updateUser(user.id, updateData);
                toast.success('User profile updated successfully');
            } else {
                // POST /users - Requires building_id
                await usersService.createUser({
                    name: data.name,
                    email: data.email,
                    password: data.password,
                    phone: data.phone,
                    building_id: data.building_id,
                    unit_id: data.unit_id, // Optional
                    role: data.role,
                });
                toast.success('User created successfully! Use "Manage Roles" to add more units.');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error(user ? 'Failed to update user' : 'Failed to create user');
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30';
            case 'board':
                return 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30';
            default:
                return 'bg-muted/50 text-muted-foreground border-border/50';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto border-border/50 bg-gradient-to-br from-card/95 to-card/100 backdrop-blur">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        {user ? (
                            <>
                                <UserIcon className="h-5 w-5 text-primary" />
                                Edit User Profile
                            </>
                        ) : (
                            <>
                                <Shield className="h-5 w-5 text-primary" />
                                Create New User
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {user
                            ? 'Update user profile information. Use "Manage Roles" to assign units and building permissions.'
                            : 'Create a new user account. You can assign units after creation.'}
                    </DialogDescription>
                </DialogHeader>

                {user && user.units && user.units.length > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-primary">Current Units ({user.units.length})</p>
                        <div className="flex flex-wrap gap-1">
                            {user.units.slice(0, 3).map((unit) => (
                                <Badge
                                    key={unit.unit_id}
                                    variant="outline"
                                    className="text-xs bg-background/50"
                                >
                                    {unit.unit_name || unit.unit_id.slice(0, 8)}
                                </Badge>
                            ))}
                            {user.units.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                    +{user.units.length - 3} more
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Use "Manage Roles" to edit unit assignments
                        </p>
                    </div>
                )}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                                        Name
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="John Doe"
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        Email
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="email"
                                            placeholder="john@example.com"
                                            disabled={!!user}
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
                                    </FormControl>
                                    {user && <p className="text-[0.8rem] text-amber-400/80">⚠️ Email cannot be changed</p>}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{user ? 'New Password (Optional)' : 'Password'}</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="password"
                                            placeholder={user ? 'Leave blank to keep current' : '******'}
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        Phone (Optional)
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="+507 6000-0000"
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Only show building/unit for CREATE mode */}
                        {!user && (
                            <>
                                <FormField
                                    control={form.control}
                                    name="building_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                Building <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-background/50 border-border/50">
                                                        <SelectValue placeholder="Select building" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {buildings.map((b) => (
                                                        <SelectItem key={b.id} value={b.id}>
                                                            <div className="flex items-center gap-2">
                                                                <Building2 className="h-4 w-4 text-primary" />
                                                                {b.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-xs">
                                                Required for user creation
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="unit_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2">
                                                <Home className="h-4 w-4 text-muted-foreground" />
                                                Unit (Optional)
                                            </FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                disabled={!selectedBuildingId || loadingUnits}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="bg-background/50 border-border/50">
                                                        <SelectValue placeholder={
                                                            !selectedBuildingId
                                                                ? "Select building first"
                                                                : loadingUnits
                                                                    ? "Loading units..."
                                                                    : "Select unit (optional)"
                                                        } />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {units.map((unit) => (
                                                        <SelectItem key={unit.id} value={unit.id}>
                                                            <div className="flex items-center gap-2">
                                                                <Home className="h-4 w-4 text-primary" />
                                                                {unit.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-xs">
                                                You can assign more units later via "Manage Roles"
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-muted-foreground" />
                                            Global Role
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-background/50 border-border/50">
                                                    <SelectValue placeholder="Select role" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="resident">
                                                    <Badge variant="outline" className={getRoleBadgeColor('resident')}>
                                                        Resident
                                                    </Badge>
                                                </SelectItem>
                                                <SelectItem value="board">
                                                    <Badge variant="outline" className={getRoleBadgeColor('board')}>
                                                        Board
                                                    </Badge>
                                                </SelectItem>
                                                <SelectItem value="admin">
                                                    <Badge variant="outline" className={getRoleBadgeColor('admin')}>
                                                        Admin
                                                    </Badge>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-background/50 border-border/50">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="inactive">Inactive</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="submit"
                                className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-all"
                            >
                                {user ? 'Save Changes' : 'Create User'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
