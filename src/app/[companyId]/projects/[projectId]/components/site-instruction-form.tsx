

'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Check, ChevronDown } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import type { SiteInstruction, PlantUnit, Project, PurchaseOrderType } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

const siSchema = z.object({
  sourceType: z.enum(['custom', 'pu', 'percentage']),
  sourceId: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  rate: z.coerce.number().optional(),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  amount: z.coerce.number(),
  discountPercentage: z.coerce.number().optional(),
  managementFee: z.coerce.number().optional(),
  hasManagementFee: z.boolean().optional(),
}).superRefine((data, ctx) => {
    if (data.sourceType === 'pu' && !data.sourceId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please select a Plant Unit.', path: ['sourceId'] });
    }
    if (data.sourceType === 'custom') {
        if (!data.description) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Description is required.', path: ['description'] });
        if (!data.unit) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unit is required.', path: ['unit'] });
        if (data.rate === undefined || data.rate < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A positive rate is required.', path: ['rate'] });
    }
});


type SiFormValues = z.infer<typeof siSchema>;

interface SiteInstructionFormProps {
  project: Project;
  editingSi?: SiteInstruction;
  onSave: (data: SiteInstruction) => void;
  onCancel: () => void;
  plantUnits: PlantUnit[];
  context: 'Client' | 'Subcontractor' | 'Team';
}

export default function SiteInstructionForm({ project, editingSi, onSave, onCancel, plantUnits, context }: SiteInstructionFormProps) {
  const form = useForm<SiFormValues>({
    resolver: zodResolver(siSchema),
    defaultValues: editingSi 
        ? {
            sourceType: editingSi.sourceType || 'custom',
            sourceId: editingSi.sourceId,
            description: editingSi.description,
            unit: editingSi.unit || '',
            rate: editingSi.rate || 0,
            quantity: editingSi.quantity || 0,
            amount: editingSi.amount || 0,
            discountPercentage: editingSi.discountPercentage,
            hasManagementFee: editingSi.hasManagementFee,
            managementFee: editingSi.managementFee,
        }
        : {
            sourceType: 'custom',
            description: '',
            unit: '',
            rate: 0,
            quantity: 0,
            amount: 0,
            discountPercentage: 0,
            hasManagementFee: context === 'Client',
            managementFee: 0,
        },
  });

  const { control, setValue, watch, getValues } = form;
  const sourceType = watch('sourceType');
  const sourceId = watch('sourceId');
  const quantity = watch('quantity');
  const rate = watch('rate');
  const discountPercentage = watch('discountPercentage');
  const hasManagementFee = watch('hasManagementFee');

  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [puCategoryFilter, setPuCategoryFilter] = React.useState<'all' | 'Client PU' | 'Engineering Services PU'>('all');
  const [managementFeePercentage, setManagementFeePercentage] = React.useState(10);

  React.useEffect(() => {
    if (sourceType === 'pu' && sourceId) {
      const selectedPu = plantUnits.find(p => p.id === sourceId);
      if (selectedPu) {
        setValue('description', selectedPu.description);
        setValue('unit', selectedPu.unit);
        setValue('hasManagementFee', !!selectedPu.materialManagementFee);
      }
    } else if (sourceType === 'custom' && !editingSi) {
        setValue('description', '');
        setValue('unit', '');
        setValue('rate', 0);
        setValue('discountPercentage', undefined);
        setValue('hasManagementFee', context === 'Client');
    }
  }, [sourceType, sourceId, plantUnits, setValue, editingSi, context]);


  React.useEffect(() => {
    if (sourceType === 'pu') {
        if (sourceId) {
            const selectedPu = plantUnits.find(p => p.id === sourceId);
            if (selectedPu) {
                const baseRate = selectedPu.rate;
                const discount = parseFloat(discountPercentage as any) || 0;
                const finalRate = baseRate * (1 - discount / 100);
                setValue('rate', parseFloat(finalRate.toFixed(2)));
            }
        } else {
            setValue('rate', 0);
        }
    }
  }, [sourceType, sourceId, discountPercentage, plantUnits, setValue]);


  React.useEffect(() => {
    const currentRate = getValues('rate') || 0;
    const currentQuantity = getValues('quantity') || 0;
    let managementFee = 0;
    if (context === 'Client' && hasManagementFee) {
        managementFee = (currentRate * currentQuantity) * (managementFeePercentage / 100);
    }
    setValue('managementFee', parseFloat(managementFee.toFixed(2)));
    if (currentRate !== undefined && currentQuantity !== undefined) {
      const calculatedAmount = parseFloat(((currentRate * currentQuantity) + managementFee).toFixed(2));
      setValue('amount', calculatedAmount);
    }
  }, [rate, quantity, hasManagementFee, context, managementFeePercentage, getValues, setValue]);

  const onSubmit = (data: SiFormValues) => {
    const siData: SiteInstruction = {
        id: editingSi?.id || `si-${Date.now()}`,
        description: data.description || '',
        unit: data.unit || '',
        rate: data.rate || 0,
        quantity: data.quantity,
        amount: data.amount,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        discountPercentage: data.discountPercentage,
        hasManagementFee: data.hasManagementFee,
        managementFee: data.managementFee,
        context: context,
    };
    onSave(siData);
  };
  
  const clientPus = React.useMemo(() => {
    if ((context === 'Subcontractor' || context === 'Team') && puCategoryFilter !== 'all' && puCategoryFilter !== 'Client PU') return [];
    return plantUnits.filter(pu => pu.category === 'Client PU');
  }, [plantUnits, context, puCategoryFilter]);

  const engineeringPus = React.useMemo(() => {
    if (context === 'Client') return [];
    if ((context === 'Subcontractor' || context === 'Team') && puCategoryFilter !== 'all' && puCategoryFilter !== 'Engineering Services PU') return [];
    return plantUnits.filter(pu => pu.category === 'Engineering Services PU');
  }, [plantUnits, context, puCategoryFilter]);
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={control}
          name="sourceType"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Item Source</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex gap-4"
                  disabled={!!editingSi}
                >
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl><RadioGroupItem value="custom" /></FormControl>
                    <FormLabel className="font-normal">Custom Item</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl><RadioGroupItem value="pu" /></FormControl>
                    <FormLabel className="font-normal">From Plant Unit</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {sourceType === 'pu' && (
            <div className="space-y-4">
                 {(context === 'Subcontractor' || context === 'Team') && (
                    <FormItem>
                        <FormLabel>Plant Unit Category</FormLabel>
                        <Select onValueChange={(value: any) => setPuCategoryFilter(value)} defaultValue={puCategoryFilter}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by category..." />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                <SelectItem value="Client PU">Client PU</SelectItem>
                                <SelectItem value="Engineering Services PU">Engineering Services PU</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                 )}
                <FormField
                    control={control}
                    name="sourceId"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Plant Unit</FormLabel>
                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                        {field.value ? plantUnits.find((pu) => pu.id === field.value)?.description : "Select a Plant Unit"}
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search PUs..." />
                                    <CommandList>
                                        <CommandEmpty>No plant unit found.</CommandEmpty>
                                        {clientPus.length > 0 && <CommandGroup heading="Client PUs">{clientPus.map((pu) => (<CommandItem value={`${pu.description} ${pu.puId}`} key={pu.id} onSelect={() => {field.onChange(pu.id); setPopoverOpen(false);}}><Check className={cn("mr-2 h-4 w-4", pu.id === field.value ? "opacity-100" : "opacity-0")} /><div className="flex flex-col"><span className="text-left">{pu.description}</span><span className="text-xs text-muted-foreground">{pu.puId}</span></div></CommandItem>))}</CommandGroup>}
                                        {engineeringPus.length > 0 && <CommandGroup heading="Engineering PUs">{engineeringPus.map((pu) => (<CommandItem value={`${pu.description} ${pu.puId}`} key={pu.id} onSelect={() => {field.onChange(pu.id); setPopoverOpen(false);}}><Check className={cn("mr-2 h-4 w-4", pu.id === field.value ? "opacity-100" : "opacity-0")} /><div className="flex flex-col"><span className="text-left">{pu.description}</span><span className="text-xs text-muted-foreground">{pu.puId}</span></div></CommandItem>))}</CommandGroup>}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                    control={control}
                    name="discountPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount (%)</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="e.g., 10 for 10% discount" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                />
            </div>
        )}
        
        {sourceType === 'custom' && (
             <FormField
                control={control}
                name="description"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Custom Work Description</FormLabel>
                    <FormControl><Textarea placeholder="Describe the custom work or service..." {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <FormControl><Input placeholder="e.g., hr, m3" {...field} disabled={sourceType !== 'custom'} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={control}
            name="rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate (RM)</FormLabel>
                <FormControl><Input type="number" placeholder="0.00" {...field} disabled={sourceType === 'pu'} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Final Amount (RM)</FormLabel>
                <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                <FormDescription className='text-xs'>Auto-calculated. Can be overridden.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {context === 'Client' && (
             <div className="space-y-2 pt-2 border-t">
                <FormField
                    control={control}
                    name="hasManagementFee"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <FormLabel>Apply Management Fee</FormLabel>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={sourceType === 'pu' && plantUnits.find(p => p.id === sourceId)?.materialManagementFee}
                            />
                        </FormControl>
                        </FormItem>
                    )}
                />
                 {hasManagementFee && (
                    <div className="grid grid-cols-2 gap-4">
                        <FormItem>
                           <FormLabel>Mngmt. Fee (%)</FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    value={managementFeePercentage}
                                    onChange={(e) => setManagementFeePercentage(parseFloat(e.target.value) || 0)}
                                />
                            </FormControl>
                        </FormItem>
                        <FormField
                            control={control}
                            name="managementFee"
                            render={({ field }) => (
                            <FormItem>
                                <Label>Calculated Mngmt. Fee</Label>
                                <Input value={formatCurrency(field.value || 0)} readOnly disabled />
                            </FormItem>
                            )}
                        />
                    </div>
                 )}
            </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">{editingSi ? 'Save Changes' : 'Add Instruction'}</Button>
        </div>
      </form>
    </Form>
  );
}
