
'use client';

import type { DeliveryOrder, MaterialPurchaseOrder, Project, PlantUnit, SerialInfo, StockAdjustment, Movement, PurchaseData } from '@/lib/types';
import { useMemo, useState, Fragment } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileDown, FileUp, TrendingUp, TrendingDown, Package, Move, ChevronDown, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, lastDayOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StockSummaryReportProps {
  openingBalance: number;
  openingStockLedger: { sourceId: string; qty: number; value: number }[];
  totalStockPurchase: number;
  totalStockMovement: number;
  closingBalance: number;
  stockItems: StockItem[];
  allMovements: Movement[];
  allPurchases: PurchaseData[];
  adjustments: StockAdjustment[];
}

interface StockItem {
    sourceId: string;
    itemNo: string;
    description: string;
    unit: string;
    hasSerialNo: boolean;
    balanceQty: number;
    balanceValue: number;
    avgRate: number;
    inventory: { date: Date; qty: number; rate: number; serialNo?: string }[];
}

type SortKey = 'description' | 'unit' | 'balanceQty' | 'avgRate' | 'balanceValue' | 'itemNo';

interface CalculationDetailsProps {
    item: StockItem;
    openingBalance: { qty: number; value: number };
    purchases: PurchaseData[];
    movements: Movement[];
    adjustments: StockAdjustment[];
    onClose: () => void;
}

