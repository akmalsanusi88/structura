
'use client';
import type { Project, PurchaseOrder, Claim, PurchaseOrderItem, PlantUnit, Company } from "@/lib/types";
import { useMemo, useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, FileDown, ChevronDown, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import ClaimForm from "./claim-form";
import { Badge } from "@/components/ui/badge";
import { useParams, useRouter } from 'next/navigation';
import { addOrUpdateClaim, deleteClaim } from '@/app/login/actions';
import ClaimSummaryView from './claim-summary-view';

interface ProjectCloseViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
    plantUnits: PlantUnit[];
    company: Company | null;
    allCompanies: Company[];
}

type ClaimStatus = 'Draft' | 'Submitted' | 'Received' | 'Paid' | 'Disputed';

export default function ProjectCloseView({ project, setProject, plantUnits, company, allCompanies }: ProjectCloseViewProps) {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    const projectId = params.projectId as string;
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [claimType, setClaimType] = useState<'client' | 'subcon' | null>(null);
    const [editingClaim, setEditingClaim] = useState<Claim | undefined>(undefined);

    const poNoMap = useMemo(() => {
        return new Map(project.purchaseOrders.map(po => [po.id, po.poNo]));
    }, [project.purchaseOrders]);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
    
    const getStatusBadgeVariant = (status: ClaimStatus) => {
        switch (status) {
            case 'Paid': return 'bg-green-100 text-green-800 hover:bg-green-100';
            case 'Submitted': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
            case 'Disputed': return 'bg-red-100 text-red-800 hover:bg-red-100';
            case 'Draft':
            default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
        }
    };
    
    const handleOpenForm = (type: 'client' | 'subcon', claim?: Claim) => {
        setClaimType(type);
        setEditingClaim(claim);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingClaim(undefined);
        setClaimType(null);
    };

    const handleSaveClaim = async (data: Claim) => {
        handleCloseForm();
        
        try {
            await addOrUpdateClaim(data, projectId, companyId);
            toast({ title: 'Success', description: `Claim ${editingClaim ? 'updated' : 'saved'} successfully.` });
            router.refresh();
        } catch (error) {
            console.error("Failed to save claim:", error);
            toast({ title: 'Error', description: 'Could not save claim.', variant: 'destructive' });
        }
    };

    const handleDeleteClaim = async (claimToDelete: Claim) => {
        const claimKey = claimToDelete.type === 'Client' ? 'clientClaims' : 'subconClaims';
        const originalClaims = project[claimKey] || [];

        setProject(prev => ({
            ...prev,
            [claimKey]: (prev[claimKey] || []).filter(c => c.id !== claimToDelete.id),
        }));

        try {
            await deleteClaim(claimToDelete.id, projectId, companyId);
            toast({ title: 'Success', description: `Claim deleted.` });
        } catch (error) {
            console.error("Failed to delete claim:", error);
            toast({ title: 'Error', description: 'Could not delete claim.', variant: 'destructive' });
            setProject(prev => ({ ...prev, [claimKey]: originalClaims })); // Revert on error
        }
    };

    const renderClaimTable = (title: string, description: string, claims: Claim[], type: 'client' | 'subcon') => {
        
        const sortedClaims = [...claims].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const totalAmount = claims.reduce((sum, claim) => sum + claim.amount, 0);
        const totalRetention = claims.reduce((sum, claim) => sum + (claim.retentionAmount || 0), 0);
        const totalSst = claims.reduce((sum, claim) => sum + (claim.sstAmount || 0), 0);
        const totalNetPayable = totalAmount - totalRetention + totalSst;


        const poIssuerMap = new Map<string, string>();
        if (type === 'subcon') {
            project.purchaseOrders.forEach(po => {
                if (po.type === 'Subcontractor') {
                    poIssuerMap.set(po.id, po.issuer);
                }
            });
        }
        
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>{title}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenForm(type)}><PlusCircle className="mr-2 h-4 w-4" /> Add Claim</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {type === 'subcon' && <TableHead>Subcon Name</TableHead>}
                                    <TableHead>Claim No.</TableHead>
                                    <TableHead>Invoice No.</TableHead>
                                    <TableHead>PO No.</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Claim Amount</TableHead>
                                    <TableHead className="text-right">Retention</TableHead>
                                    <TableHead className="text-right">SST</TableHead>
                                    <TableHead className="text-right">Net Payable</TableHead>
                                    <TableHead><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedClaims.length === 0 ? (
                                    <TableRow><TableCell colSpan={type === 'subcon' ? 11 : 10} className="h-24 text-center text-muted-foreground">No claims recorded yet.</TableCell></TableRow>
                                ) : (
                                    sortedClaims.map((claim, index) => {
                                        const subconName = type === 'subcon' ? poIssuerMap.get(claim.purchaseOrderId) || 'N/A' : null;
                                        
                                        const netPayableForThisClaim = (claim.amount || 0) - (claim.retentionAmount || 0) + (claim.sstAmount || 0);

                                        return (
                                            <TableRow key={claim.id}>
                                                {subconName && <TableCell className="font-medium">{subconName}</TableCell>}
                                                <TableCell className="font-medium">{claim.claimNo}</TableCell>
                                                <TableCell>{claim.invoiceNo}</TableCell>
                                                <TableCell>{poNoMap.get(claim.purchaseOrderId)}</TableCell>
                                                <TableCell>{format(parseISO(claim.date), 'dd MMM yyyy')}</TableCell>
                                                <TableCell>
                                                    <div>
                                                        <Badge className={getStatusBadgeVariant(claim.status)} variant="outline">{claim.status}</Badge>
                                                        {claim.statusDates?.[claim.status] && (
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                on {format(parseISO(claim.statusDates[claim.status]!), 'dd MMM yyyy')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(claim.amount)}</TableCell>
                                                <TableCell className="text-right text-red-500">
                                                    {claim.hasRetention && claim.retentionAmount != null ? (
                                                         <span>-{formatCurrency(claim.retentionAmount)} <span className="text-muted-foreground text-xs">({claim.retentionPercentage}%)</span></span>
                                                    ) : (
                                                        <span>-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-blue-500">
                                                    {claim.sstAmount != null && claim.sstAmount > 0 ? (
                                                        <span>+{formatCurrency(claim.sstAmount)} <span className="text-muted-foreground text-xs">({claim.sstPercentage}%)</span></span>
                                                    ) : (
                                                        <span>-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">{formatCurrency(netPayableForThisClaim)}</TableCell>
                                                <TableCell className="text-right">
                                                     <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => handleOpenForm(type, claim)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors">
                                                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>This will permanently delete this claim record.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteClaim(claim)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
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
                             {claims.length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={type === 'subcon' ? 9 : 8} className="text-right font-bold">Total Net Payable</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(totalNetPayable)}</TableCell>
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
    
    return (
        <>
            <div className="space-y-6">
                <div className='space-y-6'>
                    {renderClaimTable("Client Claims", "Progress claims and invoices submitted to the client.", project.clientClaims || [], 'client')}
                    <ClaimSummaryView project={project} poType="Client" plantUnits={plantUnits} />
                </div>
                 <div className='space-y-6'>
                    {renderClaimTable("Subcontractor Claims", "Claims received from subcontractors for payment.", project.subconClaims || [], 'subcon')}
                    <ClaimSummaryView project={project} poType="Subcontractor" plantUnits={plantUnits} />
                </div>
            </div>

            <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
                <DialogContent className="max-w-7xl">
                    <DialogHeader>
                        <DialogTitle>{editingClaim ? 'Edit' : 'Add'} {claimType === 'client' ? 'Client' : 'Subcontractor'} Claim</DialogTitle>
                        <DialogDescription>
                            Select a Purchase Order, then select the as-built work items to generate the claim.
                        </DialogDescription>
                    </DialogHeader>
                    {isFormOpen && claimType && (
                        <ClaimForm
                            project={project}
                            claim={editingClaim}
                            poType={claimType}
                            onSave={handleSaveClaim}
                            onCancel={handleCloseForm}
                            company={company}
                            allCompanies={allCompanies}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

    