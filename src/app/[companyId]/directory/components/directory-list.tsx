
'use client';

import type { Company } from '@/lib/types';
import { useState, useMemo, Fragment } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, ChevronDown, Building, Search } from 'lucide-react';
import CompanyForm from './company-form';
import { addOrUpdateDirectoryEntry, deleteDirectoryEntry } from '@/app/login/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';


interface DirectoryListProps {
    companies: Company[];
    companyId: string;
}

export default function DirectoryList({ companies, companyId }: DirectoryListProps) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | undefined>(undefined);
    const { toast } = useToast();
    const router = useRouter();
    const [expandedCompanyIds, setExpandedCompanyIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    const sortedCompanies = useMemo(() => {
        const filteredCompanies = companies.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const currentCompany = filteredCompanies.find(c => c.id === companyId);
        const otherCompanies = filteredCompanies.filter(c => c.id !== companyId);
        
        const sortedOthers = otherCompanies.sort((a, b) => a.name.localeCompare(b.name));

        return currentCompany ? [currentCompany, ...sortedOthers] : sortedOthers;
    }, [companies, companyId, searchTerm]);

    const toggleRow = (companyId: string) => {
        setExpandedCompanyIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(companyId)) {
                newSet.delete(companyId);
            } else {
                newSet.add(companyId);
            }
            return newSet;
        });
    };

    const handleOpenForm = (company?: Company) => {
        setEditingCompany(company);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingCompany(undefined);
    };

    const handleSaveCompany = async (data: Partial<Company>) => {
        try {
            await addOrUpdateDirectoryEntry(data, companyId);
            toast({
                title: 'Success',
                description: `Directory entry for "${data.name}" has been ${editingCompany ? 'updated' : 'created'}.`
            });
            handleCloseForm();
            router.refresh();
        } catch (error) {
            console.error('Error saving directory entry:', error);
            throw error;
        }
    };
    
    const handleDeleteCompany = async (companyIdToDelete: string) => {
        try {
            await deleteDirectoryEntry(companyIdToDelete);
             toast({
                title: 'Success',
                description: "Directory entry has been deleted.",
            });
            router.refresh();
        } catch (error) {
             toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Could not delete directory entry.',
                variant: 'destructive',
            });
        }
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle>Company Directory</CardTitle>
                            <CardDescription>A list of all clients, subcontractors, and suppliers.</CardDescription>
                        </div>
                         <Button onClick={() => handleOpenForm()}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Entry
                        </Button>
                    </div>
                     <div className="relative pt-4 max-w-sm">
                        <Search className="absolute left-2.5 top-6 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by company name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className='w-8'></TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className='w-[50px]'><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedCompanies.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                            No entries found. Add one to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedCompanies.map(company => {
                                        const isExpanded = expandedCompanyIds.has(company.id);
                                        const isCurrentCompany = company.id === companyId;
                                        return (
                                        <Fragment key={company.id}>
                                            <TableRow onClick={() => toggleRow(company.id)} className={cn("cursor-pointer", isCurrentCompany && "bg-primary/5")}>
                                                <TableCell className="py-2 px-4">
                                                    <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                                </TableCell>
                                                <TableCell className="font-medium py-2 px-4">
                                                    <div className='flex items-center gap-2'>
                                                        {company.name}
                                                        {isCurrentCompany && (
                                                            <div className='flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full'>
                                                                <Building className='h-3 w-3' />
                                                                <span>Current</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-2 px-4">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onSelect={() => handleOpenForm(company)}>
                                                                <Pencil className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            {!isCurrentCompany && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                            <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                            <AlertDialogDescription>This will permanently delete "{company.name}".</AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleDeleteCompany(company.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                    <TableCell colSpan={3} className='p-0'>
                                                        <div className='p-6 grid grid-cols-1 md:grid-cols-3 gap-6'>
                                                            <div>
                                                                <h4 className='font-semibold mb-2'>Contact Details</h4>
                                                                <div className='flex flex-col gap-1 text-sm text-muted-foreground'>
                                                                    {company.attn && <span><span className='font-medium text-foreground'>PIC:</span> {company.attn}</span>}
                                                                    {company.email && <span>{company.email}</span>}
                                                                    {company.phone && <span>{company.phone}</span>}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className='font-semibold mb-2'>Address</h4>
                                                                <p className='text-sm text-muted-foreground'>{company.address || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <h4 className='font-semibold mb-2'>Bank Details</h4>
                                                                <div className='flex flex-col gap-1 text-sm text-muted-foreground'>
                                                                    {company.bankName && <span className='font-medium text-foreground'>{company.bankName}</span>}
                                                                    {company.bankAccNo && <span>A/C: {company.bankAccNo}</span>}
                                                                    {company.bankAddress && <span className='text-xs'>{company.bankAddress}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    )})
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

             <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingCompany ? 'Edit' : 'Add'} Directory Entry</DialogTitle>
                    </DialogHeader>
                    <CompanyForm 
                        company={editingCompany}
                        onSave={handleSaveCompany}
                        onCancel={handleCloseForm}
                    />
                </DialogContent>
            </Dialog>
        </>
    )
}
