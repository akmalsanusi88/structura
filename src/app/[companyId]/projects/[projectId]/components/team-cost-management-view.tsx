'use client';

import type { Project, TeamCost } from '@/lib/types';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import TeamCostForm from './team-cost-form';

interface TeamCostManagementViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
}

export default function TeamCostManagementView({ project, setProject }: TeamCostManagementViewProps) {
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCost, setEditingCost] = useState<TeamCost | undefined>(undefined);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
    const teamNameMap = new Map(project.purchaseOrders?.filter(po => po.teamId).map(po => [po.teamId!, po.issuer]));
    
    const handleOpenForm = (cost?: TeamCost) => {
        setEditingCost(cost);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingCost(undefined);
    };
    
    const handleSaveCost = (data: TeamCost) => {
        setProject(prev => {
            const costs = [...(prev.teamCosts || [])];
            const existingIndex = costs.findIndex(c => c.id === data.id);
            if (existingIndex > -1) {
                costs[existingIndex] = data;
            } else {
                costs.push(data);
            }
            return { ...prev, teamCosts: costs };
        });
        toast({ title: 'Success', description: `Cost entry has been ${editingCost ? 'updated' : 'saved'}.` });
        handleCloseForm();
    };

    const handleDeleteCost = (costId: string) => {
        setProject(prev => ({
            ...prev,
            teamCosts: (prev.teamCosts || []).filter(c => c.id !== costId)
        }));
        toast({ title: 'Success', description: 'Cost entry deleted.' });
    };

    const totalCost = (project.teamCosts || []).reduce((sum, cost) => sum + cost.salary + cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep, 0);

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>In-house Team Costs</CardTitle>
                            <CardDescription>Log and track monthly costs for your teams on this project.</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Monthly Cost</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead>Team</TableHead>
                                    <TableHead className="text-right">Salary</TableHead>
                                    <TableHead className="text-right">Expenses</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(project.teamCosts || []).length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No cost entries logged yet.</TableCell></TableRow>
                                ) : (
                                    (project.teamCosts || []).map(cost => {
                                        const total = cost.salary + cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep;
                                        const expenses = cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep;
                                        return (
                                            <TableRow key={cost.id}>
                                                <TableCell className="font-medium">{format(parseISO(`${cost.month}-01`), 'MMM yyyy')}</TableCell>
                                                <TableCell>{teamNameMap.get(cost.teamId) || 'Unknown Team'}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(cost.salary)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(expenses)}</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                                                <TableCell className="text-right">
                                                     <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => handleOpenForm(cost)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors">
                                                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>This will permanently delete this cost entry.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteCost(cost.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                             {(project.teamCosts || []).length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-right font-bold">Total In-house Cost</TableCell>
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
                        <DialogTitle>{editingCost ? 'Edit' : 'Add'} Monthly Team Cost</DialogTitle>
                        <DialogDescription>Log the costs for an in-house team for a specific month.</DialogDescription>
                    </DialogHeader>
                    <TeamCostForm
                        project={project}
                        cost={editingCost}
                        onSave={handleSaveCost}
                        onCancel={handleCloseForm}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
