
'use client';
import type { Project, PurchaseOrder, PurchaseOrderType, PlantUnit, InHouseTeam } from '@/lib/types';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import PurchaseOrderForm from './purchase-order-form';

interface PurchaseOrderViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
    plantUnits: PlantUnit[];
    inHouseTeams: InHouseTeam[];
}

export default function PurchaseOrderView({ project, setProject, plantUnits, inHouseTeams }: PurchaseOrderViewProps) {
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPo, setEditingPo] = useState<PurchaseOrder | undefined>(undefined);
    const [poType, setPoType] = useState<PurchaseOrderType>('Client');

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

    const handleOpenForm = (type: PurchaseOrderType, po?: PurchaseOrder) => {
        setPoType(type);
        setEditingPo(po);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingPo(undefined);
    };

    const handleSavePo = (poData: PurchaseOrder) => {
        setProject(prev => {
            const existingIndex = prev.purchaseOrders.findIndex(p => p.id === poData.id);
            let newPOs;
            if (existingIndex > -1) {
                newPOs = [...prev.purchaseOrders];
                newPOs[existingIndex] = poData;
            } else {
                newPOs = [...prev.purchaseOrders, poData];
            }
            return { ...prev, purchaseOrders: newPOs };
        });
        toast({ title: 'Success', description: `Purchase Order ${editingPo ? 'updated' : 'saved'} successfully.` });
        handleCloseForm();
    };

    const handleDeletePo = (poId: string) => {
        setProject(prev => ({
            ...prev,
            purchaseOrders: prev.purchaseOrders.filter(p => p.id !== poId)
        }));
        toast({ title: 'Success', description: `Purchase Order deleted.` });
    };

    const renderPoTable = (title: string, description: string, pos: PurchaseOrder[], type: PurchaseOrderType) => {
        const totalPoValue = pos.reduce((total, po) => 
            total + po.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0),
        0);

        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{title}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenForm(type)}><PlusCircle className="mr-2 h-4 w-4" /> Add {type} PO</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PO Number</TableHead>
                                    <TableHead>Issuer/Subcon</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pos.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No purchase orders found.</TableCell></TableRow>
                                ) : (
                                    pos.map(po => {
                                        const totalAmount = po.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
                                        return (
                                            <TableRow key={po.id}>
                                                <TableCell className="font-medium">{po.poNo}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {po.teamId && <Users className="h-4 w-4 text-muted-foreground" />}
                                                        <span>{po.issuer}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{format(parseISO(po.poDate), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(totalAmount)}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => handleOpenForm(type, po)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors">
                                                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>This will permanently delete this Purchase Order.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeletePo(po.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction>
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
                             {pos.length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(totalPoValue)}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </div>
                </CardContent>
            </Card>
        );
    };

    const clientPOs = project.purchaseOrders?.filter(po => po.type === 'Client') || [];
    const subconPOs = project.purchaseOrders?.filter(po => po.type === 'Subcontractor') || [];

    return (
        <>
            <div className="space-y-6">
                {renderPoTable("Client Purchase Orders", "POs received from the client for this project.", clientPOs, 'Client')}
                {renderPoTable("Subcontractor Purchase Orders", "POs issued to subcontractors for services or to in-house teams.", subconPOs, 'Subcontractor')}
            </div>

            <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="font-headline">{editingPo ? 'Edit' : 'Add'} {poType} Purchase Order</DialogTitle>
                        <DialogDescription>Fill in the details for the purchase order.</DialogDescription>
                    </DialogHeader>
                    <PurchaseOrderForm
                        poType={poType}
                        project={project}
                        purchaseOrder={editingPo}
                        onSave={handleSavePo}
                        onCancel={handleCloseForm}
                        plantUnits={plantUnits}
                        inHouseTeams={inHouseTeams}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
