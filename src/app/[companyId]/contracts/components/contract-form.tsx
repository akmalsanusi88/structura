
'use client';

import { useForm } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import type { Contract, Company } from '@/lib/types';
import { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const contractSchema = z.object({
  title: z.string().min(1, 'Contract title is required.'),
  contractNo: z.string().min(1, 'Contract number is required.'),
  clientName: z.string().min(1, 'Client name is required.'),
  value: z.coerce.number().positive('Contract value must be a positive number.'),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  status: z.enum(['Ongoing', 'Completed', 'Terminated']).default('Ongoing'),
});

type ContractFormValues = z.infer<typeof contractSchema>;

interface ContractFormProps {
  contract?: Contract;
  onSave: (data: Omit<Contract, 'id' | 'companyId' | 'projects'>) => void;
  onCancel: () => void;
  directory: Company[];
}

export default function ContractForm({ contract, onSave, onCancel, directory }: ContractFormProps) {
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      title: contract?.title || '',
      contractNo: contract?.contractNo || '',
      clientName: contract?.clientName || '',
      value: contract?.value || 0,
      startDate: contract?.startDate ? new Date(contract.startDate) : null,
      endDate: contract?.endDate ? new Date(contract.endDate) : null,
      status: contract?.status || 'Ongoing',
    },
  });

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const clientExists = useMemo(() => 
    directory.some(c => c.name.toLowerCase() === inputValue.toLowerCase()),
    [directory, inputValue]
  );

  const onSubmit = (data: ContractFormValues) => {
    onSave({
        ...data,
        startDate: data.startDate ? format(data.startDate, 'yyyy-MM-dd') : null,
        endDate: data.endDate ? format(data.endDate, 'yyyy-MM-dd') : null,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contract Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Fiber Optic Network Rollout Phase 2" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="contractNo"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Contract No.</FormLabel>
                <FormControl><Input placeholder="e.g., C-2024-TM-001" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem className="flex flex-col pt-2">
                  <FormLabel>Client Name</FormLabel>
                   <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                      <FormControl>
                          <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                          )}
                          >
                          {field.value || "Select or add a new client"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                      </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                            <CommandInput 
                                placeholder="Search or type client..."
                                value={inputValue}
                                onValueChange={setInputValue}
                            />
                            <CommandList>
                                <CommandEmpty>No client found.</CommandEmpty>
                                <CommandGroup>
                                    {inputValue && !clientExists && (
                                        <CommandItem
                                            key="add-new"
                                            value={inputValue}
                                            onSelect={() => {
                                                form.setValue("clientName", inputValue);
                                                setOpen(false);
                                                setInputValue('');
                                            }}
                                            className="flex items-center gap-2"
                                        >
                                            <PlusCircle className="h-4 w-4" />
                                            <span>Add: "{inputValue}"</span>
                                        </CommandItem>
                                    )}
                                    {directory.map((client) => (
                                    <CommandItem
                                        value={client.name}
                                        key={client.id}
                                        onSelect={() => {
                                            form.setValue("clientName", client.name)
                                            setOpen(false)
                                            setInputValue('');
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
        </div>
         <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Contract Value (RM)</FormLabel>
                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                </Popover><FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col"><FormLabel>End Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent>
                </Popover><FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save Contract</Button>
        </div>
      </form>
    </Form>
  );
}
