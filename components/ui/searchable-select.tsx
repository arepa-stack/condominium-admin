'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Check, LucideIcon, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchableSelectProps {
    options: { value: string; label: string; icon?: LucideIcon }[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
    triggerIcon?: LucideIcon;
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder = 'Select option...',
    searchPlaceholder = 'Search...',
    emptyText = 'No options found.',
    className,
    disabled = false,
    triggerIcon: TriggerIcon,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(
        () => options.find((opt) => opt.value === value),
        [options, value]
    );

    const filteredOptions = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return options.filter((opt) =>
            opt.label.toLowerCase().includes(query)
        );
    }, [options, searchQuery]);

    const handleSelect = (val: string) => {
        onValueChange(val);
        setOpen(false);
        setSearchQuery('');
        setActiveIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
                    handleSelect(filteredOptions[activeIndex].value);
                } else if (filteredOptions.length === 1) {
                    handleSelect(filteredOptions[0].value);
                }
                break;
            case 'Escape':
                setOpen(false);
                break;
        }
    };

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={cn('relative w-full', className)} ref={containerRef}>
            <div className="relative group">
                {TriggerIcon && (
                    <TriggerIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                )}
                <input
                    type="text"
                    className={cn(
                        "flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
                        TriggerIcon && "pl-9",
                        "pr-10" // Space for chevron/clear
                    )}
                    placeholder={selectedOption ? selectedOption.label : placeholder}
                    value={open ? searchQuery : (selectedOption?.label || '')}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!open) setOpen(true);
                        setActiveIndex(-1);
                    }}
                    onFocus={() => {
                        setOpen(true);
                        setSearchQuery('');
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {value !== 'all' && value !== '' && !open && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelect('all');
                            }}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
                </div>
            </div>

            {open && (
                <div className="absolute top-full left-0 w-full z-50 mt-1 rounded-md border border-border/50 bg-card shadow-xl animate-in fade-in zoom-in-95 duration-200">
                    <ScrollArea className="h-[250px]">
                        <div className="p-1">
                            {filteredOptions.length === 0 ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    {emptyText}
                                </div>
                            ) : (
                                filteredOptions.map((option, index) => {
                                    const Icon = option.icon;
                                    const isHighlighted = index === activeIndex;
                                    const isSelected = value === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            className={cn(
                                                'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors text-left',
                                                isHighlighted ? 'bg-accent text-accent-foreground' :
                                                    isSelected ? 'bg-primary text-primary-foreground' :
                                                        'hover:bg-muted text-foreground'
                                            )}
                                            onClick={() => handleSelect(option.value)}
                                            onMouseEnter={() => setActiveIndex(index)}
                                        >
                                            {Icon && <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />}
                                            <span className="flex-1 truncate">{option.label}</span>
                                            {isSelected && (
                                                <Check className="h-4 w-4 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </div>
            )}
        </div>
    );
}
