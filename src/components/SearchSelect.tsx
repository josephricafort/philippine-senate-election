'use client';
import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Senator } from '@/lib/types';

type Props = {
  senators: Senator[];
  value: Senator | null;
  onChange: (s: Senator | null) => void;
  placeholder?: string;
};

export default function SearchSelect({ senators, value, onChange, placeholder = 'Search candidate…' }: Props) {
  const [open, setOpen] = useState(false);

  function select(s: Senator) {
    onChange(s);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background"
      >
        <span className="truncate text-left">
          {value ? value.senator_name : <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); onChange(null); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onChange(null); }}}
              className="rounded-full p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </div>
      </PopoverTrigger>
      {/* w-(--radix-popover-trigger-width) matches the trigger width exactly */}
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a name…" />
          <CommandList>
            <CommandEmpty>No candidates found.</CommandEmpty>
            <CommandGroup>
              {senators.map(s => (
                <CommandItem
                  key={s.senator_id}
                  value={s.senator_name}
                  onSelect={() => select(s)}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value?.senator_id === s.senator_id ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="flex-1">{s.senator_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{s.years.join(', ')}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
