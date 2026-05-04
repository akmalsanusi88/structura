

'use client';

import { useForm, useFieldArray, FormProvider, useWatch, Controller } from 'react-hook-form';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Project, MaterialIssuance, SerialInfo, PlantUnit, MaterialIssuanceItem, MaterialRequisitionItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Check, Pencil, Search } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';


const serialSchema = z.object({
  serialNo: z.string().optional(),
  quantity: z.coerce.number().min(0, "Quantity must be positive.").default(0),
});

const issuanceItemSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  description: z.string(),
  unit: z.string(),
  requisitionBalance: z.coerce.number(), // The remaining requested balance
  receivedQuantity: z.coerce.number().default(0),
  serials: z.array(serialSchema),
  hasSerialNo: z.boolean().optional(),
  onSiteUse: z.coerce.number().optional(),
});

const issuanceSchema = z.object({
  goodsIssueNo: z.string().min(1, "Goods Issue Number is required"),
  date: z.date({ required_error: "Date is required." }),
  items: z.array(issuanceItemSchema)
    .min(1, "At least one material must be issued.")
    .refine(items => items.some(item => (item.serials || []).reduce((sum, s) => sum + (s.quantity || 0), 0) > 0 || item.receivedQuantity > 0), {
      message: "Each issued item must have a quantity greater than zero.",
      path: ['items']
    })
});

type IssuanceFormValues = z.infer<typeof issuanceSchema>;

function ManageSerialsDialog({ form, itemIndex, onClose, serialInventory }: { 
  form: any, 
  itemIndex: number, 
  onClose: () => void, 
  serialInventory: Map<string, number> | undefined 
}) {
    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: `items.${itemIndex}.serials`,
    });

    const itemDetails = form.watch(`items.${itemIndex}`);
    const allSerials = form.watch(`items.${itemIndex}.serials`);

    const totalSerialQty = useMemo(() => {
        return (allSerials || []).reduce((sum: number, s: any) => sum + Number(s.quantity || 0), 0);
    }, [allSerials]);

    const handleDone = () => {
        form.setValue(`items.${itemIndex}.receivedQuantity`, totalSerialQty, { shouldValidate: true, shouldDirty: true });
        onClose();
    };

    const inventorySerials = useMemo(() => {
        if (!serialInventory) return [];
        return Array.from(serialInventory.entries())
            .map(([serialNo, availableQty]) => ({
                serialNo,
                available: availableQty,
            }))
            .filter(item => item.available > 0.001) // Filter out zero quantity items
            .sort((a,b) => (a.serialNo || '').localeCompare(b.serialNo || ''));
    }, [serialInventory]);
    
    useEffect(() => {
        const existingSerialsMap = new Map(allSerials.map((s: any) => [s.serialNo, s.quantity]));
        
        const combinedSerials = inventorySerials.map(invSerial => {
            return {
                serialNo: invSerial.serialNo,
                quantity: existingSerialsMap.get(invSerial.serialNo) || 0,
            };
        });

        // Also include manually added serials that might not be in inventory
        allSerials.forEach((s: any) => {
            if (!inventorySerials.some(inv => inv.serialNo === s.serialNo)) {
                combinedSerials.push(s);
            }
        });
        
        replace(combinedSerials);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inventorySerials]);
    
    const manualEntryFields = fields.filter((f: any) => !serialInventory?.has(f.serialNo as string));

    return (
        <FormProvider {...form}>
            <DialogHeader>
                <DialogTitle>Manage Serials for: {itemDetails.description}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-between text-sm text-muted-foreground border-b pb-2">
                <span>Requisitioned Balance: {itemDetails.requisitionBalance.toFixed(2)} {itemDetails.unit}</span>
                <span>Total Issued Qty: {totalSerialQty.toFixed(2)}</span>
            </div>
            <ScrollArea className="h-64">
                <Table>
                    <TableHeader className='sticky top-0 bg-secondary'>
                        <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Serial Number</TableHead>
                            <TableHead className="text-right">Available Qty</TableHead>
                            <TableHead className="w-32">Issue Qty</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {fields.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No serial numbers in inventory for this item.</TableCell>
                            </TableRow>
                        )}
                        
                        {fields.map((field, index) => {
                            const isManual = !serialInventory?.has((field as any).serialNo);
                            const available = serialInventory?.get((field as any).serialNo) || 0;
                            return <SerialRow key={field.id} control={form.control} itemIndex={itemIndex} serialIndex={index} remove={remove} availableQty={available} isManualEntry={isManual} />
                        })}

                    </TableBody>
                </Table>
            </ScrollArea>
             <div className='flex justify-between items-center pt-4'>
                <Button type="button" variant="outline" onClick={() => append({ serialNo: '', quantity: 0 })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Row
                </Button>
                <Button type="button" onClick={handleDone}>Done</Button>
            </div>
        </FormProvider>
    );
}

