
'use client';

import { useMemo, useState, useEffect, Fragment } from 'react';
import type { Project, PlantUnit, MaterialRequisition, MaterialIssuance, MaterialReturn, Company, DeliveryOrder, MaterialPurchaseOrder, SerialInfo, StockAdjustment, StockTake, SupplierInvoice, SupplierInvoiceStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, PlusCircle, Check, MoreHorizontal, Pencil, Trash2, FileDown, ArrowUp, ArrowDown, ChevronDown, Save, FileUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import MaterialPurchaseOrderForm from '@/components/forms/material-purchase-order-form';
import DeliveryOrderForm from '@/components/forms/delivery-order-form';
import SupplierInvoiceForm from '@/components/forms/supplier-invoice-form';
import { addOrUpdateMaterialPurchaseOrder, deleteMaterialPurchaseOrder, addOrUpdateDeliveryOrder, deleteDeliveryOrder, addOrUpdateSupplierInvoice, deleteSupplierInvoice, addOrUpdateStockAdjustments } from '@/app/login/actions';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PoPdfForm from '@/components/forms/po-pdf-form';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import StockTakeList from './stock-take-list';


type AggregatedRecord = (MaterialRequisition | MaterialIssuance | MaterialReturn) & {
    projectName: string;
};

export interface StockBalanceItem {
    puId: string;
    description: string;
    unit: string;
    balanceQty: number;
    sourceId: string;
    hasSerialNo?: boolean;
    inventory: { date: Date; qty: number; rate: number; serialNo?: string }[];
}

interface MaterialDashboardProps {
    allProjects: Project[];
    allPlantUnits: PlantUnit[];
    allCompanies: Company[];
    initialDeliveryOrders: DeliveryOrder[];
    initialGeneralPurchaseOrders: MaterialPurchaseOrder[];
    initialSupplierInvoices: SupplierInvoice[];
    initialStockAdjustments: StockAdjustment[];
    initialStockTakes: StockTake[];
    stockBalanceData: StockBalanceItem[];
}

type StockBalanceSortKey = keyof Omit<StockBalanceItem, 'serials' | 'inventory'>;
type PoSortKey = keyof MaterialPurchaseOrder | 'amount';
type DoSortKey = keyof (DeliveryOrder & { poNo: string; amount: number });
type InvoiceSortKey = keyof SupplierInvoice;
type UsageSortKey = keyof AggregatedRecord | 'docNo';

export default function MaterialDashboard({ allProjects, allPlantUnits, allCompanies, initialDeliveryOrders, initialGeneralPurchaseOrders, initialSupplierInvoices, initialStockAdjustments, initialStockTakes, stockBalanceData }: MaterialDashboardProps) {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const companyId = params.companyId as string;
    
    // Search terms
    const [stockSearchTerm, setStockSearchTerm] = useState('');
    const [poSearchTerm, setPoSearchTerm] = useState('');
    const [doSearchTerm, setDoSearchTerm] = useState('');
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
    const [usageSearchTerm, setUsageSearchTerm] = useState('');

    // Sorting configs
    const [stockSortConfig, setStockSortConfig] = useState<{ key: StockBalanceSortKey; direction: 'asc' | 'desc' } | null>({ key: 'puId', direction: 'asc' });
    const [poSortConfig, setPoSortConfig] = useState<{ key: PoSortKey; direction: 'asc' | 'desc' } | null>({ key: 'poDate', direction: 'desc' });
    const [doSortConfig, setDoSortConfig] = useState<{ key: DoSortKey; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
    const [invoiceSortConfig, setInvoiceSortConfig] = useState<{ key: InvoiceSortKey; direction: 'asc' | 'desc' } | null>({ key: 'invoiceDate', direction: 'desc' });
    const [usageSortConfig, setUsageSortConfig] = useState<{ key: UsageSortKey; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
    
    // Pagination
    const [poPage, setPoPage] = useState(1);
    const [reqPage, setReqPage] = useState(1);
    const [issPage, setIssPage] = useState(1);
    const [retPage, setRetPage] = useState(1);
    const [doPage, setDoPage] = useState(1);
    const [invoicePage, setInvoicePage] = useState(1);
    const [stockBalancePage, setStockBalancePage] = useState(1);
    const rowsPerPage = 15;

    // Adjustment state
    const [adjustmentQuantities, setAdjustmentQuantities] = useState<Record<string, number | undefined>>({});
    
    // Form states
    const [isPoFormOpen, setIsPoFormOpen] = useState(false);
    const [editingPo, setEditingPo] = useState<MaterialPurchaseOrder | undefined>(undefined);
    
    const [isDoFormOpen, setIsDoFormOpen] = useState(false);
    const [editingDo, setEditingDo] = useState<DeliveryOrder | undefined>(undefined);

    const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<SupplierInvoice | undefined>(undefined);

    // Detail view states
    const [isUsageDetailOpen, setIsUsageDetailOpen] = useState(false);
    const [detailedUsageRecord, setDetailedUsageRecord] = useState<AggregatedRecord | null>(null);
    const [usageDetailType, setUsageDetailType] = useState<'Requisition' | 'Issuance' | 'Return' | null>(null);
    
    const [detailedStockItem, setDetailedStockItem] = useState<StockBalanceItem | null>(null);
    const [serialAdjustments, setSerialAdjustments] = useState<Record<string, number>>({});
    const plantUnitMap = useMemo(() => new Map(allPlantUnits.map(pu => [pu.id, pu])), [allPlantUnits]);

    const [isPoPdfFormOpen, setIsPoPdfFormOpen] = useState(false);
    const [poForPdf, setPoForPdf] = useState<MaterialPurchaseOrder | undefined>(undefined);

    const [expandedPoIds, setExpandedPoIds] = useState<Set<string>>(new Set());
    const [expandedDoIds, setExpandedDoIds] = useState<Set<string>>(new Set());
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

    const currentCompany = useMemo(() => {
        return allCompanies.find(c => c.id === companyId);
    }, [allCompanies, companyId]);

    const togglePoRow = (poId: string) => {
        setExpandedPoIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(poId)) {
                newSet.delete(poId);
            } else {
                newSet.add(poId);
            }
            return newSet;
        });
    };

    const toggleDoRow = (doId: string) => {
        setExpandedDoIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(doId)) {
                newSet.delete(doId);
            } else {
                newSet.add(doId);
            }
            return newSet;
        });
    };


    const requestSort = (setter: React.Dispatch<any>, currentConfig: any) => (key: any) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (currentConfig && currentConfig.key === key && currentConfig.direction === 'asc') {
            direction = 'desc';
        }
        setter({ key, direction });
    };

    const getSortIcon = (currentConfig: any, key: any) => {
        if (!currentConfig || currentConfig.key !== key) {
            return null;
        }
        return currentConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const handleOpenPoPdfForm = (po: MaterialPurchaseOrder) => {
        setPoForPdf(po);
        setIsPoPdfFormOpen(true);
    };

    const handleViewUsageDetails = (record: AggregatedRecord, type: 'Requisition' | 'Issuance' | 'Return') => {
        setDetailedUsageRecord(record);
        setUsageDetailType(type);
        setIsUsageDetailOpen(true);
    };

    const handleViewStockDetails = (item: StockBalanceItem) => {
        if (item.hasSerialNo) {
            setDetailedStockItem(item);
            const initialAdjustments: Record<string, number> = {};
            item.inventory.forEach(inv => {
                const serialNo = inv.serialNo || 'N/A';
                initialAdjustments[serialNo] = (initialAdjustments[serialNo] || 0) + inv.qty;
            })
            setSerialAdjustments(initialAdjustments);
        }
    };
    

    const filteredStockBalance = useMemo(() => {
        let items = [...stockBalanceData];

        if (stockSortConfig !== null) {
            items.sort((a, b) => {
                const aValue = a[stockSortConfig.key as StockBalanceSortKey];
                const bValue = b[stockSortConfig.key as StockBalanceSortKey];
                
                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
                }

                return stockSortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        
        if (!stockSearchTerm) return items;
        const lowercasedFilter = stockSearchTerm.toLowerCase();
        return items.filter(item => 
            item.description.toLowerCase().includes(lowercasedFilter) ||
            item.puId.toLowerCase().includes(lowercasedFilter)
        );
    }, [stockBalanceData, stockSearchTerm, stockSortConfig]);

    const sortedMaterialPurchaseOrders = useMemo(() => {
        let sortableItems = [...initialGeneralPurchaseOrders];
        if (poSortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[poSortConfig.key as keyof MaterialPurchaseOrder];
                let bValue = b[poSortConfig.key as keyof MaterialPurchaseOrder];
                 if (poSortConfig.key === 'amount') {
                    const itemsTotalA = a.items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
                    const baseTotalA = itemsTotalA + (a.deliveryCost || 0);
                    const sstBaseA = a.includeDeliveryInSst ? baseTotalA : itemsTotalA;
                    aValue = baseTotalA + (sstBaseA * ((a.sstPercentage || 0) / 100));

                    const itemsTotalB = b.items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
                    const baseTotalB = itemsTotalB + (b.deliveryCost || 0);
                    const sstBaseB = b.includeDeliveryInSst ? baseTotalB : itemsTotalB;
                    bValue = baseTotalB + (sstBaseB * ((b.sstPercentage || 0) / 100));
                }
                
                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
                }
                return poSortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [initialGeneralPurchaseOrders, poSortConfig]);

    const filteredMaterialPurchaseOrders = useMemo(() => {
        if (!poSearchTerm) return sortedMaterialPurchaseOrders;
        const lowercasedFilter = poSearchTerm.toLowerCase();
        return sortedMaterialPurchaseOrders.filter(po =>
            po.poNo.toLowerCase().includes(lowercasedFilter) ||
            po.supplier.toLowerCase().includes(lowercasedFilter)
        );
    }, [sortedMaterialPurchaseOrders, poSearchTerm]);
    
    const deliveryOrdersWithDetails = useMemo(() => {
        return initialDeliveryOrders.map(d => {
            const po = initialGeneralPurchaseOrders.find(po => po.id === d.materialPurchaseOrderId);
            const amount = d.items.reduce((sum, item) => {
                const poItem = po?.items.find(pi => pi.id === item.poItemId);
                return sum + (item.receivedQuantity * (poItem?.rate || 0));
            }, 0);
            return {
                ...d,
                poNo: po ? po.poNo : 'N/A',
                amount
            }
        });
    }, [initialDeliveryOrders, initialGeneralPurchaseOrders]);

    const sortedDeliveryOrders = useMemo(() => {
        let sortableItems = [...deliveryOrdersWithDetails];
        if (doSortConfig !== null) {
            sortableItems.sort((a,b) => {
                const aValue = a[doSortConfig.key as keyof typeof a];
                const bValue = b[doSortConfig.key as keyof typeof b];
                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
                }
                return doSortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [deliveryOrdersWithDetails, doSortConfig]);

    const filteredDeliveryOrders = useMemo(() => {
        if (!doSearchTerm) return sortedDeliveryOrders;
        const lowercasedFilter = doSearchTerm.toLowerCase();
        return sortedDeliveryOrders.filter(d =>
            d.doNo.toLowerCase().includes(lowercasedFilter) ||
            d.poNo.toLowerCase().includes(lowercasedFilter) ||
            d.supplier.toLowerCase().includes(lowercasedFilter)
        );
    }, [sortedDeliveryOrders, doSearchTerm]);
    
    const sortedInvoices = useMemo(() => {
        let sortableItems = [...initialSupplierInvoices];
        if (invoiceSortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[invoiceSortConfig.key];
                const bValue = b[invoiceSortConfig.key];
                let comparison = 0;
                 if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
                }
                return invoiceSortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [initialSupplierInvoices, invoiceSortConfig]);

    const filteredInvoices = useMemo(() => {
        if (!invoiceSearchTerm) return sortedInvoices;
        const lowercasedFilter = invoiceSearchTerm.toLowerCase();
        return sortedInvoices.filter(inv =>
            inv.invoiceNo.toLowerCase().includes(lowercasedFilter) ||
            inv.poNo.toLowerCase().includes(lowercasedFilter) ||
            inv.supplier.toLowerCase().includes(lowercasedFilter)
        );
    }, [sortedInvoices, invoiceSearchTerm]);

    const aggregatedUsageRecords = useMemo(() => {
        const requisitions: AggregatedRecord[] = [];
        const issuances: AggregatedRecord[] = [];
        const returns: AggregatedRecord[] = [];

        allProjects.forEach(p => {
            (p.materialRequisitions || []).forEach(req => requisitions.push({ ...req, projectName: p.name }));
            (p.materialIssuances || []).forEach(iss => issuances.push({ ...iss, projectName: p.name }));
            (p.materialReturns || []).forEach(ret => returns.push({ ...ret, projectName: p.name }));
        });
        
        const filterRecords = (records: AggregatedRecord[]) => {
            if (!usageSearchTerm) return records;
            const lowercasedFilter = usageSearchTerm.toLowerCase();
            return records.filter(rec => 
                rec.projectName.toLowerCase().includes(lowercasedFilter) ||
                (rec.items || []).some(item => 
                    item.description.toLowerCase().includes(lowercasedFilter) ||
                    (plantUnitMap.get(item.sourceId)?.puId || '').toLowerCase().includes(lowercasedFilter) ||
                    (item.serials || []).some(s => s.serialNo?.toLowerCase().includes(lowercasedFilter))
                )
            );
        };
        
        const sortRecords = (records: AggregatedRecord[]) => {
            if (!usageSortConfig) return records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            return records.sort((a, b) => {
                let aValue, bValue;
                if (usageSortConfig.key === 'docNo') {
                    aValue = (a as MaterialRequisition).requisitionNo || (a as MaterialIssuance).goodsIssueNo || (a as MaterialReturn).goodsReturnNo;
                    bValue = (b as MaterialRequisition).requisitionNo || (b as MaterialIssuance).goodsIssueNo || (b as MaterialReturn).goodsReturnNo;
                } else {
                    aValue = a[usageSortConfig.key as keyof AggregatedRecord];
                    bValue = b[usageSortConfig.key as keyof AggregatedRecord];
                }

                let comparison = 0;
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
                }
                return usageSortConfig.direction === 'asc' ? comparison : -comparison;
            });
        };

        return { 
            requisitions: sortRecords(filterRecords(requisitions)), 
            issuances: sortRecords(filterRecords(issuances)), 
            returns: sortRecords(filterRecords(returns)) 
        };
    }, [allProjects, usageSearchTerm, usageSortConfig, plantUnitMap]);

    const handleOpenPoForm = (po?: MaterialPurchaseOrder) => {
        if (po) {
            setEditingPo(po);
        } else {
            const currentYear = new Date().getFullYear().toString().slice(-2);
            const prefix = `KA-POM${currentYear}-`;
    
            const poNumbersForYear = initialGeneralPurchaseOrders
                .map(p => p.poNo)
                .filter((no): no is string => no !== null && no !== undefined && no.startsWith(prefix));
    
            let maxSerial = 0;
            if (poNumbersForYear.length > 0) {
                const serials = poNumbersForYear.map(no => parseInt(no.substring(prefix.length), 10));
                const validSerials = serials.filter(n => !isNaN(n));
                if (validSerials.length > 0) {
                     maxSerial = Math.max(...validSerials);
                }
            }
            
            const nextSerial = maxSerial + 1;
            const newPoNo = `${prefix}${nextSerial.toString().padStart(4, '0')}`;
    
            setEditingPo({
                id: `mpo-${Date.now()}`,
                poNo: newPoNo,
                poDate: new Date().toISOString(),
                supplier: '',
                items: [],
                companyId: companyId
            });
        }
        setIsPoFormOpen(true);
    };
    
    const handleClosePoForm = () => {
        setIsPoFormOpen(false);
        setEditingPo(undefined);
    };
    
    const handleSavePo = async (poData: MaterialPurchaseOrder) => {
        handleClosePoForm();
        try {
            await addOrUpdateMaterialPurchaseOrder(poData, companyId);
            toast({ title: 'Success', description: `Material Purchase Order ${editingPo ? 'updated' : 'saved'} successfully.` });
            router.refresh();
        } catch (error) {
            console.error("Failed to save PO:", error);
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not save purchase order.', variant: 'destructive' });
        }
    };
    
    const handleDeletePo = async (poId: string) => {
        try {
            await deleteMaterialPurchaseOrder(poId, companyId);
            toast({ title: 'Success', description: 'Purchase Order deleted successfully.' });
            router.refresh();
        } catch (error) {
            console.error("Failed to delete PO:", error);
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not delete Purchase Order.', variant: 'destructive' });
        }
    };

    const handleOpenDoForm = (deliveryOrder?: DeliveryOrder) => {
        setEditingDo(deliveryOrder);
        setIsDoFormOpen(true);
    };

    const handleSaveDo = async (doData: DeliveryOrder) => {
        setIsDoFormOpen(false);
        try {
            await addOrUpdateDeliveryOrder(doData, companyId);
            toast({ title: 'Success', description: 'Delivery Order saved successfully.' });
            router.refresh();
        } catch (error) {
            console.error("Failed to save DO:", error);
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not save Delivery Order.', variant: 'destructive' });
        }
    };
    
     const handleDeleteDo = async (doId: string) => {
        try {
            await deleteDeliveryOrder(doId, companyId);
            toast({ title: 'Success', description: 'Delivery Order deleted successfully.' });
            router.refresh();
        } catch (error) {
            console.error("Failed to delete DO:", error);
            toast({ title: 'Error', description: 'Could not delete Delivery Order.', variant: 'destructive' });
        }
    };
    
     const handleOpenInvoiceForm = (invoice?: SupplierInvoice) => {
        setEditingInvoice(invoice);
        setIsInvoiceFormOpen(true);
    };
    
    const handleSaveInvoice = async (invoiceData: SupplierInvoice) => {
        setIsInvoiceFormOpen(false);
        try {
            await addOrUpdateSupplierInvoice(invoiceData, companyId);
            toast({ title: 'Success', description: 'Supplier Invoice saved successfully.' });
            router.refresh();
        } catch (error) {
            console.error("Failed to save Invoice:", error);
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'Could not save Supplier Invoice.', variant: 'destructive' });
        }
    };
    
    const handleDeleteInvoice = async (invoiceId: string) => {
        try {
            await deleteSupplierInvoice(invoiceId, companyId);
            toast({ title: 'Success', description: 'Supplier Invoice deleted successfully.' });
            router.refresh();
        } catch (error) {
            console.error("Failed to delete Invoice:", error);
            toast({ title: 'Error', description: 'Could not delete Supplier Invoice.', variant: 'destructive' });
        }
    };

    const handleAdjustmentChange = (sourceId: string, value: string) => {
        const numericValue = value === '' ? undefined : parseFloat(value);
        setAdjustmentQuantities(prev => ({
            ...prev,
            [sourceId]: numericValue,
        }));
    };

    const handleSerialAdjustmentChange = (serialNo: string, value: string) => {
        setSerialAdjustments(prev => ({
            ...prev,
            [serialNo]: parseFloat(value) || 0
        }));
    };
    
    const handleSaveAdjustments = async () => {
        const nonSerialAdjustments = Object.entries(adjustmentQuantities)
            .filter(([_, value]) => value !== undefined && !isNaN(value as any))
            .map(([sourceId, quantity]) => ({
                sourceId,
                quantity: quantity!,
                companyId,
            }));
        
        if (nonSerialAdjustments.length > 0) {
            try {
                await addOrUpdateStockAdjustments(nonSerialAdjustments);
                toast({ title: "Success", description: "Stock adjustments have been saved." });
                router.refresh();
            } catch (error) {
                console.error("Failed to save non-serial adjustments:", error);
                toast({ title: "Error", description: error instanceof Error ? error.message : "Could not save non-serial stock adjustments.", variant: "destructive" });
            }
        } else {
             toast({ title: "No Changes", description: "No new adjustment values were entered for non-serialized items." });
        }
    };
    
    const handleSaveSerialAdjustments = async () => {
        if (!detailedStockItem) return;

        const serials: SerialInfo[] = Object.entries(serialAdjustments).map(([serialNo, quantity]) => ({
            serialNo, quantity
        }));

        const totalQuantity = serials.reduce((sum, s) => sum + s.quantity, 0);

        const adjustment: Omit<StockAdjustment, 'id' | 'created_at'> = {
            sourceId: detailedStockItem.sourceId,
            quantity: totalQuantity,
            companyId,
            serials
        };
        
        try {
            await addOrUpdateStockAdjustments([adjustment]);
            toast({ title: "Success", description: "Serial number adjustments saved." });
            setDetailedStockItem(null);
            router.refresh();
        } catch (error) {
            toast({ title: "Error", description: `Failed to save serial adjustments: ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
        }
    }
    
    const renderPagination = (currentPage: number, totalPages: number, setPage: (page: number) => void) => {
        const goToPage = (page: number) => setPage(Math.max(1, Math.min(totalPages, page)));
        const handleNextPage = () => goToPage(currentPage + 1);
        const handlePrevPage = () => goToPage(currentPage - 1);
        const goToFirstPage = () => setPage(1);
        const goToLastPage = () => setPage(totalPages);

        return (
            <div className="flex items-center justify-end w-full space-x-4 pt-4">
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages > 0 ? totalPages : 1}
                </span>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1}>First</Button>
                    <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages}>Next</Button>
                    <Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage >= totalPages}>Last</Button>
                </div>
            </div>
        );
    }
    
    const renderUsageTable = (records: AggregatedRecord[], type: 'Requisition' | 'Issuance' | 'Return', page: number, setPage: (page: number) => void) => {
        const totalPages = Math.ceil(records.length / rowsPerPage);
        const paginatedRecords = records.slice((page - 1) * rowsPerPage, page * rowsPerPage);

        const renderHeader = (label: string, sortKey: UsageSortKey) => (
             <TableHead className='p-0'>
                <Button variant="ghost" className="w-full justify-start px-4" onClick={() => requestSort(setUsageSortConfig, usageSortConfig)(sortKey)}>
                    {label} {getSortIcon(usageSortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        return (
            <div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Project', 'projectName')}
                                {renderHeader('Doc No.', 'docNo')}
                                {renderHeader('Date', 'date')}
                                <TableHead className="text-right"># of Items</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedRecords.length > 0 ? paginatedRecords.map(rec => (
                                <TableRow key={rec.id} onClick={() => handleViewUsageDetails(rec, type)} className="cursor-pointer">
                                    <TableCell className='py-2 px-4'>{rec.projectName}</TableCell>
                                    <TableCell className="font-mono py-2 px-4">
                                        {(rec as MaterialRequisition).requisitionNo || (rec as MaterialIssuance).goodsIssueNo || (rec as MaterialReturn).goodsReturnNo}
                                    </TableCell>
                                    <TableCell className='py-2 px-4'>{format(parseISO(rec.date), 'dd MMM yyyy')}</TableCell>
                                    <TableCell className="text-right py-2 px-4">{rec.items.length}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center">No records found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {totalPages > 1 && renderPagination(page, totalPages, setPage)}
            </div>
        );
    }
    
    const formatCurrencyPO = (amount: number, fractionDigits = 2) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(amount);
    
    const handlePoExportExcel = async () => {
        const XLSX = await import('xlsx');
        const data = filteredMaterialPurchaseOrders.map(po => {
            const itemsTotal = po.items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
            const baseTotal = itemsTotal + (po.deliveryCost || 0);
            const sstBase = po.includeDeliveryInSst ? baseTotal : itemsTotal;
            const totalAmount = baseTotal + (sstBase * ((po.sstPercentage || 0) / 100));
            return {
                'PO No.': po.poNo,
                'Supplier': po.supplier,
                'Date': format(parseISO(po.poDate), 'yyyy-MM-dd'),
                'Amount (RM)': totalAmount,
                'Project Name': po.projectName,
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(data, {
            header: ['PO No.', 'Supplier', 'Date', 'Amount (RM)', 'Project Name']
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Material POs`);
        XLSX.writeFile(wb, `Material_Purchase_Orders.xlsx`);
    };

    const handlePoExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(18);
        doc.text("Material Purchase Orders", 14, 22);

        autoTable(doc, {
            head: [['PO No.', 'Supplier', 'Date', 'Amount', 'Project Name']],
            body: filteredMaterialPurchaseOrders.map(po => {
                 const itemsTotal = po.items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
                 const baseTotal = itemsTotal + (po.deliveryCost || 0);
                 const sstBase = po.includeDeliveryInSst ? baseTotal : itemsTotal;
                 const totalAmount = baseTotal + (sstBase * ((po.sstPercentage || 0) / 100));
                return [
                    po.poNo,
                    po.supplier,
                    format(parseISO(po.poDate), 'dd MMM yyyy'),
                    formatCurrencyPO(totalAmount),
                    po.projectName || 'N/A'
                ];
            }),
            startY: 30,
            headStyles: { fillColor: [41, 128, 185] },
            theme: 'striped',
        });
        
        doc.save(`Material_Purchase_Orders.pdf`);
    };
    
     const handleDoExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const data = filteredDeliveryOrders.map(d => ({
            'DO No.': d.doNo,
            'PO No.': d.poNo,
            'Supplier': d.supplier,
            'Date': format(parseISO(d.date), 'yyyy-MM-dd'),
            'Amount (RM)': d.amount,
            'Items': d.items.length
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, `Delivery Orders`);
        XLSX.writeFile(wb, `Delivery_Orders.xlsx`);
    };

    const handleDoExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();
        doc.text("Material Delivery Orders", 14, 15);
        autoTable(doc, {
            head: [['DO No.', 'PO No.', 'Supplier', 'Date', 'Amount', '# of Items']],
            body: filteredDeliveryOrders.map(d => [d.doNo, d.poNo, d.supplier, format(parseISO(d.date), 'dd MMM yyyy'), formatCurrencyPO(d.amount), d.items.length]),
            startY: 20
        });
        doc.save('Delivery_Orders.pdf');
    };
    
    const handleInvoiceExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const data = filteredInvoices.map(inv => ({
            'Invoice No.': inv.invoiceNo,
            'PO No.': inv.poNo,
            'Supplier': inv.supplier,
            'Date': format(parseISO(inv.invoiceDate), 'yyyy-MM-dd'),
            'Amount (RM)': inv.amount,
            'Status': inv.status,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, `Supplier Invoices`);
        XLSX.writeFile(wb, `Supplier_Invoices.xlsx`);
    };

    const handleInvoiceExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF();
        doc.text("Supplier Invoices", 14, 15);
        autoTable(doc, {
            head: [['Invoice No.', 'PO No.', 'Supplier', 'Date', 'Amount', 'Status']],
            body: filteredInvoices.map(inv => [inv.invoiceNo, inv.poNo, inv.supplier, format(parseISO(inv.invoiceDate), 'dd MMM yyyy'), formatCurrencyPO(inv.amount, 2), inv.status]),
            startY: 20
        });
        doc.save('Supplier_Invoices.pdf');
    };

    const handleStockBalanceExportExcel = async () => {
        const XLSX = await import('xlsx');
        const data = filteredStockBalance.flatMap(item => {
            const mainRow = {
                'PU ID': item.puId,
                'Material Name': item.description,
                'Unit': item.unit,
                'Balance Qty': item.balanceQty,
            };

            const groupedInventory = item.inventory.reduce((acc, inv) => {
                const key = item.hasSerialNo ? inv.serialNo || 'N/A' : `rate-${inv.rate}`;
                if (!acc[key]) {
                    acc[key] = {
                        label: item.hasSerialNo ? `  S/N: ${inv.serialNo || 'N/A'}` : `  from ${format(inv.date, 'dd-MM-yyyy')} @ ${formatCurrencyPO(inv.rate)}`,
                        qty: 0,
                    };
                }
                acc[key].qty += inv.qty;
                return acc;
            }, {} as Record<string, { label: string; qty: number; }>);
            
            const detailRows = Object.values(groupedInventory).map(inv => ({
                'Material Name': inv.label,
                'Balance Qty': inv.qty,
            }));
            
            return [mainRow, ...detailRows];
        });
        
        const worksheet = XLSX.utils.json_to_sheet(data, {
            header: ['PU ID', 'Material Name', 'Unit', 'Balance Qty']
        });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Stock Balance`);
        XLSX.writeFile(workbook, `Stock_Balance.xlsx`);
    };

    const renderPoTable = () => {
        const totalPages = Math.ceil(filteredMaterialPurchaseOrders.length / rowsPerPage);
        const paginatedPOs = filteredMaterialPurchaseOrders.slice((poPage - 1) * rowsPerPage, poPage * rowsPerPage);

        const renderHeader = (label: string, sortKey: PoSortKey) => (
             <TableHead className='p-0'>
                <Button variant="ghost" className="w-full justify-start px-4" onClick={() => requestSort(setPoSortConfig, poSortConfig)(sortKey)}>
                    {label} {getSortIcon(poSortConfig, sortKey)}
                </Button>
            </TableHead>
        );
         const renderNumericHeader = (label: string, sortKey: PoSortKey) => (
             <TableHead className='p-0 text-right'>
                <Button variant="ghost" className="w-full justify-end px-4" onClick={() => requestSort(setPoSortConfig, poSortConfig)(sortKey)}>
                    {label} {getSortIcon(sortKey as any)}
                </Button>
            </TableHead>
        );

        return (
            <div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead>
                                {renderHeader('PO No.', 'poNo')}
                                {renderHeader('Supplier', 'supplier')}
                                {renderHeader('Date', 'poDate')}
                                {renderNumericHeader('Amount', 'amount')}
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedPOs.length > 0 ? paginatedPOs.map(po => {
                                const itemsSubtotal = po.items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
                                const baseTotal = itemsSubtotal + (po.deliveryCost || 0);
                                const sstBase = po.includeDeliveryInSst ? baseTotal : itemsSubtotal;
                                const sstAmount = sstBase * ((po.sstPercentage || 0) / 100);
                                const totalAmount = baseTotal + sstAmount;
                                
                                const isExpanded = expandedPoIds.has(po.id);
                                
                                return (
                                <Fragment key={po.id}>
                                    <TableRow onClick={() => togglePoRow(po.id)} className='cursor-pointer'>
                                        <TableCell className="py-1 px-4">
                                            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                        </TableCell>
                                        <TableCell className="font-mono py-1 px-4">{po.poNo}</TableCell>
                                        <TableCell className='py-1 px-4'>{po.supplier}</TableCell>
                                        <TableCell className='py-1 px-4'>{format(parseISO(po.poDate), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="text-right py-1 px-4">{formatCurrencyPO(totalAmount, 2)}</TableCell>
                                        <TableCell className="text-right py-1 px-4">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenPoForm(po); }}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenPoPdfForm(po); }}>
                                                        <FileDown className="mr-2 h-4 w-4" /> Export PDF
                                                    </DropdownMenuItem>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This will permanently delete this Purchase Order.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeletePo(po.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableCell colSpan={6} className='p-0'>
                                                <div className="p-4">
                                                    <h4 className="font-semibold mb-2">PO Items</h4>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {po.items.map((item, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell className="py-1">{item.description}</TableCell>
                                                                    <TableCell className="text-right py-1">{item.quantity.toFixed(2)} {item.unit}</TableCell>
                                                                    <TableCell className="text-right py-1">{formatCurrencyPO(item.rate)}</TableCell>
                                                                    <TableCell className="text-right py-1">{formatCurrencyPO(item.rate * item.quantity)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                        <TableFooter>
                                                            <TableRow>
                                                                <TableCell colSpan={3} className="text-right font-semibold py-1">Items Subtotal</TableCell>
                                                                <TableCell className="text-right font-semibold py-1">{formatCurrencyPO(itemsSubtotal)}</TableCell>
                                                            </TableRow>
                                                            {po.deliveryCost && po.deliveryCost > 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={3} className="text-right font-semibold py-1">Delivery Cost</TableCell>
                                                                    <TableCell className="text-right font-semibold py-1">{formatCurrencyPO(po.deliveryCost)}</TableCell>
                                                                </TableRow>
                                                            ) : null}
                                                            {po.sstPercentage && po.sstPercentage > 0 ? (
                                                                <TableRow>
                                                                    <TableCell colSpan={3} className="text-right font-semibold py-1">
                                                                        SST ({po.sstPercentage}%) 
                                                                        {!po.includeDeliveryInSst && <span className="text-[10px] text-muted-foreground block">(excl. delivery)</span>}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-semibold py-1">{formatCurrencyPO(sstAmount)}</TableCell>
                                                                </TableRow>
                                                            ) : null}
                                                            <TableRow>
                                                                <TableCell colSpan={3} className="text-right font-bold py-1">Total</TableCell>
                                                                <TableCell className="text-right font-bold py-1">{formatCurrencyPO(totalAmount)}</TableCell>
                                                            </TableRow>
                                                        </TableFooter>
                                                    </Table>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                                )}
                            ) : (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center">No material purchase orders found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                 {totalPages > 1 && renderPagination(poPage, totalPages, setPoPage)}
            </div>
        )
    };
    
    const renderDoTable = () => {
        const totalPages = Math.ceil(filteredDeliveryOrders.length / rowsPerPage);
        const paginatedDOs = filteredDeliveryOrders.slice((doPage - 1) * rowsPerPage, doPage * rowsPerPage);

        const renderHeader = (label: string, sortKey: DoSortKey) => (
             <TableHead className='p-0'>
                <Button variant="ghost" className="w-full justify-start px-4" onClick={() => requestSort(setDoSortConfig, doSortConfig)(sortKey)}>
                    {label} {getSortIcon(doSortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        return (
            <div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead>
                                {renderHeader('DO No.', 'doNo')}
                                {renderHeader('PO No.', 'poNo')}
                                {renderHeader('Supplier', 'supplier')}
                                {renderHeader('Date', 'date')}
                                {renderHeader('Amount', 'amount')}
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedDOs.length > 0 ? paginatedDOs.map(d => {
                                const isExpanded = expandedDoIds.has(d.id);
                                return(
                                <Fragment key={d.id}>
                                    <TableRow onClick={() => toggleDoRow(d.id)} className='cursor-pointer'>
                                        <TableCell className="py-1 px-4">
                                            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                        </TableCell>
                                        <TableCell className="font-mono py-1 px-4">{d.doNo}</TableCell>
                                        <TableCell className="font-mono py-1 px-4">{d.poNo}</TableCell>
                                        <TableCell className='py-1 px-4'>{d.supplier}</TableCell>
                                        <TableCell className='py-1 px-4'>{format(parseISO(d.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="text-right py-1 px-4">{formatCurrencyPO(d.amount)}</TableCell>
                                        <TableCell className="text-right py-1 px-4">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); handleOpenDoForm(d);}}>
                                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                                    </DropdownMenuItem>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This will permanently delete this Delivery Order.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteDo(d.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                         <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableCell colSpan={7} className='p-0'>
                                                <div className="p-4">
                                                    <h4 className="font-semibold mb-2">Received Items</h4>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Description</TableHead>
                                                                <TableHead className="text-right">Received Qty</TableHead>
                                                                <TableHead className="text-right">Rate</TableHead>
                                                                <TableHead className="text-right">Amount</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {d.items.map((item, idx) => {
                                                                const po = initialGeneralPurchaseOrders.find(p => p.id === d.materialPurchaseOrderId);
                                                                const poItem = po?.items.find(pi => pi.id === item.poItemId);
                                                                const rate = poItem?.rate || 0;
                                                                return (
                                                                    <TableRow key={idx}>
                                                                        <TableCell className="py-1">{item.description}</TableCell>
                                                                        <TableCell className="text-right py-1">{item.receivedQuantity.toFixed(2)} {item.unit}</TableCell>
                                                                        <TableCell className="text-right py-1">{formatCurrencyPO(rate)}</TableCell>
                                                                        <TableCell className="text-right py-1">{formatCurrencyPO(rate * item.receivedQuantity)}</TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                        <TableFooter>
                                                            <TableRow>
                                                                <TableCell colSpan={3} className="text-right font-bold py-1">Items Subtotal</TableCell>
                                                                <TableCell className="text-right font-bold py-1">{formatCurrencyPO(d.amount)}</TableCell>
                                                            </TableRow>
                                                        </TableFooter>
                                                    </Table>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            )}) : (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center">No delivery orders found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {totalPages > 1 && renderPagination(doPage, totalPages, setDoPage)}
            </div>
        );
    }
    
     const renderInvoiceTable = () => {
        const totalPages = Math.ceil(filteredInvoices.length / rowsPerPage);
        const paginatedInvoices = filteredInvoices.slice((invoicePage - 1) * rowsPerPage, invoicePage * rowsPerPage);

        const renderHeader = (label: string, sortKey: InvoiceSortKey) => (
             <TableHead className='p-0'>
                <Button variant="ghost" className="w-full justify-start px-4" onClick={() => requestSort(setInvoiceSortConfig, invoiceSortConfig)(sortKey)}>
                    {label} {getSortIcon(invoiceSortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        const renderNumericHeader = (label: string, sortKey: InvoiceSortKey) => (
             <TableHead className='p-0 text-right'>
                <Button variant="ghost" className="w-full justify-end px-4" onClick={() => requestSort(setInvoiceSortConfig, invoiceSortConfig)(sortKey)}>
                    {label} {getSortIcon(invoiceSortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        return (
            <div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Invoice #', 'invoiceNo')}
                                {renderHeader('Supplier', 'supplier')}
                                {renderHeader('PO #', 'poNo')}
                                {renderHeader('Date', 'invoiceDate')}
                                {renderHeader('Status', 'status')}
                                {renderNumericHeader('Amount', 'amount')}
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedInvoices.length > 0 ? paginatedInvoices.map(inv => (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-mono py-2 px-4">{inv.invoiceNo}</TableCell>
                                    <TableCell className='py-2 px-4'>{inv.supplier}</TableCell>
                                    <TableCell className='font-mono py-2 px-4'>{inv.poNo}</TableCell>
                                    <TableCell className='py-2 px-4'>{format(parseISO(inv.invoiceDate), 'dd MMM yyyy')}</TableCell>
                                    <TableCell className='py-2 px-4'><Badge variant={inv.status === 'Paid' ? 'default' : 'secondary'}>{inv.status}</Badge></TableCell>
                                    <TableCell className="text-right py-2 px-4">{formatCurrencyPO(inv.amount, 2)}</TableCell>
                                    <TableCell className="text-right py-2 px-4">
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => handleOpenInvoiceForm(inv)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors"><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>This action will permanently delete this supplier invoice.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteInvoice(inv.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center">No supplier invoices found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                 {totalPages > 1 && renderPagination(invoicePage, totalPages, setInvoicePage)}
            </div>
        );
    }
    
    const handleStockBalanceExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const doc = new jsPDF({ orientation: 'portrait' });
        doc.setFontSize(18);
        doc.text("Stock Balance Report", 14, 22);
        
        const body: any[][] = [];
        filteredStockBalance.forEach(item => {
            body.push([
                item.puId,
                item.description,
                item.unit,
                item.balanceQty.toFixed(2),
            ]);
        
            const groupedInventory = item.inventory.reduce((acc, inv) => {
                const key = item.hasSerialNo ? inv.serialNo || 'N/A' : `rate-${inv.rate}`;
                if (!acc[key]) {
                    acc[key] = {
                        label: item.hasSerialNo ? `  S/N: ${inv.serialNo || 'N/A'}` : `  from ${format(inv.date, 'dd MMM yyyy')} @ ${formatCurrencyPO(inv.rate)}`,
                        qty: 0,
                    };
                }
                acc[key].qty += inv.qty;
                return acc;
            }, {} as Record<string, { label: string; qty: number; }>);

            Object.values(groupedInventory).forEach(inv => {
                body.push([
                    { content: inv.label, colSpan: 2, styles: { fontStyle: 'italic', textColor: 100 } },
                    null,
                    { content: inv.qty.toFixed(2), styles: { halign: 'right' } }
                ]);
            });
        });

        autoTable(doc, {
            head: [['PU ID', 'Material Name', 'Unit', 'Balance Qty']],
            body: body,
            startY: 30,
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: function (data: any) {
                if (data.cell && data.cell.raw && (data.cell.raw as any).colSpan) {
                    data.cell.styles.halign = 'left';
                } else if (data.column.index > 1) {
                    data.cell.styles.halign = 'right';
                }
            }
        });
        
        doc.save(`Stock_Balance.pdf`);
    };


    const renderStockBalanceTable = () => {
        const totalPages = Math.ceil(filteredStockBalance.length / rowsPerPage);
        const paginatedItems = filteredStockBalance.slice((stockBalancePage - 1) * rowsPerPage, stockBalancePage * rowsPerPage);

        const renderHeader = (label: string, sortKey: StockBalanceSortKey) => (
             <TableHead className='p-0'>
                <Button variant="ghost" className="w-full justify-start px-4" onClick={() => requestSort(setStockSortConfig, stockSortConfig)(sortKey)}>
                    {label} {getSortIcon(stockSortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        const renderNumericHeader = (label: string, sortKey: StockBalanceSortKey) => (
             <TableHead className='p-0 text-right'>
                <Button variant="ghost" className="w-full justify-end px-4" onClick={() => requestSort(setStockSortConfig, stockSortConfig)(sortKey)}>
                    {label} {getSortIcon(stockSortConfig, sortKey)}
                </Button>
            </TableHead>
        );

        return (
            <div>
                <div className="border rounded-lg max-h-[600px] overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className='w-8'></TableHead>
                                {renderHeader('PU ID', 'puId')}
                                {renderHeader('Material Name', 'description')}
                                {renderHeader('Unit', 'unit')}
                                {renderNumericHeader('Store Balance', 'balanceQty')}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedItems.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">No materials found.</TableCell></TableRow>
                            ) : (
                                paginatedItems.map(item => {
                                    const isExpanded = expandedRows.has(item.sourceId);

                                    const groupedInventory = item.inventory.reduce((acc, inv) => {
                                        const key = item.hasSerialNo ? inv.serialNo || 'N/A' : `rate-${inv.rate}`;
                                        if (!acc[key]) {
                                            acc[key] = {
                                                label: item.hasSerialNo ? inv.serialNo || 'N/A' : `from ${format(inv.date, 'dd-MM-yyyy')} @ ${formatCurrencyPO(inv.rate)}`,
                                                rate: inv.rate,
                                                qty: 0,
                                            };
                                        }
                                        acc[key].qty += inv.qty;
                                        return acc;
                                    }, {} as Record<string, { label: string; rate: number; qty: number; }>);


                                    return (
                                        <Fragment key={item.puId}>
                                            <TableRow onClick={() => toggleRow(item.sourceId)} className={'cursor-pointer hover:bg-muted/50'}>
                                                <TableCell className="py-2 px-4">
                                                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                                                </TableCell>
                                                <TableCell className="font-mono py-2 px-4">{item.puId}</TableCell>
                                                <TableCell className="font-medium py-2 px-4">{item.description}</TableCell>
                                                <TableCell className='py-2 px-4'>{item.unit}</TableCell>
                                                <TableCell className="text-right font-semibold py-2 px-4">{item.balanceQty.toFixed(2)}</TableCell>
                                            </TableRow>
                                             {isExpanded && (
                                                <TableRow className='bg-muted/20'>
                                                    <TableCell colSpan={5} className='p-2 pl-12'>
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow><TableHead>{item.hasSerialNo ? 'Serial No.' : 'Purchase Details'}</TableHead><TableHead className='text-right'>Quantity</TableHead></TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {Object.values(groupedInventory).map((inv, idx) => (
                                                                    <TableRow key={idx}><TableCell className='text-xs py-1'>{inv.label}</TableCell><TableCell className='text-right text-xs py-1'>{inv.qty.toFixed(2)}</TableCell></TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
                {totalPages > 1 && renderPagination(stockBalancePage, totalPages, setStockBalancePage)}
            </div>
        );
    };

    return (
        <>
            <Tabs defaultValue="purchase-order">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
                    <TabsTrigger value="purchase-order">Purchase Order</TabsTrigger>
                    <TabsTrigger value="delivery-order">Delivery Order</TabsTrigger>
                    <TabsTrigger value="invoice">Invoice</TabsTrigger>
                    <TabsTrigger value="project-usage">Project Usage</TabsTrigger>
                    <TabsTrigger value="stock-take">Stock Take</TabsTrigger>
                    <TabsTrigger value="material-status">Material Status</TabsTrigger>
                </TabsList>
                
                <TabsContent value="purchase-order" className="pt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Material Purchase Orders</CardTitle>
                                    <CardDescription>Purchase orders for general material procurement, not linked to a specific project.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                     <Button variant="outline" size="sm" onClick={handlePoExportExcel}><FileUp className="mr-2 h-4 w-4"/> Excel</Button>
                                    <Button variant="outline" size="sm" onClick={handlePoExportPdf}><FileDown className="mr-2 h-4 w-4"/> PDF</Button>
                                    <Button onClick={() => handleOpenPoForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add PO</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <div className="relative mb-4 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by PO No. or Supplier..."
                                    value={poSearchTerm}
                                    onChange={(e) => setPoSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            {renderPoTable()}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="delivery-order" className="pt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Material Delivery Orders</CardTitle>
                                    <CardDescription>Delivery orders received from suppliers against general material POs.</CardDescription>
                                </div>
                                 <div className="flex items-center gap-2">
                                     <Button variant="outline" size="sm" onClick={handleDoExportExcel}><FileUp className="mr-2 h-4 w-4"/> Excel</Button>
                                    <Button variant="outline" size="sm" onClick={handleDoExportPdf}><FileDown className="mr-2 h-4 w-4"/> PDF</Button>
                                    <Button onClick={() => handleOpenDoForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add DO</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <div className="relative mb-4 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by DO No., PO No. or Supplier..."
                                    value={doSearchTerm}
                                    onChange={(e) => setDoSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            {renderDoTable()}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                 <TabsContent value="invoice" className="pt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Supplier Invoices</CardTitle>
                                    <CardDescription>Invoices received from suppliers for delivered materials.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                     <Button variant="outline" size="sm" onClick={handleInvoiceExportExcel}><FileUp className="mr-2 h-4 w-4"/> Excel</Button>
                                    <Button variant="outline" size="sm" onClick={handleInvoiceExportPdf}><FileDown className="mr-2 h-4 w-4"/> PDF</Button>
                                    <Button onClick={() => handleOpenInvoiceForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Invoice</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <div className="relative mb-4 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by Invoice No., PO No. or Supplier..."
                                    value={invoiceSearchTerm}
                                    onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            {renderInvoiceTable()}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="project-usage" className="pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Project Usage Records</CardTitle>
                            <CardDescription>All material requisitions, issuances, and returns across projects.</CardDescription>
                             <div className="relative pt-4 max-w-sm">
                                <Search className="absolute left-2.5 top-6 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by Item, PU ID, Serial No. or Project..."
                                    value={usageSearchTerm}
                                    onChange={(e) => setUsageSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="requisition">
                            <TabsList className='mb-4'>
                                <TabsTrigger value="requisition">Requisition</TabsTrigger>
                                <TabsTrigger value="issuance">Issuance</TabsTrigger>
                                <TabsTrigger value="return">Return</TabsTrigger>
                            </TabsList>
                            <TabsContent value="requisition">{renderUsageTable(aggregatedUsageRecords.requisitions, 'Requisition', reqPage, setReqPage)}</TabsContent>
                            <TabsContent value="issuance">{renderUsageTable(aggregatedUsageRecords.issuances, 'Issuance', issPage, setIssPage)}</TabsContent>
                            <TabsContent value="return">{renderUsageTable(aggregatedUsageRecords.returns, 'Return', retPage, setRetPage)}</TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="stock-take" className="pt-4">
                    <StockTakeList
                        initialStockTakes={initialStockTakes}
                        allPlantUnits={allPlantUnits}
                        stockBalanceData={stockBalanceData}
                    />
                </TabsContent>
                
                <TabsContent value="material-status" className="pt-4">
                    <Card>
                        <CardHeader>
                             <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Material Status</CardTitle>
                                    <CardDescription>An overview of all general material stock levels across the company.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={handleStockBalanceExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                                    <Button variant="outline" size="sm" onClick={handleStockBalanceExportPdf}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                                </div>
                            </div>
                            <div className="relative pt-4 max-w-sm">
                                <Search className="absolute left-2.5 top-6 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search materials..."
                                    value={stockSearchTerm}
                                    onChange={(e) => setStockSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {renderStockBalanceTable()}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isPoFormOpen} onOpenChange={handleClosePoForm}>
                <DialogContent className="max-w-7xl">
                    <DialogHeader>
                        <DialogTitle>{editingPo?.id.startsWith('mpo-') ? 'Create' : 'Edit'} Material Purchase Order</DialogTitle>
                        <DialogDescription>
                            Fill in the details for the purchase order. This PO will not be linked to a specific project.
                        </DialogDescription>
                    </DialogHeader>
                    <MaterialPurchaseOrderForm
                        purchaseOrder={editingPo}
                        onSave={handleSavePo}
                        onCancel={handleClosePoForm}
                        plantUnits={allPlantUnits}
                        allCompanies={allCompanies}
                        allProjects={allProjects}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isDoFormOpen} onOpenChange={setIsDoFormOpen}>
                 <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{editingDo ? 'Edit' : 'Create'} Delivery Order</DialogTitle>
                        <DialogDescription>Record materials received from a supplier against a Purchase Order.</DialogDescription>
                    </DialogHeader>
                    <DeliveryOrderForm
                        deliveryOrder={editingDo}
                        purchaseOrders={initialGeneralPurchaseOrders}
                        onSave={handleSaveDo}
                        onCancel={() => setIsDoFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>
            
             <Dialog open={isInvoiceFormOpen} onOpenChange={setIsInvoiceFormOpen}>
                 <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editingInvoice ? 'Edit' : 'Create'} Supplier Invoice</DialogTitle>
                        <DialogDescription>Create an invoice for delivered goods against a Purchase Order.</DialogDescription>
                    </DialogHeader>
                    <SupplierInvoiceForm
                        invoice={editingInvoice}
                        purchaseOrders={initialGeneralPurchaseOrders}
                        deliveryOrders={deliveryOrdersWithDetails}
                        onSave={handleSaveInvoice}
                        onCancel={() => setIsInvoiceFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>

             <Dialog open={isUsageDetailOpen} onOpenChange={setIsUsageDetailOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Details: {detailedUsageRecord && ((detailedUsageRecord as MaterialRequisition).requisitionNo || (detailedUsageRecord as MaterialIssuance).goodsIssueNo || (detailedUsageRecord as MaterialReturn).goodsReturnNo)}</DialogTitle>
                        <DialogDescription>
                            Project: {detailedUsageRecord?.projectName} | Date: {detailedUsageRecord && format(parseISO(detailedUsageRecord.date), 'dd MMM yyyy')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="border rounded-lg max-h-[400px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PU ID</TableHead>
                                    <TableHead>Material Name</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Serial No</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(() => {
                                    const flattenedItems = detailedUsageRecord?.items.flatMap(item => {
                                        const puId = plantUnitMap.get(item.sourceId)?.puId || 'N/A';
                                        const hasSerials = item.serials && item.serials.length > 0 && item.serials.some(s => s.quantity > 0);

                                        if (hasSerials) {
                                            return item.serials!.filter(s => s.quantity > 0).map(serial => ({
                                                key: `${item.id}-${serial.serialNo || Math.random()}`,
                                                puId: puId,
                                                description: item.description,
                                                unit: item.unit,
                                                serialNo: serial.serialNo || 'N/A',
                                                quantity: serial.quantity
                                            }));
                                        } else {
                                            return [{
                                                key: item.id,
                                                puId: puId,
                                                description: item.description,
                                                unit: item.unit,
                                                serialNo: 'N/A',
                                                quantity: item.quantity
                                            }];
                                        }
                                    }) || [];

                                    if (flattenedItems.length === 0) {
                                        return (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-24 text-center">No items in this record.</TableCell>
                                            </TableRow>
                                        );
                                    }

                                    return flattenedItems.map(flatItem => (
                                        <TableRow key={flatItem.key}>
                                            <TableCell className="font-mono py-2 px-4">{flatItem.puId}</TableCell>
                                            <TableCell className='py-2 px-4'>{flatItem.description}</TableCell>
                                            <TableCell className='py-2 px-4'>{flatItem.unit}</TableCell>
                                            <TableCell className='py-2 px-4'>{flatItem.serialNo}</TableCell>
                                            <TableCell className="text-right py-2 px-4">{flatItem.quantity.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ));
                                })()}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
            
            <Dialog open={!!detailedStockItem} onOpenChange={(isOpen) => !isOpen && setDetailedStockItem(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Stock Details: {detailedStockItem?.description}</DialogTitle>
                        <DialogDescription>
                            Adjust physical count for each serial number. Total Balance: {(detailedStockItem?.inventory || []).reduce((sum, i) => sum + i.qty, 0).toFixed(2)} {detailedStockItem?.unit}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="border rounded-lg max-h-[400px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Serial Number</TableHead>
                                    <TableHead className="text-right">Balance Quantity</TableHead>
                                    <TableHead className="text-right w-40">Adjustment</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detailedStockItem && detailedStockItem.inventory.length > 0 ? (
                                    detailedStockItem.inventory.map((inv, index) =>
                                        (
                                            <TableRow key={index}>
                                                <TableCell className='py-2 px-4'>{inv.serialNo || 'N/A'}</TableCell>
                                                <TableCell className="text-right py-2 px-4">{inv.qty.toFixed(2)}</TableCell>
                                                <TableCell className="text-right py-2 px-4">
                                                    <Input 
                                                        type="number" 
                                                        value={serialAdjustments[inv.serialNo || ''] ?? ""}
                                                        onChange={(e) => handleSerialAdjustmentChange(inv.serialNo || '', e.target.value)}
                                                        className="h-8 text-right"
                                                        placeholder="New count"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )
                                    )
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                            No serial number data available for this item.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailedStockItem(null)}>Cancel</Button>
                        <Button onClick={handleSaveSerialAdjustments}>Save Adjustments</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isPoPdfFormOpen} onOpenChange={setIsPoPdfFormOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Export Purchase Order</DialogTitle>
                        <DialogDescription>
                            Confirm or edit the details below for the PDF export.
                        </DialogDescription>
                    </DialogHeader>
                    {poForPdf && (
                        <PoPdfForm
                            purchaseOrder={poForPdf}
                            company={currentCompany}
                            directory={allCompanies}
                            onCancel={() => setIsPoPdfFormOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
