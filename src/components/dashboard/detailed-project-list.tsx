
'use client';

import type { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileUp, FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useMemo, useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface DetailedProjectListProps {
    projects: Project[]; // these should be pre-calculated
}

export default function DetailedProjectList({ projects }: DetailedProjectListProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [clientFilter, setClientFilter] = useState('all');
    const rowsPerPage = 25;
    
    useEffect(() => {
        setCurrentPage(1);
    }, [clientFilter]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };

    const uniqueClients = useMemo(() => {
        const clients = new Set<string>();
        projects.forEach(p => clients.add(p.client));
        return ['all', ...Array.from(clients).sort()];
    }, [projects]);

    const detailedProjectData = useMemo(() => {
        return projects
            .filter(project => clientFilter === 'all' || project.client === clientFilter)
            .map(project => {
            const clientPO = (project.purchaseOrders || []).find(po => po.type === 'Client');
            
            const poValue = (project.purchaseOrders || []).filter(po => po.type === 'Client').reduce((sum, po) => sum + po.items.reduce((itemSum, item) => itemSum + item.quantity * item.rate + (item.managementFee || 0), 0), 0);
            
            const physicalWorkDone = (project as any).actualRevenue || 0;
            
            const physicalProgress = poValue > 0 ? (physicalWorkDone / poValue) * 100 : 0;

            const totalClaimableAmount = physicalWorkDone;

            const amountInvoiceSubmitted = project.clientClaims?.reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0) || 0;

            const amountInvoiceReceived = project.clientClaims?.filter(c => c.status === 'Paid').reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0) || 0;

            const amountInvoicePending = amountInvoiceSubmitted - amountInvoiceReceived;

            const totalClaimablePercent = totalClaimableAmount > 0 ? (amountInvoiceSubmitted / totalClaimableAmount) * 100 : 0;

            return {
                id: project.id,
                name: project.name,
                client: project.client,
                poDate: clientPO ? clientPO.poDate : 'N/A',
                poNo: clientPO ? clientPO.poNo : 'N/A',
                poValue,
                physicalWorkDone,
                physicalProgress,
                totalClaimableAmount,
                amountInvoiceSubmitted,
                amountInvoiceReceived,
                amountInvoicePending,
                totalClaimablePercent
            };
        });
    }, [projects, clientFilter]);

    const totalPages = Math.ceil(detailedProjectData.length / rowsPerPage);
    const paginatedProjects = detailedProjectData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    const handleNextPage = () => goToPage(currentPage + 1);
    const handlePrevPage = () => goToPage(currentPage - 1);
    const goToFirstPage = () => setCurrentPage(1);
    const goToLastPage = () => goToPage(totalPages);

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const projectsByClient = detailedProjectData.reduce((acc, project) => {
            (acc[project.client] = acc[project.client] || []).push(project);
            return acc;
        }, {} as Record<string, typeof detailedProjectData>);

        const clients = Object.keys(projectsByClient);

        clients.forEach(clientName => {
            const clientProjects = projectsByClient[clientName];
            const data = clientProjects.map(p => ({
                'Project Name': p.name,
                'Client': p.client,
                'PO Date': p.poDate && p.poDate !== 'N/A' ? format(parseISO(p.poDate), 'yyyy-MM-dd') : 'N/A',
                'PO No': p.poNo,
                'PO Value (RM)': p.poValue,
                'Physical Work Done (RM)': p.physicalWorkDone,
                'Physical Progress (%)': p.physicalProgress,
                'Total Claimable Amount (RM)': p.totalClaimableAmount,
                'Amount Invoice Submitted (RM)': p.amountInvoiceSubmitted,
                'Amount Invoice Received (RM)': p.amountInvoiceReceived,
                'Amount Invoice Pending (RM)': p.amountInvoicePending,
                'Total Claimable (%)': p.totalClaimablePercent,
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            
            const sanitizedSheetName = clientName.replace(/[\\/*?:"<>|]/g, '').substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sanitizedSheetName);
        });

        XLSX.writeFile(wb, "Detailed_Project_List_by_Client.xlsx");
    };

    const handleExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape' });

        const projectsByClient = detailedProjectData.reduce((acc, project) => {
            (acc[project.client] = acc[project.client] || []).push(project);
            return acc;
        }, {} as Record<string, typeof detailedProjectData>);

        const clients = Object.keys(projectsByClient);

        clients.forEach((clientName, index) => {
            if (index > 0) {
                doc.addPage();
            }

            doc.setFontSize(18);
            doc.text(`Detailed Project List: ${clientName}`, 14, 22);

            const head = [['Project', 'PO Date', 'PO No', 'PO Value', 'Work Done', 'Progress', 'Claimable', 'Invoiced', 'Received', 'Pending', 'Claimable %']];
            const body = projectsByClient[clientName].map(p => ([
                p.name,
                p.poDate && p.poDate !== 'N/A' ? format(parseISO(p.poDate), 'dd-MM-yy') : 'N/A',
                p.poNo,
                formatCurrency(p.poValue),
                formatCurrency(p.physicalWorkDone),
                `${p.physicalProgress.toFixed(0)}%`,
                formatCurrency(p.totalClaimableAmount),
                formatCurrency(p.amountInvoiceSubmitted),
                formatCurrency(p.amountInvoiceReceived),
                formatCurrency(p.amountInvoicePending),
                `${p.totalClaimablePercent.toFixed(0)}%`,
            ]));

            autoTable(doc, {
                head: head,
                body: body,
                startY: 30,
                headStyles: { fillColor: [41, 128, 185], fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                didParseCell: (data) => {
                    if (data.column.index > 1) {
                        data.cell.styles.halign = 'right';
                    }
                }
            });
        });

        doc.save("Detailed_Project_List_by_Client.pdf");
    };


    return (
        <Card>
            <CardHeader>
                 <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Detailed Project List</CardTitle>
                        <CardDescription>A comprehensive list of all projects with detailed financial data.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                         <Select value={clientFilter} onValueChange={setClientFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by Client..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {uniqueClients.filter(c => c !== 'all').map(client => (
                                    <SelectItem key={client} value={client}>{client}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                        <Button variant="outline" size="sm" onClick={handleExportPdf}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="min-w-[1600px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px] min-w-[200px]">Project Name</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead className="min-w-[100px]">PO Date</TableHead>
                                <TableHead className="min-w-[120px]">PO No</TableHead>
                                <TableHead className="text-right min-w-[140px]">PO Value</TableHead>
                                <TableHead className="text-right min-w-[140px]">Physical Work Done</TableHead>
                                <TableHead className="min-w-[150px]">Physical Progress</TableHead>
                                <TableHead className="text-right min-w-[140px]">Total Claimable</TableHead>
                                <TableHead className="text-right min-w-[140px]">Amount Invoiced</TableHead>
                                <TableHead className="text-right min-w-[140px]">Amount Received</TableHead>
                                <TableHead className="text-right min-w-[140px]">Amount Pending</TableHead>
                                <TableHead className="min-w-[150px]">Total Claimable %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">No data available.</TableCell>
                                </TableRow>
                            ) : (
                                paginatedProjects.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium py-2 px-4">{p.name}</TableCell>
                                        <TableCell className="py-2 px-4">{p.client}</TableCell>
                                        <TableCell className="py-2 px-4">{p.poDate && p.poDate !== 'N/A' ? format(parseISO(p.poDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>
                                        <TableCell className="py-2 px-4">{p.poNo}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(p.poValue)}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(p.physicalWorkDone)}</TableCell>
                                        <TableCell className="py-2 px-4">
                                            <div className="flex items-center gap-2">
                                                <Progress value={p.physicalProgress} className="w-16" />
                                                <span>{p.physicalProgress.toFixed(0)}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(p.totalClaimableAmount)}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(p.amountInvoiceSubmitted)}</TableCell>
                                        <TableCell className="text-right text-green-600 py-2 px-4">{formatCurrency(p.amountInvoiceReceived)}</TableCell>
                                        <TableCell className="text-right text-orange-600 py-2 px-4">{formatCurrency(p.amountInvoicePending)}</TableCell>
                                        <TableCell className="py-2 px-4">
                                            <div className="flex items-center gap-2">
                                                <Progress value={p.totalClaimablePercent} className="w-16" />
                                                <span>{p.totalClaimablePercent.toFixed(0)}%</span>
                                            </div>
                                        </TableCell>
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