function CalculationDetailsDialog({ item, openingBalance, purchases, movements, adjustments, onClose }: CalculationDetailsProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
    };

    const combinedTransactions = useMemo(() => {
        const txs: { date: string; docNo: string; type: string; qty: number; rate: number; value: number; project?: string }[] = [];
        
        purchases.forEach(p => {
            txs.push({
                date: p.date,
                docNo: p.doNo,
                type: 'Purchase',
                qty: p.qty,
                rate: p.priceRate,
                value: p.totalPrice,
                project: p.projectName || 'General'
            });
        });

        movements.forEach(m => {
            txs.push({
                date: m.date,
                docNo: m.docNo,
                type: m.type === 'Issuance' ? 'Issued' : 'Returned',
                qty: m.qty,
                rate: m.priceRate,
                value: m.totalPrice,
                project: m.projectName
            });
        });

        adjustments.forEach(adj => {
             txs.push({
                 date: adj.adjustmentDate,
                 docNo: 'ST-ADJ',
                 type: 'Correction',
                 qty: adj.quantity,
                 rate: item.avgRate,
                 value: adj.quantity * item.avgRate,
                 project: 'Stock Take / Manual Adjustment'
             });
        });

        return txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [purchases, movements, adjustments, item]);

    const totalIn = useMemo(() => combinedTransactions.filter(t => t.type !== 'Correction' && t.qty > 0).reduce((sum, t) => sum + t.qty, 0), [combinedTransactions]);
    const totalOut = useMemo(() => combinedTransactions.filter(t => t.type !== 'Correction' && t.qty < 0).reduce((sum, t) => sum + t.qty, 0), [combinedTransactions]);

    const handleExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        const doc = new jsPDF();
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 14;

        doc.setFontSize(18);
        doc.text("Stock Audit Report", margin, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Material: ${item.description}`, margin, 29);
        doc.text(`Item No: ${item.itemNo} | Unit: ${item.unit}`, margin, 35);
        
        doc.setFontSize(12);
        doc.setTextColor(40);
        doc.text("Summary", margin, 45);

        autoTable(doc, {
            startY: 48,
            head: [['Metric', 'Quantity', 'Value']],
            body: [
                ['Opening Balance', openingBalance.qty.toFixed(2), formatCurrency(openingBalance.value)],
                ['Total Stock In (+)', totalIn.toFixed(2), ''],
                ['Total Stock Out (-)', Math.abs(totalOut).toFixed(2), ''],
                ['Closing Balance', item.balanceQty.toFixed(2), formatCurrency(item.balanceValue)],
            ],
            theme: 'striped',
            headStyles: { fillColor: [34, 48, 62] },
            columnStyles: { 
                1: { halign: 'right' },
                2: { halign: 'right' }
            }
        });

        const lastY = (doc as any).lastAutoTable.finalY || 80;

        doc.text("Transaction Audit Trail", margin, lastY + 10);

        autoTable(doc, {
            startY: lastY + 14,
            head: [['Date', 'Type', 'Ref / Project', 'Qty Change', 'Rate', 'Value']],
            body: combinedTransactions.map(tx => [
                format(parseISO(tx.date), 'dd MMM yyyy'),
                tx.type,
                `${tx.docNo}\n${tx.project || ''}`,
                { content: `${tx.qty > 0 ? '+' : ''}${tx.qty.toFixed(2)}`, styles: { textColor: tx.qty > 0 ? [0, 128, 0] : [200, 0, 0] } },
                formatCurrency(tx.rate),
                formatCurrency(tx.value)
            ]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
            columnStyles: {
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' }
            }
        });

        doc.save(`Audit_${item.itemNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    };

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const summaryData = [
            { "Metric": "Opening Balance", "Quantity": openingBalance.qty, "Value (RM)": openingBalance.value },
            { "Metric": "Total Stock In (+)", "Quantity": totalIn, "Value (RM)": "" },
            { "Metric": "Total Stock Out (-)", "Quantity": Math.abs(totalOut), "Value (RM)": "" },
            { "Metric": "Closing Balance", "Quantity": item.balanceQty, "Value (RM)": item.balanceValue },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        const txData = combinedTransactions.map(tx => ({
            "Date": format(parseISO(tx.date), 'yyyy-MM-dd'),
            "Type": tx.type,
            "Doc No": tx.docNo,
            "Project": tx.project || 'General',
            "Qty Change": tx.qty,
            "Rate (RM)": tx.rate,
            "Value (RM)": tx.value
        }));
        const wsTxs = XLSX.utils.json_to_sheet(txData);
        XLSX.utils.book_append_sheet(wb, wsTxs, "Transactions");

        XLSX.writeFile(wb, `Audit_${item.itemNo}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    return (
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <div className="flex justify-between items-start pr-8">
                    <div>
                        <DialogTitle>Calculation Details: {item.description}</DialogTitle>
                        <DialogDescription>Item No: {item.itemNo} | {item.unit}</DialogDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}>
                            <FileUp className="mr-2 h-4 w-4" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPdf}>
                            <FileDown className="mr-2 h-4 w-4" /> PDF
                        </Button>
                    </div>
                </div>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-muted/30">
                        <CardHeader className="p-3 pb-0"><CardTitle className="text-xs uppercase text-muted-foreground">Opening</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-1"><p className="text-lg font-bold">{openingBalance.qty.toFixed(2)}</p></CardContent>
                    </Card>
                    <Card className="bg-green-50/50 dark:bg-green-900/10">
                        <CardHeader className="p-3 pb-0"><CardTitle className="text-xs uppercase text-muted-foreground">Total In (+)</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-1"><p className="text-lg font-bold text-green-600">
                            {totalIn.toFixed(2)}
                        </p></CardContent>
                    </Card>
                    <Card className="bg-red-50/50 dark:bg-red-900/10">
                        <CardHeader className="p-3 pb-0"><CardTitle className="text-xs uppercase text-muted-foreground">Total Out (-)</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-1"><p className="text-lg font-bold text-red-600">
                            {Math.abs(totalOut).toFixed(2)}
                        </p></CardContent>
                    </Card>
                    <Card className="bg-primary/5">
                        <CardHeader className="p-3 pb-0"><CardTitle className="text-xs uppercase text-muted-foreground">Closing Balance</CardTitle></CardHeader>
                        <CardContent className="p-3 pt-1"><p className="text-lg font-bold text-primary">{item.balanceQty.toFixed(2)}</p></CardContent>
                    </Card>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <ScrollArea className="h-[400px]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-secondary z-20">
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Doc No / Project</TableHead>
                                    <TableHead className="text-right">Qty Change</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                    <TableHead className="text-right">Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="bg-muted/20 font-medium italic">
                                    <TableCell colSpan={3}>Opening Balance (Start of Period)</TableCell>
                                    <TableCell className="text-right">{openingBalance.qty.toFixed(2)}</TableCell>
                                    <TableCell colSpan={2} className="text-right">{formatCurrency(openingBalance.value)}</TableCell>
                                </TableRow>
                                {combinedTransactions.map((tx, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{format(parseISO(tx.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                tx.type === 'Purchase' || tx.type === 'Returned' ? "bg-green-100 text-green-800" : 
                                                tx.type === 'Correction' ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
                                            )}>
                                                {tx.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-mono text-xs">{tx.docNo}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{tx.project}</div>
                                        </TableCell>
                                        <TableCell className={cn("text-right font-medium", tx.qty > 0 ? "text-green-600" : "text-red-600")}>
                                            {tx.type === 'Correction' ? <span className='text-blue-600 text-xs font-normal mr-2'>(Set to)</span> : (tx.qty > 0 ? '+' : '')}
                                            {tx.qty.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">{formatCurrency(tx.rate)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(tx.value)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="sticky bottom-0 z-20">
                                <TableRow>
                                    <TableCell colSpan={3} className="text-right font-bold">Closing Balance</TableCell>
                                    <TableCell className="text-right font-bold">{item.balanceQty.toFixed(2)}</TableCell>
                                    <TableCell className="text-right" />
                                    <TableCell className="text-right font-bold">{formatCurrency(item.balanceValue)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </ScrollArea>
                </div>
                 <div className='p-4 bg-muted/20 text-xs text-muted-foreground flex items-center gap-2'>
                    <Info className='h-4 w-4' />
                    <span>Audit trail is calculated using FIFO (First-In, First-Out) logic based on your company's transaction history. Corrections represent manual stock takes or adjustments.</span>
                </div>
            </div>
        </DialogContent>
    );
}


export default function StockSummaryReport({ openingBalance, openingStockLedger, totalStockPurchase, totalStockMovement, closingBalance, stockItems, allMovements, allPurchases, adjustments }: StockSummaryReportProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'description', direction: 'asc' });
    const [selectedItemForCalc, setSelectedItemForCalc] = useState<StockItem | null>(null);

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

    const sortedStockItems = useMemo(() => {
        let sortableItems = [...stockItems];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue);
                }
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [stockItems, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
    };

    const renderHeader = (label: string, sortKey: SortKey, className?: string) => (
        <TableHead className={className}>
            <Button variant="ghost" className="w-full justify-start p-0" onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

    const renderNumericHeader = (label: string, sortKey: SortKey, className?: string) => (
        <TableHead className={className}>
            <Button variant="ghost" className="w-full justify-end p-0" onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const summaryData = [
            { "Description": "Opening Stock Value", "Amount (RM)": openingBalance },
            { "Description": "Total Stock Purchase", "Amount (RM)": totalStockPurchase },
            { "Description": "Total Stock Movement", "Amount (RM)": totalStockMovement },
            { "Description": "Closing Balance", "Amount (RM)": closingBalance },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        const stockListData = sortedStockItems.flatMap(item => {
            const mainRow = {
                "Item No": item.itemNo,
                "Material": item.description,
                "Unit": item.unit,
                "Balance Qty": item.balanceQty,
                "Avg Rate (RM)": item.avgRate,
                "Balance Value (RM)": item.balanceValue,
            };

            const groupedInventory = item.inventory.reduce((acc, inv) => {
                const key = item.hasSerialNo ? inv.serialNo || 'N/A' : `rate-${inv.rate}`;
                if (!acc[key]) {
                    acc[key] = {
                        label: item.hasSerialNo ? `  S/N: ${inv.serialNo || 'N/A'}` : `  from ${format(inv.date, 'dd-MM-yyyy')} @ ${formatCurrency(inv.rate)}`,
                        qty: 0,
                    };
                }
                acc[key].qty += inv.qty;
                return acc;
            }, {} as Record<string, { label: string; qty: number; }>);
            
            const detailRows = Object.values(groupedInventory).map(inv => ({
                "Material": inv.label,
                "Balance Qty": inv.qty,
            }));
            
            return [mainRow, ...detailRows];
        });
        const wsStockList = XLSX.utils.json_to_sheet(stockListData);
        XLSX.utils.book_append_sheet(wb, wsStockList, "Stock Details");
        
        XLSX.writeFile(wb, `Stock_Summary_Report.xlsx`);
    };

    const handleExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Stock Summary Report", 14, 22);
        
        const summaryBody = [
            ["Opening Stock Value", formatCurrency(openingBalance)],
            ["Total Stock Purchase", formatCurrency(totalStockPurchase)],
            ["Total Stock Movement", formatCurrency(totalStockMovement)],
            ["Closing Balance Value", formatCurrency(closingBalance)],
        ];

        autoTable(doc, {
            body: summaryBody,
            startY: 35,
            theme: 'plain',
            styles: { fontSize: 10 },
            columnStyles: { 1: { halign: 'right' } },
        });

        const lastY = (doc as any).lastAutoTable.finalY || 60;
        
        const body = sortedStockItems.flatMap(item => {
            const mainRow = [
                item.itemNo,
                item.description,
                item.unit,
                item.balanceQty.toFixed(2),
                formatCurrency(item.avgRate),
                formatCurrency(item.balanceValue)
            ];
            
            const groupedInventory = item.inventory.reduce((acc, inv) => {
                const key = item.hasSerialNo ? inv.serialNo || 'N/A' : `${format(inv.date, 'yyyy-MM-dd')}_${inv.rate}`;
                 if (!acc[key]) {
                    acc[key] = {
                        label: item.hasSerialNo ? inv.serialNo || 'N/A' : `from ${format(inv.date, 'dd MMM yyyy')}`,
                        rate: inv.rate,
                        qty: 0,
                    };
                }
                acc[key].qty += inv.qty;
                return acc;
            }, {} as Record<string, { label: string; rate: number; qty: number; }>);

            const detailRows = Object.values(groupedInventory).map(inv => {
                const label = item.hasSerialNo ? `  S/N: ${inv.label}` : `  (${inv.label} @ ${formatCurrency(inv.rate)})`;
                return [
                    { content: label, colSpan: 3, styles: { fontStyle: 'italic', textColor: 100, fontSize: 8 } },
                    { content: inv.qty.toFixed(2), styles: { halign: 'right', fontStyle: 'italic', textColor: 100, fontSize: 8 } },
                    null,
                    { content: formatCurrency(inv.qty * inv.rate), styles: { halign: 'right', fontStyle: 'italic', textColor: 100, fontSize: 8 } },
                ]
            });
            return [mainRow, ...detailRows];
        });

        autoTable(doc, {
            head: [['Item No', 'Material', 'Unit', 'Balance Qty', 'Avg Rate', 'Balance Value']],
            body: body,
            startY: lastY + 10,
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: (data) => {
                 if (data.column.index > 2) {
                    data.cell.styles.halign = 'right';
                 }
                 if(data.cell.raw && (data.cell.raw as any).colSpan) {
                     data.cell.styles.halign = 'left';
                 }
            },
            foot: [
                ['Total', '', '', '', '', formatCurrency(closingBalance)]
            ],
            footStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0 },
        });

        doc.save(`Stock_Summary_Report.pdf`);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Stock Summary</CardTitle>
                        <CardDescription>A monthly summary of stock values and quantities.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                        <Button variant="outline" size="sm" onClick={handleExportPdf}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Opening Stock Value</CardTitle>
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{formatCurrency(openingBalance)}</div></CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Stock Purchase</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{formatCurrency(totalStockPurchase)}</div></CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Stock Movement</CardTitle>
                            <Move className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{formatCurrency(totalStockMovement)}</div></CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Closing Balance Value</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{formatCurrency(closingBalance)}</div></CardContent>
                    </Card>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                {renderHeader('Item No', 'itemNo', 'w-[15%]')}
                                {renderHeader('Description', 'description', 'w-[35%]')}
                                {renderHeader('Unit', 'unit')}
                                {renderNumericHeader('Balance Qty', 'balanceQty', 'text-right')}
                                {renderNumericHeader('Avg Rate', 'avgRate', 'text-right')}
                                {renderNumericHeader('Balance Value', 'balanceValue', 'text-right')}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedStockItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        No stock found for the selected period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedStockItems.map(item => {
                                    const isExpanded = expandedRows.has(item.sourceId);
                                    
                                    const groupedInventory = item.inventory.reduce((acc, inv) => {
                                        const key = item.hasSerialNo ? inv.serialNo || 'N/A' : `rate-${inv.rate}`;
                                        if (!acc[key]) {
                                            acc[key] = {
                                                label: item.hasSerialNo ? inv.serialNo || 'N/A' : `from ${format(inv.date, 'dd MMM yyyy')}`,
                                                rate: inv.rate,
                                                qty: 0,
                                            };
                                        }
                                        acc[key].qty += inv.qty;
                                        return acc;
                                    }, {} as Record<string, { label: string; rate: number; qty: number; }>);
                                    
                                    return (
                                        <Fragment key={item.sourceId}>
                                            <TableRow>
                                                <TableCell className="py-2 px-4">
                                                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleRow(item.sourceId)}>
                                                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                                     </Button>
                                                </TableCell>
                                                <TableCell className="font-mono py-2 px-4">
                                                    <Button variant="link" className="p-0 h-auto font-mono" onClick={() => setSelectedItemForCalc(item)}>
                                                        {item.itemNo}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="py-2 px-4 font-medium">
                                                    <Button variant="link" className="p-0 h-auto text-left whitespace-normal leading-tight" onClick={() => setSelectedItemForCalc(item)}>
                                                        {item.description}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="py-2 px-4">{item.unit}</TableCell>
                                                <TableCell className="text-right py-2 px-4">{item.balanceQty.toFixed(2)}</TableCell>
                                                <TableCell className="text-right py-2 px-4">{formatCurrency(item.avgRate)}</TableCell>
                                                <TableCell className="text-right py-2 px-4 font-semibold">{formatCurrency(item.balanceValue)}</TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                    <TableCell colSpan={7} className="p-0">
                                                        <div className="p-4 pl-16">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>{item.hasSerialNo ? 'Serial No.' : 'Purchase'}</TableHead>
                                                                        <TableHead className="text-right">Qty</TableHead>
                                                                        <TableHead className="text-right">Rate</TableHead>
                                                                        <TableHead className="text-right">Value</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {Object.values(groupedInventory).map((inv, idx) => (
                                                                        <TableRow key={idx}>
                                                                            <TableCell className="py-1 text-xs">{inv.label}</TableCell>
                                                                            <TableCell className="text-right py-1 text-xs">{inv.qty.toFixed(2)}</TableCell>
                                                                            <TableCell className="text-right py-1 text-xs">{formatCurrency(inv.rate)}</TableCell>
                                                                            <TableCell className="text-right py-1 text-xs">{formatCurrency(inv.qty * inv.rate)}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
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
                                <TableCell colSpan={6} className="text-right font-bold">Total Closing Value</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(closingBalance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={!!selectedItemForCalc} onOpenChange={(open) => !open && setSelectedItemForCalc(null)}>
                {selectedItemForCalc && (
                    <CalculationDetailsDialog
                        item={selectedItemForCalc}
                        openingBalance={openingStockLedger.find(l => l.sourceId === selectedItemForCalc.sourceId) || { qty: 0, value: 0 }}
                        purchases={allPurchases.filter(p => p.sourceId === selectedItemForCalc.sourceId)}
                        movements={allMovements.filter(m => m.sourceId === selectedItemForCalc.sourceId)}
                        adjustments={adjustments.filter(a => a.sourceId === selectedItemForCalc.sourceId)}
                        onClose={() => setSelectedItemForCalc(null)}
                    />
                )}
            </Dialog>
        </Card>
    );
}
