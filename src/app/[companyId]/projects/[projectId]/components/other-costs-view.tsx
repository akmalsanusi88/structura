
'use client';

import type { Project, OtherCost, OtherCostCategory } from "@/lib/types";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import OtherCostForm from "./other-cost-form";
import { addOrUpdateOtherCost, deleteOtherCost } from '@/app/login/actions';
import { useParams, useRouter } from 'next/navigation';

interface OtherCostsViewProps {
    project: Project;
}

export default function OtherCostsView({ project }: OtherCostsViewProps) {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCost, setEditingCost] = useState<OtherCost | undefined>(undefined);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

    const handleOpenForm = (cost?: OtherCost) => {
        setEditingCost(cost);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingCost(undefined);
    };

    const handleSaveCost = async (costData: OtherCost) => {
        handleCloseForm();
        try {
            await addOrUpdateOtherCost(costData, project.id, companyId);
            toast({ title: 'Success', description: `Cost entry has been ${editingCost ? 'updated' : 'saved'}.` });
            router.refresh();
        } catch (error) {
            console.error('Failed to save cost:', error);
            toast({ title: 'Error', description: 'Could not save cost entry.', variant: 'destructive' });
        }
    };

    const handleDeleteCost = async (costId: string) => {
         try {
            await deleteOtherCost(costId, companyId);
            toast({ title: 'Success', description: 'Cost entry deleted.' });
            router.refresh();
        } catch (error) {
            console.error('Failed to delete cost:', error);
            toast({ title: 'Error', description: 'Could not delete cost entry.', variant: 'destructive' });
        }
    };

    const totalOtherCosts = (project.otherCosts || []).reduce((sum, cost) => sum + cost.cost, 0);

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Other Project Costs</CardTitle>
                            <CardDescription>Track miscellaneous project costs like insurance, permits, and professional fees.</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Cost</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Start / Expiry Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                    <TableHead className="text-right">Cost</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!project.otherCosts || project.otherCosts.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No other costs recorded yet.</TableCell></TableRow>
                                ) : (
                                    project.otherCosts.map(cost => (
                                        <TableRow key={cost.id}>
                                            <TableCell className="font-medium">{cost.category}</TableCell>
                                            <TableCell>{cost.description}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-xs">
                                                    {cost.quotationNo && <span>Q: {cost.quotationNo}</span>}
                                                    {cost.purchaseOrderNo && <span>PO: {cost.purchaseOrderNo}</span>}
                                                    {cost.invoiceNo && <span>INV: {cost.invoiceNo}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell>{cost.startDate ? format(parseISO(cost.startDate), 'dd MMM yyyy') : (cost.expiryDate ? format(parseISO(cost.expiryDate), 'dd MMM yyyy') : 'N/A')}</TableCell>
                                            <TableCell>{cost.endDate ? format(parseISO(cost.endDate), 'dd MMM yyyy') : 'N/A'}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(cost.cost)}</TableCell>
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
                                    ))
                                )}
                            </TableBody>
                            {(project.otherCosts && project.otherCosts.length > 0) && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-right font-bold">Total Other Costs</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(totalOtherCosts)}</TableCell>
                                        <TableCell/>
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingCost ? 'Edit' : 'Add'} Other Cost</DialogTitle>
                        <DialogDescription>Log a miscellaneous project expense.</DialogDescription>
                    </DialogHeader>
                    <OtherCostForm
                        cost={editingCost}
                        onSave={handleSaveCost}
                        onCancel={handleCloseForm}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
