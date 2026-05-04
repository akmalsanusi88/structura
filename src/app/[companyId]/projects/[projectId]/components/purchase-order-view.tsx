
'use client';
import type { Project, PurchaseOrder, PurchaseOrderType, PlantUnit, InHouseTeam, Company, PurchaseOrderItem, Contract } from "@/lib/types";
import { useState, Fragment, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, FileDown, ChevronDown, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import PurchaseOrderForm from '@/components/forms/purchase-order-form';
import { addOrUpdatePurchaseOrder, deletePurchaseOrder } from '@/app/login/actions';
import { useParams, useRouter } from 'next/navigation';
import SubconPoPdfForm from './subcon-po-pdf-form';
import { cn } from '@/lib/utils';

interface PurchaseOrderViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
    plantUnits: PlantUnit[];
    inHouseTeams: InHouseTeam[];
    allCompanies: Company[];
    company: Company | null;
    contracts: Contract[];
}

export default function PurchaseOrderView({ project, setProject, plantUnits, inHouseTeams, allCompanies, company, contracts }: PurchaseOrderViewProps) {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    const projectId = params.projectId as string;
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPo, setEditingPo] = useState<PurchaseOrder | undefined>(undefined);
    const [poType, setPoType] = useState<PurchaseOrderType>('Client');

    const [isPoPdfFormOpen, setIsPoPdfFormOpen] = useState(false);
    const [poForPdf, setPoForPdf] = useState<PurchaseOrder | undefined>(undefined);
    const [expandedPoIds, setExpandedPoIds] = useState<Set<string>>(new Set());

    const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);

    const fullBoqMap = useMemo(() => {
        const allItems = [
            ...(project.clientBoq || []),
            ...(project.engineeringBoq || []),
            ...(project.materialBoq || []),
        ];
        return new Map(allItems.map(item => [item.id, item]));
    }, [project]);

    const clientPoItemMap = useMemo(() => {
        const map = new Map<string, PurchaseOrderItem>();
        (project.purchaseOrders || [])
        .filter(po => po.type === 'Client')
        .flatMap(po => po.items)
        .forEach(item => map.set(item.id, item));
        return map;
    }, [project.purchaseOrders]);

    const togglePoRow = (poId: string) => {
        setExpandedPoIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(poId)) {
                newSet.delete(poId);
            } else {
                newSet.add(poId);
            }
            return newSet;
        });
    };


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

    const handleOpenPoPdfForm = (po: PurchaseOrder) => {
        setPoForPdf(po);
        setIsPoPdfFormOpen(true);
    };

    const handleSavePo = async (poData: PurchaseOrder) => {
        handleCloseForm();
        try {
            await addOrUpdatePurchaseOrder(poData, projectId, companyId);
            toast({ title: 'Success', description: `Purchase Order ${editingPo ? 'updated' : 'saved'} successfully.` });
            router.refresh();
        } catch (error) {
            console.error("Failed to save PO:", error);
            toast({ title: 'Error', description: 'Could not save purchase order.', variant: 'destructive' });
        }
    };

    const handleDeletePo = async (poId: string) => {
        try {
            await deletePurchaseOrder(poId, companyId, projectId);
            toast({ title: 'Success', description: `Purchase Order deleted.` });
            router.refresh();
        } catch (error) {
             console.error("Failed to delete PO:", error);
            toast({ title: 'Error', description: 'Could not delete purchase order.', variant: 'destructive' });
        }
    };

    const renderPoTable = (title: string, description: string, pos: PurchaseOrder[], type: PurchaseOrderType) => {
        const totalPoValue = pos.reduce((total, po) => {
             const subtotal = po.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
             const sstAmount = (subtotal + (po.items.reduce((acc, i) => acc + (i.managementFee || 0), 0))) * ((po.sstPercentage || 0) / 100);
             return total + subtotal + (po.items.reduce((acc, i) => acc + (i.managementFee || 0), 0)) + sstAmount;
        }, 0);

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
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>PO Number</TableHead>
                                    <TableHead>Issuer/Subcon</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pos.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No purchase orders found.</TableCell></TableRow>
                                ) : (
                                    pos.map(po => {
                                        const subtotal = po.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
                                        const totalManagementFee = po.items.reduce((acc, item) => acc + (item.managementFee || 0), 0);
                                        const sstAmount = (subtotal + totalManagementFee) * ((po.sstPercentage || 0) / 100);
                                        const totalAmount = subtotal + totalManagementFee + sstAmount;
                                        const isExpanded = expandedPoIds.has(po.id);
                                        
                                        return (
                                            <Fragment key={po.id}>
                                                <TableRow onClick={() => togglePoRow(po.id)} className="cursor-pointer">
                                                     <TableCell className="py-2 px-4">
                                                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                                    </TableCell>
                                                    <TableCell className="font-medium py-2 px-4">{po.poNo}</TableCell>
                                                    <TableCell className="py-2 px-4">
                                                        <div className="flex items-center gap-2">
                                                            {po.teamId && <Users className="h-4 w-4 text-muted-foreground" />}
                                                            <span>{po.type === 'Client' ? project.client : po.issuer}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 px-4">{format(parseISO(po.poDate), 'dd MMM yyyy')}</TableCell>
                                                    <TableCell className="text-right py-2 px-4">{formatCurrency(totalAmount)}</TableCell>
                                                    <TableCell className="text-right py-2 px-4">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleOpenForm(type, po)}}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                                {type === 'Subcontractor' && (
                                                                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleOpenPoPdfForm(po)}}>
                                                                        <FileDown className="mr-2 h-4 w-4" /> Export PDF
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                            <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                            <AlertDialogDescription>This will permanently delete this Purchase Order.</AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePo(po.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                     <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                        <TableCell colSpan={6} className='p-0'>
                                                            <div className="p-4">
                                                                <h4 className="font-semibold mb-2">PO Items</h4>
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>PU No.</TableHead>
                                                                            <TableHead className="w-[40%]">Description</TableHead>
                                                                            <TableHead>Qty</TableHead>
                                                                            <TableHead>Unit</TableHead>
                                                                            <TableHead className="text-right">Rate</TableHead>
                                                                            <TableHead className="text-right">Material Management Fee</TableHead>
                                                                            <TableHead className="text-right">Amount</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {po.items.map((item: PurchaseOrderItem) => {
                                                                            let displayDescription = item.description;
                                                                            if (item.sourceType === 'percentage' && item.percentage) {
                                                                                const prefix = `${item.percentage}% of `;
                                                                                if (item.description.startsWith(prefix)) {
                                                                                    displayDescription = `${item.description.substring(prefix.length)} (${item.percentage}%)`;
                                                                                } else {
                                                                                    displayDescription = `${item.description} (${item.percentage}%)`;
                                                                                }
                                                                            }

                                                                            let puNo = 'N/A';
                                                                            if (item.puNo) {
                                                                                puNo = item.puNo;
                                                                            } else if (item.sourceType === 'pu') {
                                                                                puNo = plantUnitMap.get(item.sourceId!)?.puId || 'N/A';
                                                                            } else if (item.sourceType === 'boq') {
                                                                                const boqItem = fullBoqMap.get(item.sourceId!);
                                                                                if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                                                                                    puNo = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                                                                                }
                                                                            } else if (item.sourceType === 'percentage') {
                                                                                const clientPoItem = clientPoItemMap.get(item.sourceId!);
                                                                                if (clientPoItem) {
                                                                                    const boqItem = fullBoqMap.get(clientPoItem.sourceId!);
                                                                                    if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                                                                                        puNo = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                                                                                    }
                                                                                }
                                                                            }

                                                                            return (
                                                                                <TableRow key={item.id}>
                                                                                    <TableCell className="font-mono text-xs py-1">{puNo}</TableCell>
                                                                                    <TableCell className="py-1">
                                                                                        {displayDescription}
                                                                                    </TableCell>
                                                                                    <TableCell className="py-1">{Number(item.quantity).toFixed(2)}</TableCell>
                                                                                    <TableCell className="py-1">{item.unit}</TableCell>
                                                                                    <TableCell className="text-right py-1">{formatCurrency(item.rate)}</TableCell>
                                                                                    <TableCell className="text-right py-1">{formatCurrency(item.managementFee || 0)}</TableCell>
                                                                                    <TableCell className="text-right py-1">{formatCurrency((item.rate * item.quantity) + (item.managementFee || 0))}</TableCell>
                                                                                </TableRow>
                                                                            )
                                                                        })}
                                                                    </TableBody>
                                                                    <TableFooter>
                                                                        <TableRow>
                                                                            <TableCell colSpan={6} className="text-right font-semibold py-1">Subtotal</TableCell>
                                                                            <TableCell className="text-right font-semibold py-1">{formatCurrency(subtotal)}</TableCell>
                                                                        </TableRow>
                                                                        {totalManagementFee > 0 && (
                                                                            <TableRow>
                                                                                <TableCell colSpan={6} className="text-right font-semibold py-1">Material Management Fee</TableCell>
                                                                                <TableCell className="text-right font-semibold py-1">{formatCurrency(totalManagementFee)}</TableCell>
                                                                            </TableRow>
                                                                        )}
                                                                        {sstAmount > 0 && (
                                                                            <TableRow>
                                                                                <TableCell colSpan={6} className="text-right font-semibold py-1">SST ({po.sstPercentage || 0}%)</TableCell>
                                                                                <TableCell className="text-right font-semibold py-1">{formatCurrency(sstAmount)}</TableCell>
                                                                            </TableRow>
                                                                        )}
                                                                        <TableRow>
                                                                            <TableCell colSpan={6} className="text-right font-bold py-1">Grand Total</TableCell>
                                                                            <TableCell className="text-right font-bold py-1">{formatCurrency(totalAmount)}</TableCell>
                                                                        </TableRow>
                                                                    </TableFooter>
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
                             {pos.length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-right font-bold">Total</TableCell>
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
                {renderPoTable("Subcontractor Purchase Orders", "POs issued to subcontractors for services.", subconPOs, 'Subcontractor')}
            </div>

            <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
                <DialogContent className="max-w-5xl">
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
                        allCompanies={allCompanies}
                        contracts={contracts}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isPoPdfFormOpen} onOpenChange={setIsPoPdfFormOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Export Purchase Order</DialogTitle>
                        <DialogDescription>
                            Confirm or edit the details below for the PDF export.
                        </DialogDescription>
                    </DialogHeader>
                    {poForPdf && (
                        <SubconPoPdfForm
                            purchaseOrder={poForPdf}
                            project={project}
                            company={company}
                            allCompanies={allCompanies}
                            onCancel={() => setIsPoPdfFormOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
