
'use client';

import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Project, PurchaseOrder, PurchaseOrderType, PlantUnit, InHouseTeam, Company, BoQItem, ClientBoQItem, PurchaseOrderItem, Contract } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Check, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useParams } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const poItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  unit: z.string(),
  rate: z.coerce.number(),
  quantity: z.coerce.number().min(0.01, "Quantity must be > 0"),
  sourceId: z.string().optional(),
  sourceType: z.enum(['pu', 'percentage', 'custom', 'boq']).optional(),
  managementFee: z.coerce.number().optional(),
  hasManagementFee: z.boolean().optional(),
  percentage: z.number().optional(),
  puNo: z.string().optional(),
});

const poSchema = z.object({
  poNo: z.string().min(1, "PO Number is required"),
  poDate: z.date({ required_error: "PO Date is required." }),
  targetCompletionDate: z.date({ required_error: "Target Completion Date is required." }),
  issuer: z.string().min(1, "Issuer/Subcon name is required"),
  teamId: z.string().nullable().optional(),
  subcontractorCompanyId: z.string().nullable().optional(),
  items: z.array(poItemSchema).min(1, "At least one item is required in the PO."),
  sstPercentage: z.coerce.number().optional(),
}).refine(data => {
    return true;
});

type PurchaseOrderFormValues = z.infer<typeof poSchema>;

const percentageItemFormSchema = z.object({
  clientPoItemId: z.string().min(1, 'Please select a client PO item.'),
  percentage: z.coerce.number({invalid_type_error: "Must be a number"}).gt(0, 'Percentage must be positive.'),
  quantity: z.coerce.number({invalid_type_error: "Must be a number"}).gt(0, 'Quantity must be positive.'),
});
type PercentageItemFormValues = z.infer<typeof percentageItemFormSchema>;

const customItemFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  unit: z.string().min(1, "Unit is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be > 0"),
  rate: z.coerce.number().min(0, "Rate must be non-negative"),
  hasManagementFee: z.boolean().optional(),
  puNo: z.string().optional(),
});
type CustomItemFormValues = z.infer<typeof customItemFormSchema>;

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

