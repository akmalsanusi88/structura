
'use client';

import type { Project } from '@/lib/types';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileUp, FileDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format, parseISO } from 'date-fns';

interface ClientSummary {
    clientName: string;
    poAmountIssued: number;
    workDoneValue: number;
    physicalWorkDonePercent: number;
    poCount: number;
    invoiceAmount: number;
    receiptAmount: number;
    pendingReceiptAmount: number;
    pendingInvoiceAmount: number;
}

interface ProjectSummaryByClientProps {
    projects: Project[]; // these should be pre-calculated
}

export default function ProjectSummaryByClient({ projects }: ProjectSummaryByClientProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };

    const clientSummaries = useMemo(() => {
        const summaryMap = new Map<string, Omit<ClientSummary, 'clientName' | 'physicalWorkDonePercent' | 'pendingReceiptAmount' | 'pendingInvoiceAmount'>>();
        
        projects.forEach(project => {
            let clientData = summaryMap.get(project.client);
            if (!clientData) {
                clientData = {
                    poAmountIssued: 0,
                    workDoneValue: 0,
                    poCount: 0,
                    invoiceAmount: 0,
                    receiptAmount: 0,
                };
                summaryMap.set(project.client, clientData);
            }
            
            // PO Amount Issued & Count
            const clientPOs = (project.purchaseOrders || []).filter(po => po.type === 'Client');
            clientData.poCount += clientPOs.length;
            clientData.poAmountIssued += clientPOs.reduce((sum, po) => sum + po.items.reduce((itemSum, item) => itemSum + item.quantity * item.rate + (item.managementFee || 0), 0), 0);
            
            // Work Done Value (using pre-calculated actualRevenue)
            clientData.workDoneValue += (project as any).actualRevenue || 0;
            
            // Invoice & Receipt Amounts
            (project.clientClaims || []).forEach(claim => {
                clientData.invoiceAmount += (claim.amount - (claim.retentionAmount || 0));
                if (claim.status === 'Paid') {
                    clientData.receiptAmount += (claim.amount - (claim.retentionAmount || 0));
                }
            });
        });
        
        return Array.from(summaryMap.entries()).map(([clientName, data]) => {
            const physicalWorkDonePercent = data.poAmountIssued > 0 ? (data.workDoneValue / data.poAmountIssued) * 100 : 0;
            const pendingReceiptAmount = data.invoiceAmount - data.receiptAmount;
            const pendingInvoiceAmount = data.workDoneValue - data.invoiceAmount;
            return {
                clientName,
                ...data,
                physicalWorkDonePercent,
                pendingReceiptAmount,
                pendingInvoiceAmount
            };
        });

    }, [projects]);

    const totalPages = Math.ceil(clientSummaries.length / rowsPerPage);
    const paginatedSummaries = clientSummaries.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    const handleNextPage = () => goToPage(currentPage + 1);
    const handlePrevPage = () => goToPage(currentPage - 1);
    const goToFirstPage = () => setCurrentPage(1);
    const goToLastPage = () => goToPage(totalPages);

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const data = clientSummaries.map(s => ({
            'Client': s.clientName,
            'PO Amount Issued (RM)': s.poAmountIssued,
            'Work Done Value (RM)': s.workDoneValue,
            '% Done': `${s.physicalWorkDonePercent.toFixed(2)}%`,
            '# of POs': s.poCount,
            'Invoiced Amount (RM)': s.invoiceAmount,
            'Received Amount (RM)': s.receiptAmount,
            'Pending Receipt (RM)': s.pendingReceiptAmount,
            'Pending Invoice (RM)': s.pendingInvoiceAmount,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Client Summary");
        XLSX.writeFile(wb, "Project_Summary_by_Client.xlsx");
    };

    const handleExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Project Summary by Client", 14, 15);
        autoTable(doc, {
            head: [['Client', 'PO Amount', 'Work Done', '% Done', '# POs', 'Invoiced', 'Received', 'Pending Receipt', 'Pending Invoice']],
            body: clientSummaries.map(s => [
                s.clientName,
                formatCurrency(s.poAmountIssued),
                formatCurrency(s.workDoneValue),
                `${s.physicalWorkDonePercent.toFixed(2)}%`,
                s.poCount,
                formatCurrency(s.invoiceAmount),
                formatCurrency(s.receiptAmount),
                formatCurrency(s.pendingReceiptAmount),
                formatCurrency(s.pendingInvoiceAmount),
            ]),
            startY: 20,
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: (data) => {
                 if (data.column.index > 0) {
                    data.cell.styles.halign = 'right';
                 }
            }
        });
        doc.save("Project_Summary_by_Client.pdf");
    };


    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Summary Projects by Client</CardTitle>
                        <CardDescription>Aggregated project financial summary by client.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                        <Button variant="outline" size="sm" onClick={handleExportPdf}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="min-w-[1000px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client</TableHead>
                                <TableHead className="text-right">PO Amount Issued</TableHead>
                                <TableHead className="text-right">Work Done Value</TableHead>
                                <TableHead>% Done</TableHead>
                                <TableHead className="text-right"># of POs</TableHead>
                                <TableHead className="text-right">Invoiced Amount</TableHead>
                                <TableHead className="text-right">Amount Received</TableHead>
                                <TableHead className="text-right">Pending Receipt</TableHead>
                                <TableHead className="text-right">Pending Invoice</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedSummaries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No data available.</TableCell>
                                </TableRow>
                            ) : (
                                paginatedSummaries.map(summary => (
                                    <TableRow key={summary.clientName}>
                                        <TableCell className="font-medium py-2 px-4">{summary.clientName}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(summary.poAmountIssued)}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(summary.workDoneValue)}</TableCell>
                                        <TableCell className="py-2 px-4">
                                            <div className="flex items-center gap-2">
                                                <Progress value={summary.physicalWorkDonePercent} className="w-16" />
                                                <span>{summary.physicalWorkDonePercent.toFixed(0)}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-2 px-4">{summary.poCount}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(summary.invoiceAmount)}</TableCell>
                                        <TableCell className="text-right text-green-600 py-2 px-4">{formatCurrency(summary.receiptAmount)}</TableCell>
                                        <TableCell className="text-right text-orange-600 py-2 px-4">{formatCurrency(summary.pendingReceiptAmount)}</TableCell>
                                        <TableCell className="text-right text-blue-600 py-2 px-4">{formatCurrency(summary.pendingInvoiceAmount)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
             <CardFooter className="py-4">
                <div className="flex items-center justify-end w-full space-x-4">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages > 0 ? totalPages : 1}
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
            </CardFooter>
        </Card>
    );
}
