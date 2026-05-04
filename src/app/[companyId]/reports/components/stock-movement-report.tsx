
'use client';

import type { Movement, SerialInfo } from '@/lib/types';
import { useMemo, useState, Fragment } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { ArrowDown, ArrowUp, ChevronDown, FileDown, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StockMovementReportProps {
  movementData: Movement[];
  totalMovementValue: number;
}

type SortKey = 'itemName' | 'itemNo' | 'date' | 'docNo' | 'qty' | 'priceRate' | 'totalPrice';

export default function StockMovementReport({ movementData = [], totalMovementValue }: StockMovementReportProps) {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };
    
    const sortedData = useMemo(() => {
        let sortableItems = [...movementData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else {
                    comparison = String(aValue || '').localeCompare(String(bValue || ''));
                }
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        } else {
            sortableItems.sort((a,b) => {
                if (!a.date || !b.date) return 0;
                return new Date(a.date).getTime() - new Date(b.date).getTime()
            });
        }
        return sortableItems;
    }, [movementData, sortConfig]);

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

    const renderHeader = (label: string, sortKey: SortKey, isNumeric = false) => (
        <TableHead>
            <Button variant="ghost" className={`w-full p-0 ${isNumeric ? 'justify-end' : 'justify-start'}`} onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const data = sortedData.flatMap(d => {
            const mainRow = {
                'Item No': d.itemNo,
                'Item Name': d.itemName,
                'Date': format(parseISO(d.date), 'yyyy-MM-dd'),
                'Doc No': d.docNo,
                'Unit': d.unit,
                'Qty': d.qty,
                'Price Rate (RM)': d.priceRate,
                'Total Price (RM)': d.totalPrice
            };
            if (d.serials && d.serials.length > 0 && d.serials.some(s => s.serialNo !== 'N/A')) {
                const serialRows = d.serials.map(s => ({
                    'Item Name': `  S/N: ${s.serialNo}`,
                    'Qty': d.type === 'Issuance' ? -s.quantity : s.quantity
                }));
                return [mainRow, ...serialRows];
            }
            return [mainRow];
        });
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Stock Movement");
        XLSX.writeFile(wb, `Stock_Movement_Report.xlsx`);
    };

    const handleExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text(`Stock Movement Report`, 14, 15);

        const body = sortedData.flatMap(d => {
            const mainRow = [
                d.itemNo,
                d.itemName,
                format(parseISO(d.date), 'dd MMM yyyy'),
                d.docNo,
                d.unit,
                d.qty.toFixed(2),
                formatCurrency(d.priceRate),
                formatCurrency(d.totalPrice)
            ];
            if (d.serials && d.serials.length > 0 && d.serials.some(s => s.serialNo !== 'N/A')) {
                const serialRows = d.serials.map(s => {
                    const row: any[] = [{ content: `  S/N: ${s.serialNo}`, colSpan: 5, styles: { fontStyle: 'italic', textColor: 100 } }];
                    const serialQty = d.type === 'Issuance' ? -s.quantity : s.quantity;
                    row.push({ content: serialQty.toFixed(2), styles: { halign: 'right', fontStyle: 'italic', textColor: 100 } });
                    return row;
                });
                return [mainRow, ...serialRows];
            }
            return [mainRow];
        });


        autoTable(doc, {
            head: [['Item No', 'Item Name', 'Date', 'Doc No', 'Unit', 'Qty', 'Price Rate', 'Total Price']],
            body: body,
            startY: 20,
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: (data) => {
                 if (data.column.index > 3) {
                    data.cell.styles.halign = 'right';
                 }
                 if(data.cell.raw && (data.cell.raw as any).colSpan) {
                     data.cell.styles.halign = 'left';
                 }
            }
        });
        doc.save(`Stock_Movement_Report.pdf`);
    };


    return (
        <Card>
            <CardHeader>
                 <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Stock Movement</CardTitle>
                        <CardDescription>All material issuances and returns across all projects.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                        <Button variant="outline" size="sm" onClick={handleExportPdf}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className='w-8'></TableHead>
                            {renderHeader('Item No', 'itemNo')}
                            {renderHeader('Item Name', 'itemName')}
                            {renderHeader('Date', 'date')}
                            {renderHeader('Doc No', 'docNo')}
                            <TableHead>Unit</TableHead>
                            {renderHeader('Qty', 'qty', true)}
                            {renderHeader('Price Rate', 'priceRate', true)}
                            {renderHeader('Total Price', 'totalPrice', true)}
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {sortedData.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="text-center h-24">No stock movements found for the selected period.</TableCell></TableRow>
                        ) : (
                            sortedData.map(item => {
                                const isExpanded = expandedRows.has(item.id);
                                const hasSerials = item.serials && item.serials.length > 0 && item.serials.some(s => s.serialNo !== 'N/A');
                                return (
                                <Fragment key={item.id}>
                                    <TableRow className={hasSerials ? 'cursor-pointer' : ''} onClick={() => hasSerials && toggleRow(item.id)}>
                                        <TableCell className="py-2 px-4">
                                            {hasSerials && <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />}
                                        </TableCell>
                                        <TableCell className="py-2 px-4 text-xs">{item.itemNo}</TableCell>
                                        <TableCell className="py-2 px-4 text-xs">{item.itemName}</TableCell>
                                        <TableCell className="py-2 px-4 text-xs">{format(parseISO(item.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="py-2 px-4 text-xs">{item.docNo}</TableCell>
                                        <TableCell className="py-2 px-4 text-xs">{item.unit}</TableCell>
                                        <TableCell className={`text-right flex items-center justify-end gap-1 py-2 px-4 text-xs ${item.qty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {item.qty > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                        {Math.abs(item.qty).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(item.priceRate)}</TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(item.totalPrice)}</TableCell>
                                    </TableRow>
                                    {isExpanded && hasSerials && (
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableCell colSpan={9} className="p-0">
                                                <div className="p-2 pl-12">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow><TableHead className='w-[70%]'>Serial Number</TableHead><TableHead className='text-right'>Quantity</TableHead></TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {item.serials?.map((serial, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className='py-1 text-xs'>{serial.serialNo}</TableCell>
                                                                    <TableCell className='text-right py-1 text-xs'>
                                                                        <span className={`flex items-center justify-end gap-1 ${item.qty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                            {item.qty > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                                                            {serial.quantity.toFixed(2)}
                                                                        </span>
                                                                    </TableCell>
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
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={8} className="text-right font-bold">Total Net Movement</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totalMovementValue)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
