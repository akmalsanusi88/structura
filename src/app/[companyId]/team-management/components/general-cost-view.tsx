
'use client';

import type { InHouseTeam, GeneralTeamCost } from '@/lib/types';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import GeneralCostForm from './general-cost-form';
import { addOrUpdateGeneralCost, deleteGeneralCost } from '@/app/login/actions';
import { useParams, useRouter } from 'next/navigation';

interface GeneralCostViewProps {
  initialTeams: InHouseTeam[];
  initialGeneralCosts: GeneralTeamCost[];
}

export default function GeneralCostView({ initialTeams, initialGeneralCosts }: GeneralCostViewProps) {
    const params = useParams();
    const router = useRouter();
    const companyId = params.companyId as string;
    const { toast } = useToast();
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCost, setEditingCost] = useState<GeneralTeamCost | undefined>(undefined);

    const teamNameMap = useMemo(() => {
        return new Map(initialTeams.map(team => [team.id, team.name]));
    }, [initialTeams]);

    const sortedCosts = useMemo(() => {
        return initialGeneralCosts.sort((a,b) => b.month.localeCompare(a.month) || (teamNameMap.get(a.teamId) || '').localeCompare(teamNameMap.get(b.teamId) || ''));
    }, [initialGeneralCosts, teamNameMap]);
    
    const totalCost = useMemo(() => {
        return sortedCosts.reduce((sum, cost) => sum + (cost.ppe || 0) + (cost.vehicleUpkeep || 0) + (cost.other || 0), 0);
    }, [sortedCosts]);


    const handleOpenForm = (cost?: GeneralTeamCost) => {
        setEditingCost(cost);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingCost(undefined);
    };

    const handleSaveCost = async (data: Omit<GeneralTeamCost, 'id' | 'companyId'>) => {
        handleCloseForm();
        const costDataToSave: Partial<GeneralTeamCost> = {
            ...data,
            id: editingCost?.id, // Will be undefined for new entries
        };

        try {
            await addOrUpdateGeneralCost(costDataToSave, companyId);
            toast({ title: 'Success', description: `General cost entry has been ${editingCost ? 'updated' : 'saved'}.` });
            router.refresh();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to save cost entry.', variant: 'destructive' });
        }
    };
    
    const handleDeleteCost = async (costId: string) => {
        try {
            await deleteGeneralCost(costId, companyId);
            toast({ title: 'Success', description: 'Cost entry deleted.' });
            router.refresh();
        } catch(error) {
             toast({ title: 'Error', description: 'Failed to delete cost entry.', variant: 'destructive' });
        }
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

    return (
        <>
            <Card>
                <CardHeader>
                     <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>General Team Costs</CardTitle>
                            <CardDescription>Log non-project-specific costs like PPE and vehicle maintenance for each team.</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenForm()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Cost Entry
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead>Team</TableHead>
                                    <TableHead className="text-right">PPE</TableHead>
                                    <TableHead className="text-right">Vehicle Upkeep</TableHead>
                                    <TableHead className="text-right">Other</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedCosts.length > 0 ? (
                                    sortedCosts.map(cost => {
                                        const total = (cost.ppe || 0) + (cost.vehicleUpkeep || 0) + (cost.other || 0);
                                        return (
                                            <TableRow key={cost.id}>
                                                <TableCell className="font-medium">{format(parseISO(`${cost.month}-01`), 'MMM yyyy')}</TableCell>
                                                <TableCell>{teamNameMap.get(cost.teamId) || 'Unknown Team'}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(cost.ppe || 0)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(cost.vehicleUpkeep || 0)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(cost.other || 0)}</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => handleOpenForm(cost)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors"><Trash2 className="mr-2 h-4 w-4"/> Delete</Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this cost entry.</AlertDialogDescription></AlertDialogHeader>
                                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCost(cost.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        No general costs logged yet.
                                    </TableCell></TableRow>
                                )}
                            </TableBody>
                            {sortedCosts.length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-right font-bold">Total</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(totalCost)}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </div>
                </CardContent>
            </Card>
            
            <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingCost ? 'Edit' : 'Add'} General Cost</DialogTitle>
                        <DialogDescription>
                            Log general costs for a team.
                        </DialogDescription>
                    </DialogHeader>
                    <GeneralCostForm
                        cost={editingCost}
                        teams={initialTeams}
                        onSave={handleSaveCost}
                        onCancel={handleCloseForm}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
