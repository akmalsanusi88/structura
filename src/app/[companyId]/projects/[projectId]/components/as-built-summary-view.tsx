
'use client';
import type { Project, PurchaseOrder, PurchaseOrderItem, SiteInstruction, PlantUnit, Company, BoQItem, ClientBoQItem } from "@/lib/types";
import { useMemo, useState, Fragment, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import { FileUp, FileDown } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import SiteInstructionPdfForm from './site-instruction-pdf-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";


interface AsBuiltSummaryViewProps {
    project: Project;
    selectedPoId: string;
    onPoChange: (poId: string) => void;
    availablePOs: PurchaseOrder[];
    plantUnits: PlantUnit[];
    company?: Company | null;
    allCompanies: Company[];
}

export default function AsBuiltSummaryView({ project, selectedPoId, onPoChange, availablePOs, plantUnits, company, allCompanies }: AsBuiltSummaryViewProps) {
    const [isSiPdfFormOpen, setIsSiPdfFormOpen] = useState(false);
    const [showManagementFee, setShowManagementFee] = useState(true);
    const [showSst, setShowSst] = useState(false);
    
    const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);

    const fullBoqMap = useMemo(() => {
        const allItems = [
            ...(project.clientBoq || []),
            ...(project.engineeringBoq || []),
            ...(project.materialBoq || []),
        ];
        return new Map(allItems.map(item => [item.id, item]));
    }, [project]);

    const selectedPo = useMemo(() => {
        return project.purchaseOrders.find(po => po.id === selectedPoId);
    }, [project.purchaseOrders, selectedPoId]);

    useEffect(() => {
        if (selectedPo) {
            const hasFee = selectedPo.items.some(item => item.managementFee && item.managementFee > 0);
            setShowManagementFee(hasFee);
            setShowSst((selectedPo.sstPercentage || 0) > 0);
        } else {
            setShowManagementFee(false);
            setShowSst(false);
        }
    }, [selectedPo]);

    const poItemsForSummary = useMemo(() => {
        if (!selectedPo) return [];
        return selectedPo.items;
    }, [selectedPo]);


    const poSummary = useMemo(() => {
        const summary = new Map<string, { 
            poItem: PurchaseOrderItem; 
            asBuiltQty: number; 
            puNo: string; 
            asBuiltValue: number;
            balanceQty: number;
            balanceValue: number;
            poManagementFee: number;
            asBuiltManagementFee: number;
            balanceManagementFee: number;
            totalAsBuiltValue: number;
        }>();

        if (!selectedPo) return [];

        poItemsForSummary.forEach(poItem => {
            let puNo = poItem.puNo || 'N/A';
             if (poItem.sourceType === 'pu' && poItem.sourceId) {
                puNo = plantUnitMap.get(poItem.sourceId)?.puId || 'N/A';
            } else if (poItem.sourceType === 'boq' && poItem.sourceId) {
                const boqItem = fullBoqMap.get(poItem.sourceId);
                if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                    puNo = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                }
            } else if (poItem.sourceType === 'percentage' && poItem.sourceId) {
                const clientPoItem = project.purchaseOrders.flatMap(p => p.items).find(i => i.id === poItem.sourceId);
                if (clientPoItem) {
                    const boqItem = fullBoqMap.get(clientPoItem.sourceId!);
                    if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                        puNo = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                    }
                }
            }
            summary.set(poItem.id, { 
                poItem, 
                asBuiltQty: 0, 
                puNo, 
                asBuiltValue: 0, 
                balanceQty: Number(poItem.quantity) || 0,
                balanceValue: (Number(poItem.quantity) || 0) * poItem.rate,
                poManagementFee: poItem.managementFee || 0,
                asBuiltManagementFee: 0,
                balanceManagementFee: poItem.managementFee || 0,
                totalAsBuiltValue: 0
            });
        });

        project.dailyActivities?.forEach(log => {
            log.work.forEach(workRecord => {
                const existing = summary.get(workRecord.boqItemId);
                if (existing) {
                    existing.asBuiltQty += workRecord.quantity;
                }
            });
        });
        
        summary.forEach(entry => {
            const { poItem, asBuiltQty } = entry;
            const poQuantity = Number(poItem.quantity) || 0;
            const totalMMF = poItem.managementFee || 0;
            
            entry.asBuiltValue = asBuiltQty * poItem.rate;
            entry.balanceQty = poQuantity - asBuiltQty;
            entry.balanceValue = entry.balanceQty * poItem.rate;

            if (totalMMF > 0 && poQuantity > 0) {
                entry.asBuiltManagementFee = (asBuiltQty / poQuantity) * totalMMF;
                entry.balanceManagementFee = (entry.balanceQty / poQuantity) * totalMMF;
            } else {
                entry.asBuiltManagementFee = 0;
                entry.balanceManagementFee = 0;
            }

            entry.totalAsBuiltValue = entry.asBuiltValue + entry.asBuiltManagementFee;
        });

        return Array.from(summary.values());
    }, [project.dailyActivities, poItemsForSummary, plantUnitMap, fullBoqMap, project.purchaseOrders, selectedPo]);

    const siSummary = useMemo(() => {
        if (!selectedPo) return [];
        return project.dailyActivities
            ?.flatMap(log => log.siteInstructions || [])
            .filter((si): si is SiteInstruction => {
                if (!si || !si.context) return false;
                return si.purchaseOrderId === selectedPo.id;
            })
            .map(si => {
                const puNo = si.sourceType === 'pu' && si.sourceId ? plantUnitMap.get(si.sourceId)?.puId || 'N/A' : 'Custom';
                return { ...si, puNo };
            }) || [];
    }, [project.dailyActivities, selectedPo, plantUnitMap]);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };
    
    const totals = useMemo(() => {
        const result = {
            poValue: 0,
            poManagementFee: 0,
            asBuiltValue: 0,
            asBuiltManagementFee: 0,
            balanceValue: 0,
            balanceManagementFee: 0,
            totalAsBuiltValue: 0,
            sstPercentage: 0,
            sstAmount: 0,
        };

        poSummary.forEach(item => {
            result.poValue += (Number(item.poItem.quantity) || 0) * item.poItem.rate;
            result.poManagementFee += item.poManagementFee;
            result.asBuiltValue += item.asBuiltValue;
            result.asBuiltManagementFee += item.asBuiltManagementFee;
            result.balanceValue += item.balanceValue;
            result.balanceManagementFee += item.balanceManagementFee;
        });
        
        const asBuiltSubtotal = result.asBuiltValue + (showManagementFee ? result.asBuiltManagementFee : 0);
        
        result.sstPercentage = selectedPo?.sstPercentage || 0;
        if (showSst && result.sstPercentage > 0) {
            result.sstAmount = asBuiltSubtotal * (result.sstPercentage / 100);
        }

        const asBuiltSiValue = siSummary.reduce((acc, si) => acc + si.amount, 0);
        result.totalAsBuiltValue = asBuiltSubtotal + result.sstAmount + asBuiltSiValue;

        return result;
    }, [poSummary, siSummary, showManagementFee, selectedPo, showSst]);

    const handleExportExcel = async () => {
        if (!selectedPo) return;
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        
        const header = ['PU No', 'Description', 'Unit', 'Rate (RM)', 'PO Qty', 'PO Value (RM)', 'As-Built Qty', 'As-Built Value (RM)', 'Balance Qty', 'Balance Value (RM)'];
        if (showManagementFee) header.push('Material Management Fee (RM)');
        header.push('Total As-Built Value (RM)');

        let data = poSummary.map(({ poItem, puNo, asBuiltQty, balanceQty, asBuiltValue, balanceValue, asBuiltManagementFee, totalAsBuiltValue }) => {
            const poQuantity = Number(poItem.quantity) || 0;
            const poValue = poQuantity * poItem.rate;
            const row: any = {
                'PU No': puNo,
                'Description': poItem.description,
                'Unit': poItem.unit,
                'Rate (RM)': poItem.rate,
                'PO Qty': poQuantity,
                'PO Value (RM)': poValue,
                'As-Built Qty': asBuiltQty,
                'As-Built Value (RM)': asBuiltValue,
                'Balance Qty': balanceQty,
                'Balance Value (RM)': balanceValue,
            };
            if(showManagementFee) row['Material Management Fee (RM)'] = asBuiltManagementFee;
            row['Total As-Built Value (RM)'] = showManagementFee ? totalAsBuiltValue : asBuiltValue;
            return row;
        });

        const asBuiltSiValue = siSummary.reduce((acc, si) => acc + si.amount, 0);

        data.push({} as any); // spacer
        if (asBuiltSiValue > 0) {
            data.push({ 'Description': 'Site Instructions Total', 'Total As-Built Value (RM)': asBuiltSiValue } as any);
        }
        if (showSst && totals.sstAmount > 0) {
            data.push({ 'Description': `SST (${totals.sstPercentage}%)`, 'Total As-Built Value (RM)': totals.sstAmount } as any);
        }
        data.push({ 'Description': 'Grand Total As-Built', 'Total As-Built Value (RM)': totals.totalAsBuiltValue } as any);

        const ws = XLSX.utils.json_to_sheet(data, { header });
        XLSX.utils.book_append_sheet(wb, ws, `As-Built Summary ${selectedPo.poNo}`);
        XLSX.writeFile(wb, `${project.name} - As-Built Summary ${selectedPo.poNo}.xlsx`);
    };

    const handleExportPdf = async () => {
        if (!selectedPo) return;
        
        const companyName = company ? company.name : 'Structura';
        const formatNumber = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const doc = new jsPDF({ orientation: 'landscape' });
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 14;
        const max_width = page_width - margin * 2;

        doc.setFontSize(10); doc.setTextColor(150); doc.text(companyName.toUpperCase(), 14, 15);
        doc.setFontSize(18); doc.setTextColor(40);
        
        const titleLines = doc.splitTextToSize("As-Built Summary", max_width);
        doc.text(titleLines, page_width / 2, 22, { align: 'center' }); 

        let y_pos = 29;
        doc.setFontSize(11);
        doc.setTextColor(100);
        
        const projectNameText = doc.splitTextToSize(`Project: ${project.name}`, max_width);
        doc.text(projectNameText, 14, y_pos);
        y_pos += doc.getTextDimensions(projectNameText).h;

        y_pos += 2;
        doc.text(`PO No: ${selectedPo.poNo || 'N/A'}`, 14, y_pos);
        y_pos += 10;
        
        const head: any[][] = [['PU No', 'Description', 'Unit', 'Rate', 'PO Qty', 'PO Value', 'As-Built Qty', 'As-Built Value', 'Balance Qty', 'Balance Value']];
        
        const body: any[][] = [];

        poSummary.forEach(({ poItem, asBuiltQty, puNo, asBuiltValue, balanceValue, poManagementFee, asBuiltManagementFee, balanceManagementFee }) => {
            const poQuantity = Number(poItem.quantity) || 0;
            const poValue = poQuantity * poItem.rate;
            const balanceQtyCalculated = poItem.rate > 0 ? balanceValue / poItem.rate : 0;
            
            body.push([
                puNo || 'N/A',
                poItem.description,
                poItem.unit,
                { content: formatNumber(poItem.rate), styles: { halign: 'right' } },
                { content: formatNumber(poQuantity), styles: { halign: 'right' } },
                { content: formatCurrency(poValue), styles: { halign: 'right' } },
                { content: formatNumber(asBuiltQty), styles: { halign: 'right' } },
                { content: formatCurrency(asBuiltValue), styles: { halign: 'right' } },
                { content: formatNumber(balanceQtyCalculated), styles: { halign: 'right' } },
                { content: formatCurrency(balanceValue), styles: { halign: 'right' } },
            ]);

            if (showManagementFee && poManagementFee > 0) {
                 body.push([
                    { content: 'Material Management Fee', colSpan: 5, styles: { fontStyle: 'italic', halign: 'right', cellPadding: {top: 0.5, bottom: 2, left: 2, right: 2}, fontSize: 7 } },
                    { content: formatCurrency(poManagementFee), styles: { fontStyle: 'italic', halign: 'right', fontSize: 7 } },
                    null,
                    { content: formatCurrency(asBuiltManagementFee), styles: { fontStyle: 'italic', halign: 'right', fontSize: 7 } },
                    null,
                    { content: formatCurrency(balanceManagementFee), styles: { fontStyle: 'italic', halign: 'right', fontSize: 7 } },
                ]);
            }
        });
        
        const asBuiltSiValue = siSummary.reduce((acc, si) => acc + si.amount, 0);
        
        const foot: any[][] = [];

        foot.push([
            { content: 'Subtotal', colSpan: 7, styles: { halign: 'right' } },
            { content: formatCurrency(totals.asBuiltValue), styles: { halign: 'right' } }, '',
            { content: formatCurrency(totals.balanceValue), styles: { halign: 'right' } },
        ]);
        
        if (showManagementFee) {
            foot.push([
                { content: 'Total Material Management Fee', colSpan: 7, styles: { halign: 'right' } },
                { content: formatCurrency(totals.asBuiltManagementFee), styles: { halign: 'right' } }, '',
                { content: formatCurrency(totals.balanceManagementFee), styles: { halign: 'right' } },
            ]);
        }

        const asBuiltSubtotalWithFee = totals.asBuiltValue + (showManagementFee ? totals.asBuiltManagementFee : 0);
        const sstAmount = showSst ? asBuiltSubtotalWithFee * (totals.sstPercentage / 100) : 0;
        
        if (showSst && sstAmount > 0) {
            foot.push([
                { content: `SST (${totals.sstPercentage}%)`, colSpan: 7, styles: { halign: 'right' } },
                { content: formatCurrency(sstAmount), styles: { halign: 'right' } }, '', ''
            ]);
        }
        
        if (asBuiltSiValue > 0) {
            foot.push([
                { content: 'Site Instructions Total', colSpan: 7, styles: { halign: 'right' } },
                { content: formatCurrency(asBuiltSiValue), styles: { halign: 'right' } }, '', ''
            ]);
        }
        
        const grandTotalAsBuilt = asBuiltSubtotalWithFee + sstAmount + asBuiltSiValue;
        foot.push([
            { content: 'Grand Total', colSpan: 7, styles: { halign: 'right' } },
            { content: formatCurrency(grandTotalAsBuilt), styles: { halign: 'right' } }, '',
            { content: formatCurrency(totals.balanceValue + (showManagementFee ? totals.balanceManagementFee : 0)), styles: { halign: 'right' } },
        ]);
        
        let finalY = y_pos;
        
        autoTable(doc, {
            head, body, foot, startY: finalY, 
            headStyles: { fillColor: [41, 128, 185], fontSize: 7, cellPadding: 1, halign: 'center' }, 
            footStyles: { fontSize: 7, fillColor: [230, 230, 230], textColor: 0, fontStyle: 'bold' }, 
            bodyStyles: {fontSize: 7, cellPadding: 1},
            didParseCell: (data) => {
                 if(data.cell.raw && (data.cell.raw as any).colSpan) {
                     data.cell.styles.halign = 'right';
                 }
            }
        });
        
        finalY = (doc as any).lastAutoTable.finalY;

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

        doc.save(`${project.name} - As-Built Summary ${selectedPo.poNo}.pdf`);
    };

    if (availablePOs.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>As-Built vs. PO Summary</CardTitle>
                    <CardDescription>There are no Purchase Orders of this type to summarize.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    const colSpan = showManagementFee ? 12 : 11;

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>As-Built vs. PO Summary ({selectedPo?.type})</CardTitle>
                            <CardDescription>A summary of work done compared to a selected Purchase Order.</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="show-sst"
                                    checked={showSst}
                                    onCheckedChange={(checked) => setShowSst(!!checked)}
                                    disabled={(selectedPo?.sstPercentage || 0) === 0}
                                />
                                <Label htmlFor="show-sst" className="text-sm font-medium">Show SST</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="show-management-fee"
                                    checked={showManagementFee}
                                    onCheckedChange={(checked) => setShowManagementFee(!!checked)}
                                />
                                <Label htmlFor="show-management-fee" className="text-sm font-medium">Show Mngmt. Fee</Label>
                            </div>
                            <Select value={selectedPoId} onValueChange={onPoChange}>
                                <SelectTrigger className="w-[250px]">
                                    <SelectValue placeholder="Select a PO..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availablePOs.map(po => (
                                        <SelectItem key={po.id} value={po.id}>{po.poNo}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!selectedPo}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!selectedPo}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PU No</TableHead>
                                    <TableHead className="w-[25%]">Description</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                    <TableHead className="text-right">PO Qty</TableHead>
                                    <TableHead className="text-right">PO Value</TableHead>
                                    <TableHead className="text-right">As-Built Qty</TableHead>
                                    <TableHead className="text-right">As-Built Value</TableHead>
                                    <TableHead className="text-right">Balance Qty</TableHead>
                                    <TableHead className="text-right">Balance Value</TableHead>
                                    {showManagementFee && <TableHead className="text-right">Material Management Fee</TableHead>}
                                    <TableHead className="text-right">Total As-Built Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {poSummary.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={colSpan} className="text-center h-24 text-muted-foreground">No items to summarize for this PO.</TableCell>
                                    </TableRow>
                                ) : (
                                    poSummary.map(({ poItem, asBuiltQty, puNo, asBuiltValue, balanceQty, balanceValue, asBuiltManagementFee, totalAsBuiltValue }) => {
                                        const poQuantity = Number(poItem.quantity) || 0;
                                        const poValue = poQuantity * poItem.rate;
                                        const finalTotalAsBuilt = asBuiltValue + (showManagementFee ? asBuiltManagementFee : 0);

                                        return (
                                            <TableRow key={poItem.id}>
                                                <TableCell className="font-mono py-2">{puNo}</TableCell>
                                                <TableCell className="font-medium py-2">{poItem.description}</TableCell>
                                                <TableCell className="py-2">{poItem.unit}</TableCell>
                                                <TableCell className="text-right py-2">{formatCurrency(poItem.rate)}</TableCell>
                                                <TableCell className="text-right py-2">{poQuantity.toFixed(2)}</TableCell>
                                                <TableCell className="text-right py-2">{formatCurrency(poValue)}</TableCell>
                                                <TableCell className="text-right py-2">{asBuiltQty.toFixed(2)}</TableCell>
                                                <TableCell className="text-right py-2">{formatCurrency(asBuiltValue)}</TableCell>
                                                <TableCell className={`text-right py-2 ${balanceQty < 0 ? "text-red-500" : ""}`}>{balanceQty.toFixed(2)}</TableCell>
                                                <TableCell className={`text-right py-2 ${balanceValue < 0 ? "text-red-500" : ""}`}>{formatCurrency(balanceValue)}</TableCell>
                                                {showManagementFee && <TableCell className="text-right py-2">{formatCurrency(asBuiltManagementFee)}</TableCell>}
                                                <TableCell className="text-right font-bold py-2">{formatCurrency(finalTotalAsBuilt)}</TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={showManagementFee ? 11 : 10} className="text-right font-semibold">As-Built Subtotal</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(totals.asBuiltValue + (showManagementFee ? totals.asBuiltManagementFee : 0))}</TableCell>
                                </TableRow>
                                 {showSst && totals.sstAmount > 0 && (
                                    <TableRow>
                                        <TableCell colSpan={showManagementFee ? 11 : 10} className="text-right font-semibold">SST ({totals.sstPercentage}%)</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(totals.sstAmount)}</TableCell>
                                    </TableRow>
                                )}
                                {siSummary.length > 0 && (
                                    <TableRow>
                                        <TableCell colSpan={showManagementFee ? 11 : 10} className="text-right font-semibold">Site Instructions Total</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(siSummary.reduce((acc, si) => acc + si.amount, 0))}</TableCell>
                                    </TableRow>
                                )}
                                <TableRow>
                                    <TableCell colSpan={showManagementFee ? 11 : 10} className="text-right font-bold">Final As-Built Value</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(totals.totalAsBuiltValue)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>

                    {siSummary.length > 0 && (
                        <div className="mt-6">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-muted-foreground">Site Instructions (Additional Work)</h4>
                                <Button variant="outline" size="sm" onClick={() => setIsSiPdfFormOpen(true)}>
                                    <FileDown className="mr-2 h-4 w-4" /> Export SI as Quotation
                                </Button>
                            </div>
                            <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>PU No</TableHead>
                                            <TableHead className="w-[40%]">Description</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Unit</TableHead>
                                            <TableHead className="text-right">Rate</TableHead>
                                            <TableHead className="text-right">Mngmt. Fee</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                         {siSummary.map(si => (
                                            <TableRow key={si.id}>
                                                <TableCell className="font-mono">{si.puNo}</TableCell>
                                                <TableCell className="font-medium">{si.description}</TableCell>
                                                <TableCell>{si.quantity?.toFixed(2)}</TableCell>
                                                <TableCell>{si.unit}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(si.rate || 0)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(si.managementFee || 0)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(si.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-right font-bold">SI Total</TableCell>
                                            <TableCell className="text-right font-bold">{formatCurrency(siSummary.reduce((acc, si) => acc + si.amount, 0))}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isSiPdfFormOpen} onOpenChange={setIsSiPdfFormOpen}>
                 <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Export Site Instructions as Quotation</DialogTitle>
                    </DialogHeader>
                    {selectedPo && (
                        <SiteInstructionPdfForm
                            siteInstructions={siSummary}
                            project={project}
                            company={company}
                            allCompanies={allCompanies}
                            purchaseOrder={selectedPo}
                            onCancel={() => setIsSiPdfFormOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
