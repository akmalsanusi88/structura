
'use client';

import type { Project, PurchaseOrder } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileUp, FileDown, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useMemo, useState, useEffect, Fragment } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


interface DetailedSubconData {
    // Project-level info
    isFirstRow: boolean;
    rowSpan: number;
    projectId: string;
    projectName: string;
    client: string;
    // Subcon PO-level info
    subconPo: PurchaseOrder;
    subconName: string;
    subconPoNo: string;
    subconPoValue: number;
    subconWorkDone: number;
    subconProgress: number;
    subconClaimable: number;
    subconInvoiced: number;
    subconPaid: number;
    subconPendingPaid: number;
    claims: any[];
}
type SortKey = keyof Omit<DetailedSubconData, 'isFirstRow' | 'subconPo' | 'rowSpan' | 'claims'>;

interface DetailedSubconPoListProps {
    projects: Project[];
}

export default function DetailedSubconPoList({ projects }: DetailedSubconPoListProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [clientFilter, setClientFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const rowsPerPage = 30;

    useEffect(() => {
        setCurrentPage(1);
    }, [clientFilter, sortConfig]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };
    
    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        })
    }

    const uniqueClients = useMemo(() => {
        const clients = new Set<string>();
        projects.forEach(p => clients.add(p.client));
        return ['all', ...Array.from(clients).sort()];
    }, [projects]);
    
    const detailedSubconData = useMemo(() => {
        const flattenedData: Omit<DetailedSubconData, 'isFirstRow' | 'rowSpan'>[] = [];
        const filteredProjects = projects.filter(p => clientFilter === 'all' || p.client === clientFilter);
        
        filteredProjects.forEach(project => {
            const subconPOs = (project.purchaseOrders || []).filter(po => po.type === 'Subcontractor');
            if (subconPOs.length === 0) return;
            
            subconPOs.forEach((subconPO) => {
                 const subconPoValue = subconPO.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
                 
                 const subconWorkDone = (project.dailyActivities || []).reduce((sum, log) => {
                    return sum + log.work.filter(w => subconPO.items.some(item => item.id === w.boqItemId)).reduce((workSum, work) => {
                        const item = subconPO.items.find(i => i.id === work.boqItemId);
                        return workSum + (work.quantity * (item?.rate || 0));
                    }, 0);
                }, 0);

                const claimsForPo = (project.subconClaims || []).filter(c => c.purchaseOrderId === subconPO.id);
                const hasFinalClaimForPo = claimsForPo.some(c => c.isFinal || c.claimNo?.toLowerCase().includes('retention'));

                let subconProgress = subconPoValue > 0 ? (subconWorkDone / subconPoValue) * 100 : 0;
                if (hasFinalClaimForPo) {
                    subconProgress = 100;
                }
                
                const subconInvoiced = claimsForPo.reduce((sum, c) => sum + (c.amount - (c.retentionAmount || 0)), 0);
                const subconPaid = claimsForPo.filter(c => c.status === 'Paid').reduce((sum, c) => sum + (c.amount - (c.retentionAmount || 0)), 0);
                const subconPendingPaid = subconInvoiced - subconPaid;

                 flattenedData.push({
                    projectId: project.id,
                    projectName: project.name,
                    client: project.client,
                    subconPo: subconPO,
                    subconName: subconPO.issuer,
                    subconPoNo: subconPO.poNo,
                    subconPoValue,
                    subconWorkDone,
                    subconProgress,
                    subconClaimable: subconWorkDone,
                    subconInvoiced,
                    subconPaid,
                    subconPendingPaid,
                    claims: claimsForPo,
                 });
            });
        });
        
        return flattenedData;

    }, [projects, clientFilter]);
    
    const processedAndSortedData = useMemo(() => {
        const projectsMap = new Map<string, Omit<DetailedSubconData, 'isFirstRow' | 'rowSpan'>[]>();
        detailedSubconData.forEach(item => {
            if (!projectsMap.has(item.projectId)) {
                projectsMap.set(item.projectId, []);
            }
            projectsMap.get(item.projectId)!.push(item);
        });

        const projectGroups = Array.from(projectsMap.values());

        if (sortConfig) {
            projectGroups.forEach(group => {
                group.sort((a, b) => {
                    const aValue = a[sortConfig.key];
                    const bValue = b[sortConfig.key];
                    if (aValue === null || aValue === undefined) return 1;
                    if (bValue === null || bValue === undefined) return -1;
                    let comparison = 0;
                    if (typeof aValue === 'number' && typeof bValue === 'number') {
                        comparison = (aValue as number) - (bValue as number);
                    } else {
                        comparison = String(aValue).localeCompare(String(bValue));
                    }
                    return sortConfig.direction === 'asc' ? comparison : -comparison;
                });
            });

            projectGroups.sort((groupA, groupB) => {
                const findRepresentativeValue = (group: Omit<DetailedSubconData, 'isFirstRow' | 'rowSpan'>[]) => {
                    if (group.length === 0) return null;
                    return group[0][sortConfig.key];
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
        }
        
        const flattenedSortedData = projectGroups.flat();

        const finalData: DetailedSubconData[] = [];
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
    }, [detailedSubconData, sortConfig]);

    const totalPages = Math.ceil(processedAndSortedData.length / rowsPerPage);
    const paginatedData = processedAndSortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    
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

        const header_main = ['Client', 'Subcon Name', 'Subcon PO No', 'Project Name', 'Subcon PO Value', 'Work Done', 'Progress', 'Invoiced', null, null, null, null, 'Paid', null, 'Pending Paid'];
        const header_sub = [null, null, null, null, null, null, null, 'Date', 'Claim Type', 'Invoice No.', 'Amount', 'Retention', 'Date', 'Amount', null];
        
        let data: (string | number | null)[][] = [];

        processedAndSortedData.forEach(p => {
            if (p.claims.length === 0) {
                data.push([
                    p.client, p.subconName, p.subconPoNo, p.projectName, p.subconPoValue, p.subconWorkDone, `${p.subconProgress.toFixed(0)}%`,
                    null, null, null, null, null, null, null, p.subconPendingPaid
                ]);
            } else {
                p.claims.forEach((claim, index) => {
                    const row = [];
                    if (index === 0) {
                        row.push(p.client, p.subconName, p.subconPoNo, p.projectName, p.subconPoValue, p.subconWorkDone, `${p.subconProgress.toFixed(0)}%`);
                    } else {
                        row.push(null, null, null, null, null, null, null);
                    }
                    row.push(
                        claim ? format(parseISO(claim.date), 'yyyy-MM-dd') : null,
                        claim ? claim.claimNo : null,
                        claim ? claim.invoiceNo : null,
                        claim ? claim.amount : null,
                        claim ? claim.retentionAmount || 0 : null,
                        claim && claim.status === 'Paid' && claim.statusDates?.Paid ? format(parseISO(claim.statusDates.Paid), 'yyyy-MM-dd') : null,
                        claim && claim.status === 'Paid' ? claim.amount - (claim.retentionAmount || 0) : null
                    );
                    if (index === 0) {
                         row.push(p.subconPendingPaid);
                    } else {
                        row.push(null);
                    }
                    data.push(row);
                });
            }
        });

        const ws_data = [header_main, header_sub, ...data];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        
        const merges = [
            { s: { r: 0, c: 7 }, e: { r: 0, c: 11 } }, // Invoiced
            { s: { r: 0, c: 12 }, e: { r: 0, c: 13 } }, // Paid
        ];
        
        let currentRow = 2; // Start after headers
        processedAndSortedData.forEach(p => {
            const rowSpan = Math.max(1, p.claims.length);
            if (rowSpan > 1) {
                for (let i = 0; i < 7; i++) {
                    merges.push({ s: { r: currentRow, c: i }, e: { r: currentRow + rowSpan - 1, c: i } });
                }
                 merges.push({ s: { r: currentRow, c: 14 }, e: { r: currentRow + rowSpan - 1, c: 14 } });
            }
            currentRow += rowSpan;
        });
        
        ws['!merges'] = merges;
        
        XLSX.utils.book_append_sheet(wb, ws, "Subcon PO Details");
        XLSX.writeFile(wb, "Detailed_Subcon_PO_List.xlsx");
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Detailed Subcon PO List</CardTitle>
                        <CardDescription>A comprehensive list of all subcontractor POs with detailed financial data.</CardDescription>
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
                    <Table className="min-w-[1600px]">
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Client', 'client', 'w-[150px]')}
                                {renderHeader('Subcon Name', 'subconName')}
                                {renderHeader('Subcon PO No', 'subconPoNo')}
                                {renderHeader('Project Name', 'projectName', 'w-[250px]')}
                                {renderNumericHeader('Subcon PO Value', 'subconPoValue')}
                                {renderNumericHeader('Work Done', 'subconWorkDone')}
                                {renderNumericHeader('Progress', 'subconProgress')}
                                <TableHead colSpan={5} className="text-center border-l">Invoiced</TableHead>
                                <TableHead colSpan={2} className="text-center border-l">Paid</TableHead>
                                {renderNumericHeader('Pending Paid', 'subconPendingPaid')}
                            </TableRow>
                            <TableRow>
                                <TableHead className="text-right border-l w-[120px]">Date</TableHead>
                                <TableHead className="w-[150px]">Claim Type</TableHead>
                                <TableHead className='w-[150px]'>Invoice No.</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Retention</TableHead>
                                <TableHead className="text-right border-l w-[120px]">Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.length === 0 ? (
                                <TableRow>
                                     <TableCell colSpan={16} className="h-24 text-center text-muted-foreground">No data available.</TableCell>
                                </TableRow>
                            ): (
                                paginatedData.map((p, index) => {
                                    // Identify if this is the first project occurrence on THIS PAGE
                                    const isFirstProjectOccurrenceOnPage = index === 0 || paginatedData[index - 1].projectId !== p.projectId;
                                    const maxRows = Math.max(1, p.claims.length);
                                    
                                    // Calculate rowSpan for project-level info restricted to THIS PAGE
                                    let projectRowSpanOnPage = 0;
                                    if (isFirstProjectOccurrenceOnPage) {
                                        for (let i = index; i < paginatedData.length; i++) {
                                            if (paginatedData[i].projectId === p.projectId) {
                                                projectRowSpanOnPage += Math.max(1, paginatedData[i].claims.length);
                                            } else {
                                                break;
                                            }
                                        }
                                    }

                                    return (
                                    <Fragment key={`${p.projectId}-${p.subconPo?.id || index}`}>
                                        {Array.from({ length: maxRows }).map((_, claimIndex) => {
                                            const claim = p.claims[claimIndex];
                                            const isFirstClaimRowOfPo = claimIndex === 0;
                                            const showProjectInfo = isFirstClaimRowOfPo && isFirstProjectOccurrenceOnPage;
                                            
                                            return (
                                                <TableRow key={claim ? claim.id : `empty-${index}-${claimIndex}`}>
                                                    {showProjectInfo && <TableCell rowSpan={projectRowSpanOnPage} className="align-top py-2 border-b">{p.client}</TableCell>}
                                                    {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="align-top py-2">{p.subconName}</TableCell>}
                                                    {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="align-top py-2">{p.subconPoNo}</TableCell>}
                                                    {showProjectInfo && <TableCell rowSpan={projectRowSpanOnPage} className="font-medium align-top py-2 border-b">{p.projectName}</TableCell>}
                                                    {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="text-right align-top py-2">{formatCurrency(p.subconPoValue)}</TableCell>}
                                                    {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="text-right align-top py-2">{formatCurrency(p.subconWorkDone)}</TableCell>}
                                                    {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="align-top py-2">
                                                        {p.subconPoValue > 0 && <div className="flex items-center gap-2 justify-end"><Progress value={p.subconProgress} className="w-16" /><span>{p.subconProgress.toFixed(0)}%</span></div>}
                                                    </TableCell>}
                                                    
                                                    <TableCell className="text-right py-1 px-4 text-xs align-middle border-l">{claim ? format(parseISO(claim.date), 'dd-MM-yy') : ''}</TableCell>
                                                    <TableCell className="py-1 px-4 text-xs align-middle">{claim ? claim.claimNo : ''}</TableCell>
                                                    <TableCell className="py-1 px-4 text-xs align-middle">{claim ? claim.invoiceNo : ''}</TableCell>
                                                    <TableCell className="text-right py-1 px-4 text-xs align-middle">{claim ? formatCurrency(claim.amount) : ''}</TableCell>
                                                    <TableCell className="text-right py-1 px-4 text-xs align-middle">{claim ? formatCurrency(claim.retentionAmount || 0) : ''}</TableCell>

                                                    <TableCell className="text-right py-1 px-4 text-xs align-middle border-l">{claim && claim.status === 'Paid' && claim.statusDates?.Paid ? format(parseISO(claim.statusDates.Paid), 'dd-MM-yy') : ''}</TableCell>
                                                    <TableCell className="text-right py-1 px-4 text-xs align-middle text-green-600">{claim && claim.status === 'Paid' ? formatCurrency(claim.amount - (claim.retentionAmount || 0)) : ''}</TableCell>
                                                    
                                                    {isFirstClaimRowOfPo && <TableCell rowSpan={maxRows} className="text-right align-top py-2 text-orange-600">{formatCurrency(p.subconPendingPaid)}</TableCell>}
                                                </TableRow>
                                            )
                                        })}
                                    </Fragment>
                                )})
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
                        <Button variant="outline" size="sm" onClick={() => goToPage(1)} disabled={currentPage === 1}>First</Button>
                        <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage+1)} disabled={currentPage >= totalPages}>Next</Button>
                        <Button variant="outline" size="sm" onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages}>Last</Button>
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}
