
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
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
import type { DeliveryOrder, MaterialPurchaseOrder, DeliveryOrderItem, SerialInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Pencil, Check, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandList, CommandItem } from '@/components/ui/command';


const serialSchema = z.object({
  serialNo: z.string().optional(),
  quantity: z.coerce.number().min(0, "Quantity must be positive.").default(0),
});

const doItemSchema = z.object({
  poItemId: z.string(),
  description: z.string(),
  unit: z.string(),
  poQuantity: z.number(),
  receivedQuantity: z.coerce.number().default(0),
  serials: z.array(serialSchema).optional(),
}).refine(item => item.receivedQuantity <= item.poQuantity, {
    message: "Cannot exceed PO quantity.",
    path: ["receivedQuantity"],
});

const deliveryOrderSchema = z.object({
  doNo: z.string().min(1, "Delivery Order Number is required"),
  date: z.date({ required_error: "Date is required." }),
  materialPurchaseOrderId: z.string().min(1, "Please select a Purchase Order."),
  items: z.array(doItemSchema).refine(items => items.some(item => item.receivedQuantity > 0), {
    message: "At least one item must have a received quantity greater than 0.",
    path: ["items"],
  }),
});

type DeliveryOrderFormValues = z.infer<typeof deliveryOrderSchema>;

