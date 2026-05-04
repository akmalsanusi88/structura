
'use client';

import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2, Save, Search, Pencil, PlusCircle, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { addOrUpdateStockTake } from '@/app/login/actions';
import { useParams, useRouter } from 'next/navigation';
import type { PlantUnit, StockTake, SerialInfo, StockTakeItem } from '@/lib/types';
import { useState, useMemo, useEffect } from 'react';
import { type StockBalanceItem } from '../components/material-dashboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';


const serialSchema = z.object({
  serialNo: z.string().optional(),
  quantity: z.coerce.number().min(0, "Quantity must be positive.").default(0),
});

const stockTakeItemSchema = z.object({
  id: z.string().optional(),
  sourceId: z.string(),
  description: z.string(),
  unit: z.string(),
  puId: z.string(),
  countedQuantity: z.coerce.number().min(0, "Count cannot be negative.").default(0),
  serials: z.array(serialSchema).optional(),
  hasSerialNo: z.boolean().optional(),
  inventory: z.any().optional(),
});

type StockTakeItemSchemaType = z.infer<typeof stockTakeItemSchema>;
type SortKey = keyof Pick<StockTakeItemSchemaType, 'puId' | 'description' | 'unit'>;

const stockTakeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'A name for this stock take is required.'),
  takeDate: z.date({ required_error: 'Please select a date.' }),
  items: z.array(stockTakeItemSchema),
});

type StockTakeFormValues = z.infer<typeof stockTakeSchema>;

interface StockTakeFormProps {
  stockTake?: StockTake;
  stockBalanceData: StockBalanceItem[];
  allPlantUnits: PlantUnit[];
  onCancel: () => void;
}

