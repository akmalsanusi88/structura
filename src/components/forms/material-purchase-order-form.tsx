
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Project, PlantUnit, Company, MaterialPurchaseOrder, MaterialPurchaseOrderItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, Check, ChevronsUpDown, Search } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useParams } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const poItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  unit: z.string(),
  rate: z.coerce.number(),
  quantity: z.coerce.number().min(0.01, "Quantity must be > 0"),
  sourceId: z.string(),
});

const poSchema = z.object({
  poNo: z.string().min(1, "PO Number is required"),
  poDate: z.date({ required_error: "PO Date is required." }),
  supplier: z.string().min(1, "Supplier name is required"),
  items: z.array(poItemSchema).min(1, "At least one item is required in the PO."),
  deliveryCost: z.coerce.number().optional(),
  refQuotationNo: z.string().optional(),
  projectId: z.string().nullable().optional(),
  projectName: z.string().optional(),
  projectNo: z.string().optional(),
  projectPoNo: z.string().optional(),
  sstPercentage: z.coerce.number().optional(),
  includeDeliveryInSst: z.boolean().default(true),
});

type MaterialPurchaseOrderFormValues = z.infer<typeof poSchema>;

const customItemFormSchema = z.object({
  puId: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  unit: z.string().min(1, "Unit is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be > 0"),
  rate: z.coerce.number().min(0, "Rate must be non-negative"),
});
type CustomItemFormValues = z.infer<typeof customItemFormSchema>;

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

function CustomItemForm({
  onAddItem,
  onCancel,
}: {
  onAddItem: (item: MaterialPurchaseOrderItem) => void;
  onCancel: () => void;
}) {
  const form = useForm<CustomItemFormValues>({
    resolver: zodResolver(customItemFormSchema),
    defaultValues: {
      puId: "",
      description: "",
      unit: "",
      quantity: 1,
      rate: 0,
    },
  });
  
  const onSubmit = (data: CustomItemFormValues) => {
    const newItem: MaterialPurchaseOrderItem = {
      id: `poi-custom-${Date.now()}-${Math.random()}`,
      sourceId: data.puId || `custom-${Date.now()}`,
      description: data.description,
      unit: data.unit,
      rate: data.rate || 0,
      quantity: data.quantity,
    };
    onAddItem(newItem);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="puId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PU ID (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter a reference PU number" {...field} />
              </FormControl>
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
                <Input placeholder="e.g., Cement Bag 50kg" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input type="number" step="any" placeholder="1.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., bag, ton" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate (RM)</FormLabel>
                <FormControl>
                  <Input type="number" step="any" placeholder="100.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Add Item</Button>
        </div>
      </form>
    </Form>
  )
}


interface MaterialPurchaseOrderFormProps {
  purchaseOrder?: MaterialPurchaseOrder;
  onSave: (data: MaterialPurchaseOrder) => void;
  onCancel: () => void;
  plantUnits: PlantUnit[];
  allCompanies: Company[];
  allProjects: Project[];
}

