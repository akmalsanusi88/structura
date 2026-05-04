
'use client';

import type { StockTake, PlantUnit } from '@/lib/types';
import { useState, useMemo, Fragment, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, ChevronDown } from 'lucide-react';
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

  const handleOpenForm = (stockTakeToEdit?: StockTake) => {
    setEditingStockTake(stockTakeToEdit);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingStockTake(undefined);
  };

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
                                <div className="p-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>PU ID</TableHead>
                                        <TableHead>Material</TableHead>
                                        <TableHead className="text-right">Counted Quantity</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {st.items.map(item => {
                                        const plantUnit = plantUnitMap.get(item.sourceId);
                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-mono">{plantUnit?.puId || 'N/A'}</TableCell>
                                                <TableCell>{plantUnit?.description || 'Unknown Material'}</TableCell>
                                                <TableCell className="text-right">{item.countedQuantity.toFixed(2)} {plantUnit?.unit}</TableCell>
                                            </TableRow>
                                        )
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
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
