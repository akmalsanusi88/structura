

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
import type { Project, MaterialRequisition, PlantUnit, MaterialRequisitionItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Search } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';


const requisitionItemSchema = z.object({
  sourceId: z.string(),
  description: z.string().min(1, "Description is required"),
  unit: z.string().min(1, "Unit is required"),
  boqQuantity: z.coerce.number().optional(),
  quantity: z.coerce.number().min(0, "Quantity cannot be negative").default(0),
});

const requisitionSchema = z.object({
  requisitionNo: z.string().min(1, "Requisition Number is required"),
  date: z.date({ required_error: "Date is required." }),
  items: z.array(requisitionItemSchema).refine(data => data.some(item => item.quantity > 0), {
    message: "At least one item must have a quantity.",
    path: ["items"],
  }),
});


type RequisitionFormValues = z.infer<typeof requisitionSchema>;

function PUSelectorDialog({
    onCancel,
    onAddItems,
    availablePlantUnits,
}: {
    onCancel: () => void;
    onAddItems: (items: MaterialRequisitionItem[]) => void;
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
                id: `mri-${Date.now()}-${item.id}`,
                sourceId: item.id,
                description: item.description,
                unit: item.unit,
                quantity: 1, // Default quantity
                boqQuantity: 0,
            }));
        onAddItems(itemsToAdd);
        onCancel();
    };
    
    return (
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Add from Material Plant Units</DialogTitle>
                <DialogDescription>Select one or more materials to add to the requisition.</DialogDescription>
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

interface MaterialRequisitionFormProps {
  project: Project;
  allRequisitions: string[];
  requisition?: MaterialRequisition;
  onSave: (data: MaterialRequisition) => void;
  onCancel: () => void;
  plantUnits: PlantUnit[];
  plantUnitMap: Map<string, PlantUnit>;
}

export default function MaterialRequisitionForm({ project, allRequisitions, requisition, onSave, onCancel, plantUnits, plantUnitMap }: MaterialRequisitionFormProps) {
  
  const generateNewReqNo = () => {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const prefix = `MR-${currentYear}-`;

    const reqNumbersForYear = allRequisitions
        .map(no => no)
        .filter((no): no is string => no !== null && no !== undefined && no.startsWith(prefix));

    let maxSerial = 0;
    if (reqNumbersForYear.length > 0) {
        const serials = reqNumbersForYear.map(no => parseInt(no.substring(prefix.length), 10));
        const validSerials = serials.filter(n => !isNaN(n));
        if (validSerials.length > 0) {
             maxSerial = Math.max(...validSerials);
        }
    }
    
    const nextSerial = maxSerial + 1;
    return `${prefix}${nextSerial.toString().padStart(4, '0')}`;
  };
  
  const defaultValues = useMemo(() => {
    const allBoqItems = project.materialBoq || [];
    if (requisition) { // Editing
        const reqItemsMap = new Map(requisition.items.map(item => [item.sourceId, item]));
        const budgetedItems = allBoqItems.map(boqItem => ({
            sourceId: boqItem.id,
            description: boqItem.description,
            unit: boqItem.unit,
            boqQuantity: boqItem.quantity,
            quantity: reqItemsMap.get(boqItem.id)?.quantity || 0,
        }));
        const customItems = requisition.items
            .filter(item => !allBoqItems.some(boq => boq.id === item.sourceId))
            .map(customItem => ({
                sourceId: customItem.sourceId,
                description: customItem.description,
                unit: customItem.unit,
                boqQuantity: 0,
                quantity: customItem.quantity,
            }));
        return {
            ...requisition,
            date: parseISO(requisition.date),
            items: [...budgetedItems, ...customItems]
        };
    }
    // New
    return {
        requisitionNo: generateNewReqNo(),
        date: new Date(),
        items: allBoqItems.map(boqItem => ({
            sourceId: boqItem.id,
            description: boqItem.description,
            unit: boqItem.unit,
            boqQuantity: boqItem.quantity,
            quantity: 0,
        }))
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, requisition]);
  
  const form = useForm<RequisitionFormValues>({
    resolver: zodResolver(requisitionSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items'
  });

  const [isPuSelectorOpen, setIsPuSelectorOpen] = useState(false);

  const selectedIds = useMemo(() => new Set(fields.map(field => field.sourceId)), [fields]);

  const availableMaterialPus = useMemo(() => {
    return plantUnits
        .filter(pu => pu.category === 'Material PU')
        .filter(pu => !selectedIds.has(pu.id));
  }, [plantUnits, selectedIds]);

  const handleAddItems = (newItems: MaterialRequisitionItem[]) => {
      append(newItems);
  }

  const onSubmit = (data: RequisitionFormValues) => {
    const finalItems = data.items
      .filter(item => item.quantity > 0)
      .map(item => ({
        id: `mri-${data.requisitionNo}-${item.sourceId}`,
        sourceId: item.sourceId,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
    }));

    const finalData: MaterialRequisition = {
      id: requisition?.id || `mr-${Date.now()}`,
      requisitionNo: data.requisitionNo,
      date: format(data.date, 'yyyy-MM-dd'),
      items: finalItems,
    };
    onSave(finalData);
  };

  const isFromBoq = (sourceId: string) => {
    return project.materialBoq?.some(item => item.id === sourceId);
  }

  const getPuId = (sourceId: string): string => {
    const boqItem = project.materialBoq.find(item => item.id === sourceId);
    if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
      return plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
    }
    return plantUnitMap.get(sourceId)?.puId || 'N/A';
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="requisitionNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requisition Number</FormLabel>
                  <FormControl><Input placeholder="Enter Requisition Number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
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
              <h3 className="text-lg font-medium">Requisition Items</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPuSelectorOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add from Material PUs
              </Button>
            </div>
              <ScrollArea className="h-96 border rounded-lg">
                  <Table>
                  <TableHeader className='sticky top-0 bg-secondary'>
                      <TableRow>
                      <TableHead className="w-[15%]">PU ID</TableHead>
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Budget Qty</TableHead>
                      <TableHead className="w-[150px]">Req. Qty</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {fields.length === 0 ? (
                      <TableRow>
                          <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                          No material items. Add from budget or PUs.
                          </TableCell>
                      </TableRow>
                      ) : fields.map((field, index) => (
                      <TableRow key={field.id}>
                          <TableCell className="font-mono">{getPuId(field.sourceId)}</TableCell>
                          <TableCell>
                            {field.description}
                            {!isFromBoq(field.sourceId) && <span className='text-xs text-muted-foreground ml-2'>(from PU)</span>}
                          </TableCell>
                          <TableCell>{field.unit}</TableCell>
                          <TableCell>{field.boqQuantity?.toFixed(2) ?? 'N/A'}</TableCell>
                          <TableCell>
                              <FormField
                                  control={form.control}
                                  name={`items.${index}.quantity`}
                                  render={({ field: qtyField }) => (
                                      <Input type="number" {...qtyField} className="h-8" />
                                  )}
                              />
                          </TableCell>
                          <TableCell>
                              {!isFromBoq(field.sourceId) && (
                                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                              )}
                          </TableCell>
                      </TableRow>
                      ))}
                  </TableBody>
                  </Table>
              </ScrollArea>
          </div>
          
          <FormField
              control={form.control}
              name="items"
              render={({ fieldState }) => (
                fieldState.error?.message && (
                  <Alert variant="destructive" className='py-2'>
                      <AlertDescription className="text-sm">{fieldState.error.message}</AlertDescription>
                  </Alert>
                )
              )}
            />


          <div className="flex justify-end gap-2 pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">Save Requisition</Button>
          </div>
        </form>
      </Form>
      
      <Dialog open={isPuSelectorOpen} onOpenChange={setIsPuSelectorOpen}>
          <PUSelectorDialog 
            onCancel={() => setIsPuSelectorOpen(false)}
            onAddItems={handleAddItems}
            availablePlantUnits={availableMaterialPus}
          />
      </Dialog>
    </>
  );
}






