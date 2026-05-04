
'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { BoQItem, ClientBoQItem, Project, PlantUnit, Contract, Company } from '@/lib/types';
import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';


const boqItemSchema = z.object({
  sourceType: z.enum(['pu', 'percentage', 'custom']),
  sourceId: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.coerce.number().min(0, 'Quantity must be a positive number'),
  rate: z.coerce.number().optional(),
  baseRate: z.coerce.number().optional(),
  discountPercentage: z.coerce.number().optional(),
  applyDiscountAfterMmf: z.boolean().optional(),
  managementFee: z.coerce.number().optional(),
  percentage: z.coerce.number().optional(),
  includesMaterialCost: z.boolean().optional(),
}).superRefine((data, ctx) => {
    if (data.sourceType === 'custom') {
        if (!data.description) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Description is required for custom items.", path: ['description'] });
        if (!data.unit) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unit is required for custom items.", path: ['unit'] });
        
        const isClientBoq = data.baseRate !== undefined;
        if (isClientBoq) {
            if (data.baseRate === undefined || data.baseRate < 0) {
                 ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A positive base rate is required for custom items.", path: ['baseRate'] });
            }
        } else {
            if (data.rate === undefined || data.rate < 0) {
                 ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A positive rate is required for custom items.", path: ['rate'] });
            }
        }
    }
    if (data.sourceType === 'pu' && !data.sourceId) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select a Plant Unit.", path: ['sourceId'] });
    }
     if (data.sourceType === 'percentage' && !data.sourceId) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select a source Client BOQ item.", path: ['sourceId'] });
    }
     if (data.sourceType === 'percentage' && (!data.percentage || data.percentage <= 0)) {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A positive percentage is required.", path: ['percentage'] });
    }
});


type BoqItemFormValues = z.infer<typeof boqItemSchema>;

interface BoqItemFormProps {
  project: Project;
  plantUnits: PlantUnit[];
  contracts: Contract[];
  directory: Company[];
  itemType: 'Client' | 'Engineering' | 'Material';
  item?: BoQItem | ClientBoQItem;
  onSave: (data: BoQItem | ClientBoQItem) => void;
  onCancel: () => void;
  managementFeePercentage?: number;
}

