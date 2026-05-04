

'use client';

import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
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
import type { Project, MaterialReturn, SerialInfo, PlantUnit } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Check, Pencil } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const serialSchema = z.object({
  serialNo: z.string().optional(),
  quantity: z.coerce.number().min(0, "Quantity must be positive.").default(0),
});

const returnItemSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  description: z.string(),
  unit: z.string(),
  balance: z.coerce.number(), // Available balance to return
  returnedQuantity: z.coerce.number().default(0),
  serials: z.array(serialSchema),
}).superRefine((item, ctx) => {
    const totalSerialQuantity = item.serials.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const totalReturnedQty = item.returnedQuantity || totalSerialQuantity;
    if (totalReturnedQty > item.balance) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Returned quantity (${totalReturnedQty.toFixed(2)}) cannot exceed issued balance (${item.balance.toFixed(2)}).`,
            path: ['returnedQuantity'],
        });
    }
});

const returnSchema = z.object({
  goodsReturnNo: z.string().min(1, "Goods Return Number is required"),
  date: z.date({ required_error: "Date is required." }),
  items: z.array(returnItemSchema)
    .min(1, "At least one material must be returned.")
    .refine(items => items.some(item => {
        const isSerialized = (item.serials || []).length > 0;
        if (isSerialized) {
            return (item.serials || []).reduce((sum, s) => sum + (s.quantity || 0), 0) > 0;
        }
        return item.returnedQuantity > 0;
    }), {
      message: "Each returned item must have a quantity greater than zero.",
      path: ['items']
    })
});

type ReturnFormValues = z.infer<typeof returnSchema>;

function ManageReturnSerialsDialog({ form, itemIndex, onClose, issuedSerials }: { 
    form: any, 
    itemIndex: number, 
    onClose: () => void,
    issuedSerials: Map<string, number> 
}) {
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: `items.${itemIndex}.serials`,
  });

  const itemDetails = form.watch(`items.${itemIndex}`);
  const serials = form.watch(`items.${itemIndex}.serials`);

  useEffect(() => {
    const existingSerials = new Set(serials.map((s: any) => s.serialNo));
    const newSerialsFromInventory = Array.from(issuedSerials.entries())
        .filter(([serialNo]) => !existingSerials.has(serialNo))
        .map(([serialNo]) => ({ serialNo, quantity: 0 }));

    if (newSerialsFromInventory.length > 0) {
        // Use a temporary array to avoid multiple re-renders inside a loop
        const combinedSerials = [...serials, ...newSerialsFromInventory];
        replace(combinedSerials);
    }
  }, [issuedSerials, serials, replace]);


  const totalSerialQty = useMemo(() => {
    return (serials || []).reduce((sum: number, s: any) => sum + Number(s.quantity || 0), 0);
  }, [serials]);
  
  useEffect(() => {
    form.setValue(`items.${itemIndex}.returnedQuantity`, totalSerialQty, { shouldValidate: true });
  }, [totalSerialQty, form, itemIndex]);

  const alreadySelectedSerials = useMemo(() => {
    return new Set(serials.map((s: SerialInfo) => s.serialNo).filter(Boolean));
  }, [serials]);

  return (
    <FormProvider {...form}>
      <DialogHeader>
        <DialogTitle>Manage Serials for Return: {itemDetails.description}</DialogTitle>
      </DialogHeader>
      <div className="flex justify-between text-sm text-muted-foreground border-b pb-2">
        <span>Issued Balance: {itemDetails.balance.toFixed(2)} {itemDetails.unit}</span>
        <span className={totalSerialQty > itemDetails.balance ? 'text-red-500' : ''}>Total Return Qty: {totalSerialQty.toFixed(2)}</span>
      </div>
      <ScrollArea className="h-64">
        <Table>
          <TableHeader className='sticky top-0 bg-secondary'>
            <TableRow>
              <TableHead>Serial Number</TableHead>
              <TableHead className="w-32">Quantity</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => {
               return (
                <TableRow key={field.id}>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`items.${itemIndex}.serials.${index}.serialNo`}
                      render={({ field }) => (
                         <Select
                            onValueChange={(value) => {
                                const availableQty = issuedSerials.get(value) || 0;
                                field.onChange(value);
                                form.setValue(`items.${itemIndex}.serials.${index}.quantity`, availableQty);
                            }}
                            defaultValue={field.value}
                            >
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select serial..." />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {Array.from(issuedSerials.entries())
                                .filter(([serialNo, qty]) => qty > 0.001 && (!alreadySelectedSerials.has(serialNo) || serialNo === field.value))
                                .map(([serialNo, qty]) => (
                                <SelectItem key={serialNo} value={serialNo}>
                                    {serialNo === 'N/A' ? 'No Serial' : serialNo} (Avail: {qty.toFixed(2)})
                                </SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`items.${itemIndex}.serials.${index}.quantity`}
                      render={({ field }) => (
                         <Input type="number" step="any" {...field} className="h-8 text-right" />
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
      <div className='flex justify-between items-center pt-4'>
        <Button type="button" variant="outline" onClick={() => append({ serialNo: '', quantity: 0 })}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Row
        </Button>
        <Button type="button" onClick={onClose}>Done</Button>
      </div>
    </FormProvider>
  );
}


interface MaterialReturnFormProps {
  project: Project;
  plantUnits: PlantUnit[];
  allReturns: string[];
  materialReturn?: MaterialReturn;
  onSave: (data: MaterialReturn) => void;
  onCancel: () => void;
}

export default function MaterialReturnForm({ project, plantUnits, allReturns, materialReturn, onSave, onCancel }: MaterialReturnFormProps) {
  
  const plantUnitMap = useMemo(() => {
    return new Map(plantUnits.map(pu => [pu.id, pu]));
  }, [plantUnits]);

  const availableToReturn = useMemo(() => {
    const summary = new Map<string, { description: string; unit: string; issued: number; returned: number }>();
    (project.materialIssuances || []).flatMap(i => i.items).forEach(item => {
        const key = item.sourceId;
        const existing = summary.get(key) || { description: item.description, unit: item.unit, issued: 0, returned: 0 };
        existing.issued += item.quantity;
        summary.set(key, existing);
    });
    (project.materialReturns || []).filter(r => r.id !== materialReturn?.id).flatMap(r => r.items).forEach(item => {
        const key = item.sourceId;
        if (summary.has(key)) {
            const existing = summary.get(key)!;
            existing.returned += item.quantity;
        }
    });
    return Array.from(summary.entries())
        .map(([sourceId, data]) => ({
            sourceId,
            description: data.description,
            unit: data.unit,
            balance: data.issued - data.returned,
        }))
        .filter(item => item.balance > 0.001 || (materialReturn?.items.some(i => i.sourceId === item.sourceId)));
  }, [project.materialIssuances, project.materialReturns, materialReturn]);
  
  const availableSerialsByItem = useMemo(() => {
    const issuedMap = new Map<string, Map<string, number>>();
    const returnedMap = new Map<string, Map<string, number>>();

    (project.materialIssuances || []).forEach(issuance => {
        issuance.items.forEach(item => {
            if (!issuedMap.has(item.sourceId)) issuedMap.set(item.sourceId, new Map());
            const itemSerials = issuedMap.get(item.sourceId)!;
            (item.serials || []).forEach(serial => {
                const key = serial.serialNo || 'N/A';
                itemSerials.set(key, (itemSerials.get(key) || 0) + serial.quantity);
            });
        });
    });

    (project.materialReturns || []).filter(r => r.id !== materialReturn?.id).forEach(ret => {
        ret.items.forEach(item => {
            if (!returnedMap.has(item.sourceId)) returnedMap.set(item.sourceId, new Map());
            const itemSerials = returnedMap.get(item.sourceId)!;
            (item.serials || []).forEach(serial => {
                const key = serial.serialNo || 'N/A';
                itemSerials.set(key, (itemSerials.get(key) || 0) + serial.quantity);
            });
        });
    });

    const balanceMap = new Map<string, Map<string, number>>();
    issuedMap.forEach((serials, sourceId) => {
        const balanceSerials = new Map<string, number>();
        const returnedSerials = returnedMap.get(sourceId) || new Map();
        
        serials.forEach((issuedQty, serialNo) => {
            const returnedQty = returnedSerials.get(serialNo) || 0;
            const balance = issuedQty - returnedQty;
            if (balance > 0.001) {
                balanceSerials.set(serialNo, balance);
            }
        });
        
        if (balanceSerials.size > 0) {
            balanceMap.set(sourceId, balanceSerials);
        }
    });

    return balanceMap;
  }, [project.materialIssuances, project.materialReturns, materialReturn]);
  
  const generateNewReturnNo = () => {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const prefix = `GR-${currentYear}-`;

    const returnNumbersForYear = allReturns
        .map(no => no)
        .filter((no): no is string => no !== null && no !== undefined && no.startsWith(prefix));

    let maxSerial = 0;
    if (returnNumbersForYear.length > 0) {
        const serials = returnNumbersForYear.map(no => parseInt(no.substring(prefix.length), 10));
        const validSerials = serials.filter(n => !isNaN(n));
        if (validSerials.length > 0) {
             maxSerial = Math.max(...validSerials);
        }
    }
    
    const nextSerial = maxSerial + 1;
    return `${prefix}${nextSerial.toString().padStart(4, '0')}`;
  };

  const defaultValues = useMemo(() => ({
    goodsReturnNo: materialReturn?.goodsReturnNo || generateNewReturnNo(),
    date: materialReturn ? parseISO(materialReturn.date) : new Date(),
    items: materialReturn?.items.map(item => {
      const balanceItem = availableToReturn.find(i => i.sourceId === item.sourceId);
      const balance = (balanceItem?.balance || 0) + item.quantity;
      return {
        ...item,
        serials: item.serials || [],
        balance,
        returnedQuantity: item.quantity,
      };
    }) || [],
  }), [materialReturn, availableToReturn, generateNewReturnNo]);

  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema),
    defaultValues: defaultValues,
  });

  const { control, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [serialsModalOpen, setSerialsModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const selectedSourceIds = new Set(fields.map(field => field.sourceId));

  const handleAddItem = (item: { sourceId: string; description: string; unit: string; balance: number }) => {
    append({
      id: `mri-ret-${form.getValues('goodsReturnNo')}-${item.sourceId}`,
      sourceId: item.sourceId,
      description: item.description,
      unit: item.unit,
      balance: item.balance,
      returnedQuantity: 0,
      serials: [],
    });
    setPopoverOpen(false);
  };
  
  const handleOpenSerialsModal = (index: number) => {
    setEditingItemIndex(index);
    setSerialsModalOpen(true);
  };

  const onSubmit = (data: ReturnFormValues) => {
    const finalItems = data.items.map(item => {
        const isSerialized = (item.serials || []).length > 0 || !!plantUnitMap.get(item.sourceId)?.hasSerialNo;
        const qty = isSerialized
            ? (item.serials || []).reduce((sum, s) => sum + (s.quantity || 0), 0)
            : item.returnedQuantity;
        const serials = isSerialized
            ? (item.serials || []).filter(s => s.quantity > 0)
            : [];
        return {
            id: item.id,
            sourceId: item.sourceId,
            description: item.description,
            unit: item.unit,
            quantity: qty,
            serials: serials
        }
    }).filter(item => item.quantity > 0);

    const finalData: MaterialReturn = {
      id: materialReturn?.id || `mr-ret-${Date.now()}`,
      goodsReturnNo: data.goodsReturnNo,
      date: format(data.date, 'yyyy-MM-dd'),
      items: finalItems,
    };
    onSave(finalData);
  };

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="goodsReturnNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goods Return Number</FormLabel>
                  <FormControl><Input placeholder="Enter Goods Return Number" {...field} /></FormControl>
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
              <h3 className="text-lg font-medium">Return Items</h3>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Material
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Search materials..." />
                    <CommandList>
                      <CommandEmpty>No materials available to return.</CommandEmpty>
                      <CommandGroup>
                        {availableToReturn.filter(item => !selectedSourceIds.has(item.sourceId)).map((item) => (
                          <CommandItem key={item.sourceId} value={`${item.description} ${item.sourceId}`} onSelect={() => handleAddItem(item)}>
                            <Check className={cn("mr-2 h-4 w-4", selectedSourceIds.has(item.sourceId) ? "opacity-100" : "opacity-0")} />
                            <span>{item.description}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <ScrollArea className="h-80 border rounded-lg">
              <Table>
                <TableHeader className='sticky top-0 bg-secondary'>
                  <TableRow>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead>Issued Balance</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Returned Qty</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No materials added to this return.</TableCell></TableRow>
                  ) : fields.map((field, index) => {
                      const returnedQty = watch(`items.${index}.returnedQuantity`);
                      const hasSerialNo = plantUnitMap.get(field.sourceId)?.hasSerialNo;
                      return (
                        <TableRow key={field.id}>
                          <TableCell>
                            {field.description}
                            <div className='text-xs text-muted-foreground'>
                                ({plantUnitMap.get(field.sourceId)?.puId || 'N/A'})
                            </div>
                          </TableCell>
                          <TableCell>{field.balance.toFixed(2)}</TableCell>
                          <TableCell>{field.unit}</TableCell>
                          <TableCell>
                            {hasSerialNo ? (
                                <span className="font-medium">{returnedQty.toFixed(2)}</span>
                            ) : (
                                <FormField
                                    control={form.control}
                                    name={`items.${index}.returnedQuantity`}
                                    render={({ field }) => (
                                        <Input
                                            type="number"
                                            step="any"
                                            {...field}
                                            className="h-8 w-28 text-right"
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    )}
                                />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                             {hasSerialNo && (
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
          </div>
          
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

          <div className="flex justify-end gap-2 pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Save Return</Button>
          </div>
        </form>
      </FormProvider>
      
      <Dialog open={serialsModalOpen} onOpenChange={setSerialsModalOpen}>
        <DialogContent className="max-w-2xl">
          {editingItemIndex !== null && (
            <ManageReturnSerialsDialog 
                form={form} 
                itemIndex={editingItemIndex} 
                onClose={() => setSerialsModalOpen(false)}
                issuedSerials={availableSerialsByItem.get(form.getValues(`items.${editingItemIndex}.sourceId`)) || new Map()}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
