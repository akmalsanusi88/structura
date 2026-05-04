

'use client';
import type { Project, DailyActivityLog, SiteInstruction, PurchaseOrderType, DailyActivityWork, PurchaseOrder, PlantUnit, Company } from '@/lib/types';
import { useState, useMemo, Fragment } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, ChevronDown, FileDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import WorkRecordForm from './work-record-form';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useRouter, useParams } from 'next/navigation';
import { addOrUpdateDailyLog, deleteDailyLogForPO } from '@/app/login/actions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';


interface DailyActivityViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
    plantUnits: PlantUnit[]; 
    poType: PurchaseOrderType;
    company?: Company | null;
}

export default function DailyActivityView({ project, setProject, plantUnits, poType, company }: DailyActivityViewProps) {
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    const projectId = params.projectId as string;
    const { toast } = useToast();

    const [isLogFormOpen, setIsLogFormOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<DailyActivityLog | null>(null);
    const [contextualPoId, setContextualPoId] = useState<string | null>(null);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const rowsPerPage = 10;
    
    const availablePOs = useMemo(() => {
        return project.purchaseOrders.filter(po => po.type === poType);
    }, [project.purchaseOrders, poType]);
    
    const poMap = useMemo(() => new Map(availablePOs.map(po => [po.id, po])), [availablePOs]);

    const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);
    const fullBoqMap = useMemo(() => new Map([...(project.clientBoq || []), ...(project.engineeringBoq || []), ...(project.materialBoq || [])].map(item => [item.id, item])), [project]);
    const clientPoItemMap = useMemo(() => {
        const map = new Map();
        (project.purchaseOrders || []).filter(po => po.type === 'Client').flatMap(po => po.items).forEach(item => map.set(item.id, item));
        return map;
    }, [project.purchaseOrders]);

    const getPuNo = (item: any) => {
        if (item.puNo) return item.puNo;
        if (item.sourceType === 'pu' && item.sourceId) return plantUnitMap.get(item.sourceId)?.puId || 'N/A';
        if (item.sourceType === 'boq' && item.sourceId) {
            const boqItem = fullBoqMap.get(item.sourceId);
            if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                return plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
            }
        }
        if (item.sourceType === 'percentage' && item.sourceId) {
            const clientPoItem = clientPoItemMap.get(item.sourceId);
            if (clientPoItem) {
                const boqItem = fullBoqMap.get(clientPoItem.sourceId!);
                if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                    return plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                }
            }
        }
        return 'Custom';
    };


    const filteredLogs = useMemo(() => {
        const logs: any[] = [];
        (project.dailyActivities || []).forEach(log => {
            const poWorkMap = new Map<string, DailyActivityWork[]>();
            const siMap = new Map<string, SiteInstruction[]>();
            let unlinkedClientSIs: SiteInstruction[] = [];

            // Group work items by their respective POs
            log.work.forEach(w => {
                const po = availablePOs.find(po => po.items.some(item => item.id === w.boqItemId));
                if (po) {
                    if (!poWorkMap.has(po.id)) poWorkMap.set(po.id, []);
                    poWorkMap.get(po.id)!.push(w);
                }
            });

            // Group SIs by their PO, or collect unlinked client SIs
            (log.siteInstructions || []).forEach(si => {
                if (si.purchaseOrderId && poMap.has(si.purchaseOrderId)) {
                    if (!siMap.has(si.purchaseOrderId)) siMap.set(si.purchaseOrderId, []);
                    siMap.get(si.purchaseOrderId)!.push(si);
                } else if (!si.purchaseOrderId && poType === 'Client' && si.context === 'Client') {
                    unlinkedClientSIs.push(si);
                }
            });

            // Get all PO IDs that have either work or SIs
            const allPoIds = new Set([...poWorkMap.keys(), ...siMap.keys()]);
            
            // Create a log entry for each PO
            allPoIds.forEach(poId => {
                const po = poMap.get(poId)!;
                logs.push({
                    ...log,
                    id: `${log.id}-${poId}`,
                    originalLogId: log.id,
                    poDetails: [{
                        poId: po.id,
                        poNo: po.poNo,
                        issuer: po.type === 'Client' ? project.client : po.issuer,
                        work: poWorkMap.get(poId) || [],
                        siteInstructions: siMap.get(poId) || []
                    }]
                });
            });

            // If there are unlinked client SIs, create a separate log entry for them
            if (unlinkedClientSIs.length > 0) {
                 logs.push({
                    ...log,
                    id: `${log.id}-unlinked`,
                    originalLogId: log.id,
                    poDetails: [{
                        poId: 'unlinked',
                        poNo: 'N/A (General)',
                        issuer: project.client,
                        work: [],
                        siteInstructions: unlinkedClientSIs
                    }]
                });
            }
        });

        return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [project.dailyActivities, project.client, availablePOs, poMap, poType]);


    const totalPages = useMemo(() => Math.ceil(filteredLogs.length / rowsPerPage), [filteredLogs.length, rowsPerPage]);

    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredLogs.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredLogs, currentPage, rowsPerPage]);
    
    const toggleLogExpansion = (logId: string) => {
        setExpandedLogs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(logId)) {
                newSet.delete(logId);
            } else {
                newSet.add(logId);
            }
            return newSet;
        });
    };

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    const handleNextPage = () => goToPage(currentPage + 1);
    const handlePrevPage = () => goToPage(currentPage - 1);
    const goToFirstPage = () => setCurrentPage(1);
    const goToLastPage = () => goToPage(totalPages);
    
    const handleOpenLogForm = (log?: any, poId?: string) => {
        const originalLog = project.dailyActivities?.find(l => l.id === log?.originalLogId);
        setEditingLog(originalLog || null);
        setContextualPoId(poId || null);
        setIsLogFormOpen(true);
    };

    const handleSaveLog = async (logDataFromForm: DailyActivityLog, poIdForSave: string | null, teamId?: string | null) => {
        setIsLogFormOpen(false);
        
        try {
            await addOrUpdateDailyLog(logDataFromForm, projectId, companyId, poIdForSave, teamId);
            toast({ title: 'Success', description: `Daily Log ${editingLog ? 'updated' : 'saved'} successfully.` });
            router.refresh();
        } catch (error) {
            console.error('Failed to save log:', error);
            toast({ title: 'Error', description: 'Could not save daily log.', variant: 'destructive' });
        } finally {
            setEditingLog(null);
            setContextualPoId(null);
        }
    };
    
    const handleDeleteLog = async (log: any, poId: string) => {
        const originalActivities = project.dailyActivities;
        const logToDelete = originalActivities.find(l => l.id === log.originalLogId);
        
        if (logToDelete) {
             const po = poMap.get(poId);
             const poItemIds = new Set(po?.items.map(i => i.id));
             
             const updatedWork = logToDelete.work.filter(w => !poItemIds.has(w.boqItemId));
             const updatedSIs = (logToDelete.siteInstructions || []).filter(si => si.purchaseOrderId !== poId);

             let updatedLogs;
             if(updatedWork.length === 0 && updatedSIs.length === 0 && originalActivities.length === 1) {
                 updatedLogs = [];
             } else if (updatedWork.length === 0 && updatedSIs.length === 0) {
                 updatedLogs = originalActivities.filter(l => l.id !== log.originalLogId);
             } else {
                 updatedLogs = originalActivities.map(l => l.id === log.originalLogId ? {...l, work: updatedWork, siteInstructions: updatedSIs } : l);
             }
             setProject(p => ({ ...p, dailyActivities: updatedLogs }));
        }


        try {
            await deleteDailyLogForPO(log.originalLogId, projectId, companyId, poId);
            toast({ title: 'Success', description: `Log entries for PO '${log.poDetails[0].poNo}' deleted.` });
            router.refresh();
        } catch (error) {
            console.error('Failed to delete log:', error);
            toast({ title: 'Error', description: 'Could not delete daily log.', variant: 'destructive' });
            setProject(p => ({...p, dailyActivities: originalActivities })); // Revert on error
        } finally {
            setContextualPoId(null);
        }
    };

    const handleExportPdf = (log: any) => {
        const doc = new jsPDF();
        const poDetail = log.poDetails[0];

        const companyName = company?.name || 'Structura';
        
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(companyName.toUpperCase(), 14, 15);

        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text("Daily Work Record", 14, 22);

        let y_pos = 29;
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Project: ${project.name}`, 14, y_pos);
        y_pos += 7;
        doc.text(`Date: ${format(parseISO(log.date), 'PPP')}`, 14, y_pos);
        y_pos += 7;
        doc.text(`PO No: ${poDetail.poNo}`, 14, y_pos);
        y_pos += 10;
        
        if (log.description) {
            doc.setFontSize(10);
            doc.text("Description:", 14, y_pos);
            y_pos += 5;
            const descriptionLines = doc.splitTextToSize(log.description, doc.internal.pageSize.width - 28);
            doc.text(descriptionLines, 14, y_pos);
            y_pos += descriptionLines.length * 5 + 5;
        }

        const head = [['PU No.', 'Description', 'Quantity', 'Unit']];
        const body = [
            ...poDetail.work.map((w: any) => {
                const poItem = poMap.get(poDetail.poId)?.items.find((i: any) => i.id === w.boqItemId);
                return [getPuNo(poItem), poItem?.description || 'N/A', w.quantity.toFixed(2), poItem?.unit];
            }),
            ...poDetail.siteInstructions.map((si: any) => [getPuNo(si), si.description, si.quantity?.toFixed(2) || '-', si.unit || '-'])
        ];

        autoTable(doc, {
            head, body, startY: y_pos,
            headStyles: { fillColor: [41, 128, 185] },
            theme: 'striped',
        });
        
        let finalY = (doc as any).lastAutoTable.finalY || 80;
        
        if (finalY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            finalY = 20;
        }

        autoTable(doc, {
            startY: finalY + 20,
            body: [['', '']],
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
                    doc.text(text, data.cell.x + data.cell.width / 2, data.cell.y + 18, { align: 'center' });
                }
            }
        });

        doc.save(`${project.name}_WorkLog_${log.date}_${poDetail.poNo}.pdf`);
    };


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Work Records</CardTitle>
                            <CardDescription>Log daily work against a specific purchase order. Includes additional work as Site Instructions (SI).</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenLogForm()} disabled={availablePOs.length === 0}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Daily Log
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Log Summary</TableHead>
                                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedLogs.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No daily logs found for this PO type.
                                    </TableCell></TableRow>
                                ) : (
                                    paginatedLogs.map((log) => {
                                        const isExpanded = expandedLogs.has(log.id);
                                        const poDetail = log.poDetails[0]; // Each entry now has exactly one poDetail
                                        return (
                                        <Fragment key={log.id}>
                                            <TableRow onClick={() => toggleLogExpansion(log.id)} className="cursor-pointer">
                                                <TableCell className="py-2 px-4">
                                                    <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                                </TableCell>
                                                <TableCell className="font-medium py-2 px-4">{format(parseISO(log.date), 'PPP')}</TableCell>
                                                <TableCell className="py-2 px-4">
                                                   <span className="text-sm">
                                                        {poDetail.poNo}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right py-2 px-4">
                                                     <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onSelect={() => handleOpenLogForm(log, poDetail.poId)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleExportPdf(log)}><FileDown className="mr-2 h-4 w-4" /> Export PDF</DropdownMenuItem>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors" onClick={(e) => e.stopPropagation()}><Trash2 className='mr-2 h-4 w-4'/>Delete</Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>This will delete all Work Items and Site Instructions for PO '{poDetail.poNo}' on this date. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteLog(log, poDetail.poId)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                    <TableCell colSpan={4} className="p-0">
                                                         <div className="p-4 space-y-4">
                                                            <div>
                                                                <h4 className="font-semibold text-sm mb-2">PO: {poDetail.poNo} ({poDetail.issuer})</h4>
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow><TableHead>PU No.</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Unit</TableHead></TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {poDetail.work.map((w: any) => {
                                                                            const poItem = poMap.get(poDetail.poId)?.items.find((i: any) => i.id === w.boqItemId);
                                                                            return <TableRow key={w.id}><TableCell className='font-mono text-xs'>{getPuNo(poItem)}</TableCell><TableCell className="py-1">{poItem?.description || 'N/A'}</TableCell><TableCell className="text-right py-1">{w.quantity.toFixed(2)}</TableCell><TableCell className="py-1">{poItem?.unit}</TableCell></TableRow>
                                                                        })}
                                                                        {poDetail.siteInstructions.map((si: any) => (
                                                                            <TableRow key={si.id} className="bg-blue-50/50"><TableCell className='font-mono text-xs'>{getPuNo(si)}</TableCell><TableCell className="py-1">{si.description} <Badge variant="outline">SI</Badge></TableCell><TableCell className="text-right py-1">{si.quantity?.toFixed(2)}</TableCell><TableCell className="py-1">{si.unit}</TableCell></TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
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
                </CardContent>
            </Card>

            <Dialog open={isLogFormOpen} onOpenChange={(isOpen) => { if(!isOpen) { setIsLogFormOpen(false); setEditingLog(null); setContextualPoId(null); }}}>
                <DialogContent className="max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>{editingLog ? 'Edit' : 'Add'} Daily Work Log</DialogTitle>
                        <DialogDescription>
                           Select a date and add all work items completed on that day. Includes additional Site Instructions.
                        </DialogDescription>
                    </DialogHeader>
                    <WorkRecordForm
                        project={project}
                        selectedPoId={contextualPoId}
                        inHouseTeams={[]}
                        editingLog={editingLog}
                        onSave={handleSaveLog}
                        onCancel={() => { setIsLogFormOpen(false); setEditingLog(null); setContextualPoId(null); }}
                        plantUnits={plantUnits}
                        context={poType}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
