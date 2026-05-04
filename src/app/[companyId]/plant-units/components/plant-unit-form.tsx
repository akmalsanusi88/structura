

'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { PlantUnit, Company, Contract } from '@/lib/types';
import React from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const unitSchema = z.object({
  puId: z.string().min(1, 'PU ID is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(["Client PU", "Engineering Services PU", "Material PU"], { required_error: 'Category is required' }),
  unit: z.string().min(1, 'Unit is required'),
  rate: z.coerce.number().min(0, 'Rate must be a positive number'),
  clientName: z.string().optional(),
  contractId: z.string().optional().nullable(),
  materialManagementFee: z.boolean().optional(),
  hasSerialNo: z.boolean().optional(),
}).refine(data => {
    if (data.category === 'Client PU') {
        return !!data.clientName && data.clientName.length > 0;
    }
    return true;
}, {
    message: 'Client name is required for Client PUs',
    path: ['clientName'],
});

type UnitFormValues = z.infer<typeof unitSchema>;

interface PlantUnitFormProps {
  plantUnit?: PlantUnit;
  onSave: (data: PlantUnit) => void;
  onCancel: () => void;
  directory: Company[];
  contracts: Contract[];
}

export default function PlantUnitForm({ plantUnit, onSave, onCancel, directory, contracts }: PlantUnitFormProps) {
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: plantUnit ? {
        ...plantUnit,
    } : {
        puId: '',
        description: '',
        unit: '',
        rate: 0,
        materialManagementFee: false,
        hasSerialNo: false,
        clientName: '',
        contractId: null,
    },
  });
  
  const [open, setOpen] = React.useState(false);
  const [clientSearchValue, setClientSearchValue] = React.useState("");
  
  const clientExists = React.useMemo(() => 
    directory.some(c => c.name.toLowerCase() === clientSearchValue.toLowerCase()),
    [directory, clientSearchValue]
  );

  const category = useWatch({ control: form.control, name: 'category' });
  const selectedClientName = useWatch({ control: form.control, name: 'clientName' });
  
  const filteredContracts = React.useMemo(() => {
    return contracts.filter(c => c.clientName === selectedClientName);
  }, [contracts, selectedClientName]);


  React.useEffect(() => {
      if (category !== 'Client PU') {
          form.setValue('clientName', '');
          form.setValue('contractId', null);
          form.setValue('materialManagementFee', false);
      }
      if (category !== 'Material PU') {
        form.setValue('hasSerialNo', false);
      }
  }, [category, form]);

  const onSubmit = (data: UnitFormValues) => {
    const newUnit: PlantUnit = {
      id: plantUnit?.id || '',
      puId: data.puId,
      description: data.description,
      category: data.category,
      unit: data.unit,
      rate: data.rate,
      clientName: data.clientName,
      contractId: data.contractId === 'none' ? null : data.contractId,
      materialManagementFee: data.materialManagementFee,
      hasSerialNo: data.hasSerialNo,
      companyId: plantUnit?.companyId || '',
    };
    onSave(newUnit);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="puId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PU ID</FormLabel>
              <FormControl>
                <Input placeholder="e.g., CPU-001 or MPU-STEEL-01" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Excavator 20 Ton" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Client PU">Client PU</SelectItem>
                        <SelectItem value="Engineering Services PU">Engineering Services PU</SelectItem>
                        <SelectItem value="Material PU">Material PU</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
        />
        {category === 'Client PU' && (
             <div className="space-y-4 rounded-md border p-4">
                <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Client Name</FormLabel>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                    >
                                    {field.value || "Select or add a new client"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput 
                                            placeholder="Search clients..."
                                            value={clientSearchValue}
                                            onValueChange={setClientSearchValue}
                                        />
                                        <CommandList>
                                            <CommandEmpty>No client found.</CommandEmpty>
                                            <CommandGroup>
                                                {clientSearchValue && !clientExists && (
                                                    <CommandItem
                                                        key="add-new"
                                                        value={clientSearchValue}
                                                        onSelect={() => {
                                                            field.onChange(clientSearchValue);
                                                            form.setValue('contractId', null);
                                                            setOpen(false);
                                                            setClientSearchValue('');
                                                        }}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <PlusCircle className="h-4 w-4" />
                                                        <span>Add: "{clientSearchValue}"</span>
                                                    </CommandItem>
                                                )}
                                                {directory.map((client) => (
                                                <CommandItem
                                                    value={client.name}
                                                    key={client.id}
                                                    onSelect={() => {
                                                        field.onChange(client.name);
                                                        form.setValue('contractId', null);
                                                        setOpen(false)
                                                        setClientSearchValue('');
                                                    }}
                                                >
                                                    <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        client.name === field.value ? "opacity-100" : "opacity-0"
                                                    )}
                                                    />
                                                    {client.name}
                                                </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="contractId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Contract (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedClientName}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a contract..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="none">None (Common PU)</SelectItem>
                                {filteredContracts.map(c => <SelectItem key={c.id} value={c.id}>{c.contractNo}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="materialManagementFee"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between">
                            <div className="space-y-0.5">
                                <FormLabel>Material Management Fee</FormLabel>
                                <FormDescription>
                                    Apply management fee to materials.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                    />
            </div>
        )}
         {category === 'Material PU' && (
            <div className="rounded-md border p-4">
                <FormField
                control={form.control}
                name="hasSerialNo"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                            <FormLabel>Track with Serial Numbers</FormLabel>
                            <FormDescription>
                                Enable this for items tracked individually (e.g., beams, pipes).
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                )}
                />
            </div>
        )}
        <div className='grid grid-cols-2 gap-4'>
            <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Unit</FormLabel>
                <FormControl>
                    <Input placeholder="e.g., hour, ton" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="rate"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Rate</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="e.g., 150" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save Unit</Button>
        </div>
      </form>
    </Form>
  );
}
