'use client';
import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  provinces: string[];
  value: string | null;
  onChange: (province: string) => void;
};

export default function ProvinceSelect({ provinces, value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function select(p: string) {
    onChange(p);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-input bg-card px-3.5 py-2.5 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background"
      >
        <div className="text-left">
          <p className="label-eyebrow text-muted-foreground">Province</p>
          <p className="text-sm font-semibold mt-0.5">
            {value ?? <span className="text-muted-foreground font-normal">Select a province…</span>}
          </p>
        </div>
        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search province…" />
          <CommandList>
            <CommandEmpty>No province found.</CommandEmpty>
            <CommandGroup>
              {provinces.map(p => (
                <CommandItem key={p} value={p} onSelect={() => select(p)}>
                  <Check className={cn('mr-2 h-4 w-4', value === p ? 'opacity-100' : 'opacity-0')} />
                  {p}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
