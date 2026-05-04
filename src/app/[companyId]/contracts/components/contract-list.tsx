
'use client';

import type { Contract, Project, Company } from '@/lib/types';
import { useState, useMemo, Fragment } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, PlusCircle, MoreHorizontal, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ContractForm from './contract-form';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';
import { addOrUpdateContract, deleteContract } from '@/app/login/actions';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogCancel, AlertDialogAction, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogContent } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface ContractListProps {
  initialContracts: Contract[];
  directory: Company[];
}

export default function ContractList({ initialContracts, directory }: ContractListProps) {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredContracts = useMemo(() => {
    return initialContracts.filter(contract => 
        (contract.title && contract.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contract.clientName && contract.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (contract.contractNo && contract.contractNo.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a,b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
  }, [initialContracts, searchTerm]);

  const toggleRow = (contractId: string) => {
    setExpandedRows(prev => {
        const newSet = new Set(prev);
        if (newSet.has(contractId)) {
            newSet.delete(contractId);
        } else {
            newSet.add(contractId);
        }
        return newSet;
    });
  };

  const handleOpenForm = (contract?: Contract) => {
    setEditingContract(contract);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingContract(undefined);
  };

  const handleSaveContract = async (data: Omit<Contract, 'id' | 'companyId' | 'projects'>) => {
    const dataToSave = { ...editingContract, ...data };
    try {
        await addOrUpdateContract(dataToSave, companyId);
        toast({ title: 'Success', description: 'Contract saved successfully.'});
        handleCloseForm();
        router.refresh();
    } catch (error) {
        toast({ title: 'Error', description: `Failed to save contract. ${error instanceof Error ? error.message : ''}`, variant: 'destructive'});
    }
  };
  
  const handleDeleteContract = async (id: string) => {
      try {
        await deleteContract(id, companyId);
        toast({ title: 'Success', description: 'Contract deleted.'});
        router.refresh();
      } catch (error) {
         toast({ title: 'Error', description: `Failed to delete contract. ${error instanceof Error ? error.message : ''}`, variant: 'destructive'});
      }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
  };

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <CardTitle>Master Contracts</CardTitle>
                <CardDescription>A master list of all contracts received from your clients.</CardDescription>
            </div>
            <div className='flex items-center gap-4'>
                 <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by contract, client, or no..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Button onClick={() => handleOpenForm()}>
                    <PlusCircle className="mr-2 h-4 w-4"/> New Contract
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-8'></TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Contract No.</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">No contracts found.</TableCell>
                </TableRow>
              ) : (
                filteredContracts.map(contract => {
                  const isExpanded = expandedRows.has(contract.id);
                  const period = contract.startDate && contract.endDate ? `${format(parseISO(contract.startDate), 'dd/MM/yy')} - ${format(parseISO(contract.endDate), 'dd/MM/yy')}` : 'N/A';
                  
                  return (
                  <Fragment key={contract.id}>
                    <TableRow onClick={() => toggleRow(contract.id)} className="cursor-pointer">
                       <TableCell><ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} /></TableCell>
                      <TableCell className="font-medium">{contract.title}</TableCell>
                      <TableCell>{contract.clientName}</TableCell>
                      <TableCell className="font-mono">{contract.contractNo}</TableCell>
                      <TableCell className="text-right">{formatCurrency(contract.value)}</TableCell>
                      <TableCell>{period}</TableCell>
                      <TableCell><Badge>{contract.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => handleOpenForm(contract)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                            <Trash2 className="mr-2 h-4 w-4"/> Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this contract. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteContract(contract.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                         <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={8} className="p-0">
                                <div className='p-4'>
                                    <h4 className="font-semibold mb-2 ml-4 text-sm">Linked Projects</h4>
                                    {(contract.projects && contract.projects.length > 0) ? (
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Project Name</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {contract.projects.map(p => (
                                                    <TableRow key={p.id}>
                                                        <TableCell><Link href={`/${companyId}/projects/${p.id}`} className="text-primary hover:underline">{p.name}</Link></TableCell>
                                                        <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-4">No projects are linked to this contract yet.</p>
                                    )}
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
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle className="font-headline">{editingContract ? 'Edit' : 'Create'} Contract</DialogTitle>
            </DialogHeader>
            <ContractForm
                contract={editingContract}
                onSave={handleSaveContract}
                onCancel={handleCloseForm}
                directory={directory}
            />
        </DialogContent>
      </Dialog>
    </>
  );
}
