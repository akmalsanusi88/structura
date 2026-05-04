

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DailyActivityLog, Project, SiteInstruction, PurchaseOrderType, PlantUnit, BoQItem, ClientBoQItem, InHouseTeam, PurchaseOrderItem } from '@/lib/types';
import { useMemo, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { CalendarIcon, PlusCircle, Trash2, Check, Pencil, Search, ChevronsUpDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SiteInstructionForm from './site-instruction-form';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const workItemSchema = z.object({
  id: z.string(),
  boqItemId: z.string().min(1, 'Please select a PO item.'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0.'),
  teamId: z.string().optional(),
});

const siItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "Description is required"),
  unit: z.string().optional(),
  quantity: z.coerce.number().optional(),
  rate: z.coerce.number().optional(),
  amount: z.coerce.number(),
  sourceType: z.enum(['custom', 'pu', 'percentage']),
  sourceId: z.string().optional(),
  discountPercentage: z.coerce.number().optional(),
  managementFee: z.number().optional(),
  hasManagementFee: z.boolean().optional(),
  context: z.enum(['Client', 'Subcontractor', 'Team']),
  purchaseOrderId: z.string().optional(),
  teamId: z.string().optional(),
});


const dailyLogSchema = (context: string) => z.object({
  date: z.date({ required_error: "A date is required." }),
  teamId: z.string().optional(), // Now optional at the top level
  description: z.string().optional(),
  work: z.array(workItemSchema),
  siteInstructions: z.array(siItemSchema),
}).refine(data => {
    if (data.work.length === 0 && data.siteInstructions.length === 0) {
        return false;
    }
    // If context is team, teamId must be selected
    if (context === 'Team' && !data.teamId) {
        return false;
    }
    return true;
}, {
    message: 'A log must contain at least one Work Item or Site Instruction. If logging for a team, a team must be selected.',
    path: ['work'],
});


type DailyLogFormValues = z.infer<ReturnTypeOf<typeof dailyLogSchema>>;

interface WorkRecordFormProps {
  project: Project;
  selectedPoId: string | null;
  inHouseTeams?: InHouseTeam[];
  editingLog?: DailyActivityLog | null;
  onSave: (data: DailyActivityLog, poIdForSave: string | null, teamId?: string | null) => void;
  onCancel: () => void;
  plantUnits: PlantUnit[];
  context: PurchaseOrderType | 'Team';
}

function ItemSelectorDialog({
    title,
    description,
    items,
    onCancel,
    onAddItems,
    showClientFilter,
    plantUnits,
}: {
    title: string;
    description: string;
    items: { id: string; description: string; puId?: string }[];
    onCancel: () => void;
    onAddItems: (items: any[]) => void;
    showClientFilter?: boolean;
    plantUnits?: PlantUnit[];
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [clientFilter, setClientFilter] = useState('all');

    const uniqueClients = useMemo(() => {
        if (!showClientFilter || !plantUnits) return [];
        const clients = new Set<string>();
        plantUnits.forEach(pu => {
            if (pu.category === 'Client PU' && pu.clientName) {
                clients.add(pu.clientName);
            }
        });
        return ['all', ...Array.from(clients).sort()];
    }, [showClientFilter, plantUnits]);
    
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (!item) return false;

            const searchMatch = searchTerm === '' || 
                   (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) || 
                   (item.puId && item.puId.toLowerCase().includes(searchTerm.toLowerCase())) ||
                   (item.id && item.id.toLowerCase().includes(searchTerm.toLowerCase()));
            
            let clientMatch = true;
            if (showClientFilter && clientFilter !== 'all') {
                const pu = plantUnits?.find(p => p.id === item.id);
                clientMatch = pu?.clientName === clientFilter;
            }
            
            return searchMatch && clientMatch;
        });
    }, [items, searchTerm, showClientFilter, clientFilter, plantUnits]);

    const handleToggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSelectAll = (isChecked: boolean) => {
        if (isChecked) {
            setSelectedIds(new Set(filteredItems.map(item => item.id)));
        } else {
            setSelectedIds(new Set());
        }
    };
    
    const handleAddClick = () => {
        const itemsToAdd = items
            .filter(item => selectedIds.has(item.id))
            .map(item => ({
                id: `daw-${Date.now()}-${item.id}`,
                boqItemId: item.id,
                quantity: 0,
            }));
        onAddItems(itemsToAdd);
        onCancel();
    };
    
    return (
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or ID..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                 {showClientFilter && (
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
                 )}
            </div>
            <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                />
                            </TableHead>
                            <TableHead>ID</TableHead>
                            <TableHead>Description</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredItems.map(item => (
                            <TableRow key={item.id}>
                                <TableCell><Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => handleToggleSelect(item.id)} /></TableCell>
                                <TableCell className="font-mono">{item.puId || item.id}</TableCell>
                                <TableCell>{item.description}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
             <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="button" onClick={handleAddClick} disabled={selectedIds.size === 0}>Add ({selectedIds.size}) Items</Button>
            </div>
        </DialogContent>
    );
}

