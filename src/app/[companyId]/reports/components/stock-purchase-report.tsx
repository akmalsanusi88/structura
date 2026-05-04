
'use client';

import type { DeliveryOrder, MaterialPurchaseOrder, PlantUnit, SerialInfo, PurchaseData } from '@/lib/types';
import { useMemo, useState, Fragment } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, ChevronDown, FileDown, FileUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StockPurchaseReportProps {
  deliveryOrders: DeliveryOrder[];
  materialPurchaseOrders: MaterialPurchaseOrder[];
  plantUnits: PlantUnit[];
  selectedYear: string;
  selectedMonth: string;
}

type SortKey = 'itemNo' | 'itemName' | 'date' | 'doNo' | 'qty' | 'priceRate' | 'totalPrice' | 'projectName' | 'materialPoNo';

export default function StockPurchaseReport({ deliveryOrders, materialPurchaseOrders, plantUnits, selectedYear, selectedMonth }: StockPurchaseReportProps) {
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
  
  const poMap = useMemo(() => {
    const map = new Map<string, MaterialPurchaseOrder>();
    materialPurchaseOrders.forEach(po => {
        map.set(po.id, po);
    });
    return map;
  }, [materialPurchaseOrders]);

  const poItemMap = useMemo(() => {
    const map = new Map();
    materialPurchaseOrders.forEach(po => {
      po.items.forEach(item => {
        map.set(item.id, item);
      });
    });
    return map;
  }, [materialPurchaseOrders]);

  const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);

  const purchaseData: PurchaseData[] = useMemo(() => {
    const dateFilter = (dateStr: string) => {
        if (!dateStr) return false;
        if (selectedYear === 'all') return true;
        if (selectedMonth === 'all') return dateStr.startsWith(selectedYear);
        return dateStr.startsWith(selectedMonth);
    };

    return deliveryOrders
      .filter(d => dateFilter(d.date))
      .flatMap(d => {
        const materialPO = poMap.get(d.materialPurchaseOrderId);
        return d.items.map((item, itemIdx) => {
            const poItem = poItemMap.get(item.poItemId);
            const plantUnit = plantUnitMap.get(poItem?.sourceId);
            const rate = poItem?.rate || 0;
            return {
              id: `${d.id}-${item.poItemId}-${itemIdx}`,
              sourceId: poItem?.sourceId || 'N/A',
              itemNo: plantUnit?.puId || 'N/A',
              itemName: item.description,
              date: d.date,
              doNo: d.doNo,
              unit: item.unit,
              qty: item.receivedQuantity,
              priceRate: rate,
              totalPrice: item.receivedQuantity * rate,
              serials: item.serials,
              projectName: materialPO?.projectName,
              projectNo: materialPO?.projectNo,
              projectPoNo: materialPO?.projectPoNo,
              materialPoNo: materialPO?.poNo,
            };
        })
      }
    )
  }, [deliveryOrders, poMap, poItemMap, plantUnitMap, selectedYear, selectedMonth]);

  const sortedData = useMemo(() => {
    let sortableItems = [...purchaseData];
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
    }
    return sortableItems;
  }, [purchaseData, sortConfig]);

  const totalPurchaseValue = useMemo(() => {
      return sortedData.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [sortedData]);

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

  const getFileNamePeriod = () => {
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
        return format(parseISO(selectedMonth), 'yyyy-MM');
    } else if (selectedYear !== 'all') {
        return selectedYear;
    }
    return "All_Time";
  };

  const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const data = sortedData.flatMap(d => {
            const mainRow = {
                'Item No': d.itemNo,
                'Item Name': d.itemName,
                'Project Name': d.projectName || 'General',
                'Project No': d.projectNo || '',
                'Project PO No': d.projectPoNo || '',
                'Material PO No': d.materialPoNo || '',
                'Date': format(parseISO(d.date), 'yyyy-MM-dd'),
                'DO No': d.doNo,
                'Unit': d.unit,
                'Qty': d.qty,
                'Price Rate (RM)': d.priceRate,
                'Total Price (RM)': d.totalPrice
            };
            if (d.serials && d.serials.length > 0 && d.serials.some(s => s.serialNo !== 'N/A')) {
                const serialRows = d.serials.map(s => ({
                    'Item Name': `  S/N: ${s.serialNo}`,
                    'Qty': s.quantity
                }));
                return [mainRow, ...serialRows];
            }
            return [mainRow];
        });
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Stock Purchase");
        XLSX.writeFile(wb, `Stock_Purchase_Report_${getFileNamePeriod()}.xlsx`);
    };

    const handleExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Stock Purchase Report", 14, 15);

        const body = sortedData.flatMap(d => {
            const mainRow = [
                d.itemNo,
                d.itemName,
                `${d.projectName || 'General'}${d.projectNo ? `\n${d.projectNo}` : ''}${d.projectPoNo ? `\n${d.projectPoNo}`: ''}`,
                d.materialPoNo || 'N/A',
                format(parseISO(d.date), 'dd MMM yyyy'),
                d.doNo,
                d.unit,
                d.qty.toFixed(2),
                formatCurrency(d.priceRate),
                formatCurrency(d.totalPrice)
            ];
             if (d.serials && d.serials.length > 0 && d.serials.some(s => s.serialNo !== 'N/A')) {
                const serialRows = d.serials.map(s => {
                    const row: any[] = [{ content: `  S/N: ${s.serialNo}`, colSpan: 7, styles: { fontStyle: 'italic', textColor: 100 } }];
                    row.push({ content: s.quantity.toFixed(2), styles: { halign: 'right', fontStyle: 'italic', textColor: 100 } });
                    return row;
                });
                return [mainRow, ...serialRows];
            }
            return [mainRow];
        });

        autoTable(doc, {
            head: [['Item No', 'Item Name', 'Project Details', 'Material PO', 'Date', 'DO No', 'Unit', 'Qty', 'Price Rate', 'Total Price']],
            body: body,
            startY: 20,
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: (data) => {
                 if (data.column.index > 5) {
                    data.cell.styles.halign = 'right';
                 }
                 if(data.cell.raw && (data.cell.raw as any).colSpan) {
                     data.cell.styles.halign = 'left';
                 }
            }
        });
        doc.save(`Stock_Purchase_Report_${getFileNamePeriod()}.pdf`);
    };

  return (
    <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Stock Purchase</CardTitle>
                    <CardDescription>Detailed list of all materials received from suppliers.</CardDescription>
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
                    {renderHeader('Material PO no', 'materialPoNo')}
                    {renderHeader('Date', 'date')}
                    {renderHeader('DO No', 'doNo')}
                    <TableHead>Unit</TableHead>
                    {renderHeader('Qty', 'qty', true)}
                    {renderHeader('Price Rate', 'priceRate', true)}
                    {renderHeader('Total Price', 'totalPrice', true)}
                </TableRow>
                </TableHeader>
                <TableBody>
                {sortedData.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center h-24">No stock purchases found for the selected period.</TableCell></TableRow>
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
                                    <TableCell className="py-2 px-4 text-xs">{item.materialPoNo || 'N/A'}</TableCell>
                                    <TableCell className="py-2 px-4 text-xs">{format(parseISO(item.date), 'dd MMM yyyy')}</TableCell>
                                    <TableCell className="py-2 px-4 text-xs">{item.doNo}</TableCell>
                                    <TableCell className="py-2 px-4 text-xs">{item.unit}</TableCell>
                                    <TableCell className="text-right py-2 px-4 text-xs">{item.qty.toFixed(2)}</TableCell>
                                    <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(item.priceRate)}</TableCell>
                                    <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(item.totalPrice)}</TableCell>
                                </TableRow>
                                {isExpanded && hasSerials && (
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableCell colSpan={10} className="p-0">
                                            <div className="p-2 pl-12">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow><TableHead className='w-[70%]'>Serial Number</TableHead><TableHead className='text-right'>Quantity</TableHead></TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {item.serials?.map((serial, idx) => (
                                                            <TableRow key={idx}>
                                                                <TableCell className='py-1 text-xs'>{serial.serialNo}</TableCell>
                                                                <TableCell className='text-right py-1 text-xs'>{serial.quantity.toFixed(2)}</TableCell>
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
                        <TableCell colSpan={9} className="text-right font-bold">Total Purchase Value</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(totalPurchaseValue)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            </div>
        </CardContent>
    </Card>
  );
}
