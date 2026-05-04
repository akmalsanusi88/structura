

'use client';

import type { PlantUnit, PlantUnitCategory, Company, Contract } from '@/lib/types';
import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Plus, MoreHorizontal, Edit, Trash2, Filter, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import PlantUnitForm from './plant-unit-form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { addPlantUnit, updatePlantUnit, deletePlantUnit, addOrUpdateDirectoryEntry } from '@/app/login/actions';
import { useParams, useRouter } from 'next/navigation';

type SortKey = keyof PlantUnit;

interface PlantUnitListProps {
    initialPlantUnits: PlantUnit[];
    directory: Company[];
    contracts: Contract[];
}

export default function PlantUnitList({ initialPlantUnits, directory, contracts }: PlantUnitListProps) {
  const [plantUnits, setPlantUnits] = useState<PlantUnit[]>(initialPlantUnits);
  const [activeTab, setActiveTab] = useState<PlantUnitCategory>('Client PU');
  const [selectedClient, setSelectedClient] = useState<string>('All Clients');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<PlantUnit | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [clientPuPage, setClientPuPage] = useState(1);
  const [engPuPage, setEngPuPage] = useState(1);
  const [matPuPage, setMatPuPage] = useState(1);
  const rowsPerPage = 25;
  
  const contractMap = useMemo(() => new Map(contracts.map(c => [c.id, c])), [contracts]);


  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
        return null;
    }
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };
  
  const sortAndFilterData = (data: PlantUnit[]) => {
      let sortableItems = [...data];
       if (sortConfig !== null) {
          sortableItems.sort((a, b) => {
              const aValue = a[sortConfig.key];
              const bValue = b[sortConfig.key];

              if (aValue === null || aValue === undefined) return 1;
              if (bValue === null || bValue === undefined) return -1;

              if (typeof aValue === 'number' && typeof bValue === 'number') {
                  return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
              }
              
              const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
              return sortConfig.direction === 'asc' ? comparison : -comparison;
          });
      }
      return sortableItems;
  }

  const uniqueClients = useMemo(() => {
    const clientPUs = plantUnits.filter(unit => unit.category === 'Client PU' && unit.clientName);
    return ['All Clients', ...Array.from(new Set(clientPUs.map(unit => unit.clientName!)))];
  }, [plantUnits]);

  const clientPUs = useMemo(() => {
    return sortAndFilterData(plantUnits
      .filter(unit => unit.category === 'Client PU')
      .filter(unit => selectedClient === 'All Clients' || unit.clientName === selectedClient)
      .filter(unit => 
        searchTerm === '' ||
        unit.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (unit.puId && unit.puId.toLowerCase().includes(searchTerm.toLowerCase()))
      ));
  }, [plantUnits, selectedClient, searchTerm, sortConfig]);

  const engineeringPUs = useMemo(() => {
      return sortAndFilterData(plantUnits.filter(unit => unit.category === 'Engineering Services PU')
      .filter(unit => 
        searchTerm === '' ||
        unit.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (unit.puId && unit.puId.toLowerCase().includes(searchTerm.toLowerCase()))
      ));
  }, [plantUnits, searchTerm, sortConfig]);

  const materialPUs = useMemo(() => {
      return sortAndFilterData(plantUnits.filter(unit => unit.category === 'Material PU')
      .filter(unit => 
        searchTerm === '' ||
        unit.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (unit.puId && unit.puId.toLowerCase().includes(searchTerm.toLowerCase()))
      ));
  }, [plantUnits, searchTerm, sortConfig]);
  
  const handleSaveUnit = async (unitData: PlantUnit) => {
    setIsFormOpen(false);
    
    // If a new client was created, add it to the directory first
    if (unitData.clientName && !directory.some(c => c.name === unitData.clientName)) {
        try {
            await addOrUpdateDirectoryEntry({ name: unitData.clientName }, companyId);
             toast({ title: 'New Client Added', description: `"${unitData.clientName}" has been added to the directory.` });
        } catch (error) {
            toast({ title: 'Error', description: 'Could not add new client to directory.', variant: 'destructive'});
            return; // Stop if we can't save the new client
        }
    }

    try {
        if (editingUnit) {
            await updatePlantUnit(unitData);
            setPlantUnits(prev => prev.map(u => u.id === unitData.id ? unitData : u));
            toast({ title: 'Success', description: 'Plant unit updated successfully.' });
        } else {
            const { id, companyId: _companyId, ...newUnitData } = unitData;
            await addPlantUnit(newUnitData, companyId);
            toast({ title: 'Success', description: 'Plant unit created successfully. Page will refresh.' });
        }
        router.refresh();
    } catch (error) {
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save plant unit.', variant: 'destructive' });
    } finally {
        setEditingUnit(undefined);
    }
  };
  
  const handleDeleteUnit = async (unitId: string) => {
      try {
          await deletePlantUnit(unitId, companyId);
          setPlantUnits(prev => prev.filter(u => u.id !== unitId));
          toast({ title: 'Success', description: 'Plant unit deleted.' });
      } catch (error) {
          toast({ title: 'Error', description: 'Failed to delete plant unit.', variant: 'destructive' });
      }
  }

  const openEditDialog = (unit: PlantUnit) => {
    setEditingUnit(unit);
    setIsFormOpen(true);
  }

  const openNewDialog = () => {
    setEditingUnit(undefined);
    setIsFormOpen(true);
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const renderTable = (units: PlantUnit[], category: PlantUnitCategory) => {
    const [currentPage, setCurrentPage] = (() => {
        switch (category) {
            case 'Client PU': return [clientPuPage, setClientPuPage];
            case 'Engineering Services PU': return [engPuPage, setEngPuPage];
            case 'Material PU': return [matPuPage, setMatPuPage];
            default: return [1, () => {}];
        }
    })();

    const totalPages = Math.ceil(units.length / rowsPerPage);
    const paginatedUnits = units.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    const handleNextPage = () => goToPage(currentPage + 1);
    const handlePrevPage = () => goToPage(currentPage - 1);
    const goToFirstPage = () => setCurrentPage(1);
    const goToLastPage = () => goToPage(totalPages);

    return (
        <div>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className='p-0'><Button variant="ghost" className='w-full justify-start px-4' onClick={() => requestSort('puId')}>PU ID {getSortIcon('puId')}</Button></TableHead>
                            {category === 'Client PU' && <TableHead className='p-0'><Button variant="ghost" className='w-full justify-start px-4' onClick={() => requestSort('clientName')}>Client Name {getSortIcon('clientName')}</Button></TableHead>}
                            {category === 'Client PU' && <TableHead className='p-0'><Button variant="ghost" className='w-full justify-start px-4' onClick={() => requestSort('contractId')}>Contract No. {getSortIcon('contractId')}</Button></TableHead>}
                            <TableHead className='p-0'><Button variant="ghost" className='w-full justify-start px-4' onClick={() => requestSort('description')}>PU Description {getSortIcon('description')}</Button></TableHead>
                            <TableHead className='p-0'><Button variant="ghost" className='w-full justify-start px-4' onClick={() => requestSort('unit')}>Unit {getSortIcon('unit')}</Button></TableHead>
                            <TableHead className='p-0'><Button variant="ghost" className='w-full justify-start px-4' onClick={() => requestSort('rate')}>Rate {getSortIcon('rate')}</Button></TableHead>
                            {category === 'Client PU' && <TableHead className='p-0'><Button variant="ghost" className='w-full justify-start px-4' onClick={() => requestSort('materialManagementFee')}>Mngmt. Fee {getSortIcon('materialManagementFee')}</Button></TableHead>}
                             {category === 'Material PU' && <TableHead className='p-0'><Button variant="ghost" className='w-full justify-start px-4' onClick={() => requestSort('hasSerialNo')}>Has Serial {getSortIcon('hasSerialNo')}</Button></TableHead>}
                            <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedUnits.map((unit) => (
                        <TableRow key={unit.id}>
                            <TableCell className="font-mono py-2 px-4">{unit.puId}</TableCell>
                            {category === 'Client PU' && <TableCell className="font-medium text-primary py-2 px-4">{unit.clientName}</TableCell>}
                            {category === 'Client PU' && <TableCell className="text-muted-foreground py-2 px-4">{unit.contractId ? contractMap.get(unit.contractId)?.contractNo : 'Common'}</TableCell>}
                            <TableCell className="font-medium py-2 px-4">{unit.description}</TableCell>
                            <TableCell className="py-2 px-4">{unit.unit}</TableCell>
                            <TableCell className="py-2 px-4">{formatCurrency(unit.rate)}</TableCell>
                            {category === 'Client PU' && <TableCell className="py-2 px-4">{unit.materialManagementFee ? 'Yes' : 'No'}</TableCell>}
                            {category === 'Material PU' && <TableCell className="py-2 px-4">{unit.hasSerialNo ? 'Yes' : 'No'}</TableCell>}
                            <TableCell className="py-2 px-4 text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => openEditDialog(unit)}>
                                    <Edit className="mr-2 h-4 w-4"/> Edit
                                </DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors">
                                            <Trash2 className="mr-2 h-4 w-4"/> Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the plant unit.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteUnit(unit.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-end w-full space-x-4 pt-4">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1}>
                            First
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                            Previous
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages}>
                            Next
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage >= totalPages}>
                            Last
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Plant Units</h1>
            <p className="text-muted-foreground">Manage your company's plant units and assets.</p>
          </div>
          <Button onClick={openNewDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Plant Unit
          </Button>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>All Plant Units</CardTitle>
                <CardDescription>A list of all registered plant units, categorized by type.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by description or PU ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>
                <Tabs defaultValue="Client PU" onValueChange={(value) => setActiveTab(value as PlantUnitCategory)}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="Client PU">Client PU</TabsTrigger>
                        <TabsTrigger value="Engineering Services PU">Engineering Services PU</TabsTrigger>
                        <TabsTrigger value="Material PU">Material PU</TabsTrigger>
                    </TabsList>
                    <TabsContent value="Client PU" className="space-y-4">
                        <div className="flex items-center gap-2 max-w-xs">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={selectedClient} onValueChange={setSelectedClient}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by Client..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniqueClients.map(client => (
                                        <SelectItem key={client} value={client}>{client}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {renderTable(clientPUs, 'Client PU')}
                    </TabsContent>
                    <TabsContent value="Engineering Services PU">
                        {renderTable(engineeringPUs, 'Engineering Services PU')}
                    </TabsContent>
                    <TabsContent value="Material PU">
                        {renderTable(materialPUs, 'Material PU')}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
      </main>

      <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setEditingUnit(undefined); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline">{editingUnit ? 'Edit' : 'Create'} Plant Unit</DialogTitle>
            <DialogDescription>
                Fill in the details for the plant unit.
            </DialogDescription>
          </DialogHeader>
          <PlantUnitForm 
            plantUnit={editingUnit}
            onSave={handleSaveUnit} 
            onCancel={() => { setIsFormOpen(false); setEditingUnit(undefined); }}
            directory={directory}
            contracts={contracts}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
