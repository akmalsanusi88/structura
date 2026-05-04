
'use client';
import type { Project, MaterialRequisition, MaterialIssuance, MaterialReturn, PlantUnit, Company } from "@/lib/types";
import { useState, useMemo, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, FileDown, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import MaterialRequisitionForm from "./material-requisition-form";
import MaterialIssuanceForm from "./material-issuance-form";
import MaterialReturnForm from "./material-return-form";
import MaterialSummaryView from "./material-summary-view";
import { useRouter, useParams } from 'next/navigation';
import { addOrUpdateMaterialRequisition, deleteMaterialRequisition, addOrUpdateMaterialIssuance, deleteMaterialIssuance, addOrUpdateMaterialReturn, deleteMaterialReturn } from '@/app/login/actions';
import { cn } from "@/lib/utils";

interface MaterialSettlementViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
    plantUnits: PlantUnit[];
    company?: Company | null;
    serialInventory: Map<string, Map<string, number>>;
    allRequisitions: string[];
    allIssuances: string[];
    allReturns: string[];
}

export default function MaterialSettlementView({ project, setProject, plantUnits, company, serialInventory, allRequisitions, allIssuances, allReturns }: MaterialSettlementViewProps) {
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    const projectId = params.projectId as string;
    const { toast } = useToast();
    
    const [isRequisitionFormOpen, setIsRequisitionFormOpen] = useState(false);
    const [editingRequisition, setEditingRequisition] = useState<MaterialRequisition | undefined>(undefined);
    
    const [isIssuanceFormOpen, setIsIssuanceFormOpen] = useState(false);
    const [editingIssuance, setEditingIssuance] = useState<MaterialIssuance | undefined>(undefined);

    const [isReturnFormOpen, setIsReturnFormOpen] = useState(false);
    const [editingReturn, setEditingReturn] = useState<MaterialReturn | undefined>(undefined);

    const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());
    const [expandedIssuances, setExpandedIssuances] = useState<Set<string>>(new Set());
    const [expandedReturns, setExpandedReturns] = useState<Set<string>>(new Set());

    const toggleExpansion = (id: string, type: 'req' | 'iss' | 'ret') => {
        const setter = {
            req: setExpandedReqs,
            iss: setExpandedIssuances,
            ret: setExpandedReturns,
        }[type];

        setter(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);

    const handleOpenRequisitionForm = (requisition?: MaterialRequisition) => {
        setEditingRequisition(requisition);
        setIsRequisitionFormOpen(true);
    };
    const handleCloseRequisitionForm = () => {
        setIsRequisitionFormOpen(false);
        setEditingRequisition(undefined);
    };
    const handleSaveRequisition = async (data: MaterialRequisition) => {
        handleCloseRequisitionForm();
        setProject(prevProject => {
            const requisitions = [...(prevProject.materialRequisitions || [])];
            const existingIndex = requisitions.findIndex(r => r.id === data.id);
            if (existingIndex > -1) {
                requisitions[existingIndex] = data;
            } else {
                requisitions.push(data);
            }
            return { ...prevProject, materialRequisitions: requisitions };
        });
        try {
            await addOrUpdateMaterialRequisition(data, projectId, companyId);
            toast({ title: 'Success', description: `Requisition ${editingRequisition ? 'updated' : 'saved'} successfully.` });
        } catch (error) {
            console.error("Failed to save material requisition:", error);
            toast({ title: 'Error', description: 'Could not save material requisition.', variant: 'destructive' });
            router.refresh(); // Refresh on error to re-sync state
        }
    };
    const handleDeleteRequisition = async (id: string) => {
        const originalRequisitions = project.materialRequisitions;
        setProject(prev => ({ ...prev, materialRequisitions: prev.materialRequisitions.filter(r => r.id !== id) }));
        try {
            await deleteMaterialRequisition(id, projectId, companyId);
            toast({ title: 'Success', description: `Requisition deleted.` });
        } catch (error) {
            console.error("Failed to delete material requisition:", error);
            toast({ title: 'Error', description: 'Could not delete material requisition.', variant: 'destructive' });
            setProject(prev => ({ ...prev, materialRequisitions: originalRequisitions }));
        }
    };

    const handleOpenIssuanceForm = (issuance?: MaterialIssuance) => {
        setEditingIssuance(issuance);
        setIsIssuanceFormOpen(true);
    };
    const handleCloseIssuanceForm = () => {
        setIsIssuanceFormOpen(false);
        setEditingIssuance(undefined);
    };
    const handleSaveIssuance = async (data: MaterialIssuance) => {
        handleCloseIssuanceForm();
        setProject(prevProject => {
            const issuances = [...(prevProject.materialIssuances || [])];
            const existingIndex = issuances.findIndex(i => i.id === data.id);
            if (existingIndex > -1) {
                issuances[existingIndex] = data;
            } else {
                issuances.push(data);
            }
            return { ...prevProject, materialIssuances: issuances };
        });
        try {
            await addOrUpdateMaterialIssuance(data, projectId, companyId);
            toast({ title: 'Success', description: `Issuance ${editingIssuance ? 'updated' : 'saved'} successfully.` });
        } catch (error) {
            console.error("Failed to save material issuance:", error);
            toast({ title: 'Error', description: 'Could not save material issuance.', variant: 'destructive' });
            router.refresh();
        }
    };
    const handleDeleteIssuance = async (id: string) => {
        const originalIssuances = project.materialIssuances;
        setProject(prev => ({...prev, materialIssuances: prev.materialIssuances.filter(i => i.id !== id)}));
        try {
            await deleteMaterialIssuance(id, projectId, companyId);
            toast({ title: 'Success', description: `Issuance deleted.` });
        } catch (error) {
            console.error("Failed to delete material issuance:", error);
            toast({ title: 'Error', description: 'Could not delete material issuance.', variant: 'destructive' });
            setProject(prev => ({ ...prev, materialIssuances: originalIssuances }));
        }
    };

    const handleOpenReturnForm = (materialReturn?: MaterialReturn) => {
        setEditingReturn(materialReturn);
        setIsReturnFormOpen(true);
    };
    const handleCloseReturnForm = () => {
        setIsReturnFormOpen(false);
        setEditingReturn(undefined);
    };
    const handleSaveReturn = async (data: MaterialReturn) => {
        handleCloseReturnForm();
        setProject(prevProject => {
            const returns = [...(prevProject.materialReturns || [])];
            const existingIndex = returns.findIndex(r => r.id === data.id);
            if (existingIndex > -1) {
                returns[existingIndex] = data;
            } else {
                returns.push(data);
            }
            return { ...prevProject, materialReturns: returns };
        });
        try {
            await addOrUpdateMaterialReturn(data, projectId, companyId);
            toast({ title: 'Success', description: `Return ${editingReturn ? 'updated' : 'saved'} successfully.` });
        } catch (error) {
            console.error("Failed to save material return:", error);
            toast({ title: 'Error', description: 'Could not save material return.', variant: 'destructive' });
            router.refresh();
        }
    };
    const handleDeleteReturn = async (id: string) => {
        const originalReturns = project.materialReturns;
        setProject(prev => ({...prev, materialReturns: prev.materialReturns.filter(r => r.id !== id)}));
        try {
            await deleteMaterialReturn(id, projectId, companyId);
            toast({ title: 'Success', description: `Return deleted.` });
        } catch (error) {
            console.error("Failed to delete material return:", error);
            toast({ title: 'Error', description: 'Could not delete material return.', variant: 'destructive' });
            setProject(prev => ({ ...prev, materialReturns: originalReturns }));
        }
    };

    const handleExportRequisitionPdf = async (requisition: MaterialRequisition) => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const companyName = company ? company.name : 'Structura';

        const doc = new jsPDF({ orientation: 'landscape' });
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 14;
        const max_width = page_width - margin * 2;
        
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(companyName.toUpperCase(), margin, 15);

        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text(`Material Requisition`, margin, 22);

        let y_pos = 29;
        doc.setFontSize(11);
        doc.setTextColor(100);

        const projectNameText = doc.splitTextToSize(`Project: ${project.name}`, max_width);
        doc.text(projectNameText, margin, y_pos);
        y_pos += doc.getTextDimensions(projectNameText).h;
        
        doc.text(`Requisition No: ${requisition.requisitionNo}`, margin, y_pos + 2);
        y_pos += doc.getTextDimensions(`Requisition No: ${requisition.requisitionNo}`).h + 2;

        doc.text(`Date: ${format(parseISO(requisition.date), 'dd MMM yyyy')}`, margin, y_pos + 2);
        y_pos += doc.getTextDimensions(`Date: ...`).h + 5;


        const head = [['No.', 'Description', 'Unit', 'Quantity']];
        const body = requisition.items.map((item, index) => [
            (index + 1).toString(),
            item.description,
            item.unit,
            item.quantity.toFixed(2),
        ]);

        autoTable(doc, {
            head,
            body,
            startY: y_pos,
            headStyles: { fillColor: [41, 128, 185] },
            theme: 'striped',
            didParseCell: function (data) {
                if (data.column.index > 0) {
                    data.cell.styles.halign = 'right';
                    if (data.column.index <= 2 && data.row.section !== 'head') {
                         data.cell.styles.halign = 'left';
                    }
                }
            }
        });

        let finalY = (doc as any).lastAutoTable.finalY || 80;
        
        if (finalY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            finalY = 20;
        }

        autoTable(doc, {
            startY: finalY + 20,
            body: [['', '', '']],
            theme: 'plain',
            styles: {
                cellPadding: { top: 15, bottom: 5 },
            },
            didDrawCell: function (data: any) {
                if (data.row.section === 'body' && data.row.index === 0) {
                    doc.setLineWidth(0.2);
                    doc.line(data.cell.x + 5, data.cell.y + 12, data.cell.x + data.cell.width - 5, data.cell.y + 12);
                    doc.setFontSize(10);
                    doc.setTextColor(40);
                    let text = '';
                    if (data.column.index === 0) text = 'Prepared by';
                    if (data.column.index === 1) text = 'Checked by';
                    if (data.column.index === 2) text = 'Approved by';
                    doc.text(text, data.cell.x + data.cell.width / 2, data.cell.y + 18, { align: 'center' });
                }
            }
        });

        doc.save(`${project.name} - Requisition ${requisition.requisitionNo}.pdf`);
    };
    
    const handleExportIssuancePdf = async (issuance: MaterialIssuance) => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const companyName = company ? company.name : 'Structura';

        const doc = new jsPDF({ orientation: 'landscape' });
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 14;
        const max_width = page_width - margin * 2;
        
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(companyName.toUpperCase(), margin, 15);

        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text(`Material Issuance Note`, margin, 22);

        let y_pos = 29;
        doc.setFontSize(11);
        doc.setTextColor(100);

        const projectNameText = doc.splitTextToSize(`Project: ${project.name}`, max_width);
        doc.text(projectNameText, margin, y_pos);
        y_pos += doc.getTextDimensions(projectNameText).h + 2;
        
        doc.text(`Issue No: ${issuance.goodsIssueNo}`, margin, y_pos);
        y_pos += 7;
        doc.text(`Date: ${format(parseISO(issuance.date), 'dd MMM yyyy')}`, margin, y_pos);
        y_pos += 10;

        const head = [['No.', 'Description', 'Unit', 'Quantity']];
        const body: any[][] = [];
        issuance.items.forEach((item, index) => {
            body.push([
                (index + 1).toString(),
                item.description,
                item.unit,
                item.quantity.toFixed(2),
            ]);

            if (item.serials && item.serials.length > 0) {
                (item.serials || []).filter(s => s.quantity > 0).forEach(serial => {
                    const row = new Array(4).fill('');
                    row[1] = { content: `  S/N: ${serial.serialNo || 'N/A'}`, styles: { fontStyle: 'italic', textColor: [100,100,100], fontSize: 8 } };
                    row[3] = { content: serial.quantity.toFixed(2), styles: { fontStyle: 'italic', textColor: [100,100,100], fontSize: 8 } };
                    body.push(row);
                });
            }
        });

        autoTable(doc, {
            head,
            body,
            startY: y_pos,
            headStyles: { fillColor: [41, 128, 185] },
            theme: 'striped',
            didParseCell: (data) => {
                if (data.column.index > 1) {
                    data.cell.styles.halign = 'right';
                    if (data.column.index <= 2 && data.row.section !== 'head') {
                         data.cell.styles.halign = 'left';
                    }
                }
            }
        });

        let finalY = (doc as any).lastAutoTable.finalY || 80;
        if (finalY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            finalY = 20;
        }
        autoTable(doc, {
            startY: finalY + 20,
            body: [['', '', '']],
            theme: 'plain',
            styles: {
                cellPadding: { top: 15, bottom: 5 },
            },
            didDrawCell: function (data: any) {
                if (data.row.section === 'body' && data.row.index === 0) {
                    doc.setLineWidth(0.2);
                    doc.line(data.cell.x + 5, data.cell.y + 12, data.cell.x + data.cell.width - 5, data.cell.y + 12);
                    doc.setFontSize(10);
                    doc.setTextColor(40);
                    let text = '';
                    if (data.column.index === 0) text = 'Prepared by';
                    if (data.column.index === 1) text = 'Checked by';
                    if (data.column.index === 2) text = 'Approved by';
                    doc.text(text, data.cell.x + data.cell.width / 2, data.cell.y + 18, { align: 'center' });
                }
            }
        });

        doc.save(`${project.name} - Issuance ${issuance.goodsIssueNo}.pdf`);
    };

    const handleExportReturnPdf = async (materialReturn: MaterialReturn) => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const companyName = company ? company.name : 'Structura';

        const doc = new jsPDF();
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 14;
        const max_width = page_width - margin * 2;
        
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(companyName.toUpperCase(), margin, 15);

        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text(`Material Return Note`, margin, 22);

        let y_pos = 29;
        doc.setFontSize(11);
        doc.setTextColor(100);

        doc.text(`Project: ${project.name}`, margin, y_pos);
        y_pos += 7;
        doc.text(`Return No: ${materialReturn.goodsReturnNo}`, margin, y_pos);
        y_pos += 7;
        doc.text(`Date: ${format(parseISO(materialReturn.date), 'dd MMM yyyy')}`, margin, y_pos);
        y_pos += 10;

        const head = [['No.', 'Description', 'Unit', 'Quantity']];
        const body: any[][] = [];
        materialReturn.items.forEach((item, index) => {
            body.push([
                (index + 1).toString(),
                item.description,
                item.unit,
                item.quantity.toFixed(2),
            ]);

            if (item.serials && item.serials.length > 0) {
                (item.serials || []).filter(s => s.quantity > 0).forEach(serial => {
                    const row = new Array(4).fill('');
                    row[1] = { content: `  S/N: ${serial.serialNo || 'N/A'}`, styles: { fontStyle: 'italic', textColor: [100,100,100], fontSize: 8 } };
                    row[3] = { content: serial.quantity.toFixed(2), styles: { halign: 'right', fontStyle: 'italic', textColor: [100,100,100], fontSize: 8 } };
                    body.push(row);
                });
            }
        });

        autoTable(doc, {
            head,
            body,
            startY: y_pos,
            headStyles: { fillColor: [41, 128, 185] },
            theme: 'striped',
            didParseCell: (data) => {
                if (data.column.index > 1) {
                    data.cell.styles.halign = 'right';
                    if (data.column.index <= 2 && data.row.section !== 'head') {
                         data.cell.styles.halign = 'left';
                    }
                }
            }
        });

        let finalY = (doc as any).lastAutoTable.finalY || 80;
        if (finalY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            finalY = 20;
        }
        autoTable(doc, {
            startY: finalY + 20,
            body: [['', '', '']],
            theme: 'plain',
            styles: {
                cellPadding: { top: 15, bottom: 5 },
            },
            didDrawCell: function (data: any) {
                if (data.row.section === 'body' && data.row.index === 0) {
                    doc.setLineWidth(0.2);
                    doc.line(data.cell.x + 5, data.cell.y + 12, data.cell.x + data.cell.width - 5, data.cell.y + 12);
                    doc.setFontSize(10);
                    doc.setTextColor(40);
                    let text = '';
                    if (data.column.index === 0) text = 'Prepared by';
                    if (data.column.index === 1) text = 'Checked by';
                    if (data.column.index === 2) text = 'Approved by';
                    doc.text(text, data.cell.x + data.cell.width / 2, data.cell.y + 18, { align: 'center' });
                }
            }
        });

        doc.save(`${project.name} - Return ${materialReturn.goodsReturnNo}.pdf`);
    };


    const renderRequisitionTable = () => (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Material Requisition</CardTitle>
                    <Button size="sm" onClick={() => handleOpenRequisitionForm()}><PlusCircle className="mr-2 h-4 w-4" /> New Requisition</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Req. No.</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(project.materialRequisitions || []).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (project.materialRequisitions || []).map(req => {
                                    const isExpanded = expandedReqs.has(req.id);
                                    return (
                                     <Fragment key={req.id}>
                                         <TableRow onClick={() => toggleExpansion(req.id, 'req')} className="cursor-pointer">
                                            <TableCell className="py-2 px-4">
                                                <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                            </TableCell>
                                            <TableCell className="py-2 px-4">{format(parseISO(req.date), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="font-mono py-2 px-4">{req.requisitionNo}</TableCell>
                                            <TableCell className="py-2 px-4">{req.items.length}</TableCell>
                                            <TableCell className="text-right py-2 px-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onSelect={() => handleOpenRequisitionForm(req)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleExportRequisitionPdf(req)}><FileDown className="mr-2 h-4 w-4"/>Export PDF</DropdownMenuItem>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors">
                                                                    <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this requisition.</AlertDialogDescription></AlertDialogHeader>
                                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRequisition(req.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                         </TableRow>
                                         {isExpanded && (
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={5} className='p-0'>
                                                    <div className="p-4">
                                                        <h4 className="font-semibold mb-2 text-sm">Requested Items</h4>
                                                        <Table>
                                                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Unit</TableHead></TableRow></TableHeader>
                                                            <TableBody>
                                                                {req.items.map(item => (
                                                                    <TableRow key={item.id}><TableCell className="py-1">{item.description}</TableCell><TableCell className="text-right py-1">{item.quantity.toFixed(2)}</TableCell><TableCell className="py-1">{item.unit}</TableCell></TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
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
    );

    const renderIssuanceTable = () => (
         <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Material Issuance</CardTitle>
                    <Button size="sm" onClick={() => handleOpenIssuanceForm()}><PlusCircle className="mr-2 h-4 w-4" /> New Issuance</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                         <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Issue No.</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {(project.materialIssuances || []).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (project.materialIssuances || []).map(issuance => {
                                    const isExpanded = expandedIssuances.has(issuance.id);
                                    return (
                                    <Fragment key={issuance.id}>
                                         <TableRow onClick={() => toggleExpansion(issuance.id, 'iss')} className="cursor-pointer">
                                            <TableCell className="py-2 px-4">
                                                <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                            </TableCell>
                                            <TableCell className="py-2 px-4">{format(parseISO(issuance.date), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="font-mono py-2 px-4">{issuance.goodsIssueNo}</TableCell>
                                            <TableCell className="py-2 px-4">{issuance.items.length}</TableCell>
                                            <TableCell className="text-right py-2 px-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onSelect={() => handleOpenIssuanceForm(issuance)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleExportIssuancePdf(issuance)}><FileDown className="mr-2 h-4 w-4"/>Export PDF</DropdownMenuItem>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors">
                                                                    <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this issuance record.</AlertDialogDescription></AlertDialogHeader>
                                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteIssuance(issuance.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                         </TableRow>
                                          {isExpanded && (
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={5} className='p-0'>
                                                    <div className="p-4">
                                                        <h4 className="font-semibold mb-2 text-sm">Issued Items</h4>
                                                        <Table>
                                                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Unit</TableHead></TableRow></TableHeader>
                                                            <TableBody>
                                                                {issuance.items.map(item => (
                                                                    <TableRow key={item.id}><TableCell className="py-1">{item.description}</TableCell><TableCell className="text-right py-1">{item.quantity.toFixed(2)}</TableCell><TableCell className="py-1">{item.unit}</TableCell></TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
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
    );

     const renderReturnTable = () => (
         <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Material Return</CardTitle>
                    <Button size="sm" onClick={() => handleOpenReturnForm()}><PlusCircle className="mr-2 h-4 w-4" /> New Return</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                         <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Return No.</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {(project.materialReturns || []).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (project.materialReturns || []).map(ret => {
                                    const isExpanded = expandedReturns.has(ret.id);
                                    return (
                                    <Fragment key={ret.id}>
                                         <TableRow onClick={() => toggleExpansion(ret.id, 'ret')} className="cursor-pointer">
                                            <TableCell className="py-2 px-4">
                                                <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                            </TableCell>
                                            <TableCell className="py-2 px-4">{format(parseISO(ret.date), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="font-mono py-2 px-4">{ret.goodsReturnNo}</TableCell>
                                            <TableCell className="py-2 px-4">{ret.items.length}</TableCell>
                                            <TableCell className="text-right py-2 px-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onSelect={() => handleOpenReturnForm(ret)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleExportReturnPdf(ret)}><FileDown className="mr-2 h-4 w-4"/>Export PDF</DropdownMenuItem>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors">
                                                                    <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this return record.</AlertDialogDescription></AlertDialogHeader>
                                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteReturn(ret.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                         </TableRow>
                                         {isExpanded && (
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={5} className='p-0'>
                                                    <div className="p-4">
                                                        <h4 className="font-semibold mb-2 text-sm">Returned Items</h4>
                                                        <Table>
                                                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Unit</TableHead></TableRow></TableHeader>
                                                            <TableBody>
                                                                {ret.items.map(item => (
                                                                    <TableRow key={item.id}><TableCell className="py-1">{item.description}</TableCell><TableCell className="text-right py-1">{item.quantity.toFixed(2)}</TableCell><TableCell className="py-1">{item.unit}</TableCell></TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
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
    );

    return (
         <>
            <Card>
                <CardHeader>
                    <CardTitle>Material Management</CardTitle>
                    <CardDescription>Track material lifecycle from requisition to usage.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="requisition">
                        <TabsList className="mb-4">
                            <TabsTrigger value="requisition">Requisition</TabsTrigger>
                            <TabsTrigger value="issuance">Issuance</TabsTrigger>
                            <TabsTrigger value="return">Return</TabsTrigger>
                            <TabsTrigger value="summary">Summary</TabsTrigger>
                        </TabsList>
                        <TabsContent value="requisition">
                            {renderRequisitionTable()}
                        </TabsContent>
                        <TabsContent value="issuance">
                            {renderIssuanceTable()}
                        </TabsContent>
                        <TabsContent value="return">
                            {renderReturnTable()}
                        </TabsContent>
                        <TabsContent value="summary">
                            <MaterialSummaryView project={project} setProject={setProject} plantUnits={plantUnits} company={company} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={isRequisitionFormOpen} onOpenChange={handleCloseRequisitionForm}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="font-headline">{editingRequisition ? 'Edit' : 'Create'} Material Requisition</DialogTitle>
                        <DialogDescription>Fill in the details for the material requisition.</DialogDescription>
                    </DialogHeader>
                    <MaterialRequisitionForm
                        project={project}
                        allRequisitions={allRequisitions}
                        requisition={editingRequisition}
                        onSave={handleSaveRequisition}
                        onCancel={handleCloseRequisitionForm}
                        plantUnits={plantUnits}
                        plantUnitMap={plantUnitMap}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isIssuanceFormOpen} onOpenChange={handleCloseIssuanceForm}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="font-headline">{editingIssuance ? 'Edit' : 'Create'} Material Issuance</DialogTitle>
                        <DialogDescription>Fill in the details for the material issuance.</DialogDescription>
                    </DialogHeader>
                    <MaterialIssuanceForm
                        project={project}
                        plantUnits={plantUnits}
                        allIssuances={allIssuances}
                        issuance={editingIssuance}
                        onSave={handleSaveIssuance}
                        onCancel={handleCloseIssuanceForm}
                        serialInventory={serialInventory}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isReturnFormOpen} onOpenChange={handleCloseReturnForm}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="font-headline">{editingReturn ? 'Edit' : 'Create'} Material Return</DialogTitle>

                        <DialogDescription>Fill in the details for the material return.</DialogDescription>
                    </DialogHeader>
                    <MaterialReturnForm
                        project={project}
                        plantUnits={plantUnits}
                        allReturns={allReturns}
                        materialReturn={editingReturn}
                        onSave={handleSaveReturn}
                        onCancel={handleCloseReturnForm}
                    />
                </DialogContent>
            </Dialog>
         </>
    )
}
