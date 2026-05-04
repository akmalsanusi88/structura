
'use client';
import type { Project, PlantUnit, Company, SerialInfo, MaterialIssuanceItem, MaterialOnSiteUsage, MaterialIssuance, MaterialReturn } from "@/lib/types";
import { useMemo, useState, Fragment, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUp, FileDown, ChevronDown, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useParams, useRouter } from 'next/navigation';
import { addOrUpdateOnSiteUse } from "@/app/login/actions";


interface MaterialSummaryViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
    plantUnits: PlantUnit[];
    company?: Company | null;
}

interface SummaryItem {
    sourceId: string;
    description: string;
    unit: string;
    rate: number;
    issuedQty: number;
    returnedQty: number;
    onSiteUseQty: number;
    issuedSerials: SerialInfo[];
    returnedSerials: SerialInfo[];
    issuances: { docNo: string; items: MaterialIssuanceItem[], date: string }[];
    returns: { docNo: string; items: { quantity: number; serials?: SerialInfo[] }[], date: string }[];
}

export default function MaterialSummaryView({ project, setProject, plantUnits, company }: MaterialSummaryViewProps) {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    const projectId = params.projectId as string;
    
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [onSiteUseQuantities, setOnSiteUseQuantities] = useState<Record<string, number>>({});

    useEffect(() => {
        const initialQuantities: Record<string, number> = {};
        (project.materialOnSiteUsage || []).forEach(usage => {
            initialQuantities[usage.sourceId] = usage.quantity;
        });
        setOnSiteUseQuantities(initialQuantities);
    }, [project.materialOnSiteUsage]);

    const toggleRow = (sourceId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sourceId)) {
                newSet.delete(sourceId);
            } else {
                newSet.add(sourceId);
            }
            return newSet;
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };
    
    const handleSaveSummary = async () => {
        try {
            const updates = Object.entries(onSiteUseQuantities).map(([sourceId, quantity]) => 
                addOrUpdateOnSiteUse({ projectId, companyId, sourceId, quantity })
            );
            await Promise.all(updates);
            toast({ title: "Saved", description: "On-site use quantities have been updated." });
            router.refresh();
        } catch (error) {
            console.error("Error saving summary:", error);
            toast({ title: "Error", description: "Failed to save summary.", variant: 'destructive' });
        }
    };

    const handleOnSiteUseChange = (sourceId: string, quantity: number) => {
        setOnSiteUseQuantities(prev => ({
            ...prev,
            [sourceId]: quantity
        }));
    };
    
    const summaryData = useMemo(() => {
        const rateMap = new Map<string, number>();
        project.materialBoq?.forEach(item => {
            rateMap.set(item.id, item.rate);
        });
        plantUnits.filter(pu => pu.category === 'Material PU').forEach(item => {
            if (!rateMap.has(item.id)) rateMap.set(item.id, item.rate);
        });

        const summaryMap = new Map<string, SummaryItem>();

        const allIssuanceItems = project.materialIssuances?.flatMap(i => i.items.map(item => ({...item, docNo: i.goodsIssueNo, date: i.date}))) ?? [];
        const allReturnItems = project.materialReturns?.flatMap(r => r.items.map(item => ({...item, docNo: r.goodsReturnNo, date: r.date}))) ?? [];
        
        const allMovedItems = new Map<string, {description: string, unit: string}>();
        [...allIssuanceItems, ...allReturnItems].forEach(item => {
            if (!allMovedItems.has(item.sourceId)) {
                allMovedItems.set(item.sourceId, {description: item.description, unit: item.unit});
            }
        });

        allMovedItems.forEach((value, sourceId) => {
             if (!summaryMap.has(sourceId)) {
                summaryMap.set(sourceId, {
                    sourceId: sourceId,
                    description: value.description,
                    unit: value.unit,
                    rate: rateMap.get(sourceId) || 0,
                    issuedQty: 0,
                    returnedQty: 0,
                    onSiteUseQty: onSiteUseQuantities[sourceId] || 0,
                    issuedSerials: [],
                    returnedSerials: [],
                    issuances: [],
                    returns: [],
                });
            }
        });

        project.materialIssuances?.forEach(issuance => {
            issuance.items.forEach(item => {
                const entry = summaryMap.get(item.sourceId);
                if(entry) {
                    entry.issuedQty += item.quantity;
                    const existingIssuance = entry.issuances.find(i => i.docNo === issuance.goodsIssueNo);
                    if (existingIssuance) {
                      existingIssuance.items.push(item);
                    } else {
                      entry.issuances.push({ docNo: issuance.goodsIssueNo, items: [item], date: issuance.date });
                    }
                    if (item.serials) {
                        entry.issuedSerials.push(...item.serials);
                    }
                }
            });
        });

        project.materialReturns?.forEach(ret => {
            ret.items.forEach(item => {
                const entry = summaryMap.get(item.sourceId);
                if(entry) {
                    entry.returnedQty += item.quantity;
                    const existingReturn = entry.returns.find(r => r.docNo === ret.goodsReturnNo);
                    if (existingReturn) {
                        existingReturn.items.push(item);
                    } else {
                        entry.returns.push({ docNo: ret.goodsReturnNo, items: [item], date: ret.date });
                    }
                    if (item.serials) {
                        entry.returnedSerials.push(...item.serials);
                    }
                }
            });
        });
        
        summaryMap.forEach(entry => {
            entry.onSiteUseQty = onSiteUseQuantities[entry.sourceId] || 0;
        });

        return Array.from(summaryMap.values());
    }, [project, plantUnits, onSiteUseQuantities]);
    
    const totals = useMemo(() => {
        return summaryData.reduce((acc, item) => {
            const usedQty = item.issuedQty - item.returnedQty;
            const onSiteBalance = usedQty - item.onSiteUseQty;
            acc.usedValue += usedQty * item.rate;
            acc.onSiteValue += onSiteBalance * item.rate;
            return acc;
        }, { usedValue: 0, onSiteValue: 0 });
    }, [summaryData]);

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const data = summaryData.map((item) => {
            const usedQty = item.issuedQty - item.returnedQty;
            const onSiteBalance = usedQty - item.onSiteUseQty;
            const usedValue = usedQty * item.rate;
            const onSiteValue = onSiteBalance * item.rate;
            return {
                'Description': item.description,
                'Unit': item.unit,
                'Issued': item.issuedQty,
                'Returned': item.returnedQty,
                'Used': usedQty,
                'On-site Use': item.onSiteUseQty,
                'On-site Balance': onSiteBalance,
                'Used Value (RM)': usedValue,
                'On-site Value (RM)': onSiteValue,
                'Issued Serials': item.issuedSerials.map(s => `${s.serialNo || 'No S/N'}: ${s.quantity}`).join('; '),
                'Returned Serials': item.returnedSerials.map(s => `${s.serialNo || 'No S/N'}: ${s.quantity}`).join('; '),
            };
        });

        data.push({
            'Description': 'Totals',
            'Used Value (RM)': totals.usedValue,
            'On-site Value (RM)': totals.onSiteValue,
        } as any);

        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Material Summary');
        XLSX.writeFile(wb, `${project.name} - Material Usage Summary.xlsx`);
    };

    const handleExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const companyName = company ? company.name : 'Structura';
        const poNumbers = project.purchaseOrders.filter(po => po.type === 'Subcontractor').map(po => po.poNo).join(', ');

        const doc = new jsPDF({ orientation: 'landscape' });
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 14;
        const max_width = page_width - margin * 2;
        
        doc.setFontSize(10); doc.setTextColor(150); doc.text(companyName.toUpperCase(), margin, 15);
        doc.setFontSize(18); doc.setTextColor(40); doc.text('Material Settlement', margin, 22);
        
        let y_pos = 29;
        doc.setFontSize(11);
        doc.setTextColor(100);

        const projectNameText = doc.splitTextToSize(`Project: ${project.name}`, max_width);
        doc.text(projectNameText, margin, y_pos);
        y_pos += doc.getTextDimensions(projectNameText).h;

        const projectNoText = doc.splitTextToSize(`Project No: ${project.projectNo || 'N/A'}`, max_width);
        doc.text(projectNoText, margin, y_pos + 2);
        y_pos += doc.getTextDimensions(projectNoText).h + 2;

        const poNumbersText = doc.splitTextToSize(`PO No: ${poNumbers || 'N/A'}`, max_width);
        doc.text(poNumbersText, margin, y_pos + 2);
        y_pos += doc.getTextDimensions(poNumbersText).h + 5;

        const head = [['Description', 'Unit', 'Issued', 'Returned', 'Used', 'On-site Use', 'Balance', 'Used Value', 'On-site Value']];
        
        const body: any[][] = [];
        summaryData.forEach((item) => {
            const usedQty = item.issuedQty - item.returnedQty;
            const onSiteBalance = usedQty - item.onSiteUseQty;
            const usedValue = usedQty * item.rate;
            const onSiteValue = onSiteBalance * item.rate;
            body.push([
                item.description, item.unit, item.issuedQty.toFixed(2), item.returnedQty.toFixed(2), usedQty.toFixed(2),
                item.onSiteUseQty.toFixed(2), onSiteBalance.toFixed(2),
                formatCurrency(usedValue), formatCurrency(onSiteValue)
            ]);

            const subRowStyle = { fontSize: 7, textColor: [100, 100, 100], fontStyle: 'italic', cellPadding: { top: 0.5, right: 2, bottom: 0.5, left: 4 } };
            const subRowQtyStyle = { ...subRowStyle, halign: 'right' as const };
            
            (item.issuances || []).forEach(issuance => {
                const totalIssued = issuance.items.reduce((sum, i) => sum + i.quantity, 0);
                if (totalIssued > 0) {
                  body.push([{ content: `  - Issued: ${issuance.docNo}`, styles: subRowStyle, colSpan: 2 }, { content: totalIssued.toFixed(2), styles: subRowQtyStyle }]);
                }
                 issuance.items.forEach(issuanceItem => {
                    (issuanceItem.serials || []).filter(s => s.quantity > 0).forEach(serial => {
                       body.push([{ content: `    S/N: ${serial.serialNo || 'N/A'}`, styles: {...subRowStyle, fontSize: 6}, colSpan: 2 }, { content: serial.quantity.toFixed(2), styles: {...subRowQtyStyle, fontSize: 6} }]);
                    });
                 });
            });

            (item.returns || []).forEach(ret => {
                const totalReturned = ret.items.reduce((sum, i) => sum + i.quantity, 0);
                 if (totalReturned > 0) {
                    body.push([{ content: `  - Returned: ${ret.docNo}`, styles: subRowStyle, colSpan: 3 }, { content: totalReturned.toFixed(2), styles: subRowQtyStyle }]);
                 }
                  ret.items.forEach(returnItem => {
                    (returnItem.serials || []).filter(s => s.quantity > 0).forEach(serial => {
                       body.push([{ content: `    S/N: ${serial.serialNo || 'N/A'}`, styles: {...subRowStyle, fontSize: 6}, colSpan: 3 }, { content: serial.quantity.toFixed(2), styles: {...subRowQtyStyle, fontSize: 6} }]);
                    });
                 });
            });
        });

        autoTable(doc, {
            head, body, startY: y_pos, headStyles: { fillColor: [41, 128, 185], fontSize: 8, cellPadding: 1.5 }, bodyStyles: { fontSize: 8, cellPadding: 1.5 },
            foot: [['Total', '', '', '', '', '', '', formatCurrency(totals.usedValue), formatCurrency(totals.onSiteValue)]],
            footStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0, fontSize: 8, cellPadding: 1.5 },
            didParseCell: (data) => {
                 if (data.column.index > 1) {
                    data.cell.styles.halign = 'right';
                 }
                 if(data.cell.raw && (data.cell.raw as any).colSpan) {
                     data.cell.styles.halign = 'left';
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

        doc.save(`${project.name} - Material Settlement.pdf`);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Material Usage Summary</CardTitle>
                        <CardDescription>Overview of material consumption for the project.</CardDescription>
                    </div>
                     <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2" /> Excel</Button>
                        <Button variant="outline" size="sm" onClick={handleExportPdf}><FileDown className="mr-2" /> PDF</Button>
                        <Button size="sm" onClick={handleSaveSummary}><Save className="mr-2" /> Save Summary</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg max-h-[600px] overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className="w-[25%] min-w-[200px]">Description</TableHead>
                                <TableHead>Issued</TableHead>
                                <TableHead>Returned</TableHead>
                                <TableHead>Used</TableHead>
                                <TableHead>On-site Use</TableHead>
                                <TableHead>On-site Balance</TableHead>
                                <TableHead className="text-right">Used Value</TableHead>
                                <TableHead className="text-right">On-site Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaryData.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No material movements recorded.</TableCell></TableRow>
                            ) : (
                                summaryData.map((item) => {
                                    const usedQty = item.issuedQty - item.returnedQty;
                                    const onSiteBalance = usedQty - (onSiteUseQuantities[item.sourceId] || 0);
                                    const usedValue = usedQty * item.rate;
                                    const onSiteValue = onSiteBalance * item.rate;
                                    const isExpanded = expandedRows.has(item.sourceId);
                                    const hasDetails = item.issuances.length > 0 || item.returns.length > 0;

                                    return (
                                        <Fragment key={item.sourceId}>
                                            <TableRow>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center">
                                                        {hasDetails && (
                                                            <Button variant="ghost" size="sm" className="mr-2 h-8 w-8 p-0" onClick={() => toggleRow(item.sourceId)}>
                                                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                            </Button>
                                                        )}
                                                        <span className={!hasDetails ? 'ml-10' : ''}>{item.description}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.issuedQty.toFixed(2)}</TableCell>
                                                <TableCell>{item.returnedQty.toFixed(2)}</TableCell>
                                                <TableCell className="font-semibold">{usedQty.toFixed(2)}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        className="h-8 w-24"
                                                        value={onSiteUseQuantities[item.sourceId] || ''}
                                                        onChange={(e) => handleOnSiteUseChange(item.sourceId, parseFloat(e.target.value) || 0)}
                                                    />
                                                </TableCell>
                                                <TableCell className={`font-semibold ${onSiteBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>{onSiteBalance.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(usedValue)}</TableCell>
                                                <TableCell className={`text-right font-bold ${onSiteBalance >= 0 ? '' : 'text-red-500'}`}>{formatCurrency(onSiteValue)}</TableCell>
                                            </TableRow>
                                            {isExpanded && hasDetails && (
                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                    <TableCell colSpan={8} className="p-0">
                                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <div>
                                                                <h4 className="font-semibold mb-2 text-sm">Issuances</h4>
                                                                {item.issuances.length > 0 ? (
                                                                    <div className="border rounded-md max-h-48 overflow-auto">
                                                                        <Table>
                                                                            <TableHeader><TableRow><TableHead>Doc No.</TableHead><TableHead className="text-right">Qty</TableHead></TableRow></TableHeader>
                                                                            <TableBody>
                                                                                {item.issuances.map((issuance, index) => (
                                                                                    <TableRow key={`issued-${index}`}><TableCell className="py-1">{issuance.docNo}</TableCell><TableCell className="text-right py-1">{issuance.items.reduce((s,i) => s + i.quantity, 0).toFixed(2)}</TableCell></TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </div>
                                                                ) : <p className="text-sm text-muted-foreground italic">No issuances.</p>}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold mb-2 text-sm">Returns</h4>
                                                                {item.returns.length > 0 ? (
                                                                    <div className="border rounded-md max-h-48 overflow-auto">
                                                                        <Table>
                                                                            <TableHeader><TableRow><TableHead>Doc No.</TableHead><TableHead className="text-right">Qty</TableHead></TableRow></TableHeader>
                                                                            <TableBody>
                                                                                {item.returns.map((ret, index) => (
                                                                                    <TableRow key={`returned-${index}`}><TableCell className="py-1">{ret.docNo}</TableCell><TableCell className="text-right py-1">{ret.items.reduce((s,i) => s + i.quantity, 0).toFixed(2)}</TableCell></TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </div>
                                                                ) : <p className="text-sm text-muted-foreground italic">No returns.</p>}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                        <TableFooter className="sticky bottom-0 bg-muted/50">
                            <TableRow>
                                <TableCell colSpan={6} className="text-right font-bold">Total Values:</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.usedValue)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.onSiteValue)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

    