export default function MaterialPurchaseOrderForm({ purchaseOrder, onSave, onCancel, plantUnits, allCompanies, allProjects }: MaterialPurchaseOrderFormProps) {
  const params = useParams();
  const companyId = params.companyId as string;
  
  const [isSstEnabled, setIsSstEnabled] = useState(purchaseOrder?.sstPercentage ? purchaseOrder.sstPercentage > 0 : false);

  const form = useForm<MaterialPurchaseOrderFormValues>({
    resolver: zodResolver(poSchema),
    defaultValues: purchaseOrder ? {
        ...purchaseOrder,
        poDate: parseISO(purchaseOrder.poDate),
        deliveryCost: purchaseOrder.deliveryCost || 0,
        refQuotationNo: purchaseOrder.refQuotationNo || '',
        projectId: purchaseOrder.projectId || '',
        projectName: purchaseOrder.projectName || '',
        projectNo: purchaseOrder.projectNo || '',
        projectPoNo: purchaseOrder.projectPoNo || '',
        sstPercentage: purchaseOrder.sstPercentage || 0,
        includeDeliveryInSst: purchaseOrder.includeDeliveryInSst ?? true,
    } : {
        poNo: '',
        poDate: new Date(),
        supplier: '',
        items: [],
        deliveryCost: 0,
        refQuotationNo: '',
        projectId: '',
        projectName: '',
        projectNo: '',
        projectPoNo: '',
        sstPercentage: 0,
        includeDeliveryInSst: true,
    }
  });

  const { control, setValue, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });
  
  const watchedItems = useWatch({ control, name: 'items' });
  const deliveryCost = useWatch({ control, name: 'deliveryCost' });
  const sstPercentage = useWatch({ control, name: 'sstPercentage' });
  const includeDeliveryInSst = useWatch({ control, name: 'includeDeliveryInSst' });
  const selectedProjectId = watch('projectId');

  const [isPuSelectorOpen, setIsPuSelectorOpen] = useState(false);
  const [isCustomItemDialogOpen, setIsCustomItemDialogOpen] = useState(false);
  
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [supplierSearchValue, setSupplierSearchValue] = useState("");
  
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);
  
  const selectedIds = useMemo(() => new Set(fields.map(field => field.sourceId)), [fields]);

  const availableMaterialPus = useMemo(() => {
    if (!plantUnits) return [];
    return plantUnits.filter((pu): pu is PlantUnit => 
      !!(pu && pu.id && pu.category === 'Material PU' && !selectedIds.has(pu.id))
    );
  }, [plantUnits, selectedIds]);
  
  const availableSuppliers = useMemo(() => {
    if (!allCompanies || !companyId) return [];
    return allCompanies.filter(c => c.id !== companyId);
  }, [allCompanies, companyId]);

  const supplierNameExists = useMemo(() => 
    availableSuppliers.some(c => c.name.toLowerCase() === supplierSearchValue.toLowerCase()),
    [availableSuppliers, supplierSearchValue]
  );
  
  useEffect(() => {
      if (selectedProjectId) {
          const project = allProjects.find(p => p.id === selectedProjectId);
          if (project) {
              setValue('projectName', project.name);
              setValue('projectNo', project.projectNo || '');
              
              const clientPo = project.purchaseOrders.find(po => po.type === 'Client');
              if (clientPo) {
                  setValue('projectPoNo', clientPo.poNo);
              } else {
                  setValue('projectPoNo', '');
              }
          }
      } else {
            setValue('projectName', '');
            setValue('projectNo', '');
            setValue('projectPoNo', '');
      }
  }, [selectedProjectId, allProjects, setValue]);
  

  const handleAddItems = (newItems: MaterialPurchaseOrderItem[]) => {
      append(newItems);
  };

  const totals = useMemo(() => {
    const itemsTotal = (watchedItems || []).reduce((acc, item) => acc + (item.quantity * (item.rate || 0)), 0);
    const delCost = (Number(deliveryCost) || 0);
    
    const sstRate = isSstEnabled ? Number(sstPercentage) || 0 : 0;
    
    let sstBase = itemsTotal;
    if (includeDeliveryInSst) {
        sstBase += delCost;
    }
    
    const sstAmount = sstBase * (sstRate / 100);
    
    return {
        itemsTotal,
        subtotal: itemsTotal + delCost,
        sstAmount,
        totalAmount: itemsTotal + delCost + sstAmount
    };
  }, [watchedItems, deliveryCost, sstPercentage, isSstEnabled, includeDeliveryInSst]);

  const onSubmit = (data: MaterialPurchaseOrderFormValues) => {
    const finalData: MaterialPurchaseOrder = {
      id: purchaseOrder?.id || `mpo-${Date.now()}`,
      companyId: companyId,
      poNo: data.poNo,
      poDate: format(data.poDate, 'yyyy-MM-dd'),
      supplier: data.supplier,
      items: data.items,
      deliveryCost: data.deliveryCost,
      refQuotationNo: data.refQuotationNo,
      projectId: data.projectId,
      projectName: data.projectName,
      projectNo: data.projectNo,
      projectPoNo: data.projectPoNo,
      sstPercentage: isSstEnabled ? data.sstPercentage : 0,
      includeDeliveryInSst: data.includeDeliveryInSst,
    };
    onSave(finalData);
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="space-y-4 lg:col-span-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 items-start">
                  <FormField
                    control={control}
                    name="poNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PO Number</FormLabel>
                        <FormControl><Input placeholder="Enter PO Number" {...field} className="h-9" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={control}
                    name="poDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col pt-2">
                        <FormLabel>PO Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !field.value && "text-muted-foreground")}>
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
                  <FormField
                      control={form.control}
                      name="supplier"
                      render={({ field }) => (
                          <FormItem className="flex flex-col pt-2 col-span-2">
                          <FormLabel>Supplier</FormLabel>
                          <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                              <PopoverTrigger asChild>
                              <FormControl>
                                  <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn("w-full justify-between h-9", !field.value && "text-muted-foreground")}
                                  >
                                  <span className='truncate'>{field.value || "Select or add a supplier"}</span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                              </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                                  <CommandInput 
                                      placeholder="Search suppliers..."
                                      value={supplierSearchValue}
                                      onValueChange={setSupplierSearchValue}
                                  />
                                  <CommandList>
                                  <CommandEmpty>No results found.</CommandEmpty>
                                  <CommandGroup>
                                      {supplierSearchValue && !supplierNameExists && (
                                      <CommandItem
                                          key="add-new-supplier"
                                          value={supplierSearchValue}
                                          onSelect={() => {
                                          field.onChange(supplierSearchValue);
                                          setSupplierPopoverOpen(false);
                                          setSupplierSearchValue('');
                                          }}
                                      >
                                          <PlusCircle className="mr-2 h-4 w-4" />
                                          <span>Add: "{supplierSearchValue}"</span>
                                      </CommandItem>
                                      )}
                                      {availableSuppliers.map((company) => (
                                      <CommandItem value={company.name} key={company.id} onSelect={() => {field.onChange(company.name); setSupplierPopoverOpen(false); setSupplierSearchValue('');}}>
                                          <Check className={cn("mr-2 h-4 w-4", company.name === field.value ? "opacity-100" : "opacity-0")} />
                                          {company.name}
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
                  <FormField control={control} name="refQuotationNo" render={({ field }) => (
                      <FormItem className='pt-2 col-span-2'>
                      <FormLabel>Ref. Quotation No.</FormLabel>
                      <FormControl><Input placeholder="Optional" {...field} className="h-9" /></FormControl>
                      <FormMessage />
                      </FormItem>
                  )} />
              </div>
              <Card className='mt-6 bg-muted/20'>
                <CardHeader><CardTitle className="text-lg">Project Link (Optional)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Project</FormLabel>
                        <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                           <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn("w-full justify-between truncate h-9", !field.value && "text-muted-foreground")}
                                >
                                  <span className="truncate">
                                    {field.value
                                      ? allProjects.find((p) => p.id === field.value)?.name
                                      : "None (General PO)"}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                           <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                             <Command>
                               <CommandInput placeholder="Search projects..." value={projectSearch} onValueChange={setProjectSearch} />
                               <CommandList>
                                 <CommandEmpty>No projects found.</CommandEmpty>
                                 <CommandGroup>
                                   <CommandItem
                                      key="none"
                                      value="none"
                                      onSelect={() => {
                                        field.onChange(null);
                                        setProjectPopoverOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100" : "opacity-0")} />
                                      None (General PO)
                                    </CommandItem>
                                   {allProjects.map((p) => (
                                     <CommandItem
                                       value={p.name}
                                       key={p.id}
                                       onSelect={() => {
                                         field.onChange(p.id);
                                         setProjectPopoverOpen(false);
                                       }}
                                     >
                                       <Check className={cn("mr-2 h-4 w-4", p.id === field.value ? "opacity-100" : "opacity-0")} />
                                       {p.name}
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
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <FormField control={control} name="projectName" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project Name</FormLabel>
                            <FormControl><Input {...field} disabled /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={control} name="projectNo" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project No.</FormLabel>
                            <FormControl><Input {...field} disabled /></FormControl>
                        </FormItem>
                    )} />
                  </div>
                   <FormField control={control} name="projectPoNo" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project PO No.</FormLabel>
                            <FormControl><Input {...field} disabled /></FormControl>
                        </FormItem>
                    )} />
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-4 flex flex-col lg:col-span-3">
              <h3 className="text-lg font-medium">PO Items</h3>
              <ScrollArea className="h-96 rounded-md border flex-grow">
                <div className="relative overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PU ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => {
                        const item = watch(`items.${index}`);
                        const puNo = plantUnitMap.get(item.sourceId)?.puId || (item.sourceId.startsWith('custom-') ? 'Custom' : item.sourceId);
                        return (
                          <TableRow key={field.id}>
                            <TableCell className='font-mono text-xs'>{puNo}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>
                                <Controller
                                    control={control}
                                    name={`items.${index}.quantity`}
                                    render={({ field: qtyField }) => (
                                        <Input type="number" {...qtyField} className="h-8 w-24" onChange={(e) => qtyField.onChange(parseFloat(e.target.value) || 0)} />
                                    )}
                                />
                            </TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell>
                                <Controller
                                    control={control}
                                    name={`items.${index}.rate`}
                                    render={({ field: rateField }) => (
                                        <Input type="number" step="0.01" {...rateField} className="h-8 w-28" onChange={(e) => rateField.onChange(parseFloat(e.target.value) || 0)} />
                                    )}
                                />
                            </TableCell>
                            <TableCell>{formatCurrency((item.rate || 0) * (item.quantity || 0))}</TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {fields.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                            No items added yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCustomItemDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Custom</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPuSelectorOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> From PUs</Button>
              </div>
              
              <div className="flex-grow"></div>
              
              <div className="grid grid-cols-1 gap-4 pt-4 border-t">
                <div className='flex flex-wrap items-end gap-x-6 gap-y-4'>
                    <FormField control={control} name="deliveryCost" render={({ field }) => (
                        <FormItem className='w-48'>
                            <FormLabel>Delivery Cost (RM)</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        </FormItem>
                    )} />
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-1">
                            <Switch id="sst-enabled" checked={isSstEnabled} onCheckedChange={setIsSstEnabled} />
                            <Label htmlFor="sst-enabled">Enable SST</Label>
                            {isSstEnabled && (
                                <FormField
                                    control={control}
                                    name="sstPercentage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input type="number" step="0.1" placeholder="6" {...field} className="h-9 w-20 ml-2" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                        {isSstEnabled && (
                            <FormField
                                control={control}
                                name="includeDeliveryInSst"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <Label className="text-xs font-normal cursor-pointer">Apply SST to Delivery Cost</Label>
                                    </FormItem>
                                )}
                            />
                        )}
                    </div>
                    <div className="ml-auto text-right">
                        {isSstEnabled && (
                            <div className="text-sm text-muted-foreground mb-1">
                                SST ({sstPercentage}%): {formatCurrency(totals.sstAmount)}
                            </div>
                        )}
                        <div className="text-lg font-bold">
                            Total Amount: {formatCurrency(totals.totalAmount)}
                        </div>
                    </div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-5">
              <FormField
                control={control}
                name="items"
                render={() => <FormMessage />}
              />
              <div className="flex justify-end gap-2 pt-6 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit">Save PO</Button>
              </div>
            </div>

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
      
      <Dialog open={isCustomItemDialogOpen} onOpenChange={setIsCustomItemDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Add Custom PO Item</DialogTitle>
                  <DialogDescription>Manually enter the details for a new item.</DialogDescription>
              </DialogHeader>
              <CustomItemForm
                  onAddItem={(item) => {
                      append(item);
                      setIsCustomItemDialogOpen(false);
                  }}
                  onCancel={() => setIsCustomItemDialogOpen(false)}
              />
          </DialogContent>
      </Dialog>
    </>
  );
}

function PUSelectorDialog({
    onCancel,
    onAddItems,
    availablePlantUnits,
}: {
    onCancel: () => void;
    onAddItems: (items: MaterialPurchaseOrderItem[]) => void;
    availablePlantUnits: PlantUnit[];
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPuIds, setSelectedPuIds] = useState<Set<string>>(new Set());
    
    const filteredPus = useMemo(() => {
        if (!availablePlantUnits) return [];
        return availablePlantUnits.filter(pu => {
            if (!pu) return false;
            const searchMatch = searchTerm === '' || 
                                (pu.description && pu.description.toLowerCase().includes(searchTerm.toLowerCase())) || 
                                (pu.puId && pu.puId.toLowerCase().includes(searchTerm.toLowerCase()));
            return searchMatch;
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
                id: `poi-pu-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                description: item.description,
                unit: item.unit,
                rate: item.rate,
                quantity: 1, 
                sourceId: item.id,
            }));
        onAddItems(itemsToAdd);
        onCancel();
    };
    
    const formatCurrencyLocal = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

    return (
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Add from Material Plant Units</DialogTitle>
                <DialogDescription>Select one or more materials to add to the Purchase Order.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or PU ID..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
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
                            <TableHead>PU No.</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredPus.map(pu => (
                            <TableRow key={pu.id}>
                                <TableCell><Checkbox checked={selectedPuIds.has(pu.id)} onCheckedChange={() => handleToggleSelect(pu.id)} /></TableCell>
                                <TableCell className="font-mono">{pu.puId}</TableCell>
                                <TableCell>{pu.description}</TableCell>
                                <TableCell>{pu.unit}</TableCell>
                                <TableCell className='text-right'>{formatCurrencyLocal(pu.rate)}</TableCell>
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
