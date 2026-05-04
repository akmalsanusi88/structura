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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Project, PlantUnit, Company, Contract } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  projectNo: z.string().optional(),
  lorId: z.string().optional(),
  client: z.string().min(1, 'Client name is required'),
  supervisor: z.string().optional(),
  planner: z.string().optional(),
  targetCompletionDate: z.date().optional(),
  contractId: z.string().optional().nullable(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  onSave: (data: Omit<Project, 'id' | 'companyId'>) => Promise<void>;
  onCancel: () => void;
  directory: Company[];
  contracts: Contract[];
}

export default function ProjectForm({ onSave, onCancel, directory, contracts }: ProjectFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
          name: '',
          projectNo: '',
          lorId: '',
          client: '',
          supervisor: '',
          planner: '',
          targetCompletionDate: undefined,
          contractId: null,
    },
  });
  
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const selectedClient = form.watch('client');

  const clientExists = useMemo(() => 
    directory.some(c => c.name.toLowerCase() === inputValue.toLowerCase()),
    [directory, inputValue]
  );
  
  const filteredContracts = useMemo(() => {
    if (!contracts || !selectedClient) return [];
    return contracts.filter(c => c.clientName === selectedClient);
  }, [contracts, selectedClient]);


  const onSubmit = async (data: ProjectFormValues) => {
    setIsSaving(true);
    const newProject: Omit<Project, 'id' | 'companyId'> = {
      name: data.name,
      client: data.client,
      projectNo: data.projectNo || null,
      lorId: data.lorId || null,
      supervisor: data.supervisor || null,
      planner: data.planner || null,
      status: 'Setup',
      budgetedCost: 0,
      actualCost: 0,
      revenue: 0,
      progress: 0,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      targetCompletionDate: data.targetCompletionDate ? format(data.targetCompletionDate, 'yyyy-MM-dd') : null,
      actualCompletionDate: null,
      clientBoq: [],
      engineeringBoq: [],
      materialBoq: [],
      purchaseOrders: [],
      dailyActivities: [],
      materialRequisitions: [],
      materialIssuances: [],
      materialReturns: [],
      clientClaims: [],
      subconClaims: [],
      teamCosts: [],
      otherCosts: [],
      contractId: data.contractId === 'none' ? null : data.contractId,
    };
    await onSave(newProject);
    setIsSaving(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Skyscraper One" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="projectNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., P-2024-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="lorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LOR ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., LOR-123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="client"
              render={({ field }) => (
                <FormItem className="flex flex-col pt-2">
                  <FormLabel>Client</FormLabel>
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
                          <Command filter={(value, search) => {
                            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                            return 0;
                          }}>
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
                                                form.setValue("client", inputValue);
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
                                            form.setValue("client", client.name)
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
            <FormField
              control={form.control}
              name="supervisor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supervisor</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Alice Johnson" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="planner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Planner</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Bob Williams" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="targetCompletionDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col pt-2">
                    <FormLabel>Target Completion Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP")
                            ) : (
                                <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
            <FormField
                control={form.control}
                name="contractId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Master Contract</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Link to a master contract..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {filteredContracts.map(c => <SelectItem key={c.id} value={c.id}>{c.contractNo}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" isPending={isSaving}>Save Project</Button>
        </div>
      </form>
    </Form>
  );
}
