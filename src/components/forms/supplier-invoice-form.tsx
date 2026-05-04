
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import type { SupplierInvoice, MaterialPurchaseOrder, DeliveryOrder, MaterialPurchaseOrderItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO, addDays } from 'date-fns';
import { CalendarIcon, AlertTriangle, ChevronsUpDown, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandInput, CommandGroup, CommandList, CommandItem } from '@/components/ui/command';


const invoiceSchema = z.object({
  materialPurchaseOrderId: z.string().min(1, 'Please select a Purchase Order.'),
  invoiceNo: z.string().min(1, 'Invoice Number is required'),
  invoiceDate: z.date({ required_error: "Invoice date is required." }),
  dueDate: z.date({ required_error: "Due date is required." }),
  deliveryOrderIds: z.array(z.string()).optional(),
  isPrepayment: z.boolean().default(false),
  amount: z.coerce.number().gt(0, "Amount must be greater than zero."),
  status: z.enum(['Draft', 'Received', 'Paid']),
}).superRefine((data, ctx) => {
    if (!data.isPrepayment && (!data.deliveryOrderIds || data.deliveryOrderIds.length === 0)) {
        ctx.addIssue({
            path: ["deliveryOrderIds"],
            message: "Please select at least one Delivery Order.",
        });
    }
});


type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface SupplierInvoiceFormProps {
  invoice?: SupplierInvoice;
  purchaseOrders: MaterialPurchaseOrder[];
  deliveryOrders: DeliveryOrder[];
  onSave: (data: SupplierInvoice) => void;
  onCancel: () => void;
}