export default function WorkRecordForm({ project, selectedPoId: initialPoId, inHouseTeams, editingLog, onSave, onCancel, plantUnits, context }: WorkRecordFormProps) {
  
  const [selectedPoId, setSelectedPoId] = useState<string | null>(initialPoId);
  const selectedTeamIdForEdit = editingLog?.work.find(w => w.teamId)?.teamId;
  
  const form = useForm<DailyLogFormValues>({
    resolver: zodResolver(dailyLogSchema(context)),
    defaultValues: editingLog ? {
      date: parseISO(editingLog.date),
      description: editingLog.description || '',
      work: editingLog.work,
      siteInstructions: editingLog.siteInstructions || [],
      teamId: selectedTeamIdForEdit,
    } : {
      date: new Date(),
      description: '',
      work: [],
      siteInstructions: [],
      teamId: '',
    },
  });

  const { control, watch, setValue, setError, clearErrors } = form;
  const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({
    control: form.control,
    name: 'work',
  });
  
  const { fields: siFields, append: appendSi, remove: removeSi, update: updateSi } = useFieldArray({
    control: form.control,
    name: 'siteInstructions',
  });

  const [isSiFormOpen, setIsSiFormOpen] = useState(false);
  const [editingSi, setEditingSi] = useState<{si: SiteInstruction, index: number} | null>(null);
  
  const [itemSelectorType, setItemSelectorType] = useState<'pu' | 'boq' | null>(null);

  const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);
  const teamId = form.watch('teamId');

  const fullBoqMap = useMemo(() => new Map([...(project.clientBoq || []), ...(project.engineeringBoq || []), ...(project.materialBoq || [])].map(item => [item.id, item])), [project]);
  const clientPoItemMap = useMemo(() => {
    const map = new Map<string, PurchaseOrderItem>();
    (project.purchaseOrders || []).filter(po => po.type === 'Client').flatMap(po => po.items).forEach(item => map.set(item.id, item));
    return map;
  }, [project.purchaseOrders]);

  const handleOpenSiForm = (si?: SiteInstruction, index?: number) => {
    setEditingSi(si && index !== undefined ? { si, index } : null);
    setIsSiFormOpen(true);
  }

  const handleSaveSi = (siData: SiteInstruction) => {
    const siWithContext = {
      ...siData,
      purchaseOrderId: selectedPoId || undefined,
      teamId: context === 'Team' ? teamId : undefined,
      context: siteInstructionsContext,
    };
    if (editingSi) {
      updateSi(editingSi.index, siWithContext);
    } else {
      appendSi(siWithContext);
    }
    setIsSiFormOpen(false);
    setEditingSi(null);
  };
  
  const selectedPOItems = useMemo(() => {
    if (context === 'Team' || !selectedPoId) return [];
    const po = project.purchaseOrders.find(p => p.id === selectedPoId);
    return po?.items.map(item => {
        let puNo = 'N/A';
        if (item.puNo) {
            puNo = item.puNo;
        } else if (item.sourceType === 'pu') {
            puNo = plantUnitMap.get(item.sourceId!)?.puId || 'N/A';
        } else if (item.sourceType === 'boq') {
            const boqItem = fullBoqMap.get(item.sourceId!);
            if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                puNo = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
            }
        } else if (item.sourceType === 'percentage') {
            const clientPoItem = clientPoItemMap.get(item.sourceId!);
            if (clientPoItem) {
                const boqItem = fullBoqMap.get(clientPoItem.sourceId!);
                if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                    puNo = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                }
            }
        }
        return { ...item, puNo };
    }) || [];
  }, [selectedPoId, project.purchaseOrders, context, plantUnitMap, fullBoqMap, clientPoItemMap]);
  
  const availablePUsForTeam = useMemo(() => {
    if (context !== 'Team') return [];
    return plantUnits.filter(pu => pu.category === 'Client PU' || pu.category === 'Engineering Services PU');
  }, [plantUnits, context]);

  const allWorkRecords = useMemo(() => {
    return project.dailyActivities?.flatMap(d => d.work) || [];
  }, [project.dailyActivities]);

  const boqInfoMap = useMemo(() => {
    const infoMap = new Map<string, { budgeted: number; asBuilt: number; balance: number; unit: string; puNo?: string; }>();
    if (context === 'Team') return infoMap;

    const allPoItems = project.purchaseOrders.flatMap(po => po.items);

    allPoItems.forEach(poItem => {
        const asBuiltQty = allWorkRecords
            .filter(w => {
                if (editingLog) {
                    const workIdsInEditingLog = new Set(editingLog.work.map(ew => ew.id));
                    return w.boqItemId === poItem.id && !workIdsInEditingLog.has(w.id);
                }
                return w.boqItemId === poItem.id;
            })
            .reduce((sum, w) => sum + w.quantity, 0) || 0;
        
        infoMap.set(poItem.id, {
            budgeted: poItem.quantity,
            asBuilt: asBuiltQty,
            balance: poItem.quantity - asBuiltQty,
            unit: poItem.unit,
            puNo: poItem.puNo
        });
    });

    return infoMap;
  }, [project.purchaseOrders, allWorkRecords, editingLog, context]);
  
  const handleAddWorkItems = (items: any[]) => {
    const itemsToAppend = items.map(item => ({
        ...item,
        teamId: context === 'Team' ? teamId : undefined,
    }));
    appendWork(itemsToAppend);
  };

  const onSubmit = (data: DailyLogFormValues) => {
    if (context !== 'Team') {
      for (const workItem of data.work) {
          const info = boqInfoMap.get(workItem.boqItemId);
          if (info && workItem.quantity > info.balance) {
              const poItem = project.purchaseOrders.flatMap(p => p.items).find(i => i.id === workItem.boqItemId);
              form.setError(`work`, {
                  type: 'manual',
                  message: `Quantity for "${poItem?.description}" exceeds balance of ${info.balance.toFixed(2)}.`,
              });
              return;
          }
      }
    }

    const finalWork = data.work.map(w => ({ ...w, teamId: context === 'Team' ? data.teamId : undefined }));

    const logData: DailyActivityLog = {
      id: editingLog?.id || `dalog-${Date.now()}`,
      date: format(data.date, 'yyyy-MM-dd'),
      description: data.description,
      work: finalWork,
      siteInstructions: (data.siteInstructions || []).map(si => ({ ...si, teamId: context === 'Team' ? data.teamId : undefined })),
    };
    onSave(logData, selectedPoId, data.teamId);
  };

  const getItemInfo = (boqItemId: string) => {
    let description = 'N/A';
    let unit = 'N/A';
    let puNo = 'N/A';
    if (context === 'Team') {
        const pu = plantUnitMap.get(boqItemId);
        if (pu) {
            description = pu.description;
            unit = pu.unit;
            puNo = pu.puId || 'N/A';
        } else {
            const boqItem = project.engineeringBoq.find(b => b.id === boqItemId);
            if (boqItem) {
                description = boqItem.description;
                unit = boqItem.unit;
                if (boqItem.sourceType === 'pu' && boqItem.sourceId) {
                    puNo = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                }
            }
        }
    } else {
        const item = project.purchaseOrders.flatMap(p => p.items).find(i => i.id === boqItemId);
        if(item) {
            description = item.description;
            unit = item.unit;
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
        }
    }
    return { description, unit, puNo };
  }

  const workItemsHeader = context === 'Team' ? 'Team Work Items' : 'Work Items from PO';
  const siteInstructionsHeader = context === 'Team' ? 'Custom Team Work Items' : 'Site Instructions (Additional Work)';
  const siteInstructionsContext = context === 'Team' ? 'Team' : context;

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Date of Work</FormLabel>
                    <Popover>
                    <PopoverTrigger asChild>
                        <FormControl>
                        <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
                )}
            />
            {context === 'Team' ? (
                 <FormField
                    control={form.control}
                    name="teamId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Team</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!editingLog}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a team" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {(inHouseTeams || []).map(team => (
                                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            ) : (
              <FormItem>
                <FormLabel>Purchase Order</FormLabel>
                <Select value={selectedPoId || ''} onValueChange={setSelectedPoId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a PO..." />
                    </SelectTrigger>
                    <SelectContent>
                        {project.purchaseOrders.filter(po => po.type === context).map(po => (
                            <SelectItem key={po.id} value={po.id}>{po.poNo} - {po.issuer}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </FormItem>
            )}
          </div>
            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Log Description</FormLabel>
                    <FormControl>
                        <Textarea
                        placeholder="Describe the overall work done for the day..."
                        {...field}
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
          
          <div className="space-y-8">
              <div className="space-y-2 pt-4">
                  <div className='flex items-center justify-between'>
                      <h3 className="text-lg font-medium">{workItemsHeader}</h3>
                       {context === 'Team' ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" disabled={!teamId}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onSelect={() => setItemSelectorType('boq')}>From Budget (Engineering)</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setItemSelectorType('pu')}>From Plant Units</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      ) : (
                          <Popover>
                              <PopoverTrigger asChild>
                                  <Button type="button" variant="outline" disabled={!selectedPoId}><PlusCircle className="mr-2 h-4 w-4" /> Add Item from PO</Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
                                  <Command>
                                      <CommandInput placeholder="Search items..." />
                                      <CommandList>
                                          <CommandEmpty>No items found.</CommandEmpty>
                                          <CommandGroup>
                                              {selectedPOItems
                                                .filter(item => !workFields.some(f => f.boqItemId === item.id))
                                                .map(item => (
                                                  <CommandItem key={item.id} value={`${item.description} ${item.puNo}`} onSelect={() => handleAddWorkItems([{id: `daw-${Date.now()}`, boqItemId: item.id, quantity: 0}])}>
                                                      <Check className={cn("mr-2 h-4 w-4", workFields.some(f => f.boqItemId === item.id) ? "opacity-100" : "opacity-0")} />
                                                      <div className="flex flex-col">
                                                        <span>{item.description}</span>
                                                        <span className="text-xs text-muted-foreground">{item.puNo}</span>
                                                      </div>
                                                  </CommandItem>
                                              ))}
                                          </CommandGroup>
                                      </CommandList>
                                  </Command>
                              </PopoverContent>
                          </Popover>
                      )}
                  </div>
                  
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                      <Table>
                          <TableHeader className='sticky top-0 bg-secondary'>
                              <TableRow>
                                  <TableHead className="w-[120px]">PU No.</TableHead>
                                  <TableHead className="w-[40%]">Description</TableHead>
                                  {context !== 'Team' && <TableHead>Balance Qty</TableHead>}
                                  <TableHead>Quantity</TableHead>
                                  <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {workFields.length === 0 ? (
                                  <TableRow><TableCell colSpan={context === 'Team' ? 4 : 5} className="h-24 text-center text-muted-foreground">No work items added.</TableCell></TableRow>
                              ) : (
                                  workFields.map((field, index) => {
                                      const info = getItemInfo(field.boqItemId);
                                      const balanceInfo = boqInfoMap.get(field.boqItemId);
                                      return (
                                          <TableRow key={field.id}>
                                              <TableCell className='font-mono'>{info.puNo}</TableCell>
                                              <TableCell className="font-medium">{info.description}</TableCell>
                                              {context !== 'Team' && <TableCell>{balanceInfo ? `${balanceInfo.balance.toFixed(2)} ${balanceInfo.unit}`: 'N/A'}</TableCell>}
                                              <TableCell>
                                                  <div className="flex items-center gap-2">
                                                    <FormField
                                                        control={form.control}
                                                        name={`work.${index}.quantity`}
                                                        render={({ field }) => (
                                                            <Input type="number" step="0.01" {...field} className="h-8 w-28" />
                                                        )}
                                                    />
                                                    <span className='text-sm text-muted-foreground'>{info.unit}</span>
                                                  </div>
                                              </TableCell>
                                              <TableCell>
                                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeWork(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                              </TableCell>
                                          </TableRow>
                                      )
                                  })
                              )}
                          </TableBody>
                      </Table>
                  </div>
              </div>
              
              <div className="space-y-2 pt-4">
                  <div className='flex items-center justify-between'>
                      <h3 className="text-lg font-medium">{siteInstructionsHeader}</h3>
                      <Button type="button" variant="outline" onClick={() => handleOpenSiForm()} disabled={context==='Team' && !teamId}><PlusCircle className="mr-2 h-4 w-4" /> Add SI / Custom Work</Button>
                  </div>
                  
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                      <Table>
                          <TableHeader className='sticky top-0 bg-secondary'>
                              <TableRow>
                                  <TableHead className="w-[40%]">Description</TableHead>
                                  <TableHead>Qty</TableHead>
                                  <TableHead>Unit</TableHead>
                                  <TableHead>Rate</TableHead>
                                  <TableHead>Amount</TableHead>
                                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {siFields.length === 0 ? (
                                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No Site Instructions added.</TableCell></TableRow>
                              ) : (
                                  siFields.map((field, index) => (
                                      <TableRow key={field.id}>
                                          <TableCell className="font-medium">{field.description}</TableCell>
                                          <TableCell>{field.quantity}</TableCell>
                                          <TableCell>{field.unit}</TableCell>
                                          <TableCell>{field.rate}</TableCell>
                                          <TableCell>{field.amount}</TableCell>
                                          <TableCell className="text-right">
                                              <Button type="button" variant="ghost" size="icon" onClick={() => handleOpenSiForm(field, index)}><Pencil className="h-4 w-4" /></Button>
                                              <Button type="button" variant="ghost" size="icon" onClick={() => removeSi(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                          </TableCell>
                                      </TableRow>
                                  ))
                              )}
                          </TableBody>
                      </Table>
                  </div>
              </div>
          </div>

          <FormField
              control={form.control}
              name="work"
              render={({ fieldState }) => (
              fieldState.error?.message ? (
                  <Alert variant="destructive" className="py-2"><AlertDescription className="text-sm">{fieldState.error.message}</AlertDescription></Alert>
              ) : fieldState.error?.root?.message ? (
                  <Alert variant="destructive" className="py-2"><AlertDescription className="text-sm">{fieldState.error.root.message}</AlertDescription></Alert>
              ) : null
              )}
          />
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">{editingLog ? 'Save Changes' : 'Add Log'}</Button>
          </div>
        </form>
      </Form>
      
      <Dialog open={!!itemSelectorType} onOpenChange={(isOpen) => !isOpen && setItemSelectorType(null)}>
        {itemSelectorType === 'pu' && (
            <ItemSelectorDialog 
                title="Add Work from Plant Units"
                description="Select one or more Plant Units to log work against."
                items={availablePUsForTeam.map(pu => ({id: pu.id, description: pu.description, puId: pu.puId}))}
                onCancel={() => setItemSelectorType(null)}
                onAddItems={handleAddWorkItems}
                showClientFilter={true}
                plantUnits={plantUnits}
            />
        )}
        {itemSelectorType === 'boq' && (
            <ItemSelectorDialog
                title="Add Work from Engineering Budget"
                description="Select one or more budgeted engineering services."
                items={project.engineeringBoq.map(boq => ({id: boq.id, description: boq.description, puId: (plantUnitMap.get(boq.sourceId!)?.puId || 'N/A')}))}
                onCancel={() => setItemSelectorType(null)}
                onAddItems={handleAddWorkItems}
            />
        )}
      </Dialog>
      
      <Dialog open={isSiFormOpen} onOpenChange={setIsSiFormOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingSi ? 'Edit' : 'Add'} {siteInstructionsHeader}</DialogTitle>
            </DialogHeader>
            <SiteInstructionForm 
                project={project}
                editingSi={editingSi?.si}
                onSave={handleSaveSi}
                onCancel={() => setIsSiFormOpen(false)}
                plantUnits={plantUnits}
                context={siteInstructionsContext as 'Client' | 'Subcontractor' | 'Team'}
            />
        </DialogContent>
      </Dialog>
    </>
  );
}
