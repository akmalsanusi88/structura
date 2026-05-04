
'use client';
import type { Project, PurchaseOrder, Claim, PurchaseOrderItem, PlantUnit } from "@/lib/types";
import { useMemo, useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import { FileUp, FileDown, ChevronDown } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { parseISO, format } from 'date-fns';
import { cn } from "@/lib/utils";

interface ClaimSummaryViewProps {
    project: Project;
    poType: 'Client' | 'Subcontractor';
    plantUnits: PlantUnit[];
}

export default function ClaimSummaryView({ project, poType, plantUnits }: ClaimSummaryViewProps) {
    const [selectedPoId, setSelectedPoId] = useState<string>('');

    const availablePOs = useMemo(() => {
        return project.purchaseOrders.filter(po => po.type === poType);
    }, [project.purchaseOrders, poType]);
    
    const selectedPo = useMemo(() => {
        return availablePOs.find(po => po.id === selectedPoId);
    }, [selectedPoId, availablePOs]);
    
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const claimsForPo = useMemo(() => {
        const claimSource = poType === 'Client' ? project.clientClaims : project.subconClaims;
        return (claimSource || []).filter(c => c.purchaseOrderId === selectedPoId).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [project.clientClaims, project.subconClaims, selectedPoId, poType]);

    const plantUnitMap = useMemo(() => {
        if (!plantUnits) return new Map();
        return new Map(plantUnits.map(pu => [pu.id, pu]));
    }, [plantUnits]);


    const fullBoqMap = useMemo(() => {
        const allItems = [
            ...(project.clientBoq || []),
            ...(project.engineeringBoq || []),
            ...(project.materialBoq || []),
        ];
        return new Map(allItems.map(item => [item.id, item]));
    }, [project]);

    const summaryData = useMemo(() => {
        if (!selectedPo) return [];

        return selectedPo.items.map(poItem => {
            const claimsBreakdown = claimsForPo.map(claim => {
                const claimItem = claim.claimedItems.find(ci => ci.boqItemId === poItem.id);
                const claimedQty = claimItem?.quantity || 0;
                
                // Calculate this item's value within the claim (Gross, before retention)
                const currentItemGrossValue = claimedQty * poItem.rate;

                return {
                    claimId: claim.id,
                    claimNo: claim.claimNo,
                    claimedQty,
                    claimedValue: currentItemGrossValue, // Gross value for this item in this claim
                    retentionAmount: 0, // This will be calculated later proportionally if needed
                };
            });
            
            claimsForPo.forEach((claim, index) => {
                const totalGrossClaimValue = claim.claimedItems.reduce((total, ci) => {
                    const item = selectedPo.items.find(i => i.id === ci.boqItemId);
                    return total + ((ci.quantity || 0) * (item?.rate || 0));
                }, 0);
                
                const claimBreakdownItem = claimsBreakdown.find(b => b.claimId === claim.id);
                if (claimBreakdownItem && totalGrossClaimValue > 0) {
                    const proportion = claimBreakdownItem.claimedValue / totalGrossClaimValue;
                    claimBreakdownItem.retentionAmount = (claim.retentionAmount || 0) * proportion;
                }
            });


            const totalClaimedQty = claimsBreakdown.reduce((sum, c) => sum + c.claimedQty, 0);
            const totalClaimedValue = claimsBreakdown.reduce((sum, c) => sum + c.claimedValue, 0);
            
            let puNo = 'Custom';
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

            return {
                ...poItem,
                puNo,
                claims: claimsBreakdown,
                totalClaimedQty,
                totalClaimedValue,
                variance: Number(poItem.quantity) - totalClaimedQty,
            };
        });
    }, [selectedPo, claimsForPo, plantUnitMap, fullBoqMap, project.purchaseOrders]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };
    
    const formatNumber = (num: number | undefined | null): string => {
      if (num === undefined || num === null || isNaN(Number(num))) return '0.00';
      return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleExportExcel = async () => {
        if (!selectedPo || !summaryData) return;
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const poSubtotal = selectedPo.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * item.rate), 0);
        const poValueTotal = selectedPo.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * item.rate), 0);
        const poManagementFee = selectedPo.items.reduce((sum, item) => sum + (item.managementFee || 0), 0);

        const header_main = ['PU ID', 'Description', 'Unit', 'Rate (RM)', 'PO', '', ...claimsForPo.flatMap(c => [c.claimNo, '', '']), 'Total Claim', ''];
        const header_sub = ['', '', '', '', 'Qty', 'Total Value', ...claimsForPo.flatMap(c => ['Qty', 'Total Value', 'Retention']), 'Qty', 'Total Value'];
        
        let data: (string | number)[][] = summaryData.map(item => {
            const poValue = (Number(item.quantity) || 0) * item.rate;
            let rowData: (string | number)[] = [
                item.puNo,
                item.description,
                item.unit,
                item.rate,
                Number(item.quantity) || 0,
                poValue
            ];
            
            claimsForPo.forEach(claim => {
                const claimData = item.claims.find(c => c.claimId === claim.id);
                rowData.push(claimData?.claimedQty || 0);
                rowData.push(claimData?.claimedValue || 0);
                rowData.push(claimData?.retentionAmount || 0);
            });
            
            rowData.push(item.totalClaimedQty);
            rowData.push(item.totalClaimedValue);
            return rowData;
        });

        // --- Totals ---
        const poQtyTotal = summaryData.reduce((sum, item) => sum + Number(item.quantity), 0);
        
        const claimTotals = claimsForPo.map(claim => {
            return {
                qty: summaryData.reduce((sum, item) => sum + (item.claims.find(c => c.claimId === claim.id)?.claimedQty || 0), 0),
                value: summaryData.reduce((sum, item) => sum + (item.claims.find(c => c.claimId === claim.id)?.claimedValue || 0), 0),
                retention: summaryData.reduce((sum, item) => sum + (item.claims.find(c => c.claimId === claim.id)?.retentionAmount || 0), 0),
            }
        });

        const totalClaimedQtyAll = summaryData.reduce((sum, item) => sum + item.totalClaimedQty, 0);
        const totalClaimedValueAll = summaryData.reduce((sum, item) => sum + item.totalClaimedValue, 0);

        const feeRowValues = claimsForPo.map(claim => {
            const itemsWithFeeInThisClaim = claim.claimedItems.filter(ci => {
                const poItem = selectedPo.items.find(i => i.id === ci.boqItemId);
                return poItem && poItem.managementFee && poItem.managementFee > 0;
            });

            const subtotalForFeeCalc = itemsWithFeeInThisClaim.reduce((sum, ci) => {
                const poItem = selectedPo.items.find(i => i.id === ci.boqItemId);
                if (!poItem) return sum;
                return sum + (ci.quantity * poItem.rate);
            }, 0);

            const totalPoValueForFeeItems = selectedPo.items
                .filter(i => i.managementFee && i.managementFee > 0)
                .reduce((sum, i) => sum + (i.quantity * i.rate), 0);
            
            if (totalPoValueForFeeItems === 0) return 0;

            const managementFeePercentage = poManagementFee / totalPoValueForFeeItems;
            return subtotalForFeeCalc * managementFeePercentage;
        });
        const totalFeeClaimed = feeRowValues.reduce((sum, fee) => sum + fee, 0);

        const feeRow = ['Management Fee', '', '', '', '', poManagementFee, ...feeRowValues.flatMap(fee => ['', fee, '']), '', totalFeeClaimed];

        const subtotalRow = [
            'Subtotal', '', '', '', poQtyTotal, poSubtotal + poManagementFee, 
            ...claimTotals.flatMap((t, i) => [t.qty, t.value + (feeRowValues[i] || 0), t.retention]), 
            totalClaimedQtyAll, 
            totalClaimedValueAll + totalFeeClaimed
        ];

        
        const ws_data = [header_main, header_sub, ...data, feeRow, subtotalRow];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        
        const merges: XLSX.Range[] = [ { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } } ];
        let col = 6;
        claimsForPo.forEach(() => { merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 2 } }); col += 3; });
        merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 1 } });
        ws['!merges'] = merges;
        
        XLSX.utils.book_append_sheet(wb, ws, `Claim Summary ${selectedPo.poNo}`);
        XLSX.writeFile(wb, `${project.name} - Claim Summary ${selectedPo.poNo}.xlsx`);
    };

    const handleExportPdf = async () => {
        if (!selectedPo || !summaryData) return;
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const doc = new jsPDF({ orientation: 'landscape' });
        
        const totalColumns = 6 + (claimsForPo.length * 3) + 2;
        const fontSize = totalColumns > 12 ? 6 : 8;

        doc.setFontSize(18);
        doc.text("Claim vs. PO Summary", 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Project: ${project.name}`, 14, 29);
        doc.text(`PO No: ${selectedPo.poNo || 'N/A'}`, 14, 35);
        
        const head: any[][] = [
            [
                { content: 'PU ID', rowSpan: 2, styles: { valign: 'middle' } },
                { content: 'Description', rowSpan: 2, styles: { valign: 'middle', cellWidth: 50 } },
                { content: 'Unit', rowSpan: 2, styles: { valign: 'middle' } },
                { content: 'Rate (RM)', rowSpan: 2, styles: { valign: 'middle', halign: 'right' } },
                { content: 'PO', colSpan: 2, styles: { halign: 'center' } },
                ...claimsForPo.map(c => ({ content: c.claimNo, colSpan: 3, styles: { halign: 'center' } })),
                { content: 'Total Claim', colSpan: 2, styles: { halign: 'center' } },
            ],
            [
                { content: 'Qty', styles: { halign: 'right' } },
                { content: 'Total Value', styles: { halign: 'right' } },
                ...Array(claimsForPo.length).fill(0).flatMap(() => ([
                    { content: 'Qty', styles: { halign: 'right' } },
                    { content: 'Total Value', styles: { halign: 'right' } },
                    { content: 'Retention', styles: { halign: 'right' } },
                ])),
                 { content: 'Qty', styles: { halign: 'right' } },
                 { content: 'Total Value', styles: { halign: 'right' } },
            ]
        ];
        
        const body = summaryData.map(item => {
            const poValue = (Number(item.quantity) || 0) * item.rate;
            const rowData: any[] = [
                item.puNo,
                item.description,
                item.unit,
                { content: formatNumber(item.rate), styles: { halign: 'right' } },
                { content: formatNumber(Number(item.quantity)), styles: { halign: 'right' } },
                { content: formatNumber(poValue), styles: { halign: 'right' } },
            ];

            claimsForPo.forEach(claim => {
                const claimData = item.claims.find(c => c.claimId === claim.id);
                rowData.push(
                    { content: formatNumber(claimData?.claimedQty), styles: { halign: 'right' } },
                    { content: formatNumber(claimData?.claimedValue), styles: { halign: 'right' } },
                    { content: formatNumber(claimData?.retentionAmount), styles: { halign: 'right' } }
                );
            });
            
            rowData.push({ content: formatNumber(item.totalClaimedQty), styles: { halign: 'right', fontStyle: 'bold' } });
            rowData.push({ content: formatNumber(item.totalClaimedValue), styles: { halign: 'right', fontStyle: 'bold' } });
            return rowData;
        });

        // --- Footer Calculations ---
        const poSubtotal = summaryData.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * item.rate), 0);
        const poManagementFee = selectedPo.items.reduce((sum, item) => sum + (item.managementFee || 0), 0);
        
        const claimTotals = claimsForPo.map(claim => {
            const totalValue = summaryData.reduce((sum, item) => sum + (item.claims.find(c => c.claimId === claim.id)?.claimedValue || 0), 0);
            const totalRetention = summaryData.reduce((sum, item) => sum + (item.claims.find(c => c.claimId === claim.id)?.retentionAmount || 0), 0);
            const totalQty = summaryData.reduce((sum, item) => sum + (item.claims.find(c => c.claimId === claim.id)?.claimedQty || 0), 0);
            return { qty: totalQty, value: totalValue, retention: totalRetention };
        });

        const totalClaimedQtyAll = summaryData.reduce((sum, item) => sum + item.totalClaimedQty, 0);
        const totalClaimedValueAll = summaryData.reduce((sum, item) => sum + item.totalClaimedValue, 0);
        
        const managementFeePerRow = claimsForPo.map(claim => {
            const itemsWithFeeInThisClaim = claim.claimedItems.filter(ci => {
                const poItem = selectedPo.items.find(i => i.id === ci.boqItemId);
                return poItem && poItem.managementFee && poItem.managementFee > 0;
            });
            
            const subtotalForFeeCalc = itemsWithFeeInThisClaim.reduce((sum, ci) => {
                const poItem = selectedPo.items.find(i => i.id === ci.boqItemId);
                if (!poItem) return sum;
                return sum + (ci.quantity * poItem.rate);
            }, 0);

            const totalPoValueForFeeItems = selectedPo.items
                .filter(i => i.managementFee && i.managementFee > 0)
                .reduce((sum, i) => sum + (i.quantity * i.rate), 0);
            
            if (totalPoValueForFeeItems === 0) return 0;
            const managementFeePercentage = poManagementFee / totalPoValueForFeeItems;

            return subtotalForFeeCalc * managementFeePercentage;
        });
        const totalManagementFeeClaimed = managementFeePerRow.reduce((sum, fee) => sum + fee, 0);

        const feeRow = [
            { content: 'Management Fee', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: formatCurrency(poManagementFee), styles: { halign: 'right', fontStyle: 'bold' } },
            ...managementFeePerRow.flatMap(fee => ['', { content: formatCurrency(fee), styles: { halign: 'right', fontStyle: 'bold' }}, '']),
            '',
            { content: formatCurrency(totalManagementFeeClaimed), styles: { halign: 'right', fontStyle: 'bold' } },
        ];
        
        const subtotalRow = [
            { content: 'Subtotal', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: formatCurrency(poSubtotal + poManagementFee), styles: { halign: 'right', fontStyle: 'bold' } },
             ...claimTotals.flatMap((t, i) => [
                { content: formatNumber(t.qty), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: formatCurrency(t.value + (managementFeePerRow[i] || 0)), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: formatCurrency(t.retention), styles: { halign: 'right', fontStyle: 'bold' } },
            ]),
            { content: formatNumber(totalClaimedQtyAll), styles: { halign: 'right', fontStyle: 'bold' } },
            { content: formatCurrency(totalClaimedValueAll + totalManagementFeeClaimed), styles: { halign: 'right', fontStyle: 'bold' } },
        ];
        
        const foot = [feeRow, subtotalRow];
        
        autoTable(doc, {
            head, body, foot, startY: 45,
            headStyles: { fillColor: [41, 128, 185], fontSize: fontSize, cellPadding: 1, lineWidth: 0.1, valign: 'middle' },
            footStyles: { fontSize: fontSize, cellPadding: 1, lineWidth: 0.1, fillColor: [230, 230, 230], textColor: 0 },
            bodyStyles: { fontSize: fontSize, cellPadding: 1, lineWidth: 0.1 },
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
        
        doc.save(`${project.name} - Claim Summary ${selectedPo.poNo}.pdf`);
    };
    
    if (availablePOs.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>As-Built vs. Claim Summary ({poType})</CardTitle>
                    <CardDescription>There are no {poType} Purchase Orders to summarize.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>As-Built vs. Claim Summary ({poType})</CardTitle>
                        <CardDescription>A summary of claimed quantities compared to a selected Purchase Order.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Select value={selectedPoId} onValueChange={setSelectedPoId}>
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
                                <TableHead className="w-[30%]">Description</TableHead>
                                <TableHead>PO Qty</TableHead>
                                <TableHead>PO Value</TableHead>
                                {claimsForPo.map(c => <TableHead key={c.id} className="text-right">{c.claimNo}</TableHead>)}
                                <TableHead className="text-right font-bold">Total Claimed Qty</TableHead>
                                <TableHead className="text-right font-bold">Total Claim Value</TableHead>
                                <TableHead className="text-right">Variance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaryData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7 + claimsForPo.length} className="h-24 text-center">Select a PO to see the summary.</TableCell>
                                </TableRow>
                            ) : (
                                summaryData.map(item => (
                                    <Fragment key={item.id}>
                                    <TableRow>
                                        <TableCell className="font-medium py-2 px-4">
                                             <div className="flex items-center">
                                                <Button variant="ghost" size="sm" className="mr-2 h-8 w-8 p-0" onClick={() => toggleRow(item.id)}>
                                                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedRows.has(item.id) ? 'rotate-180' : ''}`} />
                                                </Button>
                                                {item.description}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 px-4">{formatNumber(Number(item.quantity))}</TableCell>
                                        <TableCell className="py-2 px-4">{formatCurrency(Number(item.quantity) * item.rate)}</TableCell>
                                        {claimsForPo.map(c => {
                                            const claimData = item.claims.find(cd => cd.claimId === c.id);
                                            return <TableCell key={c.id} className="text-right py-2 px-4">{claimData && claimData.claimedQty > 0 ? formatNumber(claimData.claimedQty) : '-'}</TableCell>
                                        })}
                                        <TableCell className="text-right font-semibold py-2 px-4">{formatNumber(item.totalClaimedQty)}</TableCell>
                                        <TableCell className="text-right font-semibold py-2 px-4 bg-muted/50">{formatCurrency(item.totalClaimedValue)}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatNumber(item.variance)}</TableCell>
                                    </TableRow>
                                    {expandedRows.has(item.id) && (
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableCell colSpan={3}></TableCell>
                                            {item.claims.map(c => (
                                                <TableCell key={c.claimId} className="text-right text-xs text-muted-foreground p-1 pr-4">
                                                    <div>Value: {formatCurrency(c.claimedValue)}</div>
                                                    <div>Ret: {formatCurrency(c.retentionAmount)}</div>
                                                </TableCell>
                                            ))}
                                            <TableCell colSpan={3}></TableCell>
                                        </TableRow>
                                    )}
                                    </Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
