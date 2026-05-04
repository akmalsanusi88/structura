
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { OtherCost, OtherCostCategory } from '@/lib/types';

const otherCostSchema = z.object({
  category: z.enum(['Insurance', 'Permitting', 'Performance bond', 'Utilities mapping', 'Professional Fees', 'Levy', 'Others']),
  description: z.string().min(1, 'Description is required.'),
  cost: z.coerce.number().min(0, 'Cost must be a positive number.'),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  expiryDate: z.date().optional().nullable(),
  quotationNo: z.string().optional(),
  purchaseOrderNo: z.string().optional(),
  invoiceNo: z.string().optional(),
});

type OtherCostFormValues = z.infer<typeof otherCostSchema>;

const categories: OtherCostCategory[] = ['Insurance', 'Permitting', 'Performance bond', 'Utilities mapping', 'Professional Fees', 'Levy', 'Others'];

interface OtherCostFormProps {
  cost?: OtherCost;
  onSave: (data: OtherCost) => void;
  onCancel: () => void;
}

export default function OtherCostForm({ cost, onSave, onCancel }: OtherCostFormProps) {
  const form = useForm<OtherCostFormValues>({
    resolver: zodResolver(otherCostSchema),
    defaultValues: {
      category: cost?.category || 'Others',
      description: cost?.description || '',
      cost: cost?.cost || 0,
      startDate: cost?.startDate ? parseISO(cost.startDate) : null,
      endDate: cost?.endDate ? parseISO(cost.endDate) : null,
      expiryDate: cost?.expiryDate ? parseISO(cost.expiryDate) : null,
      quotationNo: cost?.quotationNo || '',
      purchaseOrderNo: cost?.purchaseOrderNo || '',
      invoiceNo: cost?.invoiceNo || '',
    },
  });

  const onSubmit = (data: OtherCostFormValues) => {
    onSave({
      id: cost?.id || `oc-${Date.now()}`,
      ...data,
      startDate: data.startDate ? format(data.startDate, 'yyyy-MM-dd') : null,
      endDate: data.endDate ? format(data.endDate, 'yyyy-MM-dd') : null,
      expiryDate: data.expiryDate ? format(data.expiryDate, 'yyyy-MM-dd') : null,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
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
                <Textarea placeholder="Describe the cost item..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="quotationNo" render={({ field }) => (
                <FormItem><FormLabel>Quotation No.</FormLabel><FormControl><Input placeholder="e.g., Q-123" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="purchaseOrderNo" render={({ field }) => (
                <FormItem><FormLabel>PO No.</FormLabel><FormControl><Input placeholder="e.g., PO-456" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="invoiceNo" render={({ field }) => (
                <FormItem><FormLabel>Invoice No.</FormLabel><FormControl><Input placeholder="e.g., INV-789" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
        </div>
        <FormField
          control={form.control}
          name="cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cost (RM)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="0.00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} /></PopoverContent>
              </Popover><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="endDate" render={({ field }) => (
            <FormItem className="flex flex-col"><FormLabel>End Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} /></PopoverContent>
              </Popover><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="expiryDate" render={({ field }) => (
            <FormItem className="flex flex-col"><FormLabel>Expiry Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} /></PopoverContent>
              </Popover><FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Cost</Button>
        </div>
      </form>
    </Form>
  );
}
