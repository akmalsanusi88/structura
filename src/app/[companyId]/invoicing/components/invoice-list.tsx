
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { Project, Claim, ClaimStatus, SupplierInvoice, SupplierInvoiceStatus, Company } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Search, FileText, Send, CircleDollarSign, XCircle, CalendarIcon, CalendarDays, FileUp, FileDown, Pencil, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { useRouter, useParams } from 'next/navigation';
import { addOrUpdateClaim, addOrUpdateSupplierInvoice } from '@/app/login/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';


type AggregatedClaim = Claim & {
    projectId: string;
    projectName: string;
    clientName: string; // Project's client
    subconName?: string; // Subcontractor for the claim
    netAmount?: number;
    purchaseOrderNo: string;
};

type MaterialInvoice = SupplierInvoice & { poNo: string };

type ClientSortKey = keyof AggregatedClaim;
type SubconSortKey = keyof AggregatedClaim;
type MaterialSortKey = keyof MaterialInvoice;

interface PdfExportOptions {
    includeClient: boolean;
    includeSubcon: boolean;
    includeMaterial: boolean;
    orientation: 'portrait' | 'landscape';
}

interface InvoiceListProps {
    allProjects: Project[];
    supplierInvoices: MaterialInvoice[];
}

const getStatusBadgeVariant = (status: ClaimStatus | SupplierInvoiceStatus) => {
    switch (status) {
        case 'Paid': return 'bg-green-100 text-green-800 hover:bg-green-100';
        case 'Submitted':
        case 'Received':
             return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
        case 'Disputed': return 'bg-red-100 text-red-800 hover:bg-red-100';
        case 'Draft':
        default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
};

const getStatusIcon = (status: ClaimStatus | SupplierInvoiceStatus) => {
    switch (status) {
        case 'Paid': return <CircleDollarSign className="h-4 w-4 text-white" />;
        case 'Submitted': 
        case 'Received':
            return <Send className="h-4 w-4 text-white" />;
        case 'Disputed': return <XCircle className="h-4 w-4 text-white" />;
        case 'Draft':
        default: return <FileText className="h-4 w-4 text-white" />;
    }
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

export default function InvoiceList({ allProjects, supplierInvoices }: InvoiceListProps) {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState<'all' | ClaimStatus | SupplierInvoiceStatus>('all');
    const [selectedYear, setSelectedYear] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState('all');

    
    // State for Client/Subcon invoices
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailedInvoice, setDetailedInvoice] = useState<AggregatedClaim | null>(null);
    const [newStatus, setNewStatus] = useState<ClaimStatus | null>(null);
    const [newStatusDate, setNewStatusDate] = useState<Date | undefined>(new Date());
    const [editingTimelineStatus, setEditingTimelineStatus] = useState<ClaimStatus | null>(null);
    const [timelineEditDate, setTimelineEditDate] = useState<Date | undefined>(new Date());

    // Sorting states
    const [clientSortConfig, setClientSortConfig] = useState<{ key: ClientSortKey, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [subconSortConfig, setSubconSortConfig] = useState<{ key: SubconSortKey, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [materialSortConfig, setMaterialSortConfig] = useState<{ key: MaterialSortKey, direction: 'asc' | 'desc' }>({ key: 'invoiceDate', direction: 'desc' });

    // State for Material invoices
    const [isMaterialDetailOpen, setIsMaterialDetailOpen] = useState(false);
    const [detailedMaterialInvoice, setDetailedMaterialInvoice] = useState<SupplierInvoice | null>(null);
    const [newMaterialStatus, setNewMaterialStatus] = useState<SupplierInvoiceStatus | null>(null);
    const [newMaterialStatusDate, setNewMaterialStatusDate] = useState<Date | undefined>(new Date());

    const [clientPage, setClientPage] = useState(1);
    const [subconPage, setSubconPage] = useState(1);
    const [materialPage, setMaterialPage] = useState(1);
    const rowsPerPage = 25;

    // State for PDF export options
    const [isPdfExportDialogOpen, setIsPdfExportDialogOpen] = useState(false);
    const [pdfExportOptions, setPdfExportOptions] = useState<PdfExportOptions>({
        includeClient: true,
        includeSubcon: true,
        includeMaterial: true,
        orientation: 'landscape'
    });


    const uniqueClients = useMemo(() => {
        return ['all', ...Array.from(new Set(allProjects.map(p => p.client)))];
    }, [allProjects]);
    
    const uniqueStatuses = useMemo(() => {
        const statuses = new Set<ClaimStatus | SupplierInvoiceStatus>();
        allProjects.forEach(p => {
            (p.clientClaims || []).forEach(c => statuses.add(c.status));
            (p.subconClaims || []).forEach(c => statuses.add(c.status));
        });
        supplierInvoices.forEach(i => statuses.add(i.status));
        return ['all', ...Array.from(statuses)];
    }, [allProjects, supplierInvoices]);

    const { availableYears, availableMonths } = useMemo(() => {
        const years = new Set<string>();
        const months = new Set<string>();
        const allDates = [...allProjects.flatMap(p => [...(p.clientClaims || []), ...(p.subconClaims || [])]).map(c => c.date), ...supplierInvoices.map(i => i.invoiceDate)];
        
        allDates.forEach(dateStr => {
            if (dateStr) {
                years.add(dateStr.substring(0, 4));
            }
        });
        
        const sortedYears = ['all', ...Array.from(years).sort((a,b) => Number(b) - Number(a))];
        
        if (selectedYear !== 'all') {
             allDates.forEach(dateStr => {
                if (dateStr && dateStr.startsWith(selectedYear)) {
                    months.add(dateStr.substring(0, 7)); // YYYY-MM
                }
            });
        }
        
        const sortedMonths = ['all', ...Array.from(months).sort().reverse()];

        return { availableYears: sortedYears, availableMonths: sortedMonths };
    }, [allProjects, supplierInvoices, selectedYear]);

    useEffect(() => {
        if (selectedYear === 'all') {
            setSelectedMonth('all');
        }
    }, [selectedYear]);

    const aggregatedInvoices = useMemo(() => {
        let clientInvoices: AggregatedClaim[] = [];
        let subconInvoices: AggregatedClaim[] = [];

        allProjects.forEach(project => {
            const poMap = new Map(project.purchaseOrders.map(p => [p.id, p]));
            (project.clientClaims || []).forEach(claim => {
                 const po = poMap.get(claim.purchaseOrderId);
                clientInvoices.push({ 
                    ...claim, 
                    projectId: project.id, 
                    projectName: project.name, 
                    clientName: project.client,
                    purchaseOrderNo: po?.poNo || 'N/A',
                    netAmount: claim.amount - (claim.retentionAmount || 0),
                });
            });
            (project.subconClaims || []).forEach(claim => {
                const po = poMap.get(claim.purchaseOrderId);
                subconInvoices.push({ 
                    ...claim, 
                    projectId: project.id, 
                    projectName: project.name, 
                    clientName: project.client,
                    subconName: po?.issuer || 'Unknown Subcon',
                    purchaseOrderNo: po?.poNo || 'N/A',
                    netAmount: claim.amount - (claim.retentionAmount || 0),
                });
            });
        });

        const filterInvoices = (invoices: AggregatedClaim[]) => {
            return invoices.filter(invoice => {
                const clientFilter = selectedClient === 'all' || invoice.clientName === selectedClient;
                const statusFilter = selectedStatus === 'all' || invoice.status === selectedStatus;
                
                const date = parseISO(invoice.date);
                const yearMatch = selectedYear === 'all' || date.getFullYear().toString() === selectedYear;
                const monthMatch = selectedMonth === 'all' || format(date, 'yyyy-MM') === selectedMonth;

                const searchTermLower = searchTerm.toLowerCase();
                const searchFilter = searchTerm === '' ||
                    invoice.clientName.toLowerCase().includes(searchTermLower) ||
                    invoice.projectName.toLowerCase().includes(searchTermLower) ||
                    (invoice.claimNo && invoice.claimNo.toLowerCase().includes(searchTermLower)) ||
                    (invoice.invoiceNo && invoice.invoiceNo.toLowerCase().includes(searchTermLower)) ||
                    (invoice.purchaseOrderNo && invoice.purchaseOrderNo.toLowerCase().includes(searchTermLower)) ||
                    (invoice.subconName && invoice.subconName.toLowerCase().includes(searchTermLower));
                return clientFilter && searchFilter && statusFilter && yearMatch && monthMatch;
            });
        };
        
        return {
            client: filterInvoices(clientInvoices),
            subcon: filterInvoices(subconInvoices),
        };
    }, [allProjects, searchTerm, selectedClient, selectedStatus, selectedYear, selectedMonth]);
    
     const filteredMaterialInvoices = useMemo(() => {
        return supplierInvoices.filter(inv => {
            const statusFilter = selectedStatus === 'all' || inv.status === selectedStatus;
            
            const date = parseISO(inv.invoiceDate);
            const yearMatch = selectedYear === 'all' || date.getFullYear().toString() === selectedYear;
            const monthMatch = selectedMonth === 'all' || format(date, 'yyyy-MM') === selectedMonth;
            
            const lowercasedFilter = searchTerm.toLowerCase();
            const searchFilter = searchTerm === '' ||
                inv.invoiceNo.toLowerCase().includes(lowercasedFilter) ||
                inv.poNo.toLowerCase().includes(lowercasedFilter) ||
                inv.supplier.toLowerCase().includes(lowercasedFilter);
                
            return searchFilter && statusFilter && yearMatch && monthMatch;
        });
    }, [supplierInvoices, searchTerm, selectedStatus, selectedYear, selectedMonth]);
    
    const sortedClientInvoices = useMemo(() => {
        let sortableItems = [...aggregatedInvoices.client];
        if (clientSortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[clientSortConfig.key];
                const bValue = b[clientSortConfig.key];
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return clientSortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }
                const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
                return clientSortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [aggregatedInvoices.client, clientSortConfig]);

    const sortedSubconInvoices = useMemo(() => {
        let sortableItems = [...aggregatedInvoices.subcon];
        if (subconSortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[subconSortConfig.key];
                const bValue = b[subconSortConfig.key];
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return subconSortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }
                const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
                return subconSortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [aggregatedInvoices.subcon, subconSortConfig]);

    const sortedMaterialInvoices = useMemo(() => {
        let sortableItems = [...filteredMaterialInvoices];
        if (materialSortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[materialSortConfig.key];
                const bValue = b[materialSortConfig.key];
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return materialSortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }
                const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
                return materialSortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [filteredMaterialInvoices, materialSortConfig]);


    // This effect will re-sync the detailedInvoice state when the main project data changes
    useEffect(() => {
        if (detailedInvoice) {
            const freshInvoice = aggregatedInvoices.client.find(c => c.id === detailedInvoice.id) || 
                                 aggregatedInvoices.subcon.find(s => s.id === detailedInvoice.id);
            if (freshInvoice) {
                setDetailedInvoice(freshInvoice);
            }
        }
    }, [aggregatedInvoices, detailedInvoice]);


    const handleSaveStatusUpdate = async () => {
        if (!detailedInvoice || !newStatus || !newStatusDate) return;
    
        const projectToUpdate = allProjects.find(p => p.id === detailedInvoice.projectId);
        if (!projectToUpdate) {
            toast({ title: "Error", description: "Project not found.", variant: 'destructive' });
            return;
        }

        const isClientClaim = detailedInvoice.type === 'Client';
        const claimsList = isClientClaim ? projectToUpdate.clientClaims : projectToUpdate.subconClaims;
        const claimToUpdate = (claimsList || []).find(c => c.id === detailedInvoice.id);

        if (!claimToUpdate) {
            toast({ title: "Error", description: "Claim not found within the project.", variant: 'destructive' });
            return;
        }

        const updatedClaim = {
            ...claimToUpdate,
            status: newStatus,
            statusDates: {
                ...(claimToUpdate.statusDates || {}),
                [newStatus]: format(newStatusDate, 'yyyy-MM-dd'),
            },
        };

        try {
            await addOrUpdateClaim(updatedClaim, projectToUpdate.id, companyId);
            toast({
                title: "Status Updated",
                description: `Invoice ${updatedClaim.invoiceNo} status set to ${newStatus}.`,
            });
            setIsDetailOpen(false);
            router.refresh(); // Refresh the page to get the latest data
        } catch (error) {
            toast({ title: "Error", description: `Failed to update claim status. ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
        }
    };
    
    const handleSaveTimelineDate = async (statusToUpdate: ClaimStatus) => {
        if (!detailedInvoice || !timelineEditDate) return;

        const projectToUpdate = allProjects.find(p => p.id === detailedInvoice.projectId);
        if (!projectToUpdate) {
            toast({ title: "Error", description: "Project not found.", variant: 'destructive' });
            return;
        }
        
        const isClientClaim = detailedInvoice.type === 'Client';
        const claimsList = isClientClaim ? projectToUpdate.clientClaims : projectToUpdate.subconClaims;
        const claimToUpdate = (claimsList || []).find(c => c.id === detailedInvoice.id);

        if (!claimToUpdate) {
            toast({ title: "Error", description: "Claim not found within the project.", variant: 'destructive' });
            return;
        }

        const updatedClaim = {
            ...claimToUpdate,
            statusDates: {
                ...(claimToUpdate.statusDates || {}),
                [statusToUpdate]: format(timelineEditDate, 'yyyy-MM-dd'),
            },
        };

        try {
            await addOrUpdateClaim(updatedClaim, projectToUpdate.id, companyId);
            toast({
                title: "Date Updated",
                description: `Date for status "${statusToUpdate}" has been changed.`,
            });
            setEditingTimelineStatus(null);
            router.refresh();
        } catch (error) {
            toast({ title: "Error", description: `Failed to update timeline date. ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
        }
    };
    
    const handleSaveMaterialStatusUpdate = async () => {
        if (!detailedMaterialInvoice || !newMaterialStatus) return;

        const updatedInvoice: SupplierInvoice = { 
            ...detailedMaterialInvoice, 
            status: newMaterialStatus,
        };
        
        try {
            await addOrUpdateSupplierInvoice(updatedInvoice, companyId);
             toast({
                title: "Status Updated",
                description: `Invoice ${updatedInvoice.invoiceNo} status set to ${newMaterialStatus}.`,
            });
            setIsMaterialDetailOpen(false);
            router.refresh();
        } catch (error) {
            toast({ title: "Error", description: `Failed to update invoice status. ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
        }
    };

    const handleViewDetails = (invoice: AggregatedClaim) => {
        setDetailedInvoice(invoice);
        setNewStatus(null);
        setNewStatusDate(new Date());
        setEditingTimelineStatus(null);
        setIsDetailOpen(true);
    }
    
    const handleViewMaterialDetails = (invoice: SupplierInvoice) => {
        setDetailedMaterialInvoice(invoice);
        setNewMaterialStatus(null);
        setNewMaterialStatusDate(new Date());
        setIsMaterialDetailOpen(true);
    };

    const clientTimelineOrder: ClaimStatus[] = ['Draft', 'Submitted', 'Paid', 'Disputed'];
    const subconTimelineOrder: ClaimStatus[] = ['Draft', 'Submitted', 'Paid', 'Disputed'];
    const materialTimelineOrder: SupplierInvoiceStatus[] = ['Draft', 'Received', 'Paid', 'Disputed'];

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const addSheet = (sheetName: string, data: any[], headers: string[]) => {
            const ws = XLSX.utils.json_to_sheet(data, { header: headers });
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        };
        
        if (sortedClientInvoices.length > 0) {
            addSheet("Client Invoices", sortedClientInvoices.map(invoice => ({
                'Project': invoice.projectName,
                'Invoice #': invoice.invoiceNo,
                'Claim #': invoice.claimNo,
                'PO #': invoice.purchaseOrderNo,
                'Date': format(parseISO(invoice.date), 'yyyy-MM-dd'),
                'Amount': invoice.amount - (invoice.retentionAmount || 0),
                'Status': invoice.status,
                'Status Date': invoice.statusDates?.[invoice.status] ? format(parseISO(invoice.statusDates[invoice.status]!), 'yyyy-MM-dd') : 'N/A',
            })), ['Project', 'Invoice #', 'Claim #', 'PO #', 'Date', 'Amount', 'Status', 'Status Date']);
        }

        if (sortedSubconInvoices.length > 0) {
            addSheet("Subcon Invoices", sortedSubconInvoices.map(invoice => ({
                'Project': invoice.projectName,
                'Subcontractor': invoice.subconName,
                'Invoice #': invoice.invoiceNo,
                'Claim #': invoice.claimNo,
                'PO #': invoice.purchaseOrderNo,
                'Date': format(parseISO(invoice.date), 'yyyy-MM-dd'),
                'Amount': invoice.amount - (invoice.retentionAmount || 0),
                'Status': invoice.status,
                'Status Date': invoice.statusDates?.[invoice.status] ? format(parseISO(invoice.statusDates[invoice.status]!), 'yyyy-MM-dd') : 'N/A',
            })), ['Project', 'Subcontractor', 'Invoice #', 'Claim #', 'PO #', 'Date', 'Amount', 'Status', 'Status Date']);
        }
        
        if (sortedMaterialInvoices.length > 0) {
            addSheet("Material Invoices", sortedMaterialInvoices.map(invoice => ({
                'Invoice #': invoice.invoiceNo,
                'PO #': invoice.poNo,
                'Supplier': invoice.supplier,
                'Invoice Date': invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'yyyy-MM-dd') : 'N/A',
                'Due Date': invoice.dueDate ? format(parseISO(invoice.dueDate), 'yyyy-MM-dd') : 'N/A',
                'Amount': invoice.amount,
                'Status': invoice.status,
            })), ['Invoice #', 'PO #', 'Supplier', 'Invoice Date', 'Due Date', 'Amount', 'Status']);
        }

        XLSX.writeFile(wb, "Invoice_Management_Report.xlsx");
    };

    const handleConfirmPdfExport = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        const doc = new jsPDF({ orientation: pdfExportOptions.orientation });

        doc.setFontSize(18);
        doc.text("Invoice Management Report", 14, 22);

        let lastTableY = 25;
        
        const addSheetToPdf = (title: string, data: any[], headers: {header: string, dataKey: string}[], bodyMapper: (item: any) => string[], columnStyles?: any) => {
             if (data.length === 0) return;
             if (lastTableY > doc.internal.pageSize.getHeight() - 60) {
                doc.addPage();
                lastTableY = 20;
            }
            doc.setFontSize(14);
            doc.text(title, 14, lastTableY + 10);
            autoTable(doc, {
                head: [headers.map(h => h.header)],
                body: data.map(bodyMapper),
                startY: lastTableY + 14,
                headStyles: { fillColor: [41, 128, 185], fontSize: 7, cellPadding: 1.5 },
                bodyStyles: { fontSize: 7, cellPadding: 1 },
                footStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0, fontSize: 7, cellPadding: 1.5 },
                theme: 'striped',
                foot: [[{ content: 'Total', colSpan: headers.length - 1, styles: { halign: 'right' } }, { content: formatCurrency(data.reduce((sum, item) => sum + (item.netAmount || item.amount), 0)), styles: { halign: 'right' } }]],
                columnStyles: columnStyles,
            });
            lastTableY = (doc as any).lastAutoTable.finalY || lastTableY + 20;
        }

        if (pdfExportOptions.includeClient) {
            const clientInvoicesByClient = sortedClientInvoices.reduce((acc, inv) => {
                (acc[inv.clientName] = acc[inv.clientName] || []).push(inv);
                return acc;
            }, {} as Record<string, AggregatedClaim[]>);

            Object.entries(clientInvoicesByClient).forEach(([clientName, invoices]) => {
                const headers = [
                    { header: 'Project', dataKey: 'projectName' },
                    { header: 'Invoice #', dataKey: 'invoiceNo' },
                    { header: 'Claim #', dataKey: 'claimNo' },
                    { header: 'PO #', dataKey: 'purchaseOrderNo' },
                    { header: 'Date', dataKey: 'date' },
                    { header: 'Status', dataKey: 'status' },
                    { header: 'Amount', dataKey: 'netAmount' },
                ];
                addSheetToPdf(`Client Invoices: ${clientName}`, invoices, headers, (inv: AggregatedClaim) => [
                    inv.projectName,
                    inv.invoiceNo,
                    inv.claimNo,
                    inv.purchaseOrderNo,
                    format(parseISO(inv.date), 'dd/MM/yy'),
                    `${inv.status}${inv.statusDates?.[inv.status] ? `\n on ${format(parseISO(inv.statusDates[inv.status]!), 'dd/MM/yy')}` : ''}`,
                    formatCurrency(inv.netAmount || 0),
                ], {
                  0: { cellWidth: 50 }, // Project
                  4: { cellWidth: 20 }, // Date
                  5: { cellWidth: 25 }, // Status
                  6: { cellWidth: 25 }, // Amount
                });
            });
        }
        
        if (pdfExportOptions.includeSubcon) {
            const headers = [
                { header: 'Project', dataKey: 'projectName' },
                { header: 'Subcon', dataKey: 'subconName' },
                { header: 'Invoice #', dataKey: 'invoiceNo' },
                { header: 'Claim #', dataKey: 'claimNo' },
                { header: 'PO #', dataKey: 'purchaseOrderNo' },
                { header: 'Date', dataKey: 'date' },
                { header: 'Status', dataKey: 'status' },
                { header: 'Amount', dataKey: 'netAmount' },
            ];
            addSheetToPdf("Subcontractor Invoices", sortedSubconInvoices, headers, (inv: AggregatedClaim) => [
                inv.projectName,
                inv.subconName || '',
                inv.invoiceNo,
                inv.claimNo,
                inv.purchaseOrderNo,
                format(parseISO(inv.date), 'dd/MM/yy'),
                `${inv.status}${inv.statusDates?.[inv.status] ? `\n on ${format(parseISO(inv.statusDates[inv.status]!), 'dd/MM/yy')}` : ''}`,
                formatCurrency(inv.netAmount || 0),
            ], {
                 0: { cellWidth: 40 }, // Project
                 1: { cellWidth: 30 }, // Subcon
                 5: { cellWidth: 20 }, // Date
                 6: { cellWidth: 25 }, // Status
                 7: { cellWidth: 25 }, // Amount
            });
        }
        
        if (pdfExportOptions.includeMaterial) {
            const headers = [
                { header: 'Invoice #', dataKey: 'invoiceNo' },
                { header: 'PO #', dataKey: 'poNo' },
                { header: 'Supplier', dataKey: 'supplier' },
                { header: 'Inv. Date', dataKey: 'invoiceDate' },
                { header: 'Due Date', dataKey: 'dueDate' },
                { header: 'Status', dataKey: 'status' },
                { header: 'Amount', dataKey: 'amount' },
            ];
            addSheetToPdf("Material Invoices", sortedMaterialInvoices, headers, (inv: MaterialInvoice) => [
                inv.invoiceNo,
                inv.poNo,
                inv.supplier,
                inv.invoiceDate ? format(parseISO(inv.invoiceDate), 'dd/MM/yy') : 'N/A',
                inv.dueDate ? format(parseISO(inv.dueDate), 'dd/MM/yy') : 'N/A',
                inv.status,
                formatCurrency(inv.amount),
            ], {
                2: { cellWidth: 50 }, // Supplier
                3: { cellWidth: 20 }, // Inv. Date
                4: { cellWidth: 20 }, // Due Date
                6: { cellWidth: 25 }, // Amount
            });
        }

        doc.save("Invoice_Management_Report.pdf");
        setIsPdfExportDialogOpen(false);
    };
    
    const requestSort = (setter: React.Dispatch<any>, currentConfig: any) => (key: any) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (currentConfig && currentConfig.key === key && currentConfig.direction === 'asc') {
            direction = 'desc';
        }
        setter({ key, direction });
    };

    const getSortIcon = (currentConfig: any, key: any) => {
        if (!currentConfig || currentConfig.key !== key) return null;
        return currentConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const renderInvoiceTable = (invoices: AggregatedClaim[], type: 'client' | 'subcon') => {
        const [currentPage, setCurrentPage] = type === 'client'
            ? [clientPage, setClientPage]
            : [subconPage, setSubconPage];
        
        const [sortConfig, setSortConfig] = type === 'client'
            ? [clientSortConfig, setClientSortConfig]
            : [subconSortConfig, setSubconSortConfig];

        const totalPages = Math.ceil(invoices.length / rowsPerPage);
        const paginatedInvoices = invoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

        const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
        const handleNextPage = () => goToPage(currentPage + 1);
        const handlePrevPage = () => goToPage(currentPage - 1);
        const goToFirstPage = () => setCurrentPage(1);
        const goToLastPage = () => goToPage(totalPages);
        
        const totalAmount = invoices.reduce((sum, inv) => sum + (inv.netAmount || 0), 0);

        const renderHeader = (label: string, sortKey: ClientSortKey | SubconSortKey) => (
            <TableHead>
                <Button variant="ghost" className="w-full justify-start p-0" onClick={() => requestSort(setSortConfig, sortConfig)(sortKey)}>
                    {label} {getSortIcon(sortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        const renderNumericHeader = (label: string, sortKey: ClientSortKey | SubconSortKey) => (
            <TableHead className="text-right">
                <Button variant="ghost" className="w-full justify-end p-0" onClick={() => requestSort(setSortConfig, sortConfig)(sortKey)}>
                    {label} {getSortIcon(sortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        return (
            <div>
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {renderHeader(type === 'client' ? 'Project / Client' : 'Project / Subcontractor', 'projectName')}
                                {renderHeader('Invoice #', 'invoiceNo')}
                                {renderHeader('Claim #', 'claimNo')}
                                {renderHeader('PO #', 'purchaseOrderNo')}
                                {renderHeader('Date', 'date')}
                                {renderNumericHeader('Amount', 'netAmount')}
                                {renderHeader('Status', 'status')}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedInvoices.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No invoices found for the current filters.</TableCell></TableRow>
                            ) : (
                                paginatedInvoices.map(invoice => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className='py-2 px-4'>
                                            <div className='font-medium'>{invoice.projectName}</div>
                                            <div className='text-sm text-muted-foreground'>
                                                {type === 'client' ? invoice.clientName : invoice.subconName}
                                            </div>
                                        </TableCell>
                                        <TableCell className='py-2 px-4'>
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleViewDetails(invoice)}>
                                                {invoice.invoiceNo}
                                            </Button>
                                        </TableCell>
                                        <TableCell className='py-2 px-4'>{invoice.claimNo}</TableCell>
                                        <TableCell className='py-2 px-4'>{invoice.purchaseOrderNo}</TableCell>
                                        <TableCell className='py-2 px-4'>{format(parseISO(invoice.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className='py-2 px-4 text-right'>{formatCurrency(invoice.netAmount || 0)}</TableCell>
                                        <TableCell className='py-2 px-4'>
                                            <Badge className={getStatusBadgeVariant(invoice.status)} variant="outline">
                                                {invoice.status}
                                            </Badge>
                                            {invoice.statusDates?.[invoice.status] && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    on {format(parseISO(invoice.statusDates[invoice.status]!), 'dd MMM yyyy')}
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                         {invoices.length > 0 && (
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={5} className="text-right font-bold">Total</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(totalAmount)}</TableCell>
                                    <TableCell/>
                                </TableRow>
                            </TableFooter>
                        )}
                    </Table>
                </div>
                 <div className="flex items-center justify-end w-full space-x-4 pt-4">
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
            </div>
        );
    }
    
    const renderMaterialInvoiceTable = () => {
        const totalPages = Math.ceil(sortedMaterialInvoices.length / rowsPerPage);
        const paginatedInvoices = sortedMaterialInvoices.slice((materialPage - 1) * rowsPerPage, materialPage * rowsPerPage);

        const goToPage = (page: number) => setMaterialPage(Math.max(1, Math.min(totalPages, page)));
        const handleNextPage = () => goToPage(materialPage + 1);
        const handlePrevPage = () => goToPage(materialPage - 1);
        const goToFirstPage = () => setMaterialPage(1);
        const goToLastPage = () => goToPage(totalPages);

        const totalAmount = sortedMaterialInvoices.reduce((sum, inv) => sum + inv.amount, 0);

        const renderHeader = (label: string, sortKey: MaterialSortKey) => (
            <TableHead>
                <Button variant="ghost" className="w-full justify-start p-0" onClick={() => requestSort(setMaterialSortConfig, materialSortConfig)(sortKey)}>
                    {label} {getSortIcon(materialSortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        const renderNumericHeader = (label: string, sortKey: MaterialSortKey) => (
            <TableHead className="text-right">
                <Button variant="ghost" className="w-full justify-end p-0" onClick={() => requestSort(setMaterialSortConfig, materialSortConfig)(sortKey)}>
                    {label} {getSortIcon(materialSortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        return (
            <div>
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Invoice #', 'invoiceNo')}
                                {renderHeader('PO #', 'poNo')}
                                {renderHeader('Supplier', 'supplier')}
                                {renderHeader('Invoice Date', 'invoiceDate')}
                                {renderHeader('Due Date', 'dueDate')}
                                {renderNumericHeader('Amount', 'amount')}
                                {renderHeader('Status', 'status')}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedInvoices.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No material invoices found.</TableCell></TableRow>
                            ) : (
                                paginatedInvoices.map(invoice => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className='py-2 px-4'>
                                             <Button variant="link" className="p-0 h-auto" onClick={() => handleViewMaterialDetails(invoice)}>
                                                {invoice.invoiceNo}
                                            </Button>
                                        </TableCell>
                                        <TableCell className='py-2 px-4'>{invoice.poNo}</TableCell>
                                        <TableCell className='py-2 px-4'>{invoice.supplier}</TableCell>
                                        <TableCell className='py-2 px-4'>{invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'dd MMM yyyy') : 'N/A'}</TableCell>
                                        <TableCell className='py-2 px-4'>{invoice.dueDate ? format(parseISO(invoice.dueDate), 'dd MMM yyyy') : 'N/A'}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(invoice.amount)}</TableCell>
                                        <TableCell className='py-2 px-4'>
                                            <Badge className={getStatusBadgeVariant(invoice.status)} variant="outline">{invoice.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {sortedMaterialInvoices.length > 0 && (
                             <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={6} className="text-right font-bold">Total</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(totalAmount)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        )}
                    </Table>
                </div>
                <div className="flex items-center justify-end w-full space-x-4 pt-4">
                    <span className="text-sm text-muted-foreground">
                        Page {materialPage} of {totalPages > 0 ? totalPages : 1}
                    </span>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={goToFirstPage} disabled={materialPage === 1}>
                            First
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={materialPage === 1}>
                            Previous
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleNextPage} disabled={materialPage >= totalPages}>
                            Next
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToLastPage} disabled={materialPage >= totalPages}>
                            Last
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle>Invoice Management</CardTitle>
                            <CardDescription>Update the status of all client and subcontractor invoices across all projects.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                             <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                             <Button variant="outline" size="sm" onClick={() => setIsPdfExportDialogOpen(true)}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="relative w-full lg:col-span-2">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by client, project, claim, PO..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as any)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by status..." />
                            </SelectTrigger>
                            <SelectContent>
                                {uniqueStatuses.map(status => (
                                    <SelectItem key={status} value={status}>{status === 'all' ? 'All Statuses' : status}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedClient} onValueChange={setSelectedClient}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by client..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Clients</SelectItem>
                                {uniqueClients.filter(c => c !== 'all').map(client => (
                                    <SelectItem key={client} value={client}>{client}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by year..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableYears.map(year => (
                                    <SelectItem key={year} value={year}>{year === 'all' ? 'All Years' : year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={selectedYear === 'all'}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by month..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map(month => (
                                     <SelectItem key={month} value={month}>
                                        {month === 'all' ? 'All Months' : format(parseISO(`${month}-01`), 'MMMM yyyy')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Tabs defaultValue="client">
                        <TabsList>
                            <TabsTrigger value="client">Client Invoices</TabsTrigger>
                            <TabsTrigger value="subcon">Subcontractor Invoices</TabsTrigger>
                            <TabsTrigger value="material">Material Invoices</TabsTrigger>
                        </TabsList>
                        <TabsContent value="client" className="mt-4">
                            {renderInvoiceTable(sortedClientInvoices, 'client')}
                        </TabsContent>
                        <TabsContent value="subcon" className="mt-4">
                            {renderInvoiceTable(sortedSubconInvoices, 'subcon')}
                        </TabsContent>
                         <TabsContent value="material" className="mt-4">
                            {renderMaterialInvoiceTable()}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Invoice Details: {detailedInvoice?.invoiceNo}</DialogTitle>
                        <DialogDescription>
                            Timeline and details for invoice {detailedInvoice?.invoiceNo}.
                        </DialogDescription>
                    </DialogHeader>
                    {detailedInvoice && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                <div>
                                    <h3 className="font-semibold text-lg mb-4">Summary</h3>
                                     <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-start">
                                            <span className="text-muted-foreground mt-1">Project:</span>
                                            <div className="text-right">
                                                <span className="font-medium">{detailedInvoice.projectName}</span>
                                                <Button variant="link" size="sm" className="h-auto p-0 pl-2" asChild>
                                                    <Link href={`/${companyId}/projects/${detailedInvoice.projectId}?tab=project-claims`} target="_blank">
                                                        <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                                {detailedInvoice.type === 'Subcontractor' ? 'Subcontractor:' : 'Client:'}
                                            </span>
                                            <span className="font-medium">{detailedInvoice.subconName || detailedInvoice.clientName}</span>
                                        </div>
                                         <div className="flex justify-between">
                                            <span className="text-muted-foreground">PO No:</span>
                                            <span className="font-medium">{detailedInvoice.purchaseOrderNo}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Invoice Date:</span>
                                            <span className="font-medium">{format(parseISO(detailedInvoice.date), 'dd MMM yyyy')}</span>
                                        </div>
                                     </div>
                                     <Card className="bg-muted/50 mt-4">
                                        <CardContent className="p-4 space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Claim Amount</span>
                                                <span className="font-medium">{formatCurrency(detailedInvoice.amount)}</span>
                                            </div>
                                            {detailedInvoice.hasRetention && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Retention Held ({detailedInvoice.retentionPercentage || 0}%)</span>
                                                    <span className="font-medium text-red-500">- {formatCurrency(detailedInvoice.retentionAmount || 0)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                                                <span>Net Amount Payable</span>
                                                <span>{formatCurrency(detailedInvoice.netAmount || 0)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">Timeline</h3>
                                    <ol className="relative border-l border-gray-200 dark:border-gray-700">
                                        {(detailedInvoice.type === 'Client' ? clientTimelineOrder : subconTimelineOrder).map(status => {
                                            const dateStr = detailedInvoice.statusDates?.[status];
                                            if (!dateStr) return null;
                                            
                                            const isCurrent = detailedInvoice.status === status;
                                            const isEditing = editingTimelineStatus === status;
                                            
                                            let displayStatus = status;
                                            if (detailedInvoice.type === 'Subcontractor' && status === 'Submitted') {
                                                displayStatus = 'Received' as ClaimStatus;
                                            }

                                            return (
                                                <li key={status} className="mb-1 ml-8">
                                                    <span className={`absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-background ${isCurrent ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                                        {getStatusIcon(status)}
                                                    </span>
                                                    <div className="flex flex-col items-start p-2 rounded-lg hover:bg-muted/50">
                                                        <div className="flex items-center justify-between w-full">
                                                            <div>
                                                                <h4 className="font-semibold">{displayStatus}</h4>
                                                                <time className="text-sm font-normal text-muted-foreground">
                                                                    {format(parseISO(dateStr), 'dd MMMM yyyy')}
                                                                </time>
                                                            </div>
                                                            {!isEditing && (
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTimelineStatus(status); setTimelineEditDate(parseISO(dateStr)); }}>
                                                                    <Pencil className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {isEditing && (
                                                            <div className="w-full mt-2 flex items-center gap-2">
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                                            {timelineEditDate ? format(timelineEditDate, "PPP") : <span>Pick a date</span>}
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0">
                                                                        <Calendar mode="single" selected={timelineEditDate} onSelect={setTimelineEditDate} initialFocus />
                                                                    </PopoverContent>
                                                                </Popover>
                                                                <Button size="sm" onClick={() => handleSaveTimelineDate(status)}>Save</Button>
                                                                <Button size="sm" variant="ghost" onClick={() => setEditingTimelineStatus(null)}>Cancel</Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </div>
                            </div>
                             <div className="space-y-4 pt-4 border-t">
                                <h3 className="font-semibold text-lg">Update Status</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="col-span-1">
                                        <Label>New Status</Label>
                                        <Select onValueChange={(s: ClaimStatus) => setNewStatus(s)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(detailedInvoice.type === 'Client' ? clientTimelineOrder : subconTimelineOrder).map(s => {
                                                    let displayStatus = s;
                                                    if (detailedInvoice.type === 'Subcontractor' && s === 'Submitted') {
                                                        displayStatus = 'Received' as ClaimStatus;
                                                    }
                                                    return <SelectItem key={s} value={s}>{displayStatus}</SelectItem>;
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-1">
                                        <Label>Status Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {newStatusDate ? format(newStatusDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={newStatusDate} onSelect={setNewStatusDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="col-span-1">
                                        <Button onClick={handleSaveStatusUpdate} disabled={!newStatus || !newStatusDate} className='w-full'>Save Update</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={isMaterialDetailOpen} onOpenChange={setIsMaterialDetailOpen}>
                 <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Update Material Invoice Status</DialogTitle>
                        <DialogDescription>
                           Invoice: {detailedMaterialInvoice?.invoiceNo} | Supplier: {detailedMaterialInvoice?.supplier}
                        </DialogDescription>
                    </DialogHeader>
                     {detailedMaterialInvoice && (
                        <div className="space-y-6 pt-4">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-semibold text-lg">Summary</h3>
                                    <div className="text-sm space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Amount:</span>
                                            <span className="font-bold text-base">{formatCurrency(detailedMaterialInvoice.amount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Current Status:</span>
                                            <div><Badge className={getStatusBadgeVariant(detailedMaterialInvoice.status)}>{detailedMaterialInvoice.status}</Badge></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg">Status</h3>
                                    <p className="text-sm text-muted-foreground">Set the new status for this invoice.</p>
                                </div>
                            </div>
                            <div className="space-y-4 pt-4 border-t">
                                 <h3 className="font-semibold text-lg">Update Status</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                    <div className='col-span-1'>
                                        <Label>New Status</Label>
                                        <Select onValueChange={(s: SupplierInvoiceStatus) => setNewMaterialStatus(s)}>
                                            <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                                            <SelectContent>
                                                {materialTimelineOrder.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='col-span-1'>
                                         <Button onClick={handleSaveMaterialStatusUpdate} disabled={!newMaterialStatus} className='w-full'>Save Update</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                     )}
                </DialogContent>
            </Dialog>

             <Dialog open={isPdfExportDialogOpen} onOpenChange={setIsPdfExportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>PDF Export Options</DialogTitle>
                        <DialogDescription>Customize your PDF report.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Sections to Include</Label>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="includeClient" checked={pdfExportOptions.includeClient} onCheckedChange={(checked) => setPdfExportOptions(prev => ({...prev, includeClient: !!checked}))} />
                                    <Label htmlFor="includeClient">Client Invoices</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="includeSubcon" checked={pdfExportOptions.includeSubcon} onCheckedChange={(checked) => setPdfExportOptions(prev => ({...prev, includeSubcon: !!checked}))} />
                                    <Label htmlFor="includeSubcon">Subcontractor Invoices</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="includeMaterial" checked={pdfExportOptions.includeMaterial} onCheckedChange={(checked) => setPdfExportOptions(prev => ({...prev, includeMaterial: !!checked}))} />
                                    <Label htmlFor="includeMaterial">Material Invoices</Label>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="orientation">Page Orientation</Label>
                            <Select
                                value={pdfExportOptions.orientation}
                                onValueChange={(value) => setPdfExportOptions(prev => ({...prev, orientation: value as 'portrait' | 'landscape'}))}
                            >
                                <SelectTrigger id="orientation">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="portrait">Portrait</SelectItem>
                                    <SelectItem value="landscape">Landscape</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPdfExportDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmPdfExport}>Export PDF</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