function ManageSerialsDialog({ form, itemIndex, onClose }: { form: any, itemIndex: number, onClose: () => void }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `items.${itemIndex}.serials`,
  });

  const itemDetails = form.watch(`items.${itemIndex}`);
  const serials = form.watch(`items.${itemIndex}.serials`);

  const totalSerialQty = useMemo(() => {
    return (serials || []).reduce((sum: number, s: any) => sum + Number(s.quantity || 0), 0);
  }, [serials]);

  useEffect(() => {
    form.setValue(`items.${itemIndex}.receivedQuantity`, totalSerialQty, { shouldValidate: true, shouldDirty: true });
  }, [totalSerialQty, form, itemIndex]);

  const handleDone = () => {
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Manage Serials for: {itemDetails.description}</DialogTitle>
      </DialogHeader>
      <div className="flex justify-between text-sm text-muted-foreground border-b pb-2">
        <span>PO Quantity: {itemDetails.poQuantity.toFixed(2)} {itemDetails.unit}</span>
        <span className={totalSerialQty > itemDetails.poQuantity ? 'text-red-500' : ''}>Total Received Qty: {totalSerialQty.toFixed(2)}</span>
      </div>
      <ScrollArea className="h-64">
        <Table>
          <TableHeader className='sticky top-0 bg-secondary'>
            <TableRow>
              <TableHead>Serial Number (Optional)</TableHead>
              <TableHead className="w-32">Quantity</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell>
                  <FormField
                    control={form.control}
                    name={`items.${itemIndex}.serials.${index}.serialNo`}
                    render={({ field }) => (
                      <Input {...field} placeholder="Enter serial number" className="h-8" />
                    )}
                  />
                </TableCell>
                <TableCell>
                  <FormField
                    control={form.control}
                    name={`items.${itemIndex}.serials.${index}.quantity`}
                    render={({ field }) => (
                      <Input type="number" step="any" {...field} className="h-8 text-right" onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
    </>
  );
}


interface DeliveryOrderFormProps {
  deliveryOrder?: DeliveryOrder;
  purchaseOrders: MaterialPurchaseOrder[];
  onSave: (data: DeliveryOrder) => void;
  onCancel: () => void;
}

export default function DeliveryOrderForm({ deliveryOrder, purchaseOrders, onSave, onCancel }: DeliveryOrderFormProps) {
  const form = useForm<DeliveryOrderFormValues>({
    resolver: zodResolver(deliveryOrderSchema),
    defaultValues: {
        doNo: deliveryOrder?.doNo || '',
        date: deliveryOrder ? parseISO(deliveryOrder.date) : new Date(),
        materialPurchaseOrderId: deliveryOrder?.materialPurchaseOrderId || '',
        items: deliveryOrder
            ? (() => {
                const po = purchaseOrders.find(p => p.id === deliveryOrder.materialPurchaseOrderId);
                const poItemsMap = new Map(po?.items.map(item => [item.id, item]));
                return deliveryOrder.items.map(doItem => {
                    const latestPoItem = poItemsMap.get(doItem.poItemId);
                    return {
                        ...doItem,
                        poQuantity: latestPoItem ? latestPoItem.quantity : doItem.poQuantity,
                        serials: doItem.serials || []
                    };
                });
            })()
            : [],
    },
  });

  const { control, watch, setValue } = form;
  const { fields, replace } = useFieldArray({ control, name: 'items' });
  const selectedPoId = watch('materialPurchaseOrderId');
  const [serialsModalOpen, setSerialsModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [poPopoverOpen, setPoPopoverOpen] = useState(false);

  useEffect(() => {
    if (selectedPoId && !deliveryOrder) { // Only auto-populate for new DOs
      const po = purchaseOrders.find(p => p.id === selectedPoId);
      if (po) {
        const poItems = po.items.map((item): DeliveryOrderItem => ({
          poItemId: item.id,
          description: item.description,
          unit: item.unit,
          poQuantity: item.quantity,
          receivedQuantity: 0,
          serials: [],
        }));
        replace(poItems);
      }
    }
  }, [selectedPoId, purchaseOrders, replace, deliveryOrder]);
  
  const handleOpenSerialsModal = (index: number) => {
    const item = form.getValues(`items.${index}`);
    const serials = item.serials || [];
    const receivedQuantity = item.receivedQuantity || 0;
    
    // If user enters a quantity directly then opens serials, initialize the dialog
    if (serials.length === 0 && receivedQuantity > 0) {
      form.setValue(`items.${index}.serials`, [{ serialNo: 'N/A', quantity: receivedQuantity }], { shouldValidate: true });
    }

    setEditingItemIndex(index);
    setSerialsModalOpen(true);
  };

  const onSubmit = (data: DeliveryOrderFormValues) => {
    const po = purchaseOrders.find(p => p.id === data.materialPurchaseOrderId);
    if (!po) return;
    
    const finalItems = data.items
      .filter(item => item.receivedQuantity > 0)
      .map(item => {
         const finalSerials = (item.serials && item.serials.some(s => s.quantity > 0))
            ? item.serials.filter(s => s.quantity > 0)
            : [{ serialNo: 'N/A', quantity: item.receivedQuantity }];

        return {
          poItemId: item.poItemId,
          description: item.description,
          unit: item.unit,
          poQuantity: item.poQuantity,
          receivedQuantity: item.receivedQuantity,
          serials: finalSerials
        };
      });
    
    const finalData: DeliveryOrder = {
      id: deliveryOrder?.id || `do-${Date.now()}`,
      companyId: '', // Will be set by the action
      materialPurchaseOrderId: data.materialPurchaseOrderId,
      poNo: po.poNo,
      supplier: po.supplier,
      doNo: data.doNo,
      date: format(data.date, 'yyyy-MM-dd'),
      items: finalItems,
    };
    onSave(finalData);
  };
  
  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField
              control={control}
              name="materialPurchaseOrderId"
              render={({ field }) => (
                <FormItem className="flex flex-col pt-2">
                  <FormLabel>Source Purchase Order</FormLabel>
                   <Popover open={poPopoverOpen} onOpenChange={setPoPopoverOpen}>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                            )}
                            disabled={!!deliveryOrder}
                            >
                            {field.value
                                ? purchaseOrders.find(
                                    (po) => po.id === field.value
                                )?.poNo
                                : "Select a PO"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Search POs..." />
                            <CommandList>
                            <CommandEmpty>No purchase orders found.</CommandEmpty>
                            <CommandGroup>
                                {purchaseOrders.map((po) => (
                                <CommandItem
                                    value={`${po.poNo} - ${po.supplier}`}
                                    key={po.id}
                                    onSelect={() => {
                                        field.onChange(po.id)
                                        setPoPopoverOpen(false)
                                    }}
                                >
                                    <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        po.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                    />
                                    {po.poNo} - {po.supplier}
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
              control={control}
              name="doNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Order Number</FormLabel>
                  <FormControl><Input placeholder="Enter DO Number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col pt-1.5">
                  <FormLabel>Date Received</FormLabel>
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
            <h3 className="text-lg font-medium">Received Items</h3>
            <ScrollArea className="h-80 border rounded-lg">
              <Table>
                <TableHeader className='sticky top-0 bg-secondary'>
                  <TableRow>
                    <TableHead className="w-[45%]">Description</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">PO Qty</TableHead>
                    <TableHead className="text-right w-36">Received Qty</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Please select a Purchase Order to see items.</TableCell></TableRow>
                  ) : fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>{field.description}</TableCell>
                      <TableCell>{field.unit}</TableCell>
                      <TableCell className="text-right">{field.poQuantity}</TableCell>
                      <TableCell className="text-right">
                         <FormField
                            control={form.control}
                            name={`items.${index}.receivedQuantity`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="any"
                                            {...field}
                                            className="h-8 w-28 text-right"
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                </FormItem>
                            )}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                         <Button type="button" size="sm" variant="outline" onClick={() => handleOpenSerialsModal(index)}>
                          <Pencil className="mr-2 h-4 w-4" /> Serials
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <FormField
                control={form.control}
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

          <div className="flex justify-end gap-2 pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Save Delivery Order</Button>
          </div>
        </form>
      </Form>
      <Dialog open={serialsModalOpen} onOpenChange={setSerialsModalOpen}>
        <DialogContent className="max-w-2xl">
          {editingItemIndex !== null && (
            <ManageSerialsDialog form={form} itemIndex={editingItemIndex} onClose={() => setSerialsModalOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