function SerialRow({ control, itemIndex, serialIndex, remove, availableQty, isManualEntry = false }: { control: any, itemIndex: number, serialIndex: number, remove: (index: number) => void, availableQty: number, isManualEntry?: boolean }) {
    const serialField = useWatch({ control, name: `items.${itemIndex}.serials.${serialIndex}` });

    if (!serialField) return null;

    const isSelected = serialField.quantity > 0;

    return (
        <TableRow className={cn("h-12", isSelected && !isManualEntry && "bg-muted/50")}>
            <TableCell className="py-1 px-4">
                {!isManualEntry && (
                    <Controller
                        control={control}
                        name={`items.${itemIndex}.serials.${serialIndex}.quantity`}
                        render={({ field: { onChange } }) => (
                            <Checkbox
                                checked={!!serialField.quantity && serialField.quantity === availableQty}
                                onCheckedChange={(checked) => {
                                    onChange(checked ? availableQty : 0);
                                }}
                            />
                        )}
                    />
                )}
            </TableCell>
            <TableCell className="font-medium py-1 px-4">
                {isManualEntry ? (
                    <FormField
                        control={control}
                        name={`items.${itemIndex}.serials.${serialIndex}.serialNo`}
                        render={({ field: serialNoField }) => (
                            <Input {...serialNoField} placeholder="Enter Serial No." className="h-8" />
                        )}
                    />
                ) : (
                    serialField.serialNo
                )}
            </TableCell>
            <TableCell className="text-right text-muted-foreground py-1 px-4">{availableQty.toFixed(2)}</TableCell>
            <TableCell className="py-1 px-4">
                <FormField
                    control={control}
                    name={`items.${itemIndex}.serials.${serialIndex}.quantity`}
                    render={({ field: qtyField }) => (
                        <Input type="number" step="any" {...qtyField} className="h-8 text-right"
                            max={!isManualEntry ? availableQty : undefined}
                            onChange={(e) => qtyField.onChange(parseFloat(e.target.value) || 0)}
                        />
                    )}
                />
            </TableCell>
            <TableCell className="py-1 px-4 text-right">
                {isManualEntry && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(serialIndex)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                )}
            </TableCell>
        </TableRow>
    );
}


