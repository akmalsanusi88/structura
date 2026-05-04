
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
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Project, ProjectStatus, PlantUnit, Company, Contract } from "@/lib/types";
import { cn } from '@/lib/utils';
import { CalendarIcon, Save, Trash2, Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useState, useMemo, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

const projectInfoSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  projectNo: z.string().optional(),
  lorId: z.string().optional(),
  client: z.string().min(1, 'Client name is required'),
  supervisor: z.string().optional(),
  planner: z.string().optional(),
  status: z.enum(["Setup", "Planning", "Implementation", "Overdue", "KIV", "Completed", "Cancelled", "Closed"]),
  targetCompletionDate: z.date().optional(),
  actualCompletionDate: z.date().optional().nullable(),
  contractId: z.string().optional().nullable(),
});

type ProjectInfoFormValues = z.infer<typeof projectInfoSchema>;

interface ProjectInfoFormProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  allCompanies: Company[];
  contracts: Contract[];
  saveProjectDetails: (updatedProject?: Project) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
}

export default function ProjectInfoForm({ project, setProject, allCompanies, contracts, saveProjectDetails, deleteProject }: ProjectInfoFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const form = useForm<ProjectInfoFormValues>({
    resolver: zodResolver(projectInfoSchema),
    defaultValues: {
      name: project.name || '',
      projectNo: project.projectNo || '',
      lorId: project.lorId || '',
      client: project.client || '',
      supervisor: project.supervisor || '',
      planner: project.planner || '',
      status: project.status || 'Setup',
      targetCompletionDate: project.targetCompletionDate ? parseISO(project.targetCompletionDate) : undefined,
      actualCompletionDate: project.actualCompletionDate ? parseISO(project.actualCompletionDate) : null,
      contractId: project.contractId || null,
    },
  });
  const { reset } = form;
  
  useEffect(() => {
    if (project) {
        reset({
            name: project.name || '',
            projectNo: project.projectNo || '',
            lorId: project.lorId || '',
            client: project.client || '',
            supervisor: project.supervisor || '',
            planner: project.planner || '',
            status: project.status || 'Setup',
            targetCompletionDate: project.targetCompletionDate ? parseISO(project.targetCompletionDate) : undefined,
            actualCompletionDate: project.actualCompletionDate ? parseISO(project.actualCompletionDate) : null,
            contractId: project.contractId || null,
        });
    }
  }, [project, reset]);


  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const clientExists = useMemo(() => 
    allCompanies.some(c => c.name.toLowerCase() === inputValue.toLowerCase()),
    [allCompanies, inputValue]
  );


  const onSubmit = async (data: ProjectInfoFormValues) => {
    setIsSaving(true);
    const updatedProject = {
        ...project,
        ...data,
        targetCompletionDate: data.targetCompletionDate ? format(data.targetCompletionDate, 'yyyy-MM-dd') : undefined,
        actualCompletionDate: data.actualCompletionDate ? format(data.actualCompletionDate, 'yyyy-MM-dd') : null,
    };
    setProject(updatedProject);
    
    try {
        await saveProjectDetails(updatedProject);
        toast({ title: "Project Saved", description: "Project details have been updated." });
    } catch (error) {
        toast({ title: "Error", description: "Failed to save project details.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteProject(project.id);
    setIsDeleting(false);
  };
  
  const statuses: ProjectStatus[] = ["Setup", "Planning", "Implementation", "Overdue", "KIV", "Completed", "Cancelled", "Closed"];

  return (
    <Card>
        <CardHeader>
            <CardTitle>Edit Project Information</CardTitle>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                                        form.setValue("client", inputValue, { shouldDirty: true });
                                                        setOpen(false);
                                                        setInputValue('');
                                                    }}
                                                    className="flex items-center gap-2"
                                                >
                                                    <PlusCircle className="h-4 w-4" />
                                                    <span>Add: "{inputValue}"</span>
                                                </CommandItem>
                                            )}
                                            {allCompanies.map((client) => (
                                            <CommandItem
                                                value={client.name}
                                                key={client.id}
                                                onSelect={() => {
                                                    form.setValue("client", client.name, { shouldDirty: true })
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
                        <FormLabel>Person in Charge (Supervisor)</FormLabel>
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
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Project Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a status" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
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
                            name="actualCompletionDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col pt-2">
                                <FormLabel>Actual Completion Date</FormLabel>
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
                                        selected={field.value || undefined}
                                        onSelect={field.onChange}
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
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Link to a master contract..." />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="">None</SelectItem>
                                        {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.title} ({c.contractNo})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                </div>
                <div className="flex justify-between items-center pt-4 mt-4 border-t">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" isPending={isDeleting}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Project
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the
                                    project "{project.name}" and all of its associated data.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className='bg-red-600 hover:bg-red-700'>
                                    Yes, delete project
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                     <Button type="submit" isPending={isSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                    </Button>
                </div>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}
