
'use client';

import type { StockTake, PlantUnit } from '@/lib/types';
import { useState, useMemo, Fragment, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, ChevronDown, FileDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { deleteStockTake } from '@/app/login/actions';
import { createClient } from '@/lib/supabase/client';
import StockTakeForm from '../stock-take-form';


interface StockTakeListProps {
  initialStockTakes: StockTake[];
  allPlantUnits: PlantUnit[];
  stockBalanceData: any[]; // Simplified for prop drilling
}

type SortKey = 'puId' | 'description' | 'countedQuantity';

function StockTakeDetail({ st, plantUnitMap }: { st: StockTake, plantUnitMap: Map<string, PlantUnit> }) {
  const [detailSortConfig, setDetailSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const sortedItems = useMemo(() => {
    let items = st.items.map(item => ({
      ...item,
      puId: plantUnitMap.get(item.sourceId)?.puId || 'N/A',
      description: plantUnitMap.get(item.sourceId)?.description || 'Unknown Material',
    }));
    if (detailSortConfig) {
      items.sort((a, b) => {
        const aValue = a[detailSortConfig.key];
        const bValue = b[detailSortConfig.key];
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return detailSortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return detailSortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return 0;
      });
    }
    return items;
  }, [st.items, detailSortConfig, plantUnitMap]);

  const requestDetailSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (detailSortConfig && detailSortConfig.key === key && detailSortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setDetailSortConfig({ key, direction });
  };
  
  const getDetailSortIcon = (key: SortKey) => {
    if (!detailSortConfig || detailSortConfig.key !== key) return null;
    return detailSortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const renderSortableDetailHeader = (label: string, sortKey: SortKey, className = "") => (
    <TableHead className={className}>
        <Button variant="ghost" onClick={(e) => {e.stopPropagation(); requestDetailSort(sortKey)}} className="px-0">
            {label} {getDetailSortIcon(sortKey)}
        </Button>
    </TableHead>
  );

  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            {renderSortableDetailHeader("PU ID", "puId")}
            {renderSortableDetailHeader("Material", "description")}
            {renderSortableDetailHeader("Counted Quantity", "countedQuantity", "text-right")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map(item => {
            const plantUnit = plantUnitMap.get(item.sourceId);
            return (
                <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.puId}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.countedQuantity.toFixed(2)} {plantUnit?.unit}</TableCell>
                </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default function StockTakeList({ initialStockTakes, allPlantUnits, stockBalanceData }: StockTakeListProps) {
  const [stockTakes, setStockTakes] = useState<StockTake[]>(initialStockTakes);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStockTake, setEditingStockTake] = useState<StockTake | undefined>(undefined);
  

  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;
  const { toast } = useToast();

  const plantUnitMap = useMemo(() => new Map(allPlantUnits.map(pu => [pu.id, pu])), [allPlantUnits]);

  useEffect(() => {
    setStockTakes(initialStockTakes);
  }, [initialStockTakes]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`stock_takes:${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_takes', filter: `company_id=eq.${companyId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: newRecord, error } = await supabase
              .from('stock_takes')
              .select('*, stock_take_items(*)')
              .eq('id', payload.new.id)
              .single();

            if (newRecord && !error) {
                const newStockTake: StockTake = {
                    id: newRecord.id,
                    companyId: newRecord.company_id,
                    name: newRecord.name,
                    takeDate: newRecord.take_date,
                    items: (newRecord.stock_take_items || []).map((item: any) => ({
                      id: item.id,
                      stockTakeId: item.stock_take_id,
                      sourceId: item.source_id,
                      countedQuantity: item.counted_quantity,
                      serials: item.serials || [],
                    }))
                };
              setStockTakes(current => [newStockTake, ...current].sort((a,b) => new Date(b.takeDate).getTime() - new Date(a.takeDate).getTime()));
            }
          } else if (payload.eventType === 'UPDATE') {
              const { data: updatedRecord, error } = await supabase
              .from('stock_takes')
              .select('*, stock_take_items(*)')
              .eq('id', payload.new.id)
              .single();

            if (updatedRecord && !error) {
                const updatedStockTake: StockTake = {
                    id: updatedRecord.id,
                    companyId: updatedRecord.company_id,
                    name: updatedRecord.name,
                    takeDate: updatedRecord.take_date,
                    items: (updatedRecord.stock_take_items || []).map((item: any) => ({
                      id: item.id,
                      stockTakeId: item.stock_take_id,
                      sourceId: item.source_id,
                      countedQuantity: item.counted_quantity,
                      serials: item.serials || [],
                    }))
                };
                setStockTakes(current => current.map(st => st.id === updatedStockTake.id ? updatedStockTake : st));
            }
          } else if (payload.eventType === 'DELETE') {
            setStockTakes(current => current.filter(st => st.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  const handleDelete = async (id: string) => {
    try {
      await deleteStockTake(id, companyId);
      toast({ title: "Success", description: "Stock take record has been deleted." });
    } catch (error) {
      console.error("Failed to delete stock take:", error);
      toast({ title: "Error", description: "Could not delete stock take record.", variant: "destructive" });
    }
  };

  const handleOpenForm = (stockTake?: StockTake) => {
    setEditingStockTake(stockTake);
    setIsFormOpen(true);
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingStockTake(undefined);
  };

  const handleExportSingleExcel = async (st: StockTake) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // The data preparation for Excel should use the same logic as the displayed table.
    // Since sorting state is inside StockTakeDetail, we can't directly access it.
    // For now, we will export with default sorting. A more complex solution would lift state up.
     const sheetData: any[] = [];
    sheetData.push({ A: 'Stock Take Name:', B: st.name });
    sheetData.push({ A: 'Date:', B: format(parseISO(st.takeDate), 'dd MMM yyyy') });
    sheetData.push({});
    sheetData.push({ A: 'PU ID', B: 'Material', C: 'Counted Quantity', D: 'Unit' });

    st.items.forEach(item => {
      const plantUnit = plantUnitMap.get(item.sourceId);
      const hasSerials = item.serials && item.serials.length > 0 && item.serials.some(s => s.quantity > 0);
      sheetData.push({
        A: plantUnit?.puId || 'N/A',
        B: plantUnit?.description || 'Unknown Material',
        C: item.countedQuantity,
        D: plantUnit?.unit || 'N/A'
      });

      if (hasSerials) {
          sheetData.push({ B: 'Serial Number', C: 'Quantity' });
          item.serials!.forEach(serial => {
            if (serial.quantity > 0) {
              sheetData.push({ B: `  ${serial.serialNo || 'N/A'}`, C: serial.quantity });
            }
          });
      }
    });

    const ws = XLSX.utils.json_to_sheet(sheetData, { skipHeader: true });
    const sheetName = st.name.replace(/[\\/*?:"<>|]/g, '').substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    XLSX.writeFile(wb, `${st.name}.xlsx`);
    toast({ title: "Export Successful", description: `Stock take "${st.name}" has been exported.` });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stock Take History</CardTitle>
              <CardDescription>Records of all physical stock counts.</CardDescription>
            </div>
             <Button onClick={() => handleOpenForm()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Stock Take
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Items Counted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockTakes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">No stock takes recorded.</TableCell></TableRow>
                ) : (
                  stockTakes.map(st => {
                    const isExpanded = expandedRows.has(st.id);
                    return (
                      <Fragment key={st.id}>
                        <TableRow onClick={() => toggleRow(st.id)} className="cursor-pointer">
                          <TableCell className="py-2 px-4">
                              <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                          </TableCell>
                          <TableCell className="font-medium py-2 px-4">{format(parseISO(st.takeDate), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="py-2 px-4">{st.name}</TableCell>
                          <TableCell className="py-2 px-4">{st.items.length}</TableCell>
                          <TableCell className="text-right py-2 px-4">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                     <DropdownMenuItem onSelect={() => handleOpenForm(st)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                     <DropdownMenuItem onSelect={() => handleExportSingleExcel(st)}>
                                        <FileDown className="mr-2 h-4 w-4" /> Export Excel
                                    </DropdownMenuItem>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors" onClick={(e) => e.stopPropagation()}>
                                                <Trash2 className="mr-2 h-4 w-4"/> Delete
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete "{st.name}".</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(st.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                           <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={5} className="p-0">
                                <StockTakeDetail st={st} plantUnitMap={plantUnitMap} />
                              </TableCell>
                           </TableRow>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle className="font-headline">{editingStockTake ? 'Edit' : 'Create New'} Stock Take</DialogTitle>
                <DialogDescription>
                    {editingStockTake ? `Update the physical count for "${editingStockTake.name}".` : 'Enter the physical count for each material.'}
                </DialogDescription>
            </DialogHeader>
            <StockTakeForm
                stockTake={editingStockTake}
                stockBalanceData={stockBalanceData}
                allPlantUnits={allPlantUnits}
                onCancel={handleCloseForm}
            />
        </DialogContent>
      </Dialog>
    </>
  );
}