export default function SupplierInvoiceForm({ invoice, purchaseOrders, deliveryOrders, onSave, onCancel }: SupplierInvoiceFormProps) {
  const [poPopoverOpen, setPoPopoverOpen] = React.useState(false);
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: invoice ? {
        ...invoice,
        invoiceDate: parseISO(invoice.invoiceDate),
        dueDate: parseISO(invoice.dueDate),
        isPrepayment: !(invoice.deliveryOrderIds && invoice.deliveryOrderIds.length > 0),
    } : {
        materialPurchaseOrderId: '',
        invoiceNo: '',
        invoiceDate: new Date(),
        dueDate: addDays(new Date(), 30),
        amount: 0,
        status: 'Draft',
        deliveryOrderIds: [],
        isPrepayment: false,
    },
  });

  const { control, watch, setValue, trigger } = form;
  const selectedPoId = watch('materialPurchaseOrderId');
  const selectedDoIds = watch('deliveryOrderIds');
  const isPrepayment = watch('isPrepayment');

  const availableDos = React.useMemo(() => {
    if (!selectedPoId) return [];
    return deliveryOrders.filter(d => d.materialPurchaseOrderId === selectedPoId);
  }, [selectedPoId, deliveryOrders]);
  
  const selectedPO = React.useMemo(() => {
    return purchaseOrders.find(po => po.id === selectedPoId);
  }, [selectedPoId, purchaseOrders]);
  
  const { subtotal, deliveryCost, totalAmount } = React.useMemo(() => {
      let subtotal = 0;
      let deliveryCost = 0;
      
      const poItemsMap = new Map(selectedPO?.items.map(i => [i.id, i]));
      
      if (isPrepayment) {
          // For prepayment, the amount is manually entered.
          // We can however show the full PO value as a reference.
          subtotal = selectedPO?.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0) || 0;
          if (subtotal > 0) {
              deliveryCost = selectedPO?.deliveryCost || 0;
          }
      } else {
          const selectedDos = deliveryOrders.filter(d => selectedDoIds?.includes(d.id));
          
          subtotal = selectedDos.reduce((sum, d) => {
              return sum + d.items.reduce((doSum, doItem) => {
                  const poItem = poItemsMap.get(doItem.poItemId);
                  const rate = poItem?.rate || 0;
                  return doSum + (doItem.receivedQuantity * rate);
              }, 0)
          }, 0);

          if (subtotal > 0 && selectedPO?.deliveryCost) {
            deliveryCost = selectedPO.deliveryCost;
          }
      }
      const totalAmount = subtotal + deliveryCost;
      return { subtotal, deliveryCost, totalAmount };
  }, [selectedDoIds, isPrepayment, deliveryOrders, selectedPO]);


  React.useEffect(() => {
    if (selectedPoId) {
      setValue('deliveryOrderIds', []); // Reset selections when PO changes
    }
  }, [selectedPoId, setValue]);

  React.useEffect(() => {
    // Only auto-update the amount if not in prepayment mode.
    // In prepayment mode, user enters it manually.
    if (!isPrepayment) {
      setValue('amount', totalAmount);
    }
  }, [totalAmount, isPrepayment, setValue]);


  const onSubmit = (data: InvoiceFormValues) => {
    if (!selectedPO) return;
    const finalData: SupplierInvoice = {
      id: invoice?.id || `si-${Date.now()}`,
      companyId: '', // Set by server action
      invoiceNo: data.invoiceNo,
      invoiceDate: format(data.invoiceDate, 'yyyy-MM-dd'),
      dueDate: format(data.dueDate, 'yyyy-MM-dd'),
      supplier: selectedPO.supplier,
      materialPurchaseOrderId: data.materialPurchaseOrderId,
      poNo: selectedPO.poNo,
      deliveryOrderIds: data.isPrepayment ? [] : data.deliveryOrderIds,
      amount: data.amount,
      status: data.status,
    };
    onSave(finalData);
  };
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          disabled={!!invoice}
                          >
                           <span className="truncate">
                            {field.value
                                ? purchaseOrders.find(
                                    (po) => po.id === field.value
                                )?.poNo
                                : "Select a PO"}
                           </span>
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
          <FormField control={control} name="invoiceNo" render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice Number</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={control} name="invoiceDate" render={({ field }) => (
            <FormItem className="flex flex-col"><FormLabel>Invoice Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild><FormControl>
                    <Button variant="outline" className={cn(!field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button>
                </FormControl></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); if (date) setValue('dueDate', addDays(date, 30)); }} /></PopoverContent>
              </Popover><FormMessage />
            </FormItem>
          )} />
           <FormField control={control} name="dueDate" render={({ field }) => (
            <FormItem className="flex flex-col"><FormLabel>Due Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild><FormControl>
                    <Button variant="outline" className={cn(!field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button>
                </FormControl></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
              </Popover><FormMessage />
            </FormItem>
          )} />
        </div>
        
        <FormField
            control={control}
            name="isPrepayment"
            render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <FormLabel className="text-base">Invoice without Delivery Order</FormLabel>
                    <p className='text-sm text-muted-foreground'>For prepayments or invoices received before goods.</p>
                </div>
                <FormControl>
                    <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if(checked) {
                                setValue('deliveryOrderIds', []);
                            }
                            trigger('deliveryOrderIds');
                        }}
                        disabled={!!invoice}
                    />
                </FormControl>
                </FormItem>
            )}
            />

        {!isPrepayment && (
             <div>
                <FormLabel>Included Delivery Orders</FormLabel>
                <div className="border rounded-lg mt-2 max-h-60 overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary">
                            <TableRow><TableHead className='w-12'></TableHead><TableHead>DO No.</TableHead><TableHead>Date</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {!selectedPoId ? (
                                <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Select a PO to see delivery orders.</TableCell></TableRow>
                            ) : availableDos.length === 0 ? (
                                <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No delivery orders found for this PO.</TableCell></TableRow>
                            ) : (
                                <FormField
                                    control={control}
                                    name="deliveryOrderIds"
                                    render={({ field }) => (
                                        <>
                                        {availableDos.map(d => (
                                            <TableRow key={d.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={field.value?.includes(d.id)}
                                                        onCheckedChange={(checked) => {
                                                            return checked
                                                            ? field.onChange([...(field.value || []), d.id])
                                                            : field.onChange((field.value || []).filter(id => id !== d.id))
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono">{d.doNo}</TableCell>
                                                <TableCell>{format(parseISO(d.date), 'dd MMM yyyy')}</TableCell>
                                            </TableRow>
                                        ))}
                                        </>
                                    )}
                                />
                            )}
                        </TableBody>
                    </Table>
                </div>
                <FormField control={control} name="deliveryOrderIds" render={() => <FormMessage />} />
            </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
             <FormField control={control} name="amount" render={({ field }) => (
                <FormItem>
                <FormLabel>Invoice Amount</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} disabled={!isPrepayment} /></FormControl>
                {!isPrepayment && (
                    <p className='text-xs text-muted-foreground pt-1'>Auto-calculated from DOs + delivery cost. Total: {formatCurrency(totalAmount)}</p>
                )}
                <FormMessage />
                </FormItem>
            )} />
             <FormField control={control} name="status" render={({ field }) => (
                <FormItem>
                <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="Draft">Draft</SelectItem>
                            <SelectItem value="Received">Received</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                        </SelectContent>
                    </Select>
                <FormMessage />
                </FormItem>
            )} />
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Invoice</Button>
        </div>
      </form>
    </Form>
  );
}