function PUSelectorDialog({
    onCancel,
    onAddItems,
    availablePlantUnits,
}: {
    onCancel: () => void;
    onAddItems: (items: MaterialIssuanceItem[]) => void;
    availablePlantUnits: PlantUnit[];
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPuIds, setSelectedPuIds] = useState<Set<string>>(new Set());
    
    const filteredPus = useMemo(() => {
        return availablePlantUnits.filter(pu => {
            if (!pu) return false;
            return searchTerm === '' || 
                   (pu.description && pu.description.toLowerCase().includes(searchTerm.toLowerCase())) || 
                   (pu.puId && pu.puId.toLowerCase().includes(searchTerm.toLowerCase()));
        });
    }, [availablePlantUnits, searchTerm]);

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
            .filter(pu => selectedPuIds.has(pu.id))
            .map(item => ({
                id: `mii-${Date.now()}-${item.id}`,
                sourceId: item.id,
                description: item.description,
                unit: item.unit,
                requisitionBalance: 0, // No requisition when adding from PU
                receivedQuantity: 0,
                serials: [],
                hasSerialNo: item.hasSerialNo,
            }));
        onAddItems(itemsToAdd);
        onCancel();
    };
    
    return (
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Add from Material Plant Units</DialogTitle>
                <DialogDescription>Select one or more materials to add to the issuance.</DialogDescription>
            </DialogHeader>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or PU ID..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={selectedPuIds.size === filteredPus.length && filteredPus.length > 0}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                />
                            </TableHead>
                            <TableHead>PU ID</TableHead>
                            <TableHead>Description</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredPus.map(pu => (
                            <TableRow key={pu.id}>
                                <TableCell><Checkbox checked={selectedPuIds.has(pu.id)} onCheckedChange={() => handleToggleSelect(pu.id)} /></TableCell>
                                <TableCell className="font-mono">{pu.puId}</TableCell>
                                <TableCell>{pu.description}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
             <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="button" onClick={handleAddClick} disabled={selectedPuIds.size === 0}>Add ({selectedPuIds.size}) Items</Button>
            </div>
        </DialogContent>
    );
}

interface MaterialIssuanceFormProps {
  project: Project;
  issuance?: MaterialIssuance;
  onSave: (data: MaterialIssuance) => void;
  onCancel: () => void;
  serialInventory: Map<string, Map<string, number>>;
  plantUnits: PlantUnit[];
}

export default function MaterialIssuanceForm({ project, issuance, onSave, onCancel, serialInventory, plantUnits }: MaterialIssuanceFormProps) {
  
  const plantUnitMap = useMemo(() => {
    return new Map(plantUnits.map(pu => [pu.id, pu]));
  }, [plantUnits]);

  const requisitionBalanceMap = useMemo(() => {
    const summary = new Map<string, { sourceId: string; puId: string; description: string; unit: string; balance: number; hasSerialNo?: boolean; }>();
    
    (project.materialRequisitions || []).forEach(req => {
      (req.items || []).forEach(item => {
        const boqItem = project.materialBoq?.find(bi => bi.id === item.sourceId);
        const plantUnit = plantUnitMap.get(boqItem?.sourceId || item.sourceId);

        const current = summary.get(item.sourceId) || { 
            sourceId: item.sourceId,
            puId: plantUnit?.puId || 'N/A',
            description: item.description, 
            unit: item.unit, 
            balance: 0, 
            hasSerialNo: plantUnit?.hasSerialNo 
        };
        current.balance += item.quantity;
        summary.set(item.sourceId, current);
      });
    });

    (project.materialIssuances || []).forEach(iss => {
      if (iss.id === issuance?.id) return; 
      (iss.items || []).forEach(item => {
        if (summary.has(item.sourceId)) {
            const current = summary.get(item.sourceId)!;
            current.balance -= item.quantity;
        }
      });
    });
    
    const filteredSummary = new Map<string, { sourceId: string; puId: string; description: string; unit: string; balance: number; hasSerialNo?: boolean; }>();
    summary.forEach((value, key) => {
        if (value.balance > 0.001) {
            filteredSummary.set(key, value);
        }
    });

    return filteredSummary;
  }, [project.materialRequisitions, project.materialIssuances, issuance, plantUnitMap, project.materialBoq]);


  const getHasSerialFromSource = (sourceId: string): boolean => {
    const boqItem = project.materialBoq?.find(bi => bi.id === sourceId);
    const puId = boqItem?.sourceId || sourceId;
    return !!plantUnitMap.get(puId)?.hasSerialNo;
  }

  const generateNewIssueNo = () => {
    return `GI-${new Date().getFullYear().toString().slice(-2)}-0000`;
  };

  const defaultValues = useMemo(() => {
    if (!issuance) {
        return {
            goodsIssueNo: generateNewIssueNo(),
            date: new Date(),
            items: [],
        };
    }
    
    const itemsWithBalance = issuance.items.map(item => {
        let balance = requisitionBalanceMap.get(item.sourceId)?.balance || 0;
        balance += item.quantity;
        return {
            ...item,
            serials: item.serials || [],
            requisitionBalance: balance,
            receivedQuantity: item.quantity,
            hasSerialNo: getHasSerialFromSource(item.sourceId),
        };
    });

    return {
        goodsIssueNo: issuance.goodsIssueNo,
        date: parseISO(issuance.date),
        items: itemsWithBalance,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuance, requisitionBalanceMap, getHasSerialFromSource, project.materialBoq, plantUnitMap]);

  const form = useForm<IssuanceFormValues>({
    resolver: zodResolver(issuanceSchema),
    defaultValues,
  });

  const { control, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [isPuSelectorOpen, setIsPuSelectorOpen] = useState(false);
  const [serialsModalOpen, setSerialsModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  
  const selectedSourceIds = new Set(fields.map(field => field.sourceId));

  const availableMaterialPus = useMemo(() => {
    return plantUnits.filter(pu => pu.category === 'Material PU' && !selectedSourceIds.has(pu.id));
  }, [plantUnits, selectedSourceIds]);

  const handleAddItems = (newItems: MaterialIssuanceItem[]) => {
      append(newItems);
  }
  
  const handleOpenSerialsModal = (index: number) => {
    const item = form.getValues(`items.${index}`);
    const serials = item.serials || [];
    const receivedQuantity = item.receivedQuantity || 0;
    
    if (serials.length === 0 && receivedQuantity > 0) {
      form.setValue(`items.${index}.serials`, [{ serialNo: 'N/A', quantity: receivedQuantity }], { shouldValidate: true });
    }

    setEditingItemIndex(index);
    setSerialsModalOpen(true);
  };

  const onSubmit = (data: IssuanceFormValues) => {
    const finalItems = data.items.map(item => {
        const isSerialized = getHasSerialFromSource(item.sourceId);
        const qty = isSerialized
            ? (item.serials || []).reduce((sum, s) => sum + (s.quantity || 0), 0)
            : item.receivedQuantity;
        const serials = isSerialized
            ? (item.serials || []).filter(s => (s.serialNo && s.quantity > 0))
            : [];
        return {
            id: item.id,
            sourceId: item.sourceId,
            description: item.description,
            unit: item.unit,
            quantity: qty,
            serials: serials,
            onSiteUse: item.onSiteUse,
        }
    }).filter(item => item.quantity > 0);

    const finalData: MaterialIssuance = {
      id: issuance?.id || `mi-${Date.now()}`,
      goodsIssueNo: data.goodsIssueNo,
      date: format(data.date, 'yyyy-MM-dd'),
      items: finalItems,
    };
    onSave(finalData);
  };

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                  control={control}
                  name="goodsIssueNo"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Goods Issue Number</FormLabel>
                      <FormControl><Input placeholder="Enter Goods Issue Number" {...field} /></FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
                  <FormField
                  control={control}
                  name="date"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Date</FormLabel>
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
                  <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Issuance Items</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsPuSelectorOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add from Plant Units
                  </Button>
                  </div>
                  <ScrollArea className="h-80 border rounded-lg">
                  <Table>
                      <TableHeader className='sticky top-0 bg-secondary'>
                      <TableRow>
                          <TableHead className="w-[35%]">Description</TableHead>
                          <TableHead>Issued Qty</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                      </TableHeader>
                      <TableBody>
                      {fields.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No materials added to this issuance.</TableCell></TableRow>
                      ) : fields.map((field, index) => {
                          const issuedQty = watch(`items.${index}.receivedQuantity`);
                          return (
                              <TableRow key={field.id}>
                                  <TableCell>
                                  {field.description}
                                  <div className='text-xs text-muted-foreground'>
                                      ({plantUnitMap.get(field.sourceId)?.puId || 'N/A'})
                                  </div>
                                  </TableCell>
                                  <TableCell>
                                  {field.hasSerialNo ? (
                                      <span className="font-medium">{issuedQty.toFixed(2)}</span>
                                  ) : (
                                      <FormField
                                          control={form.control}
                                          name={`items.${index}.receivedQuantity`}
                                          render={({ field }) => (
                                              <Input
                                                  type="number"
                                                  {...field}
                                                  className="h-8 w-28 text-right"
                                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                              />
                                          )}
                                      />
                                  )}
                                  </TableCell>
                                  <TableCell>{field.unit}</TableCell>
                                  <TableCell className="text-right">
                                      {field.hasSerialNo && (
                                          <Button type="button" size="sm" variant="outline" onClick={() => handleOpenSerialsModal(index)} className="mr-2"><Pencil className="mr-2 h-4 w-4" /> Serials</Button>
                                      )}
                                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                  </TableCell>
                              </TableRow>
                          );
                      })}
                      </TableBody>
                  </Table>
                  </ScrollArea>
                   <FormField
                      control={control}
                      name="items"
                      render={({ fieldState }) => (
                          fieldState.error?.root?.message && (
                          <Alert variant="destructive" className='py-2'>
                              <AlertDescription className="text-sm">{fieldState.error.root.message}</AlertDescription>
                          </Alert>
                          )
                      )}
                      />
              </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Save Issuance</Button>
          </div>
        </form>
      </FormProvider>
      
      <Dialog open={isPuSelectorOpen} onOpenChange={setIsPuSelectorOpen}>
        <PUSelectorDialog 
          onCancel={() => setIsPuSelectorOpen(false)}
          onAddItems={handleAddItems}
          availablePlantUnits={availableMaterialPus}
        />
      </Dialog>

      <Dialog open={serialsModalOpen} onOpenChange={setSerialsModalOpen}>
        <DialogContent className="max-w-2xl">
          {editingItemIndex !== null && (
            <ManageSerialsDialog 
                form={form} 
                itemIndex={editingItemIndex} 
                onClose={() => setSerialsModalOpen(false)}
                serialInventory={serialInventory.get(form.getValues(`items.${editingItemIndex}.sourceId`))}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