function ManageSerialsDialog({ form, itemIndex, onClose }: { 
  form: any, 
  itemIndex: number, 
  onClose: () => void, 
}) {
    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: `items.${itemIndex}.serials`,
    });

    const itemDetails = form.watch(`items.${itemIndex}`);
    const serials = form.watch(`items.${itemIndex}.serials`);

    const totalSerialQty = useMemo(() => {
        return (serials || []).reduce((sum: number, s: any) => sum + Number(s.quantity || 0), 0);
    }, [serials]);

    useEffect(() => {
        form.setValue(`items.${itemIndex}.countedQuantity`, totalSerialQty, { shouldValidate: true, shouldDirty: true });
    }, [totalSerialQty, form, itemIndex]);

    const handleDone = () => {
        onClose();
    };
    
    const inventorySerials = useMemo(() => {
        const grouped = new Map<string, number>();
        (itemDetails.inventory || []).forEach((inv: any) => {
            const key = inv.serialNo || 'N/A';
            grouped.set(key, (grouped.get(key) || 0) + inv.qty);
        });

        return Array.from(grouped.entries())
            .map(([serialNo, availableQty]) => ({
                serialNo,
                available: availableQty,
            }))
            .filter(item => item.available > 0.001)
            .sort((a,b) => (a.serialNo || '').localeCompare(b.serialNo || ''));
    }, [itemDetails.inventory]);

    useEffect(() => {
        const existingSerialsMap = new Map((serials || []).map((s: any) => [s.serialNo, s.quantity]));
        
        const combinedSerials = inventorySerials.map(invSerial => ({
            serialNo: invSerial.serialNo,
            quantity: existingSerialsMap.get(invSerial.serialNo) || 0,
        }));

        (serials || []).forEach((s: any) => {
            if (!inventorySerials.some(inv => inv.serialNo === s.serialNo)) {
                combinedSerials.push(s);
            }
        });
        
        replace(combinedSerials);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inventorySerials]);
    
    return (
        <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Count Serials for: {itemDetails.description}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-between text-sm text-muted-foreground border-b pb-2">
                <span>Physical Count: {totalSerialQty.toFixed(2)}</span>
            </div>
            <ScrollArea className="h-64">
                <Table>
                    <TableHeader className='sticky top-0 bg-secondary'>
                        <TableRow>
                            <TableHead>Serial Number</TableHead>
                            <TableHead className="w-32">Physical Qty</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                    No serial numbers for this item. Add one to start counting.
                                </TableCell>
                            </TableRow>
                        )}
                        {fields.map((field, index) => (
                            <TableRow key={field.id}>
                                <TableCell className="font-medium py-1 px-4">
                                     <FormField
                                        control={form.control}
                                        name={`items.${itemIndex}.serials.${index}.serialNo`}
                                        render={({ field: serialNoField }) => (
                                            <Input {...serialNoField} placeholder="Enter Serial No." className="h-8" />
                                        )}
                                    />
                                </TableCell>
                                <TableCell className="py-1 px-4">
                                    <FormField
                                        control={form.control}
                                        name={`items.${itemIndex}.serials.${index}.quantity`}
                                        render={({ field: qtyField }) => (
                                            <Input type="number" step="any" {...qtyField} className="h-8 text-right" onChange={(e) => qtyField.onChange(parseFloat(e.target.value) || 0)} />
                                        )}
                                    />
                                </TableCell>
                                <TableCell className="py-1 px-4 text-right">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
             <div className='flex justify-between items-center pt-4'>
                <Button type="button" variant="outline" onClick={() => append({ serialNo: '', quantity: 0 })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Row
                </Button>
                <Button type="button" onClick={handleDone}>Done</Button>
            </div>
        </DialogContent>
    );
}

export default function StockTakeForm({ stockTake, stockBalanceData, allPlantUnits, onCancel }: StockTakeFormProps) {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [serialsModalOpen, setSerialsModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const defaultValues = useMemo(() => {
    let defaultItems;
    if (stockTake) {
        const itemsMap = new Map(stockTake.items.map(i => [i.sourceId, i]));
        defaultItems = stockBalanceData.map(balanceItem => {
            const existingItem = itemsMap.get(balanceItem.sourceId);
            return {
                id: existingItem?.id,
                sourceId: balanceItem.sourceId,
                description: balanceItem.description,
                unit: balanceItem.unit,
                puId: balanceItem.puId,
                countedQuantity: existingItem?.countedQuantity ?? 0,
                hasSerialNo: balanceItem.hasSerialNo,
                serials: existingItem?.serials?.length ? existingItem.serials : (balanceItem.inventory || []).map((inv: any) => ({ serialNo: inv.serialNo, quantity: 0 })),
                inventory: balanceItem.inventory,
            };
        });
    } else {
        defaultItems = stockBalanceData.map(item => ({
            sourceId: item.sourceId,
            description: item.description,
            unit: item.unit,
            puId: item.puId,
            countedQuantity: 0,
            hasSerialNo: item.hasSerialNo,
            serials: (item.inventory || []).map((inv: any) => ({ serialNo: inv.serialNo, quantity: 0 })),
            inventory: item.inventory,
        }));
    }

    return {
        id: stockTake?.id,
        name: stockTake?.name || `Stock Take - ${format(new Date(), 'MMM yyyy')}`,
        takeDate: stockTake ? parseISO(stockTake.takeDate) : new Date(),
        items: defaultItems,
    };
  }, [stockTake, stockBalanceData]);

  const form = useForm<StockTakeFormValues>({
    resolver: zodResolver(stockTakeSchema),
    defaultValues,
  });

  const { control } = form;

  const sortedAndFilteredItems = useMemo(() => {
    let items = form.getValues('items') || [];

    if (sortConfig !== null) {
        items.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            
            let comparison = 0;
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
            }

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }
    
    if (!searchTerm) {
      return items.map((_, index) => index);
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        item.description.toLowerCase().includes(lowercasedFilter) ||
        item.puId.toLowerCase().includes(lowercasedFilter)
      )
      .map(({ index }) => index);
  }, [searchTerm, form, sortConfig]);

  const onSubmit = async (data: StockTakeFormValues) => {
    setIsSaving(true);
    try {
        const stockTakePayload: StockTake = {
            id: data.id || `st-${Date.now()}`,
            companyId: companyId,
            name: data.name,
            takeDate: format(data.takeDate, 'yyyy-MM-dd'),
            items: data.items.map(i => ({
                id: i.id || `sti-${Date.now()}-${Math.random()}`,
                sourceId: i.sourceId,
                countedQuantity: i.hasSerialNo ? (i.serials || []).reduce((sum, s) => sum + (s.quantity || 0), 0) : i.countedQuantity,
                stockTakeId: data.id || '', // placeholder, will be set on backend if new
                serials: i.hasSerialNo ? (i.serials || []).filter(s => s.serialNo) : [],
            }))
        };
        await addOrUpdateStockTake(stockTakePayload, companyId);
        toast({ title: "Success", description: "Stock take has been saved." });
        
        onCancel();
        router.refresh();

    } catch (error) {
        toast({ title: "Error", description: `Failed to save stock take: ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleOpenSerialsModal = (index: number) => {
    setEditingItemIndex(index);
    setSerialsModalOpen(true);
  };
  
  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const renderSortableHeader = (label: string, sortKey: SortKey, className = "") => (
    <TableHead className={className}>
        <Button type="button" variant="ghost" onClick={() => requestSort(sortKey)} className="px-0">
            {label} {getSortIcon(sortKey)}
        </Button>
    </TableHead>
  );
  
  if (!isClient) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-[600px] w-full" />
        </div>
    );
  }

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Take Name</FormLabel>
                <FormControl><Input placeholder="e.g., Monthly Count - Aug" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="takeDate"
            render={({ field }) => (
              <FormItem className="flex flex-col pt-1.5">
                <FormLabel>Date of Count</FormLabel>
                <Popover>
                    <PopoverTrigger asChild><FormControl>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button>
                    </FormControl></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="space-y-2">
            <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search materials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                />
            </div>

            <ScrollArea className="h-[600px] border rounded-lg">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            {renderSortableHeader("PU ID", "puId", "w-[150px]")}
                            {renderSortableHeader("Material", "description", "w-[40%]")}
                            {renderSortableHeader("Unit", "unit")}
                            <TableHead className="w-48 text-right">Physical Qty</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedAndFilteredItems.map((itemIndex) => {
                            const item = form.getValues('items')[itemIndex];
                            return (
                                <TableRow key={item.sourceId}>
                                    <TableCell className="font-mono py-2 px-4">{item.puId}</TableCell>
                                    <TableCell className="py-2 px-4">{item.description}</TableCell>
                                    <TableCell className="py-2 px-4">{item.unit}</TableCell>
                                    <TableCell className="py-2 px-4">
                                        <div className='flex items-center justify-end gap-2'>
                                            {item.hasSerialNo ? (
                                                <>
                                                    <Button type='button' variant="outline" size="icon" className='h-8 w-8' onClick={() => handleOpenSerialsModal(itemIndex)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        value={item.countedQuantity.toFixed(2)}
                                                        className="h-8 text-right bg-muted"
                                                        readOnly
                                                    />
                                                </>
                                            ) : (
                                                <FormField
                                                    control={control}
                                                    name={`items.${itemIndex}.countedQuantity`}
                                                    render={({ field }) => (
                                                        <Input
                                                            type="number"
                                                            step="any"
                                                            {...field}
                                                            className="h-8 text-right"
                                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                        />
                                                    )}
                                                />
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>


        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Stock Take
            </Button>
        </div>
      </form>
    </Form>
    <Dialog open={serialsModalOpen} onOpenChange={setSerialsModalOpen}>
        {editingItemIndex !== null && (
            <ManageSerialsDialog
                form={form}
                itemIndex={editingItemIndex}
                onClose={() => setSerialsModalOpen(false)}
            />
        )}
    </Dialog>
    </>
  );
}