export default function BoqItemForm({ project, plantUnits, contracts, directory, itemType, item, onSave, onCancel, managementFeePercentage }: BoqItemFormProps) {
  const form = useForm<BoqItemFormValues>({
    resolver: zodResolver(boqItemSchema),
    defaultValues: item
      ? {
          sourceType: item.sourceType || 'custom',
          sourceId: item.sourceId,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate,
          baseRate: itemType === 'Client' ? (item as ClientBoQItem).baseRate ?? item.rate : undefined,
          discountPercentage: item.discountPercentage,
          applyDiscountAfterMmf: item.applyDiscountAfterMmf,
          percentage: item.percentage,
          managementFee: (item as ClientBoQItem).managementFee,
          includesMaterialCost: (item as ClientBoQItem).includesMaterialCost,
        }
      : {
          sourceType: itemType === 'Client' ? 'pu' : 'custom',
          description: '',
          unit: '',
          quantity: 0,
          rate: 0,
          baseRate: 0,
          discountPercentage: 0,
          applyDiscountAfterMmf: false,
          managementFee: 0,
          percentage: 0,
          includesMaterialCost: false,
        },
  });

  const { control, setValue, watch } = form;
  const sourceType = watch('sourceType');
  const selectedPuId = watch('sourceId');
  const includesMaterialCost = watch('includesMaterialCost');
  const quantity = watch('quantity');
  const rate = watch('rate');
  const selectedClientBoqId = watch('sourceId');
  const percentage = watch('percentage');
  const baseRate = watch('baseRate');
  const discountPercentage = watch('discountPercentage');
  const applyDiscountAfterMmf = watch('applyDiscountAfterMmf');
  
  const [puPopoverOpen, setPuPopoverOpen] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>(project.client);
  const [selectedContractId, setSelectedContractId] = useState<string>(project.contractId || 'common');
  
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => c.clientName === selectedClient);
  }, [contracts, selectedClient]);
  
  useEffect(() => {
    if (item && item.sourceType === 'pu' && item.sourceId) {
      const pu = plantUnits.find(p => p.id === item.sourceId);
      if (pu) {
        setSelectedClient(pu.clientName || project.client);
        setSelectedContractId(pu.contractId || 'common');
      }
    } else {
        setSelectedClient(project.client);
        setSelectedContractId(project.contractId || 'common');
    }
  }, [item, plantUnits, project.client, project.contractId]);


  const availablePus = useMemo(() => {
    let categories: string[] = [];
    if (itemType === 'Client') {
        let clientPUs = plantUnits.filter(pu => pu.category === 'Client PU' && pu.clientName === selectedClient);
        
        if (selectedContractId === 'common') {
            return clientPUs.filter(pu => !pu.contractId);
        }
        return clientPUs.filter(pu => pu.contractId === selectedContractId);
    }
    if (itemType === 'Engineering') categories = ['Engineering Services PU'];
    else if (itemType === 'Material') categories = ['Material PU'];
    
    return plantUnits.filter(pu => categories.includes(pu.category));
  }, [plantUnits, itemType, selectedClient, selectedContractId]);


  useEffect(() => {
      if (sourceType === 'pu' && selectedPuId && !item) { // Only auto-update for new items
        const pu = plantUnits.find(p => p.id === selectedPuId);
        if (pu) {
            setValue('description', pu.description);
            setValue('unit', pu.unit);
            if (itemType === 'Client') {
                setValue('baseRate', pu.rate);
            } else {
                setValue('rate', pu.rate);
            }
            if (itemType === 'Client') {
              setValue('includesMaterialCost', !!pu.materialManagementFee);
            }
        }
      }
  }, [selectedPuId, sourceType, plantUnits, setValue, itemType, item]);

    useEffect(() => {
        if (itemType !== 'Client') return;

        const baseR = baseRate || 0;
        const qty = quantity || 0;
        const discount = discountPercentage || 0;
        const mmfPercent = managementFeePercentage || 0;

        const finalRateValue = baseR * (1 - discount / 100);
        setValue('rate', parseFloat(finalRateValue.toFixed(2)));
        
        let finalManagementFee = 0;
        if (includesMaterialCost) {
            if (applyDiscountAfterMmf) {
                // SCENARIO 2
                const baseItemValue = baseR * qty;
                const managementFeeOnBase = baseItemValue * (mmfPercent / 100);
                const totalValueBeforeDiscount = baseItemValue + managementFeeOnBase;
                const totalValueAfterDiscount = totalValueBeforeDiscount * (1 - discount / 100);
                
                const discountedItemValue = parseFloat(finalRateValue.toFixed(2)) * qty;
                finalManagementFee = totalValueAfterDiscount - discountedItemValue;

            } else {
                // SCENARIO 1
                const discountedItemValue = parseFloat(finalRateValue.toFixed(2)) * qty;
                finalManagementFee = discountedItemValue * (mmfPercent / 100);
            }
        }
        
        setValue('managementFee', parseFloat(finalManagementFee.toFixed(2)));

    }, [baseRate, discountPercentage, quantity, includesMaterialCost, applyDiscountAfterMmf, managementFeePercentage, itemType, setValue]);


  useEffect(() => {
    if (sourceType === 'percentage' && selectedClientBoqId && !item) { // Only auto-update for new items
      const sourceItem = project.clientBoq?.find((i) => i.id === selectedClientBoqId);
      if (sourceItem) {
        setValue('unit', sourceItem.unit);
        setValue('quantity', sourceItem.quantity); // Set initial quantity from source
        setValue('description', sourceItem.description); // Set description without percentage
        if (percentage) {
          // The description is set above, here we just update the rate
          const rawRate = sourceItem.rate * (percentage / 100);
          setValue('rate', parseFloat(rawRate.toFixed(2)));
        }
      }
    }
  }, [sourceType, selectedClientBoqId, percentage, project.clientBoq, setValue, item]);


  const onSubmit = (data: BoqItemFormValues) => {
    const finalItem = {
      id: item?.id || `${itemType.toLowerCase()}-${Date.now()}`,
      description: data.description || '',
      unit: data.unit || '',
      quantity: data.quantity,
      rate: data.rate || 0,
      baseRate: itemType === 'Client' ? data.baseRate : undefined,
      discountPercentage: itemType === 'Client' ? data.discountPercentage : undefined,
      applyDiscountAfterMmf: itemType === 'Client' ? data.applyDiscountAfterMmf : undefined,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      percentage: data.percentage,
      managementFee: itemType === 'Client' ? data.managementFee || 0 : undefined,
      includesMaterialCost: itemType === 'Client' ? data.includesMaterialCost || false : undefined,
    };
    onSave(finalItem as BoQItem | ClientBoQItem);
  };

  const renderSourceTypeSelector = () => (
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
              disabled={!!item}
            >
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl><RadioGroupItem value="custom" /></FormControl>
                <FormLabel className="font-normal">Custom Item</FormLabel>
              </FormItem>
              {(itemType === 'Client' || itemType === 'Engineering' || itemType === 'Material') && (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl><RadioGroupItem value="pu" /></FormControl>
                    <FormLabel className="font-normal">From Plant Unit</FormLabel>
                  </FormItem>
              )}
              {itemType === 'Engineering' && (
                <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl><RadioGroupItem value="percentage" /></FormControl>
                    <FormLabel className="font-normal">% of Client Item</FormLabel>
                </FormItem>
              )}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
  
  const renderCustomFields = () => (
    <>
      <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Input placeholder="e.g., Supply and install..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={control}
            name="unit"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Unit</FormLabel>
                <FormControl><Input placeholder="e.g., m, kg, ls" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
    </>
  );

  const renderPuSelector = () => (
     <>
        {itemType === 'Client' && (
            <div className="grid grid-cols-2 gap-4">
                <FormItem>
                    <FormLabel>Filter by Client</FormLabel>
                    <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                        <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant="outline" role="combobox" className={cn("w-full justify-between", !selectedClient && "text-muted-foreground")}>
                                    <span className="truncate">{selectedClient || "Select a client"}</span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search clients..." />
                                <CommandList>
                                    <CommandEmpty>No client found.</CommandEmpty>
                                    <CommandGroup>
                                        {directory.map((client) => (
                                            <CommandItem value={client.name} key={client.id} onSelect={() => { setSelectedClient(client.name); setClientPopoverOpen(false); }}>
                                                <Check className={cn("mr-2 h-4 w-4", client.name === selectedClient ? "opacity-100" : "opacity-0")} />
                                                {client.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </FormItem>
                 <FormItem>
                    <FormLabel>Filter by Contract</FormLabel>
                    <Select onValueChange={setSelectedContractId} value={selectedContractId}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a contract..." />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="common">None (Common PU)</SelectItem>
                            {filteredContracts.map(c => <SelectItem key={c.id} value={c.id}>{c.contractNo}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </FormItem>
            </div>
        )}
        <FormField
            control={control}
            name="sourceId"
            render={({ field }) => (
            <FormItem className="flex flex-col">
                <FormLabel>Select Plant Unit</FormLabel>
                <Popover open={puPopoverOpen} onOpenChange={setPuPopoverOpen}>
                    <PopoverTrigger asChild>
                        <FormControl>
                             <Button variant="outline" role="combobox" className={cn("w-full justify-start font-normal", !field.value && "text-muted-foreground")}>
                                <div className="flex-1 min-w-0 text-left">
                                  <span className='truncate'>
                                    {field.value ? availablePus.find(pu => pu.id === field.value)?.description : "Select a Plant Unit"}
                                  </span>
                                </div>
                                <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search PUs..." />
                            <CommandList className="overflow-x-hidden">
                                <CommandEmpty>No units found.</CommandEmpty>
                                <CommandGroup>
                                    {availablePus.map(pu => (
                                        <CommandItem
                                            value={`${pu.description} ${pu.puId}`}
                                            key={pu.id}
                                            onSelect={() => {
                                                field.onChange(pu.id)
                                                setPuPopoverOpen(false)
                                            }}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4", pu.id === field.value ? "opacity-100" : "opacity-0")} />
                                            <div className="flex flex-col min-w-0">
                                                <span className="truncate">{pu.description}</span>
                                                <span className="text-xs text-muted-foreground">{pu.puId}</span>
                                            </div>
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
     </>
  );
  
  const renderPercentageFields = () => (
     <>
        <FormField
            control={control}
            name="sourceId"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Source Client BOQ Item</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a client BOQ item..." /></SelectTrigger></FormControl>
                    <SelectContent>
                        {(project.clientBoq || []).map(item => (
                            <SelectItem key={item.id} value={item.id}>{item.description}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
        />
        <FormField
            control={control}
            name="percentage"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Percentage (%)</FormLabel>
                <FormControl><Input type="number" step="0.01" placeholder="e.g., 10" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
     </>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        {renderSourceTypeSelector()}
        
        <div className='mt-4 space-y-4'>
            {sourceType === 'custom' && renderCustomFields()}
            {sourceType === 'pu' && renderPuSelector()}
            {sourceType === 'percentage' && renderPercentageFields()}
        </div>

        {itemType === 'Client' && sourceType !== 'percentage' && (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start border p-4 rounded-md">
                    <FormField
                        control={control}
                        name="baseRate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Base Rate (RM)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} disabled={sourceType === 'pu'} /></FormControl>
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
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name="rate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Final Rate (RM)</FormLabel>
                                <FormControl><Input type="number" {...field} disabled /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={control}
                    name="applyDiscountAfterMmf"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel>Apply Discount to Total (incl. MMF)</FormLabel>
                                <FormDescription>
                                    If enabled, discount is applied after adding MMF.
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

        {itemType !== 'Client' && sourceType !== 'percentage' && (
            <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Rate (RM)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} disabled={sourceType === 'pu'} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        )}


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
        
        {itemType === 'Client' && (
            <div className="space-y-4 rounded-md border p-4">
                 <FormField
                    control={control}
                    name="managementFee"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Material Management Fee (RM)</FormLabel>
                        <FormControl><Input type="number" placeholder="0.00" {...field} readOnly disabled /></FormControl>
                        {includesMaterialCost && <FormDescription>Auto-calculated: {managementFeePercentage}% of item value.</FormDescription>}
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={control}
                    name="includesMaterialCost"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between">
                            <div className="space-y-0.5">
                                <FormLabel>Includes Material Cost</FormLabel>
                                <FormDescription>
                                    Signifies this is a lumpsum item that includes material costs.
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
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Item</Button>
        </div>
      </form>
    </Form>
  );
}