function CustomItemForm({
  poType,
  managementFeePercentage,
  onAddItem,
  onCancel,
}: {
  poType: PurchaseOrderType;
  managementFeePercentage: number;
  onAddItem: (item: PurchaseOrderItem) => void;
  onCancel: () => void;
}) {
  const form = useForm<CustomItemFormValues>({
    resolver: zodResolver(customItemFormSchema),
    defaultValues: {
      description: "",
      unit: "",
      quantity: 1,
      rate: 0,
      hasManagementFee: poType === 'Client', // Default to true for client POs
      puNo: '',
    },
  });
  
  const { control, watch } = form;
  const hasManagementFee = watch('hasManagementFee');
  const rate = watch('rate');
  const quantity = watch('quantity');

  const calculatedManagementFee = useMemo(() => {
    if (poType !== 'Client' || !hasManagementFee) return 0;
    return (rate * quantity) * (managementFeePercentage / 100);
  }, [poType, hasManagementFee, rate, quantity, managementFeePercentage]);

  const onSubmit = (data: CustomItemFormValues) => {
    const newItem: PurchaseOrderItem = {
      id: `poi-custom-${Date.now()}-${Math.random()}`,
      description: data.description,
      unit: data.unit,
      rate: data.rate,
      quantity: data.quantity,
      sourceType: 'custom',
      managementFee: poType === 'Client' ? calculatedManagementFee : 0,
      hasManagementFee: poType === 'Client' ? data.hasManagementFee : false,
      puNo: data.puNo,
    };
    onAddItem(newItem);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="puNo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PU No. (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter a reference PU number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Temporary hoarding installation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FormField
            control={control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input type="number" step="any" placeholder="1.00" {...field} />
                </FormControl>
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
                <FormControl>
                  <Input placeholder="e.g., m, ls" {...field} />
                </FormControl>
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
                <FormControl>
                  <Input type="number" step="any" placeholder="100.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {poType === 'Client' && (
          <div className="space-y-2 pt-2 border-t">
            <FormField
              control={control}
              name="hasManagementFee"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Apply Material Management Fee</FormLabel>
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
            {hasManagementFee && (
              <div>
                <Label>Calculated Material Management Fee</Label>
                <Input value={formatCurrency(calculatedManagementFee)} readOnly disabled />
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Add Item</Button>
        </div>
      </form>
    </Form>
  )
}


function PercentageItemForm({
  clientPOs,
  onAddItem,
  onCancel,
  plantUnitMap,
  fullBoqMap,
}: {
  clientPOs: PurchaseOrder[],
  onAddItem: (item: any) => void,
  onCancel: () => void,
  plantUnitMap: Map<string, PlantUnit>,
  fullBoqMap: Map<string, BoQItem | ClientBoQItem>,
}) {
  const form = useForm<PercentageItemFormValues>({
    resolver: zodResolver(percentageItemFormSchema),
    defaultValues: {
      percentage: 100,
      quantity: 1,
    }
  });

  const { control, watch, setValue } = form;
  const selectedPoItemId = watch('clientPoItemId');
  const percentage = watch('percentage');
  
  const allClientPoItems = useMemo(() => {
    return clientPOs.flatMap(po => {
      return po.items.map(item => {
        let puNo = 'N/A';
        if (item.puNo) {
          puNo = item.puNo;
        } else if (item.sourceType === 'pu' && item.sourceId) {
          puNo = plantUnitMap.get(item.sourceId)?.puId || 'N/A';
        } else if (item.sourceType === 'boq' && item.sourceId) {
          const boqItem = fullBoqMap.get(item.sourceId);
          if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
            puNo = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
          }
        }
        return { ...item, poNo: po.poNo, puNo: puNo };
      });
    });
  }, [clientPOs, plantUnitMap, fullBoqMap]);

  const selectedPoItem = useMemo(() => {
    return allClientPoItems.find(item => item.id === selectedPoItemId);
  }, [allClientPoItems, selectedPoItemId]);

  useEffect(() => {
      if(selectedPoItem) {
          setValue('quantity', selectedPoItem.quantity);
      }
  }, [selectedPoItem, setValue]);

  const calculatedRate = useMemo(() => {
    if (!selectedPoItem || !percentage) return 0;
    const rawRate = selectedPoItem.rate * (percentage / 100);
    return parseFloat(rawRate.toFixed(2));
  }, [selectedPoItem, percentage]);

  const calculatedManagementFee = useMemo(() => {
    if (!selectedPoItem || !percentage || !selectedPoItem.managementFee) return 0;
    return selectedPoItem.managementFee * (percentage / 100);
  }, [selectedPoItem, percentage]);

  const onSubmit = (data: PercentageItemFormValues) => {
    if (!selectedPoItem) return;
    
    const newItem = {
      id: `poi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      description: selectedPoItem.description,
      unit: selectedPoItem.unit,
      rate: calculatedRate,
      quantity: data.quantity,
      sourceId: data.clientPoItemId,
      sourceType: 'percentage' as const,
      percentage: data.percentage,
      managementFee: calculatedManagementFee,
      hasManagementFee: calculatedManagementFee > 0,
      puNo: selectedPoItem.puNo,
    };
    onAddItem(newItem);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={control}
          name="clientPoItemId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client PO Item</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an item from a Client PO" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clientPOs.map(po => (
                    <SelectGroup key={po.id}>
                      <SelectLabel>{po.poNo}</SelectLabel>
                      {allClientPoItems.filter(item => item.poNo === po.poNo).map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          <div className="flex flex-col">
                              <span>{item.description}</span>
                              <span className="text-xs text-muted-foreground">{item.puNo}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name="percentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Percentage (%)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 80" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
             <div>
                <FormLabel>Calculated Rate</FormLabel>
                <Input value={formatCurrency(calculatedRate)} readOnly disabled />
            </div>
             <div>
                <FormLabel>Calculated Material Management Fee</FormLabel>
                <Input value={formatCurrency(calculatedManagementFee)} readOnly disabled />
            </div>
        </div>
         <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Add Item</Button>
        </div>
      </form>
    </Form>
  )
}

interface PurchaseOrderFormProps {
  poType: PurchaseOrderType;
  project: Project;
  purchaseOrder?: PurchaseOrder;
  onSave: (data: PurchaseOrder) => void;
  onCancel: () => void;
  plantUnits: PlantUnit[];
  inHouseTeams: InHouseTeam[];
  allCompanies: Company[];
  contracts: Contract[];
}

export default function PurchaseOrderForm({ poType, project, purchaseOrder, onSave, onCancel, plantUnits, inHouseTeams, allCompanies, contracts }: PurchaseOrderFormProps) {
  const params = useParams();
  const companyId = params.companyId as string;
  
  if (!project || !project.clientBoq || !project.engineeringBoq || !project.materialBoq) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Loading project data...</p>
      </div>
    );
  }

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(poSchema),
    defaultValues: purchaseOrder
      ? {
        ...purchaseOrder,
        poDate: parseISO(purchaseOrder.poDate),
        targetCompletionDate: purchaseOrder.targetCompletionDate ? parseISO(purchaseOrder.targetCompletionDate) : new Date(),
        teamId: purchaseOrder.teamId || null,
        subcontractorCompanyId: purchaseOrder.subcontractorCompanyId || null,
        items: purchaseOrder.items.map(item => ({...item, managementFee: item.managementFee || 0})),
        sstPercentage: purchaseOrder.sstPercentage || 0,
      } : {
        poNo: '',
        poDate: new Date(),
        targetCompletionDate: project?.targetCompletionDate ? parseISO(project.targetCompletionDate) : new Date(),
        issuer: poType === 'Client' ? project?.client : '',
        items: [],
        sstPercentage: 0,
      }
  });

  const { control, setValue } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });
  
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedSstPercentage = useWatch({ control, name: 'sstPercentage' });
  const [isSstEnabled, setIsSstEnabled] = useState(purchaseOrder?.sstPercentage ? purchaseOrder.sstPercentage > 0 : false);

  const [managementFeePercentage, setManagementFeePercentage] = useState(10);

  const [boqPopoverOpen, setBoqPopoverOpen] = useState(false);
  const [isPuSelectorOpen, setIsPuSelectorOpen] = useState(false);
  const [isPercentageItemDialogOpen, setIsPercentageItemDialogOpen] = useState(false);
  const [isCustomItemDialogOpen, setIsCustomItemDialogOpen] = useState(false);
  const [isRateConfigOpen, setIsRateConfigOpen] = useState(false);
  const [itemsForRateConfig, setItemsForRateConfig] = useState<PlantUnit[]>([]);
  
  const [subconPopoverOpen, setSubconPopoverOpen] = useState(false);
  const [subconSearchValue, setSubconSearchValue] = useState("");

  const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);
  
  const fullBoqMap = useMemo(() => {
    const allItems = [
      ...(project.clientBoq || []),
      ...(project.engineeringBoq || []),
      ...(project.materialBoq || []),
    ];
    return new Map(allItems.map(item => [item.id, item]));
  }, [project]);

  const clientPoItemMap = useMemo(() => {
    const map = new Map<string, PurchaseOrderItem>();
    (project.purchaseOrders || [])
      .filter(po => po.type === 'Client')
      .flatMap(po => po.items)
      .forEach(item => map.set(item.id, item));
    return map;
  }, [project.purchaseOrders]);


  const selectedIds = useMemo(() => new Set(fields.map(field => field.sourceId)), [fields]);

  const usedBoqItemIds = useMemo(() => {
    const ids = new Set<string>();
    project.purchaseOrders
        .filter(po => po.id !== purchaseOrder?.id) // Exclude the current PO if editing
        .forEach(po => {
            po.items.forEach(item => {
                if (item.sourceId) {
                    ids.add(item.sourceId);
                }
            });
        });
    return ids;
  }, [project.purchaseOrders, purchaseOrder]);

  const availableBoqItems = useMemo(() => {
    if (!project) return [];
  
    let sourceBoq: (BoQItem | ClientBoQItem)[] = [];
    if (poType === 'Client') {
      sourceBoq = project.clientBoq || [];
    } else {
      sourceBoq = [
        ...(project.engineeringBoq || []),
        ...(project.materialBoq || []),
      ];
    }
    
    return sourceBoq.filter((item): item is BoQItem | ClientBoQItem => {
        return !!item && !!item.id && !selectedIds.has(item.id) && !usedBoqItemIds.has(item.id);
    });
  }, [project, poType, selectedIds, usedBoqItemIds]);

  const availablePlantUnits = useMemo(() => {
    if (!plantUnits) return [];

    const relevantCats: string[] = poType === 'Client' ? ['Client PU', 'Engineering Services PU'] : ['Engineering Services PU'];
    
    return plantUnits.filter((pu): pu is PlantUnit => {
      return !!(
        pu &&
        pu.id &&
        relevantCats.includes(pu.category) &&
        !selectedIds.has(pu.id)
      );
    });
  }, [plantUnits, selectedIds, poType]);
  
  const availableSubcontractors = useMemo(() => {
    if (!allCompanies || !companyId) return [];
    return allCompanies.filter(c => c.id !== companyId);
  }, [allCompanies, companyId]);

  const subconNameExists = useMemo(() => 
    availableSubcontractors.some(c => c.name.toLowerCase() === subconSearchValue.toLowerCase()),
    [availableSubcontractors, subconSearchValue]
  );
  
  const clientPOs = useMemo(() => project.purchaseOrders.filter(po => po.type === 'Client'), [project.purchaseOrders]);

  useEffect(() => {
    if (poType === 'Client') {
      setValue('issuer', project.client);
    }
  }, [project.client, poType, setValue]);
  
  const handleAddItemFromBoq = (item: (BoQItem | ClientBoQItem)) => {
    const boqItem = item as ClientBoQItem;
    append({
      id: `poi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      description: item.description,
      unit: item.unit,
      rate: item.rate,
      quantity: (item as BoQItem).quantity || 1,
      sourceType: 'boq',
      sourceId: item.id,
      managementFee: boqItem.managementFee || 0,
      hasManagementFee: !!(boqItem.managementFee && boqItem.managementFee > 0),
      percentage: undefined,
    });
  };

  const handleConfiguredItemsSave = (configuredItems: Omit<PurchaseOrderItem, 'id' | 'hasManagementFee'>[]) => {
    const newItems = configuredItems.map(item => {
      let hasFee = false;
      let initialFee = 0;
      if(poType === 'Client') {
        const puItem = plantUnits.find(pu => pu.id === item.sourceId);
        hasFee = !!puItem?.materialManagementFee;
        if(hasFee) {
          initialFee = (item.rate * item.quantity) * (managementFeePercentage / 100);
        }
      }
      return {
        id: `poi-pu-${Date.now()}-${Math.random()}`,
        hasManagementFee: hasFee,
        managementFee: initialFee,
        ...item
      }
    });
    append(newItems);
    setIsPuSelectorOpen(false);
    setIsRateConfigOpen(false);
  };

  const handleAddItemsFromBoq = (newItems: (BoQItem | ClientBoQItem)[]) => {
      append(newItems.map(item => {
        const boqItem = item as ClientBoQItem;
         return {
          id: `poi-boq-${Date.now()}-${item.id}`,
          description: item.description,
          unit: item.unit,
          rate: item.rate,
          quantity: (item as BoQItem).quantity || 1,
          sourceType: 'boq',
          sourceId: item.id,
          managementFee: boqItem.managementFee || 0,
          hasManagementFee: !!(boqItem.managementFee && boqItem.managementFee > 0),
          percentage: undefined,
        }
      }));
  };

  const itemsWithCalculatedFees = useMemo(() => {
    if (!watchedItems) return [];
    return watchedItems.map(item => {
        if (!item) return null; // Guard against null/undefined items
        let fee = item.managementFee || 0;
        if (poType === 'Client' && item.hasManagementFee) {
            fee = (item.rate * item.quantity) * (managementFeePercentage / 100);
        }
        return { ...item, managementFee: fee };
    }).filter(Boolean) as (PurchaseOrderItem & { managementFee: number })[]; // Filter out nulls
  }, [watchedItems, poType, managementFeePercentage]);

  const {subtotal, totalManagementFee, sstAmount, totalAmount} = useMemo(() => {
    const subtotal = itemsWithCalculatedFees.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
    const totalManagementFee = itemsWithCalculatedFees.reduce((acc, item) => acc + (item.managementFee || 0), 0);
    const sst = isSstEnabled ? watchedSstPercentage || 0 : 0;
    const sstAmount = (subtotal + totalManagementFee) * (sst / 100);
    const totalAmount = subtotal + totalManagementFee + sstAmount;
    return { subtotal, totalManagementFee, sstAmount, totalAmount };
  }, [itemsWithCalculatedFees, watchedSstPercentage, isSstEnabled]);

  const onSubmit = (data: PurchaseOrderFormValues) => {
    const finalItems = itemsWithCalculatedFees.map(item => {
        const { hasManagementFee, ...rest } = item;
        return rest;
    });

    const finalData: PurchaseOrder = {
      id: purchaseOrder?.id || `po-${Date.now()}`,
      type: poType,
      poNo: data.poNo,
      poDate: format(data.poDate, 'yyyy-MM-dd'),
      targetCompletionDate: format(data.targetCompletionDate, 'yyyy-MM-dd'),
      issuer: data.issuer,
      teamId: data.teamId,
      items: finalItems,
      subcontractorCompanyId: data.subcontractorCompanyId,
      sstPercentage: isSstEnabled ? data.sstPercentage : 0,
    };
    onSave(finalData);
  };

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <FormField
            control={control}
            name="poNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PO Number</FormLabel>
                <FormControl><Input placeholder="Enter PO Number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {poType === 'Client' ? (
              <FormField
                control={form.control}
                name="issuer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl><Input placeholder="Enter name" {...field} disabled /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
          ) : (
            <FormField
              control={form.control}
              name="issuer"
              render={({ field }) => (
                <FormItem className="flex flex-col pt-2">
                  <FormLabel>Subcontractor</FormLabel>
                  <Popover open={subconPopoverOpen} onOpenChange={setSubconPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                        >
                          {field.value || "Select or add a subcontractor"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command filter={(value, search) => {
                        if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                        return 0;
                      }}>
                        <CommandInput 
                            placeholder="Search or type subcontractor..."
                            value={subconSearchValue}
                            onValueChange={setSubconSearchValue}
                        />
                        <CommandList>
                          <CommandEmpty>No results found.</CommandEmpty>
                          <CommandGroup>
                            {subconSearchValue && !subconNameExists && (
                              <CommandItem
                                key="add-new-subcon"
                                value={subconSearchValue}
                                onSelect={() => {
                                  setValue('issuer', subconSearchValue);
                                  setValue('subcontractorCompanyId', null);
                                  setValue('teamId', null);
                                  setSubconPopoverOpen(false);
                                  setSubconSearchValue('');
                                }}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                <span>Add: "{subconSearchValue}"</span>
                              </CommandItem>
                            )}
                            {availableSubcontractors.map((company) => (
                              <CommandItem
                                value={company.name}
                                key={company.id}
                                onSelect={() => {
                                  field.onChange(company.name);
                                  setValue('subcontractorCompanyId', company.id);
                                  setValue('teamId', null);
                                  setSubconPopoverOpen(false);
                                  setSubconSearchValue('');
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    company.name === field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {company.name}
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
          )}
          <FormField
            control={control}
            name="poDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>PO Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="targetCompletionDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Target Completion Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="space-y-2 pt-4">
          <h3 className="text-lg font-medium">PO Items</h3>
          <ScrollArea className="h-64 rounded-md border">
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PU ID</TableHead>
                    <TableHead className="min-w-[250px] w-[35%]">Description</TableHead>
                    <TableHead className="w-[120px]">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Material Management Fee</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const calculatedItem = itemsWithCalculatedFees[index];
                    if (!calculatedItem) return null;
                    
                    let puId = 'N/A';
                    if (calculatedItem.puNo) {
                      puId = calculatedItem.puNo;
                    } else if (calculatedItem.sourceType === 'pu') {
                        puId = plantUnitMap.get(calculatedItem.sourceId!)?.puId || 'N/A';
                    } else if (calculatedItem.sourceType === 'boq') {
                        const boqItem = fullBoqMap.get(calculatedItem.sourceId!);
                        if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                            puId = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                        }
                    } else if (calculatedItem.sourceType === 'percentage') {
                        const clientPoItem = clientPoItemMap.get(calculatedItem.sourceId!);
                        if (clientPoItem) {
                            const boqItem = fullBoqMap.get(clientPoItem.sourceId!);
                             if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                                puId = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                            }
                        }
                    }

                    const isCustom = calculatedItem.sourceType === 'custom';

                    return (
                      <TableRow key={field.id}>
                        <TableCell className='font-mono text-xs'>{puId}</TableCell>
                        <TableCell>
                            {calculatedItem.description}
                            {calculatedItem.sourceType === 'percentage' && (
                                <span className="text-xs text-muted-foreground ml-2">({calculatedItem.percentage}%)</span>
                            )}
                        </TableCell>
                        <TableCell>
                            <Controller
                                control={control}
                                name={`items.${index}.quantity`}
                                render={({ field: qtyField }) => (
                                    <Input type="number" {...qtyField} className="h-8 w-28" />
                                )}
                            />
                        </TableCell>
                        <TableCell>{calculatedItem.unit}</TableCell>
                        <TableCell>
                            <Controller
                                control={control}
                                name={`items.${index}.rate`}
                                render={({ field: rateField }) => (
                                    <Input type="number" step="0.01" {...rateField} disabled={!isCustom} className="h-8 w-28" />
                                )}
                            />
                        </TableCell>
                        <TableCell>
                             <Controller
                                control={control}
                                name={`items.${index}.managementFee`}
                                render={({ field: feeField }) => (
                                    <Input type="number" step="0.01" {...feeField} disabled={!isCustom || !calculatedItem.hasManagementFee} className="h-8 w-28" />
                                )}
                            />
                        </TableCell>
                        <TableCell>{formatCurrency(
                            (calculatedItem.rate * calculatedItem.quantity) + (calculatedItem.managementFee || 0)
                        )}</TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {fields.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                        No items added yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>

        <div className="flex items-center gap-2 pt-4 flex-wrap">
            <Button type="button" variant="outline" onClick={() => setIsCustomItemDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Custom Item
            </Button>
            <Popover open={boqPopoverOpen} onOpenChange={setBoqPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add from Budget
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                   <Command>
                        <CommandInput placeholder="Search budget items..." />
                        <CommandList>
                            <CommandEmpty>No budget items found.</CommandEmpty>
                            <CommandGroup>
                                {availableBoqItems.map((item) => {
                                    const puId = (item.sourceType === 'pu' && item.sourceId
                                        ? plantUnitMap.get(item.sourceId)?.puId
                                        : item.puNo) || 'Custom';
                                    return (
                                        <CommandItem
                                            key={item.id}
                                            value={`${item.description} ${puId}`}
                                            onSelect={() => {
                                                handleAddItemFromBoq(item);
                                                setBoqPopoverOpen(false);
                                            }}
                                        >
                                            <div className="flex flex-col">
                                              <span className="text-left">{item.description}</span>
                                              <span className="text-xs text-muted-foreground">{puId}</span>
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <Button type="button" variant="outline" onClick={() => setIsPuSelectorOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add from Plant Units
            </Button>
            
            {poType === 'Subcontractor' && (
                 <Button type="button" variant="outline" onClick={() => setIsPercentageItemDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add from % of Client PO
                </Button>
            )}

            {poType === 'Client' && (
                <div className="flex items-center gap-2 ml-auto">
                    <Label htmlFor="mngmt-fee-perc" className="text-sm shrink-0">Material Management Fee % (for PUs)</Label>
                    <Input 
                        id="mngmt-fee-perc"
                        type="number"
                        value={managementFeePercentage} 
                        onChange={e => setManagementFeePercentage(parseFloat(e.target.value) || 0)}
                        className="w-20 h-9"
                    />
                </div>
            )}
        </div>
        
         <FormField
            control={control}
            name="items"
            render={() => <FormMessage />}
          />
        
        <div className="grid grid-cols-2 gap-4 items-end pt-4 border-t">
            <div className="flex items-center gap-2">
                <Switch id="sst-enabled" checked={isSstEnabled} onCheckedChange={setIsSstEnabled} />
                <Label htmlFor="sst-enabled">Enable SST</Label>
                 {isSstEnabled && (
                     <FormField
                        control={control}
                        name="sstPercentage"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                     <Input type="number" placeholder="6" {...field} className="h-9 w-20 ml-2" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>

            <div className="text-right space-y-1">
                <div className="flex justify-end gap-4 text-sm">
                    <span className='text-muted-foreground'>Subtotal:</span>
                    <span className='font-medium w-32'>{formatCurrency(subtotal)}</span>
                </div>
                 <div className="flex justify-end gap-4 text-sm">
                    <span className='text-muted-foreground'>Material Management Fee:</span>
                    <span className='font-medium w-32'>{formatCurrency(totalManagementFee)}</span>
                </div>
                {isSstEnabled && (
                    <div className="flex justify-end gap-4 text-sm">
                        <span className='text-muted-foreground'>SST ({watchedSstPercentage || 0}%):</span>
                        <span className='font-medium w-32'>{formatCurrency(sstAmount)}</span>
                    </div>
                )}
                 <div className="flex justify-end gap-4 text-lg font-bold border-t pt-2 mt-2">
                    <span>Total Amount:</span>
                    <span className='w-32'>{formatCurrency(totalAmount)}</span>
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-2 pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Save PO</Button>
        </div>

      </form>
    </Form>

    <Dialog open={isPuSelectorOpen} onOpenChange={setIsPuSelectorOpen}>
      <PUSelectorDialog
        project={project}
        poType={poType}
        contracts={contracts}
        onCancel={() => setIsPuSelectorOpen(false)}
        onAddItems={(items) => {
            setItemsForRateConfig(items);
            setIsRateConfigOpen(true);
        }}
        availablePlantUnits={availablePlantUnits}
        allCompanies={allCompanies}
      />
    </Dialog>
    
    <Dialog open={isCustomItemDialogOpen} onOpenChange={setIsCustomItemDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Custom PO Item</DialogTitle>
                <DialogDescription>Manually enter the details for a new item.</DialogDescription>
            </DialogHeader>
            <CustomItemForm
                poType={poType}
                managementFeePercentage={managementFeePercentage}
                onAddItem={(item) => {
                    append(item);
                    setIsCustomItemDialogOpen(false);
                }}
                onCancel={() => setIsCustomItemDialogOpen(false)}
            />
        </DialogContent>
    </Dialog>

    <Dialog open={isPercentageItemDialogOpen} onOpenChange={setIsPercentageItemDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Item from % of Client PO</DialogTitle>
                <DialogDescription>Select an item from an existing Client PO and set a percentage to calculate the subcontractor rate.</DialogDescription>
            </DialogHeader>
            <PercentageItemForm
                clientPOs={clientPOs}
                onAddItem={(item) => {
                    append(item);
                    setIsPercentageItemDialogOpen(false);
                }}
                onCancel={() => setIsPercentageItemDialogOpen(false)}
                plantUnitMap={plantUnitMap}
                fullBoqMap={fullBoqMap}
            />
        </DialogContent>
    </Dialog>
    
    <Dialog open={isRateConfigOpen} onOpenChange={setIsRateConfigOpen}>
      <RateConfigDialog 
        items={itemsForRateConfig}
        onCancel={() => setIsRateConfigOpen(false)}
        onSave={handleConfiguredItemsSave}
      />
    </Dialog>
    </>
  );
}

interface RateConfigDialogProps {
    items: PlantUnit[];
    onSave: (configuredItems: Omit<PurchaseOrderItem, 'id' | 'hasManagementFee'>[]) => void;
    onCancel: () => void;
}

function RateConfigDialog({
  items,
  onSave,
  onCancel
}: RateConfigDialogProps) {
  const [configuredItems, setConfiguredItems] = useState<RateConfigItem[]>(
    items.map(item => ({
      id: item.id,
      description: item.description,
      unit: item.unit,
      defaultRate: item.rate,
      rateType: 'default',
      discount: 0,
      customRate: item.rate,
    }))
  );

  const handleRateTypeChange = (index: number, type: 'default' | 'discount' | 'custom') => {
    const newItems = [...configuredItems];
    newItems[index].rateType = type;
    setConfiguredItems(newItems);
  };

  const handleDiscountChange = (index: number, discount: number) => {
    const newItems = [...configuredItems];
    newItems[index].discount = discount;
    setConfiguredItems(newItems);
  };

  const handleCustomRateChange = (index: number, rate: number) => {
    const newItems = [...configuredItems];
    newItems[index].customRate = rate;
    setConfiguredItems(newItems);
  };

  const handleSave = () => {
    const finalItems = configuredItems.map(item => {
      let finalRate = item.defaultRate;
      if (item.rateType === 'discount') {
        finalRate = item.defaultRate * (1 - item.discount / 100);
      } else if (item.rateType === 'custom') {
        finalRate = item.customRate;
      }
      return {
        description: item.description,
        unit: item.unit,
        rate: parseFloat(finalRate.toFixed(2)),
        quantity: 1,
        sourceType: 'pu' as const,
        sourceId: item.id,
        managementFee: 0,
      };
    });
    onSave(finalItems);
  };

  return (
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>Configure Item Rates</DialogTitle>
        <DialogDescription>
          Adjust the rates for the selected Plant Units. You can apply a discount or set a custom rate.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="h-96">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[30%]'>Description</TableHead>
              <TableHead>Rate Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className='text-right'>Final Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configuredItems.map((item, index) => {
              let finalRate = item.defaultRate;
              if (item.rateType === 'discount') {
                finalRate = item.defaultRate * (1 - (item.discount || 0) / 100);
              } else if (item.rateType === 'custom') {
                finalRate = item.customRate || 0;
              }

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className='font-medium'>{item.description}</p>
                    <p className='text-xs text-muted-foreground'>Default Rate: {formatCurrency(item.defaultRate)}</p>
                  </TableCell>
                  <TableCell>
                    <Select value={item.rateType} onValueChange={(value) => handleRateTypeChange(index, value as any)}>
                      <SelectTrigger className='h-8 w-[120px]'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="discount">Discount</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {item.rateType === 'discount' && (
                      <div className="flex items-center gap-2">
                        <Input type="number" value={item.discount} onChange={e => handleDiscountChange(index, parseFloat(e.target.value) || 0)} className="h-8 w-24" />
                        <span>%</span>
                      </div>
                    )}
                    {item.rateType === 'custom' && (
                       <Input type="number" value={item.customRate} onChange={e => handleCustomRateChange(index, parseFloat(e.target.value) || 0)} className="h-8 w-32" />
                    )}
                  </TableCell>
                  <TableCell className='text-right font-semibold'>{formatCurrency(finalRate)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={handleSave}>Add Configured Items</Button>
      </div>
    </DialogContent>
  );
}


function PUSelectorDialog({
  project,
  poType,
  onCancel,
  onAddItems,
  availablePlantUnits,
  contracts,
  allCompanies
}: {
  project: Project;
  poType: PurchaseOrderType;
  onCancel: () => void;
  onAddItems: (items: PlantUnit[]) => void;
  availablePlantUnits: PlantUnit[];
  contracts: Contract[];
  allCompanies: Company[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState(project.contractId || 'common');
  const [selectedPuIds, setSelectedPuIds] = useState<Set<string>>(new Set());
  
  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    allCompanies.forEach(c => clients.add(c.name));
    if (availablePlantUnits) {
        availablePlantUnits.forEach(pu => {
            if(pu && pu.clientName) clients.add(pu.clientName);
        });
    }
    return ['all', 'Engineering Services', ...Array.from(clients).sort()];
  }, [availablePlantUnits, allCompanies]);

  const filteredContracts = useMemo(() => {
    if (!contracts || clientFilter === 'all' || clientFilter === 'Engineering Services') return [];
    return contracts.filter(c => c.clientName === clientFilter);
  }, [contracts, clientFilter]);

  useEffect(() => {
    setContractFilter(project.contractId || 'common');
    if (poType === 'Client') {
        setClientFilter(project.client);
    }
  }, [project.client, project.contractId, poType]);

  const filteredPus = useMemo(() => {
    if (!availablePlantUnits) return [];
    return availablePlantUnits.filter(pu => {
      if (!pu) return false;
      let categoryMatch = true;
      if (clientFilter !== 'all') {
        if (clientFilter === 'Engineering Services') {
          categoryMatch = pu.category === 'Engineering Services PU';
        } else {
          categoryMatch = pu.clientName === clientFilter;
        }
      }

      let contractMatch = true;
      if (poType === 'Client' && clientFilter !== 'all') {
        if (contractFilter === 'common') {
            contractMatch = !pu.contractId;
        } else {
            contractMatch = pu.contractId === contractFilter;
        }
      }
      
      const searchMatch = searchTerm === '' ||
        (pu.description && pu.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (pu.puId && pu.puId.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return categoryMatch && searchMatch && contractMatch;
    });
  }, [availablePlantUnits, searchTerm, clientFilter, contractFilter, poType]);

  const handleToggleSelect = (puId: string) => {
    const newSet = new Set(selectedPuIds);
    if (newSet.has(puId)) {
      newSet.delete(puId);
    } else {
      newSet.add(puId);
    }
    setSelectedPuIds(newSet);
  };

  const handleSelectAll = (isChecked: boolean) => {
    if (isChecked) {
      setSelectedPuIds(new Set(filteredPus.map(pu => pu.id)));
    } else {
      setSelectedPuIds(new Set());
    }
  };
  
  const handleAddClick = () => {
    const itemsToAdd = availablePlantUnits
        .filter(pu => selectedPuIds.has(pu.id));
    onAddItems(itemsToAdd);
    onCancel();
  };
  
  return (
    <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
            <DialogTitle>Add from Plant Units</DialogTitle>
            <DialogDescription>Select one or more Plant Units to add to the Purchase Order.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or PU ID..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
             {poType === 'Client' && (
                <>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                          <SelectValue placeholder="Filter by Client" />
                      </SelectTrigger>
                      <SelectContent>
                          {uniqueClients.map(client => (
                            <SelectItem key={client} value={client}>{client === 'all' ? 'All Clients' : client}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  <Select value={contractFilter} onValueChange={setContractFilter} disabled={clientFilter === 'all' || clientFilter === 'Engineering Services'}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                          <SelectValue placeholder="Filter by Contract" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="common">Common PUs</SelectItem>
                          {filteredContracts.map(c => <SelectItem key={c.id} value={c.id}>{c.contractNo}</SelectItem>)}
                      </SelectContent>
                  </Select>
                </>
             )}
        </div>
        <ScrollArea className="flex-1 border rounded-lg">
            <Table>
                <TableHeader className="sticky top-0 bg-secondary">
                    <TableRow>
                        <TableHead className="w-12">
                            <Checkbox
                                checked={selectedPuIds.size === filteredPus.length && filteredPus.length > 0}
                                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            />
                        </TableHead>
                        <TableHead>PU No.</TableHead>
                        <TableHead>Description</TableHead>
                        {poType === 'Client' && <TableHead>Client</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredPus.map(pu => (
                        <TableRow key={pu.id}>
                            <TableCell><Checkbox checked={selectedPuIds.has(pu.id)} onCheckedChange={() => handleToggleSelect(pu.id)} /></TableCell>
                            <TableCell className="font-mono">{pu.puId}</TableCell>
                            <TableCell>{pu.description}</TableCell>
                            {poType === 'Client' && <TableCell>{pu.clientName || 'N/A'}</TableCell>}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
         <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="button" onClick={handleAddClick} disabled={selectedPuIds.size === 0}>Configure Rates ({selectedPuIds.size})</Button>
        </div>
    </DialogContent>
  );
}
