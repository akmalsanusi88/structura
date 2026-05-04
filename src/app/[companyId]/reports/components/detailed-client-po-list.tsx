
'use client';

import type { Project, PurchaseOrder } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileUp, FileDown, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useMemo, useState, useEffect, Fragment } from 'react';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DetailedProjectData {
    // Project-level info
    isFirstRow: boolean;
    rowSpan: number;
    projectId: string;
    projectName: string;
    client: string;
    hasFinalOrRetentionClaim: boolean;
    // PO-level info
    po: PurchaseOrder | null; 
    poDate: string;
    poNo: string;
    poValue: number;
    // Calculated fields
    physicalWorkDone: number;
    physicalProgress: number;
    totalClaimableAmount: number;
    amountInvoiceSubmitted: number;
    amountInvoiceReceived: number;
    amountInvoicePending: number;
    pendingInvoice: number;
    claims: any[];
}
type SortKey = keyof Omit<DetailedProjectData, 'isFirstRow' | 'po' | 'rowSpan' | 'claims' | 'hasFinalOrRetentionClaim'>;

interface DetailedProjectListProps {
    projects: Project[]; // these should be pre-calculated
}

export default function DetailedClientPoList({ projects }: DetailedProjectListProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [clientFilter, setClientFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'client', direction: 'asc' });
    const rowsPerPage = 50;
    
    useEffect(() => {
        setCurrentPage(1);
    }, [clientFilter, sortConfig]);

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
        const flattenedData: Omit<DetailedProjectData, 'isFirstRow' | 'rowSpan'>[] = [];

        const filteredProjects = projects.filter(project => clientFilter === 'all' || project.client === clientFilter);
        
        filteredProjects.forEach(project => {
            const hasFinalClaimProject = (project.clientClaims || []).some(c => c.isFinal || c.claimNo?.toLowerCase().includes('retention'));
            const hasFinalOrRetentionClaim = hasFinalClaimProject;

            const clientPOs = (project.purchaseOrders || []).filter(po => po.type === 'Client');
            
            if (clientPOs.length === 0) {
                 const totalPhysicalWorkDoneForProject = (project as any).actualRevenue || 0;
                 if (totalPhysicalWorkDoneForProject > 0) {
                    const allClaimsForProject = project.clientClaims || [];
                    const amountInvoiceSubmitted = allClaimsForProject.reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0);
                    const amountInvoiceReceived = allClaimsForProject.filter(c => c.status === 'Paid').reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0);
                    const amountInvoicePending = amountInvoiceSubmitted - amountInvoiceReceived;
                    const pendingInvoice = totalPhysicalWorkDoneForProject - amountInvoiceSubmitted;

                     flattenedData.push({
                        projectId: project.id,
                        projectName: project.name,
                        client: project.client,
                        hasFinalOrRetentionClaim,
                        po: null,
                        poDate: 'N/A',
                        poNo: 'N/A',
                        poValue: 0,
                        physicalWorkDone: totalPhysicalWorkDoneForProject,
                        physicalProgress: hasFinalOrRetentionClaim ? 100 : 0, 
                        totalClaimableAmount: totalPhysicalWorkDoneForProject,
                        amountInvoiceSubmitted,
                        amountInvoiceReceived,
                        amountInvoicePending,
                        pendingInvoice,
                        claims: allClaimsForProject,
                    });
                }
               return;
            }

            clientPOs.forEach((clientPO) => {
                const poValue = clientPO ? clientPO.items.reduce((sum, item) => sum + (item.quantity * item.rate) + (item.managementFee || 0), 0) : 0;
                
                const clientPoItemMap = new Map(clientPO.items.map(item => [item.id, item]));

                const workDoneFromLogs = (project.dailyActivities || []).reduce((total, log) => {
                    return total + log.work.reduce((dayTotal, workRecord) => {
                        const poItem = clientPoItemMap.get(workRecord.boqItemId);
                        if (poItem) {
                            const workValue = workRecord.quantity * poItem.rate;
                            let feePortion = 0;
                            if (poItem.managementFee && poItem.quantity > 0) {
                                feePortion = (workRecord.quantity / poItem.quantity) * poItem.managementFee;
                            }
                            return dayTotal + workValue + feePortion;
                        }
                        return dayTotal;
                    }, 0);
                }, 0) || 0;

                const workDoneFromSIs = (project.dailyActivities || [])
                    .flatMap(log => log.siteInstructions || [])
                    .filter(si => si.context === 'Client' && si.purchaseOrderId === clientPO.id)
                    .reduce((total, si) => total + si.amount, 0);

                const physicalWorkDoneForPo = workDoneFromLogs + workDoneFromSIs;
                
                const claimsForPo = (project.clientClaims || []).filter(claim => claim.purchaseOrderId === clientPO.id);
                const hasFinalClaimForPo = claimsForPo.some(c => c.isFinal || c.claimNo?.toLowerCase().includes('retention'));

                let physicalProgress = poValue > 0 ? Math.min(100, (physicalWorkDoneForPo / poValue) * 100) : 0;
                
                if (hasFinalClaimForPo) {
                    physicalProgress = 100;
                }

                const amountInvoiceSubmitted = claimsForPo.reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0);
                const amountInvoiceReceived = claimsForPo.filter(c => c.status === 'Paid').reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0);
                const amountInvoicePending = amountInvoiceSubmitted - amountInvoiceReceived;
                const pendingInvoice = physicalWorkDoneForPo - amountInvoiceSubmitted;
                
                flattenedData.push({
                    projectId: project.id,
                    projectName: project.name,
                    client: project.client,
                    hasFinalOrRetentionClaim: hasFinalClaimForPo,
                    po: clientPO,
                    poDate: clientPO?.poDate || 'N/A',
                    poNo: clientPO?.poNo || 'N/A',
                    poValue,
                    physicalWorkDone: physicalWorkDoneForPo,
                    physicalProgress,
                    totalClaimableAmount: physicalWorkDoneForPo,
                    amountInvoiceSubmitted,
                    amountInvoiceReceived,
                    amountInvoicePending,
                    pendingInvoice,
                    claims: claimsForPo,
                });
            })
        });
        
        return flattenedData;
    }, [projects, clientFilter]);
    
    const processedAndSortedData = useMemo(() => {
        const projectsMap = new Map<string, Omit<DetailedProjectData, 'isFirstRow' | 'rowSpan'>[]>();
        detailedProjectData.forEach(item => {
            if (!projectsMap.has(item.projectId)) {
                projectsMap.set(item.projectId, []);
            }
            projectsMap.get(item.projectId)!.push(item);
        });

        const projectGroups = Array.from(projectsMap.values());

        if (sortConfig) {
            projectGroups.sort((groupA, groupB) => {
                const findRepresentativeValue = (group: Omit<DetailedProjectData, 'isFirstRow' | 'rowSpan'>[]) => {
                    if (group.length === 0) return null;
                    if (sortConfig.direction === 'asc') {
                        return group.reduce((min, item) => (item[sortConfig.key] ?? '') < (min[sortConfig.key] ?? '') ? item : min, group[0])[sortConfig.key];
                    } else {
                        return group.reduce((max, item) => (item[sortConfig.key] ?? '') > (max[sortConfig.key] ?? '') ? item : max, group[0])[sortConfig.key];
                    }
                };

                const valueA = findRepresentativeValue(groupA);
                const valueB = findRepresentativeValue(groupB);

                if (valueA === null || valueA === undefined) return 1;
                if (valueB === null || valueB === undefined) return -1;
                
                let comparison = 0;
                if (typeof valueA === 'number' && typeof valueB === 'number') {
                    comparison = (valueA as number) - (valueB as number);
                } else {
                    comparison = String(valueA).localeCompare(String(valueB));
                }
                
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
            
            projectGroups.forEach(group => {
                group.sort((a, b) => {
                    const aValue = a[sortConfig.key];
                    const bValue = b[sortConfig.key];
                    if (aValue === null || aValue === undefined) return 1;
                    if (bValue === null || bValue === undefined) return -1;

                    let comparison = 0;
                     if (typeof aValue === 'number' && typeof bValue === 'number') {
                        comparison = aValue - bValue;
                    } else {
                        comparison = String(aValue).localeCompare(String(bValue));
                    }
                    return sortConfig.direction === 'asc' ? comparison : -comparison;
                });
            });
        }
        
        const flattenedSortedData = projectGroups.flat();

        const finalData: DetailedProjectData[] = [];
        const processedProjectIds = new Set<string>();

        flattenedSortedData.forEach(item => {
            if (!processedProjectIds.has(item.projectId)) {
                 finalData.push({
                    ...item,
                    isFirstRow: true,
                    rowSpan: projectsMap.get(item.projectId)?.length || 1,
                });
                processedProjectIds.add(item.projectId);
            } else {
                finalData.push({
                    ...item,
                    isFirstRow: false,
                    rowSpan: 0,
                });
            }
        });
        return finalData;

    }, [detailedProjectData, sortConfig]);

    const totalPages = Math.ceil(processedAndSortedData.length / rowsPerPage);
    const paginatedProjects = processedAndSortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    const handleNextPage = () => goToPage(currentPage + 1);
    const handlePrevPage = () => goToPage(currentPage - 1);
    const goToFirstPage = () => setCurrentPage(1);
    const goToLastPage = () => goToPage(totalPages);

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
        <TableHead rowSpan={2} className={cn("align-bottom", className)}>
            <Button variant="ghost" className="w-full justify-start p-0" onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );
     const renderNumericHeader = (label: string, sortKey: SortKey, className?: string) => (
        <TableHead rowSpan={2} className={cn("align-bottom", className)}>
            <Button variant="ghost" className="w-full justify-end p-0" onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const header_main = ['Client', 'PO Date', 'PO No', 'Project Name', 'Status', 'PO Value', 'Work Done', 'Progress', 'Claimable', 'Invoiced', null, null, null, null, 'Received Payment', null, 'Pending Payment', 'Pending Invoice'];
        const header_sub = [null, null, null, null, null, null, null, null, null, 'Date', 'Claim Type', 'Invoice No.', 'Amount', 'Retention', 'Date', 'Amount', null, null];
        
        let data: (string | number | null)[][] = [];

        processedAndSortedData.forEach(p => {
            const poDateFormatted = p.poDate && p.poDate !== 'N/A' ? format(parseISO(p.poDate), 'yyyy-MM-dd') : 'N/A';
            const projectName = p.projectName;
            const projectStatus = p.hasFinalOrRetentionClaim ? 'Final Claimed' : '';

            if (p.claims.length === 0) {
                data.push([
                    p.client, poDateFormatted, p.poNo, projectName, projectStatus, p.poValue, p.physicalWorkDone, `${p.physicalProgress.toFixed(0)}%`, p.totalClaimableAmount,
                    null, null, null, null, null, null, null,
                    p.amountInvoicePending, p.pendingInvoice
                ]);
            } else {
                p.claims.forEach((claim, index) => {
                    const row = [];
                    if (index === 0) {
                        row.push(p.client, poDateFormatted, p.poNo, projectName, projectStatus, p.poValue, p.physicalWorkDone, `${p.physicalProgress.toFixed(0)}%`, p.totalClaimableAmount);
                    } else {
                        row.push(null, null, null, null, null, null, null, null, null);
                    }
                    const netClaimAmount = claim ? claim.amount - (claim.retentionAmount || 0) : null;
                    row.push(
                        claim ? format(parseISO(claim.date), 'yyyy-MM-dd') : null,
                        claim ? claim.claimNo : null,
                        claim ? claim.invoiceNo : null,
                        netClaimAmount,
                        claim ? claim.retentionAmount || 0 : null,
                        claim && claim.status === 'Paid' && claim.statusDates?.Paid ? format(parseISO(claim.statusDates.Paid), 'yyyy-MM-dd') : null,
                        claim && claim.status === 'Paid' ? claim.amount - (claim.retentionAmount || 0) : null
                    );
                    if (index === 0) {
                         row.push(p.amountInvoicePending, p.pendingInvoice);
                    } else {
                        row.push(null, null);
                    }
                    data.push(row);
                });
            }
        });

        const ws_data = [header_main, header_sub, ...data];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        
        const merges = [
            { s: { r: 0, c: 9 }, e: { r: 0, c: 13 } }, // Invoiced
            { s: { r: 0, c: 14 }, e: { r: 0, c: 15 } }, // Received Payment
        ];

        // Add row-spanning merges
        let currentRow = 2; // Start after headers
        processedAndSortedData.forEach(p => {
            const rowSpan = Math.max(1, p.claims.length);
            if (rowSpan > 1) {
                for (let i = 0; i < 9; i++) {
                    merges.push({ s: { r: currentRow, c: i }, e: { r: currentRow + rowSpan - 1, c: i } });
                }
                 for (let i = 16; i < 18; i++) {
                    merges.push({ s: { r: currentRow, c: i }, e: { r: currentRow + rowSpan - 1, c: i } });
                }
            }
            currentRow += rowSpan;
        });
        
        ws['!merges'] = merges;
        
        XLSX.utils.book_append_sheet(wb, ws, "Client PO Details");
        XLSX.writeFile(wb, "Detailed_Client_PO_List.xlsx");
    };

    return (
        <Card>
            <CardHeader>
                 <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Detailed Client PO List</CardTitle>
                        <CardDescription>A comprehensive list of all projects with detailed financial data by Client PO.</CardDescription>
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
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="min-w-[2000px]">
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Client', 'client', 'w-[180px] min-w-[180px]')}
                                {renderHeader('PO Date', 'poDate', 'w-[120px] min-w-[120px]')}
                                {renderHeader('PO No', 'poNo', 'w-[150px] min-w-[150px]')}
                                {renderHeader('Project Name', 'projectName', 'w-[300px] min-w-[300px]')}
                                {renderNumericHeader('PO Value', 'poValue', 'text-right min-w-[150px]')}
                                {renderNumericHeader('Work Done', 'physicalWorkDone', 'text-right min-w-[150px]')}
                                {renderNumericHeader('Progress', 'physicalProgress', 'min-w-[150px]')}
                                {renderNumericHeader('Claimable', 'totalClaimableAmount', 'text-right min-w-[150px]')}
                                <TableHead colSpan={5} className="text-center border-l">Invoiced</TableHead>
                                <TableHead colSpan={2} className="text-center border-l">Received Payment</TableHead>
                                {renderNumericHeader('Pending Payment', 'amountInvoicePending', 'text-right min-w-[150px]')}
                                {renderNumericHeader('Pending Invoice', 'pendingInvoice', 'text-right min-w-[150px]')}
                            </TableRow>
                            <TableRow>
                                <TableHead className="text-right border-l w-[120px]">Date</TableHead>
                                <TableHead className='w-[150px]'>Claim Type</TableHead>
                                <TableHead className='w-[150px]'>Invoice No.</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Retention</TableHead>
                                <TableHead className="text-right border-l w-[120px]">Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={18} className="h-24 text-center text-muted-foreground">No data available.</TableCell>
                                </TableRow>
                            ) : (
                                paginatedProjects.map((p, index) => {
                                    // Check if this is the first project occurrence ON THIS PAGE
                                    const isFirstProjectOccurrenceOnPage = index === 0 || paginatedProjects[index - 1].projectId !== p.projectId;
                                    
                                    const maxRows = Math.max(1, p.claims.length);
                                    
                                    // Calculate rowSpan for project-level info restricted to THIS PAGE
                                    let projectRowSpanOnPage = 0;
                                    if (isFirstProjectOccurrenceOnPage) {
                                        for (let i = index; i < paginatedProjects.length; i++) {
                                            if (paginatedProjects[i].projectId === p.projectId) {
                                                projectRowSpanOnPage += Math.max(1, paginatedProjects[i].claims.length);
                                            } else {
                                                break;
                                            }
                                        }
                                    }

                                    return (
                                        <Fragment key={`${p.projectId}-${p.po?.id || index}`}>
                                            {Array.from({ length: maxRows }).map((_, claimIndex) => {
                                                const claim = p.claims[claimIndex];
                                                const isFirstClaimRowOfPo = claimIndex === 0;
                                                const showProjectInfo = isFirstClaimRowOfPo && isFirstProjectOccurrenceOnPage;
                                                
                                                return (
                                                    <TableRow key={claim ? claim.id : `empty-${index}-${claimIndex}`} className={cn(p.hasFinalOrRetentionClaim && 'bg-green-50/50 dark:bg-green-900/10')}>
                                                        {showProjectInfo && <TableCell rowSpan={projectRowSpanOnPage} className="align-top py-2 border-b">{p.client}</TableCell>}
                                                        {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="align-top py-2">{p.poDate && p.poDate !== 'N/A' ? format(parseISO(p.poDate), 'dd-MM-yyyy') : 'N/A'}</TableCell>}
                                                        {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="align-top py-2">{p.poNo}</TableCell>}
                                                        {showProjectInfo && (
                                                            <TableCell rowSpan={projectRowSpanOnPage} className="font-medium align-top py-2 border-b">
                                                                {p.projectName}
                                                            </TableCell>
                                                        )}
                                                        {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="text-right align-top py-2">{formatCurrency(p.poValue)}</TableCell>}
                                                        {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="text-right align-top py-2">{formatCurrency(p.physicalWorkDone)}</TableCell>}
                                                        {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="align-top py-2">
                                                            {p.poValue > 0 && <div className="flex items-center gap-2 justify-end"><Progress value={p.physicalProgress} className="w-16" /><span>{p.physicalProgress.toFixed(0)}%</span></div>}
                                                        </TableCell>}
                                                        {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="text-right align-top py-2">{formatCurrency(p.totalClaimableAmount)}</TableCell>}
                                                        
                                                        <TableCell className="text-right py-1 px-4 text-xs align-middle border-l">{claim ? format(parseISO(claim.date), 'dd-MM-yy') : ''}</TableCell>
                                                        <TableCell className="py-1 px-4 text-xs align-middle">{claim ? claim.claimNo : ''}</TableCell>
                                                        <TableCell className="py-1 px-4 text-xs align-middle">{claim ? claim.invoiceNo : ''}</TableCell>
                                                        <TableCell className="text-right py-1 px-4 text-xs align-middle">{claim ? formatCurrency(claim.amount - (claim.retentionAmount || 0)) : ''}</TableCell>
                                                        <TableCell className="text-right py-1 px-4 text-xs align-middle">{claim ? formatCurrency(claim.retentionAmount || 0) : ''}</TableCell>

                                                        <TableCell className="text-right py-1 px-4 text-xs align-middle border-l">{claim && claim.status === 'Paid' && claim.statusDates?.Paid ? format(parseISO(claim.statusDates.Paid), 'dd-MM-yy') : ''}</TableCell>
                                                        <TableCell className="text-right py-1 px-4 text-xs align-middle text-green-600">{claim && claim.status === 'Paid' ? formatCurrency(claim.amount - (claim.retentionAmount || 0)) : ''}</TableCell>
                                                        
                                                        {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="text-right align-top py-2 text-orange-600">{formatCurrency(p.amountInvoicePending)}</TableCell>}
                                                        {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="text-right align-top py-2 text-blue-600">{formatCurrency(p.pendingInvoice)}</TableCell>}
                                                    </TableRow>
                                                )
                                            })}
                                        </Fragment>
                                    )
                                })
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
