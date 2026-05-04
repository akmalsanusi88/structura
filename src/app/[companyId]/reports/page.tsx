
'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMemo, useState, useEffect } from 'react';
import type { Project, PlantUnit, InHouseTeam, Company, Claim, ClaimStatus, DailyActivityWork, SiteInstruction, DeliveryOrder, MaterialPurchaseOrder, StockAdjustment, GeneralTeamCost, SerialInfo, Movement, PurchaseData } from '@/lib/types';
import { format, parseISO, endOfMonth, startOfYear, startOfMonth, lastDayOfMonth, subMonths } from 'date-fns';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import TeamPnlReport from './components/team-pnl-report';
import ProjectSummaryByClient from './components/project-summary-by-client';
import DetailedClientPoList from './components/detailed-client-po-list';
import DetailedSubconPoList from './components/detailed-subcon-po-list';
import SummaryBySubcon from './components/summary-by-subcon';
import ProjectSummaryReport from './components/project-summary-report';
import FinancialSummaryByClient from './components/financial-summary-by-client';
import StockPurchaseReport from './components/stock-purchase-report';
import StockMovementReport from './components/stock-movement-report';
import StockSummaryReport from './components/stock-summary-report';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const getPeriod = (year: string, month: string, ytd: boolean) => {
    if (year === 'all') return { start: new Date(0), end: new Date(9999, 11, 31) };
    
    const yearNum = parseInt(year);
    let periodStartDate: Date;
    let periodEndDate: Date;

    if (ytd) {
        periodStartDate = new Date(0);
        if (month === 'all') {
            periodEndDate = endOfMonth(new Date(yearNum, 11, 1));
        } else {
            periodEndDate = endOfMonth(parseISO(month + '-01'));
        }
    } else {
        if (month === 'all') {
            periodStartDate = startOfYear(new Date(yearNum, 0, 1));
            periodEndDate = endOfMonth(new Date(yearNum, 11, 1));
        } else {
            periodStartDate = startOfMonth(parseISO(month + '-01'));
            periodEndDate = endOfMonth(parseISO(month + '-01'));
        }
    }
    return { start: periodStartDate, end: periodEndDate };
};


export default function ReportsPage() {
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedFinancialClient, setSelectedFinancialClient] = useState<string>('all');
    const [selectedProjectClient, setSelectedProjectClient] = useState<string>('all');
    const [isClient, setIsClient] = useState(false);
    const [isYtdMode, setIsYtdMode] = useState(false);
    
    useEffect(() => {
        setIsClient(true);
    }, []);

    const params = useParams();
    const companyId = params.companyId as string;
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [plantUnits, setPlantUnits] = useState<PlantUnit[]>([]);
    const [teams, setTeams] = useState<InHouseTeam[]>([]);
    const [company, setCompany] = useState<Company | null>(null);
    const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
    const [materialPOs, setMaterialPOs] = useState<MaterialPurchaseOrder[]>([]);
    const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
    const [generalCosts, setGeneralCosts] = useState<GeneralTeamCost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!companyId) return;
            const supabase = createClient();
            setLoading(true);
            
            const { data: currentCompany } = await supabase.from('companies').select('name').eq('id', companyId).single();
            const companyName = currentCompany?.name || '';

            const [projectsRes, plantUnitsRes, teamsRes, companyRes, deliveryOrdersRes, materialPOsRes, stockAdjustmentsRes, generalCostsRes] = await Promise.all([
                supabase.from('projects').select('*, claims(*), purchase_orders(*), team_costs(*), material_issuances(items, date, goods_issue_no), material_returns(items, date, goods_return_no), daily_activity_logs(*)').or(`company_id.eq.${companyId},client.eq.${companyName}`).neq('status', 'Closed').range(0, 10000),
                supabase.from('plant_units').select('*').eq('company_id', companyId).range(0, 10000),
                supabase.from('in_house_teams').select('*').eq('company_id', companyId),
                supabase.from('companies').select('*').eq('id', companyId).single(),
                supabase.from('delivery_orders').select('*').eq('company_id', companyId),
                supabase.from('material_purchase_orders').select('*').eq('company_id', companyId),
                supabase.from('stock_adjustments').select('*').eq('company_id', companyId),
                supabase.from('general_team_costs').select('*').eq('company_id', companyId),
            ]);

            setProjects((projectsRes.data || []).map((p: any) => {
                const allClaims = (p.claims || []).map((c: any) => ({ ...c, claimNo: c.claim_no, invoiceNo: c.invoice_no, statusDates: c.status_dates, isFinal: c.is_final, hasRetention: c.has_retention, retentionPercentage: c.retention_percentage, retentionAmount: c.retention_amount, claimedItems: c.claimed_items, purchaseOrderId: c.purchase_order_id, purchaseOrderNo: c.purchase_order_no }));
                return {
                    id: p.id,
                    companyId: p.company_id,
                    name: p.name,
                    projectNo: p.projectno,
                    client: p.client,
                    supervisor: p.supervisor,
                    planner: p.planner,
                    status: p.status,
                    budgetedCost: p.budgetedcost,
                    actualCost: p.actualcost,
                    revenue: p.revenue,
                    progress: p.progress,
                    startDate: p.startdate,
                    targetCompletionDate: p.targetcompletiondate,
                    actualCompletionDate: p.actualcompletiondate,
                    clientBoq: p.clientboq || [],
                    engineeringBoq: p.engineeringboq || [],
                    materialBoq: p.materialboq || [],
                    purchaseOrders: (p.purchase_orders || []).map((po: any) => ({ ...po, poNo: po.po_no, teamId: po.team_id, poDate: po.po_date, targetCompletionDate: po.target_completion_date, originatingPoId: po.originating_po_id })),
                    clientClaims: allClaims.filter((c: Claim) => c.type === 'Client'),
                    subconClaims: allClaims.filter((c: Claim) => c.type === 'Subcontractor'),
                    teamCosts: (p.team_costs || []).map((tc: any) => ({ ...tc, teamId: tc.team_id, petrolAndToll: tc.petrol_and_toll, siteExpenses: tc.site_expenses, machineryAndUpkeep: tc.machinery_and_upkeep })),
                    materialIssuances: (p.material_issuances || []).map((iss: any) => ({...iss, goodsIssueNo: iss.goods_issue_no})),
                    materialReturns: (p.material_returns || []).map((ret: any) => ({...ret, goodsReturnNo: ret.goods_return_no})),
                    dailyActivities: (p.daily_activity_logs || []).map((log: any) => ({
                        id: log.id,
                        date: log.date,
                        work: (log.work || []).map((w: any): DailyActivityWork => ({
                            id: w.id,
                            boqItemId: w.boqItemId,
                            quantity: w.quantity,
                            teamId: w.teamId,
                        })),
                        siteInstructions: (log.site_instructions || []).map((si: any): SiteInstruction => ({
                            id: si.id,
                            description: si.description,
                            amount: si.amount,
                            quantity: si.quantity,
                            unit: si.unit,
                            rate: si.rate,
                            sourceType: si.source_type,
                            sourceId: si.source_id,
                            discountPercentage: si.discount_percentage,
                            context: si.context,
                            purchaseOrderId: si.purchase_order_id,
                            teamId: si.teamId,
                        })),
                    })),
                    materialRequisitions: [],
                }
            }));
            setPlantUnits((plantUnitsRes.data || []).map(item => ({
              id: item.id,
              companyId: item.company_id,
              puId: item.pu_id,
              description: item.description,
              category: item.category,
              unit: item.unit,
              rate: item.rate,
              clientName: item.client_name,
              materialManagementFee: item.material_management_fee,
              hasSerialNo: item.has_serial_no,
            })));
            setTeams(teamsRes.data || []);
            setCompany(companyRes.data || null);
            setDeliveryOrders((deliveryOrdersRes.data || []).map((d: any) => ({
                ...d,
                doNo: d.do_no,
                materialPurchaseOrderId: d.material_purchase_order_id,
            })));
            setMaterialPOs((materialPOsRes.data || []).map((po: any) => ({ 
                ...po, 
                poNo: po.po_no,
                projectName: po.project_name,
                projectNo: po.project_no,
                projectPoNo: po.project_po_no,
            })));
            setStockAdjustments((stockAdjustmentsRes.data || []).map((sa: any) => ({ ...sa, adjustmentDate: sa.adjustment_date})));
            setLoading(false);
        };
        fetchData();
    }, [companyId]);

    const period = useMemo(() => getPeriod(selectedYear, selectedMonth, isYtdMode), [selectedYear, selectedMonth, isYtdMode]);

    const dateFilter = useMemo(() => {
        return (dateStr: string | null | undefined): boolean => {
            if (!dateStr) return false;
            const date = parseISO(dateStr.length === 7 ? `${dateStr}-01` : dateStr);
            return date >= period.start && date <= period.end;
        };
    }, [period]);

    const { availableYears, availableMonths, uniqueClients } = useMemo(() => {
        const years = new Set<string>();
        const months = new Set<string>();
        const clients = new Set<string>();
        
        projects.forEach(p => {
            clients.add(p.client);
            if (p.startDate) years.add(p.startDate.substring(0, 4));
            if (p.targetCompletionDate) years.add(p.targetCompletionDate.substring(0, 4));
        });
        
        deliveryOrders.forEach(d => {
            if (d.date) years.add(d.date.substring(0, 4));
        });

        const sortedYears = ['all', ...Array.from(years).sort((a, b) => b.localeCompare(a))];

        if (selectedYear !== 'all') {
            projects.forEach(p => {
                if (p.startDate && p.startDate.startsWith(selectedYear)) months.add(p.startDate.substring(0, 7));
                if (p.targetCompletionDate && p.targetCompletionDate.startsWith(selectedYear)) months.add(p.targetCompletionDate.substring(0, 7));
            });
             deliveryOrders.forEach(d => {
                if (d.date && d.date.startsWith(selectedYear)) months.add(d.date.substring(0, 7));
            });
        }
        
        const sortedMonths = ['all', ...Array.from(months).sort((a, b) => b.localeCompare(a))];

        return { 
            availableYears: sortedYears, 
            availableMonths: sortedMonths,
            uniqueClients: ['all', ...Array.from(clients).sort()]
        };
    }, [projects, deliveryOrders, selectedYear]);


    const allProjectItemsMap = useMemo(() => {
        const map = new Map<string, { description: string; unit: string; puId?: string, hasSerialNo?: boolean, rate?: number }>();
        plantUnits.forEach(pu => map.set(pu.id, { description: pu.description, unit: pu.unit, puId: pu.puId, hasSerialNo: pu.hasSerialNo, rate: pu.rate }));
        projects.forEach(p => {
            (p.materialBoq || []).forEach(boqItem => {
                const pu = plantUnits.find(pu => pu.id === boqItem.sourceId);
                if (!map.has(boqItem.id)) {
                    map.set(boqItem.id, { description: boqItem.description, unit: boqItem.unit, puId: pu?.puId || 'N/A', hasSerialNo: pu?.hasSerialNo, rate: boqItem.rate });
                }
            });
        });
        return map;
    }, [plantUnits, projects]);

    const poItemMap = useMemo(() => {
        const map = new Map<string, any>();
        materialPOs.forEach(po => po.items.forEach(item => map.set(item.id, item)));
        return map;
    }, [materialPOs]);

    const purchaseLedger = useMemo(() => {
        const ledger = new Map<string, { date: Date; qty: number; rate: number; serialNo?: string, doNo: string, supplier: string }[]>();

        deliveryOrders.forEach(d => {
            d.items.forEach(item => {
                const poItem = poItemMap.get(item.poItemId);
                if (!poItem) return;

                const itemInfo = allProjectItemsMap.get(poItem.sourceId);
                if (!ledger.has(poItem.sourceId)) {
                    ledger.set(poItem.sourceId, []);
                }
                const sourceLedger = ledger.get(poItem.sourceId)!;

                if (itemInfo?.hasSerialNo && item.serials && item.serials.length > 0) {
                     item.serials.forEach(serial => {
                        sourceLedger.push({ date: parseISO(d.date), qty: serial.quantity, rate: poItem.rate, serialNo: serial.serialNo || 'N/A', doNo: d.doNo, supplier: d.supplier });
                     });
                } else {
                    sourceLedger.push({ date: parseISO(d.date), qty: item.receivedQuantity, rate: poItem.rate, doNo: d.doNo, supplier: d.supplier });
                }
            });
        });
        ledger.forEach(entries => entries.sort((a, b) => a.date.getTime() - b.date.getTime()));
        return ledger;
    }, [deliveryOrders, poItemMap, allProjectItemsMap]);

    const movementData = useMemo(() => {
        const allMovementsChronological = projects
            .flatMap(p => [
                ...(p.materialIssuances || []).map(iss => ({ ...iss, type: 'Issuance' as const, projectId: p.id, projectName: p.name })),
                ...(p.materialReturns || []).map(ret => ({ ...ret, type: 'Return' as const, projectId: p.id, projectName: p.name })),
            ])
            .sort((a, b) => {
                 if (!a.date || !b.date) return 0; 
                 return new Date(a.date).getTime() - new Date(b.date).getTime()
            });
        
        const tempPurchaseLedger = new Map(Array.from(purchaseLedger.entries()).map(([key, value]) => [key, [...value.map(v => ({...v}))]]));
        
        const issuanceCostTracker = new Map<string, { rate: number, serialNo?: string }[]>();

        const movements: Movement[] = [];
        
        allMovementsChronological.forEach(movement => {
            const docNo = (movement as any).goodsIssueNo || (movement as any).goodsReturnNo;

            (movement.items || []).forEach(item => {
                const itemInfo = allProjectItemsMap.get(item.sourceId);
                if (!itemInfo) return;
                
                let qtyToProcess = item.quantity;
                const trackerKeyBase = item.sourceId;
                const fallbackRate = itemInfo.rate || 0;
                
                if (movement.type === 'Issuance') {
                    if (itemInfo.hasSerialNo && item.serials && item.serials.length > 0) {
                        item.serials.forEach(serial => {
                            let qtyToIssueForSerial = serial.quantity;
                            const purchaseStock = tempPurchaseLedger.get(item.sourceId) || [];
                            const trackerKey = `${trackerKeyBase}-${serial.serialNo || 'N/A'}`;
                            if (!issuanceCostTracker.has(trackerKey)) issuanceCostTracker.set(trackerKey, []);

                            for (let i = 0; i < purchaseStock.length && qtyToIssueForSerial > 0; i++) {
                                if (purchaseStock[i].serialNo === serial.serialNo) {
                                    const stock = purchaseStock[i];
                                    const useQty = Math.min(qtyToIssueForSerial, stock.qty);
                                    
                                    if(dateFilter(movement.date)) {
                                        movements.push({
                                            id: '',
                                            sourceId: item.sourceId,
                                            itemName: item.description, itemNo: itemInfo.puId || 'N/A', date: movement.date, docNo,
                                            type: 'Issuance', unit: item.unit, qty: -useQty, priceRate: stock.rate, totalPrice: -useQty * stock.rate,
                                            serials: [{ serialNo: serial.serialNo, quantity: useQty }],
                                            projectName: movement.projectName,
                                        });
                                    }

                                    for(let j=0; j < useQty; j++) issuanceCostTracker.get(trackerKey)!.push({ rate: stock.rate, serialNo: serial.serialNo });

                                    stock.qty -= useQty;
                                    qtyToIssueForSerial -= useQty;
                                }
                            }

                            if (qtyToIssueForSerial > 0 && dateFilter(movement.date)) {
                                 movements.push({
                                    id: '',
                                    sourceId: item.sourceId,
                                    itemName: item.description, itemNo: itemInfo.puId || 'N/A', date: movement.date, docNo,
                                    type: 'Issuance', unit: item.unit, qty: -qtyToIssueForSerial, priceRate: fallbackRate, totalPrice: -qtyToIssueForSerial * fallbackRate,
                                    serials: [{ serialNo: serial.serialNo, quantity: qtyToIssueForSerial }],
                                    projectName: movement.projectName,
                                });
                                for(let j=0; j < qtyToIssueForSerial; j++) issuanceCostTracker.get(trackerKey)!.push({ rate: fallbackRate, serialNo: serial.serialNo });
                            }

                            tempPurchaseLedger.set(item.sourceId, purchaseStock.filter(s => s.qty > 0.001));
                        });
                    } else {
                        const purchaseStock = tempPurchaseLedger.get(item.sourceId) || [];
                        if (!issuanceCostTracker.has(trackerKeyBase)) issuanceCostTracker.set(trackerKeyBase, []);
                        
                        while (qtyToProcess > 0 && purchaseStock.length > 0) {
                            const stock = purchaseStock[0];
                            const useQty = Math.min(qtyToProcess, stock.qty);

                            if(dateFilter(movement.date)) {
                                movements.push({
                                    id: '',
                                    sourceId: item.sourceId,
                                    itemName: item.description, itemNo: itemInfo.puId || 'N/A', date: movement.date, docNo,
                                    type: 'Issuance', unit: item.unit, qty: -useQty, priceRate: stock.rate, totalPrice: -useQty * stock.rate,
                                    projectName: movement.projectName,
                                });
                            }

                            for(let j=0; j<useQty; j++) issuanceCostTracker.get(trackerKeyBase)!.push({ rate: stock.rate });

                            stock.qty -= useQty;
                            qtyToProcess -= useQty;
                            if (stock.qty < 0.001) {
                                purchaseStock.shift();
                            }
                        }

                        if (qtyToProcess > 0 && dateFilter(movement.date)) {
                            movements.push({
                                id: '',
                                sourceId: item.sourceId,
                                itemName: item.description, itemNo: itemInfo.puId || 'N/A', date: movement.date, docNo,
                                type: 'Issuance', unit: item.unit, qty: -qtyToProcess, priceRate: fallbackRate, totalPrice: -qtyToProcess * fallbackRate,
                                projectName: movement.projectName,
                            });
                            for(let j=0; j < qtyToProcess; j++) issuanceCostTracker.get(trackerKeyBase)!.push({ rate: fallbackRate });
                        }
                    }
                } else { // Return
                    if (itemInfo.hasSerialNo && item.serials) {
                        item.serials.forEach(serialToReturn => {
                            const key = serialToReturn.serialNo || 'N/A';
                            const trackerKey = `${item.sourceId}-${key}`;
                            const tracker = issuanceCostTracker.get(trackerKey) || [];
                            let returnedQty = serialToReturn.quantity;
                            while (returnedQty > 0 && tracker.length > 0) {
                                const originalIssuance = tracker.pop();
                                if (originalIssuance) {
                                    if(dateFilter(movement.date)) {
                                        movements.push({
                                            id: '',
                                            sourceId: item.sourceId,
                                            itemName: item.description, itemNo: itemInfo.puId || 'N/A', date: movement.date, docNo,
                                            type: 'Return', unit: item.unit, qty: 1, priceRate: originalIssuance.rate, totalPrice: 1 * originalIssuance.rate,
                                            serials: [{ serialNo: key, quantity: 1}],
                                            projectName: movement.projectName,
                                        });
                                    }
                                    const mainLedger = tempPurchaseLedger.get(item.sourceId) || [];
                                    mainLedger.push({ date: parseISO(movement.date!), qty: 1, rate: originalIssuance.rate, serialNo: key, doNo: 'Return', supplier: 'Project' });
                                    mainLedger.sort((a,b) => a.date.getTime() - b.date.getTime());
                                    returnedQty--;
                                }
                            }
                        });
                     } else {
                         let returnedQty = item.quantity;
                         const tracker = issuanceCostTracker.get(item.sourceId) || [];
                         while(returnedQty > 0 && tracker.length > 0) {
                             const originalIssuance = tracker.pop()!;
                            if(dateFilter(movement.date)) {
                                movements.push({
                                    id: '',
                                    sourceId: item.sourceId,
                                    itemName: item.description, itemNo: itemInfo.puId || 'N/A', date: movement.date, docNo,
                                    type: 'Return', unit: item.unit, qty: 1, priceRate: originalIssuance.rate, totalPrice: 1 * originalIssuance.rate,
                                    projectName: movement.projectName,
                                });
                            }
                             const mainLedger = tempPurchaseLedger.get(item.sourceId) || [];
                             mainLedger.push({ date: parseISO(movement.date!), qty: 1, rate: originalIssuance.rate, doNo: 'Return', supplier: 'Project' });
                             mainLedger.sort((a,b) => a.date.getTime() - b.date.getTime());
                             returnedQty--;
                         }
                     }
                }
            });
        });

        const groupedMovements = new Map<string, any>();
        movements.forEach((m, index) => {
            const key = `${m.docNo}-${m.itemName}-${m.priceRate}-${m.projectName}`;
            let entry = groupedMovements.get(key);
            if (entry) {
                entry.qty += m.qty;
                entry.totalPrice += m.totalPrice;
                if (m.serials) {
                    if (!entry.serials) entry.serials = [];
                    const existingSerialsMap = new Map(entry.serials.map((s: any) => [s.serialNo || 'N/A', s.quantity]));
                    m.serials.forEach((s: any) => {
                        const serialKey = s.serialNo || 'N/A';
                        existingSerialsMap.set(serialKey, (existingSerialsMap.get(serialKey) || 0) + s.quantity);
                    });
                    entry.serials = Array.from(existingSerialsMap.entries()).map(([serialNo, quantity]) => ({serialNo, quantity}));
                }
            } else {
                 groupedMovements.set(key, { ...m, id: `${key}-${index}` });
            }
        });

        return Array.from(groupedMovements.values());

    }, [projects, allProjectItemsMap, purchaseLedger, dateFilter]);

    const purchaseData: PurchaseData[] = useMemo(() => {
      return deliveryOrders
        .filter(d => dateFilter(d.date))
        .flatMap(d => {
          const materialPO = materialPOs.find(po => po.id === d.materialPurchaseOrderId);
          return d.items.map((item, itemIdx) => {
              const poItem = poItemMap.get(item.poItemId);
              const plantUnit = plantUnits.find(pu => pu.id === poItem?.sourceId);
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
    }, [deliveryOrders, materialPOs, poItemMap, plantUnits, dateFilter]);
    
    const totalStockMovement = useMemo(() => {
        return movementData.reduce((sum, m) => sum + m.totalPrice, 0);
    }, [movementData]);

    const stockReportData = useMemo(() => {
        const { start: periodStart, end: periodEndDate } = getPeriod(selectedYear, selectedMonth, isYtdMode);
        const previousPeriodEnd = lastDayOfMonth(subMonths(periodStart, 1));
        
        const calculateStockData = (endDate: Date) => {
            const stockLedger = new Map<string, { date: Date; qty: number; rate: number, serialNo?: string }[]>();
            
            (deliveryOrders || []).forEach(d => {
                const deliveryDate = parseISO(d.date);
                if (deliveryDate <= endDate) {
                    d.items.forEach(item => {
                        const poItem = poItemMap.get(item.poItemId);
                        if(poItem) {
                            const plantUnit = plantUnits.find(pu => pu.id === poItem.sourceId);
                            if (!stockLedger.has(poItem.sourceId)) stockLedger.set(poItem.sourceId, []);
                            const sourceLedger = stockLedger.get(poItem.sourceId)!;

                            if (plantUnit?.hasSerialNo && item.serials && item.serials.length > 0) {
                                (item.serials || []).forEach(serial => {
                                    sourceLedger.push({ date: deliveryDate, qty: serial.quantity, rate: poItem.rate, serialNo: serial.serialNo || 'N/A' });
                                })
                            } else {
                                sourceLedger.push({ date: deliveryDate, qty: item.receivedQuantity, rate: poItem.rate });
                            }
                        }
                    });
                }
            });

            stockLedger.forEach(entries => entries.sort((a, b) => a.date.getTime() - b.date.getTime()));
            
            const relevantAdjustments = (stockAdjustments || []).filter(adj => parseISO(adj.adjustmentDate) <= endDate);
            const latestAdjustments = new Map<string, StockAdjustment>();
            relevantAdjustments.forEach(adj => {
                const existing = latestAdjustments.get(adj.sourceId);
                if (!existing || new Date(adj.adjustmentDate) > new Date(existing.adjustmentDate)) {
                    latestAdjustments.set(adj.sourceId, adj);
                }
            });
            
            latestAdjustments.forEach((adj, sourceId) => {
                const adjDate = parseISO(adj.adjustmentDate);
                const entriesAfter = stockLedger.get(sourceId)?.filter(e => e.date > adjDate) || [];
                
                const plantUnit = plantUnits.find(pu => pu.id === sourceId);
                const newInventory = [];

                if (plantUnit?.hasSerialNo && adj.serials) {
                     const ledgerForSource = stockLedger.get(sourceId);
                    const avgRate = (ledgerForSource && ledgerForSource.length > 0 ? ledgerForSource.reduce((acc, curr, _, arr) => acc + curr.rate / arr.length, 0) : plantUnit?.rate) || 0;
                    (adj.serials || []).forEach(s => {
                        newInventory.push({ date: adjDate, qty: s.quantity, rate: avgRate, serialNo: s.serialNo });
                    });
                } else {
                     const ledgerForSource = stockLedger.get(sourceId);
                     const avgRate = (ledgerForSource && ledgerForSource.length > 0 ? ledgerForSource.reduce((acc, curr, _, arr) => acc + curr.rate / arr.length, 0) : plantUnit?.rate) || 0;
                    newInventory.push({ date: adjDate, qty: adj.quantity, rate: avgRate });
                }
                stockLedger.set(sourceId, [...newInventory, ...entriesAfter]);
            });

            const movements = (projects || []).flatMap(p => [
                ...(p.materialIssuances || []).map(iss => ({ ...iss, type: 'Issuance' as const })),
                ...(p.materialReturns || []).map(ret => ({ ...ret, type: 'Return' as const }))
            ]).filter(m => m.date && parseISO(m.date) <= endDate).sort((a,b) => parseISO(a.date!).getTime() - parseISO(b.date!).getTime());

            const issuanceCostTracker = new Map<string, { rate: number, serialNo?: string }[]>();
            
            movements.forEach(movement => {
                movement.items.forEach(item => {
                    const plantUnit = plantUnits.find(pu => pu.id === item.sourceId);
                    const itemLedger = stockLedger.get(item.sourceId);
                    if (!itemLedger) return;
                    
                    if (movement.type === 'Issuance') {
                         if (plantUnit?.hasSerialNo && item.serials && item.serials.length > 0) {
                            item.serials.forEach(serial => {
                                let qtyToIssueForSerial = serial.quantity;
                                const trackerKey = `${item.sourceId}-${serial.serialNo || 'N/A'}`;
                                if (!issuanceCostTracker.has(trackerKey)) issuanceCostTracker.set(trackerKey, []);

                                for (let i = 0; i < itemLedger.length && qtyToIssueForSerial > 0; i++) {
                                    if (itemLedger[i].serialNo === serial.serialNo) {
                                        const useQty = Math.min(qtyToIssueForSerial, itemLedger[i].qty);
                                        for(let j=0; j < useQty; j++) issuanceCostTracker.get(trackerKey)!.push({ rate: itemLedger[i].rate, serialNo: serial.serialNo });
                                        itemLedger[i].qty -= useQty;
                                        qtyToIssueForSerial -= useQty;
                                    }
                                }
                                if (qtyToIssueForSerial > 0) {
                                     itemLedger.push({ date: parseISO(movement.date!), qty: -qtyToIssueForSerial, rate: plantUnit.rate, serialNo: serial.serialNo });
                                }
                                stockLedger.set(item.sourceId, itemLedger.filter(e => Math.abs(e.qty) > 0.001));
                            });
                        } else {
                            let qtyToIssue = item.quantity;
                            const trackerKey = item.sourceId;
                            if (!issuanceCostTracker.has(trackerKey)) issuanceCostTracker.set(trackerKey, []);

                            while (qtyToIssue > 0 && itemLedger.length > 0) {
                                const purchaseEntry = itemLedger[0];
                                const useQty = Math.min(qtyToIssue, purchaseEntry.qty);

                                for(let j=0; j<useQty; j++) issuanceCostTracker.get(trackerKey)!.push({ rate: purchaseEntry.rate });

                                purchaseEntry.qty -= useQty;
                                qtyToIssue -= useQty;
                                if (purchaseEntry.qty <= 0.001) {
                                    itemLedger.shift();
                                }
                            }
                            if (qtyToIssue > 0) {
                                itemLedger.push({ date: parseISO(movement.date!), qty: -qtyToIssue, rate: plantUnit.rate });
                            }
                        }
                    } else { // Return
                        if (plantUnit?.hasSerialNo && item.serials) {
                             item.serials.forEach(serialToReturn => {
                                const key = serialToReturn.serialNo || 'N/A';
                                const trackerKey = `${item.sourceId}-${key}`;
                                const tracker = issuanceCostTracker.get(trackerKey) || [];
                                let returnedQty = serialToReturn.quantity;
                                while (returnedQty > 0 && tracker.length > 0) {
                                    const originalIssuance = tracker.pop();
                                    if (originalIssuance) {
                                        itemLedger.push({ date: parseISO(movement.date!), qty: 1, rate: originalIssuance.rate, serialNo: key });
                                        returnedQty--;
                                    }
                                }
                            });
                        } else {
                            let returnedQty = item.quantity;
                             const tracker = issuanceCostTracker.get(item.sourceId) || [];
                             while(returnedQty > 0 && tracker.length > 0) {
                                 const originalIssuance = tracker.pop()!;
                                 itemLedger.push({ date: parseISO(movement.date!), qty: 1, rate: originalIssuance.rate });
                                 returnedQty--;
                             }
                        }
                        itemLedger.sort((a,b) => a.date.getTime() - b.date.getTime());
                    }
                });
            });
            
            let stockValue = 0;
            stockLedger.forEach(entries => {
                stockValue += entries.reduce((sum, e) => sum + (e.qty * e.rate), 0);
            });
            return { stockLedger, stockValue };
        };

        const { stockValue: openingBalanceValue, stockLedger: openingStockLedger } = calculateStockData(previousPeriodEnd);
        const { stockLedger: closingStockLedger, stockValue: closingBalanceValue } = calculateStockData(periodEndDate);

        const totalStockPurchase = (deliveryOrders || [])
            .filter(d => dateFilter(d.date))
            .reduce((sum, d) => sum + d.items.reduce((itemSum, item) => {
                 const poItem = poItemMap.get(item.poItemId);
                 return itemSum + (item.receivedQuantity * (poItem?.rate || 0));
            }, 0), 0);
        
        return {
            openingBalance: openingBalanceValue,
            openingStockLedger: Array.from(openingStockLedger.entries()).map(([sourceId, entries]) => ({
                sourceId,
                qty: entries.reduce((sum, e) => sum + e.qty, 0),
                value: entries.reduce((sum, e) => sum + (e.qty * e.rate), 0),
            })),
            totalStockPurchase,
            closingBalance: closingBalanceValue,
            stockItems: Array.from(closingStockLedger.entries())
              .map(([sourceId, inventory]) => {
                  const materialInfo = plantUnits.find(pu => pu.id === sourceId);
                  if (!materialInfo) return null;
                  const balanceQty = inventory.reduce((sum, entry) => sum + entry.qty, 0);
                  const balanceValue = inventory.reduce((sum, entry) => sum + (entry.qty * entry.rate), 0);
                  const avgRate = balanceQty > 0 ? balanceValue / balanceQty : (balanceQty < 0 ? materialInfo.rate : 0);
                  return {
                      sourceId,
                      itemNo: materialInfo.puId,
                      description: materialInfo.description,
                      unit: materialInfo.unit,
                      hasSerialNo: materialInfo.hasSerialNo || false,
                      balanceQty,
                      balanceValue,
                      avgRate,
                      inventory: inventory.filter(entry => Math.abs(entry.qty) > 0.001),
                  };
              }).filter(Boolean) as any[],
        };
    }, [deliveryOrders, poItemMap, projects, plantUnits, stockAdjustments, selectedYear, selectedMonth, isYtdMode, dateFilter]);

    const filteredAdjustments = useMemo(() => {
        return (stockAdjustments || []).filter(adj => dateFilter(adj.adjustmentDate));
    }, [stockAdjustments, dateFilter]);


    const filteredProjects = useMemo(() => {
        const periodEnd = period.end;

        const results = projects.map(project => {
            const allClientPOs = (project.purchaseOrders || []).filter(po => po?.type === 'Client');
            const clientPoItemMap = new Map(allClientPOs.flatMap(po => po.items).map(item => [item.id, item]));

            const workDoneFromLogs = (project.dailyActivities || [])
                .filter(log => dateFilter(log.date))
                .reduce((total, log) => {
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
                .filter(log => dateFilter(log.date))
                .flatMap(log => log.siteInstructions || [])
                .filter((si: SiteInstruction) => si.context === 'Client')
                .reduce((total, si) => total + si.amount, 0);

            const actualRevenue = workDoneFromLogs + workDoneFromSIs;
            
            const getEffectiveStatus = (c: Claim): ClaimStatus => {
                const statusDates = c.statusDates || {};
                if (statusDates.Paid && parseISO(statusDates.Paid) <= periodEnd) return 'Paid';
                if (statusDates.Received && parseISO(statusDates.Received) <= periodEnd) return 'Received';
                if (statusDates.Submitted && parseISO(statusDates.Submitted) <= periodEnd) return 'Submitted';
                if (c.status !== 'Draft' && parseISO(c.date) <= periodEnd) return 'Submitted';
                return 'Draft';
            };

            const clientClaims = (project.clientClaims || [])
                .filter(c => parseISO(c.date) <= periodEnd)
                .map(c => ({
                    ...c,
                    status: getEffectiveStatus(c)
                }));

            const subconClaims = (project.subconClaims || [])
                .filter(c => parseISO(c.date) <= periodEnd)
                .map(c => ({
                    ...c,
                    status: getEffectiveStatus(c)
                }));

            const totalInvoiced = clientClaims
                .filter(c => c.status !== 'Draft')
                .reduce((sum, c) => sum + (c.amount - (c.retentionAmount || 0)), 0);
            
            const totalReceived = clientClaims
                .filter(c => c.status === 'Paid')
                .reduce((sum, c) => sum + (c.amount - (c.retentionAmount || 0)), 0);
            
            const hasFinalClaim = clientClaims.some(c => c.isFinal || c.claimNo?.toLowerCase().includes('retention'));

            return {
                ...project,
                purchaseOrders: (project.purchaseOrders || []).filter(po => dateFilter(po.poDate)),
                clientClaims,
                subconClaims,
                teamCosts: (project.teamCosts || []).filter(c => dateFilter(c.month)),
                materialIssuances: (project.materialIssuances || []).filter(i => dateFilter(i.date)),
                materialReturns: (project.materialReturns || []).filter(r => dateFilter(r.date)),
                dailyActivities: (project.dailyActivities || []).filter(log => dateFilter(log.date)),
                actualRevenue,
                totalInvoiced,
                totalReceived,
                hasFinalClaim,
            };
        });

        return results.filter(p => {
            if (selectedYear === 'all') return true;
            
            const projectStartDate = p.startDate ? parseISO(p.startDate) : null;
            const projectYear = projectStartDate ? projectStartDate.getFullYear().toString() : '';
            if (projectYear === selectedYear) return true;
            
            const targetPrefix = selectedMonth === 'all' ? selectedYear : selectedMonth;
            const hasDirectActivity = (p.dailyActivities || []).some(log => log.date.startsWith(targetPrefix)) ||
                                     (p.clientClaims || []).some(c => c.date.startsWith(targetPrefix));
            if (hasDirectActivity) return true;

            const hadStatusUpdateInPeriod = p.clientClaims?.some(c => {
                if (!c.statusDates) return false;
                return Object.values(c.statusDates).some(date => date && date.startsWith(targetPrefix));
            });
            if (hadStatusUpdateInPeriod) return true;

            const hasPendingPaymentAtPeriodEnd = p.totalInvoiced > p.totalReceived || p.actualRevenue > p.totalInvoiced;
            
            if (isYtdMode) {
                if (Number(projectYear) < Number(selectedYear)) {
                    return hasPendingPaymentAtPeriodEnd || !p.hasFinalClaim;
                }
            } else {
                return hasPendingPaymentAtPeriodEnd;
            }
            
            return false;
        });
    }, [projects, dateFilter, isYtdMode, selectedYear, selectedMonth, period.end]);

    const financialFilteredProjects = useMemo(() => {
        return filteredProjects.filter(p => selectedFinancialClient === 'all' || p.client === selectedFinancialClient);
    }, [filteredProjects, selectedFinancialClient]);

    const projectFilteredProjects = useMemo(() => {
        return filteredProjects.filter(p => selectedProjectClient === 'all' || p.client === selectedProjectClient);
    }, [filteredProjects, selectedProjectClient]);


    if (loading) {
        return (
             <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <Skeleton className="h-10 w-1/4" />
                <Skeleton className="h-6 w-1/2" />
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
                 <Skeleton className="h-64 w-full" />
                 <Skeleton className="h-96 w-full" />
            </div>
        )
    }
    
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Reports & Analytics</h2>
                    <p className="text-muted-foreground">Comprehensive business intelligence and reporting</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Select a period to refine the reports below.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                     <div className="flex-1">
                        <p className="text-sm font-medium mb-1">Year</p>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableYears.map(year => <SelectItem key={year} value={year}>{year === 'all' ? 'All Years' : year}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="flex-1">
                        <p className="text-sm font-medium mb-1">Month</p>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={selectedYear === 'all'}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Month" />
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
                     <div className="flex items-end pb-1">
                        <div className="flex items-center space-x-2">
                           <Switch
                                id="ytd-mode"
                                checked={isYtdMode}
                                onCheckedChange={setIsYtdMode}
                                disabled={selectedYear === 'all'}
                            />
                            <Label htmlFor="ytd-mode">Year-to-Date</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="project">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="project">Project</TabsTrigger>
                    <TabsTrigger value="financial">Financial</TabsTrigger>
                    <TabsTrigger value="material">Material</TabsTrigger>
                    <TabsTrigger value="team">Team</TabsTrigger>
                    <TabsTrigger value="executive">Executive Summary</TabsTrigger>
                </TabsList>

                <TabsContent value="project" className="pt-4 space-y-6">
                    <div className="pb-4">
                        <Label htmlFor="project-client-filter">Filter by Client</Label>
                        <Select value={selectedProjectClient} onValueChange={setSelectedProjectClient}>
                            <SelectTrigger id="project-client-filter" className="w-[280px] mt-1">
                                <SelectValue placeholder="Select a Client..." />
                            </SelectTrigger>
                            <SelectContent>
                                {uniqueClients.map(client => (
                                    <SelectItem key={client} value={client}>{client === 'all' ? 'All Clients' : client}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                   <Tabs defaultValue="summary">
                        <TabsList>
                            <TabsTrigger value="summary">Summary</TabsTrigger>
                            <TabsTrigger value="detail-project">Detail Project</TabsTrigger>
                        </TabsList>
                        <TabsContent value="summary" className="pt-4">
                             <ProjectSummaryByClient projects={projectFilteredProjects} plantUnits={plantUnits} />
                        </TabsContent>
                         <TabsContent value="detail-project" className="pt-4">
                            <ProjectSummaryReport projects={projectFilteredProjects} plantUnits={plantUnits} />
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                <TabsContent value="financial" className="pt-4 space-y-6">
                    <div className="pb-4">
                        <Label htmlFor="financial-client-filter">Filter by Client</Label>
                        <Select value={selectedFinancialClient} onValueChange={setSelectedFinancialClient}>
                            <SelectTrigger id="financial-client-filter" className="w-[280px] mt-1">
                                <SelectValue placeholder="Select a Client..." />
                            </SelectTrigger>
                            <SelectContent>
                                {uniqueClients.map(client => (
                                    <SelectItem key={client} value={client}>{client === 'all' ? 'All Clients' : client}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Tabs defaultValue="summary-by-client">
                        <TabsList>
                            <TabsTrigger value="summary-by-client">Summary by Client</TabsTrigger>
                            <TabsTrigger value="summary-by-subcon">Summary by Subcon</TabsTrigger>
                            <TabsTrigger value="detail-client-po">Detail Client PO</TabsTrigger>
                            <TabsTrigger value="detail-subcon-po">Detail Subcon PO</TabsTrigger>
                        </TabsList>
                        <TabsContent value="summary-by-client" className="pt-4">
                           <FinancialSummaryByClient projects={financialFilteredProjects} />
                        </TabsContent>
                        <TabsContent value="summary-by-subcon" className="pt-4">
                            <SummaryBySubcon projects={financialFilteredProjects} />
                        </TabsContent>
                        <TabsContent value="detail-client-po" className="pt-4">
                            <DetailedClientPoList projects={financialFilteredProjects} />
                        </TabsContent>
                         <TabsContent value="detail-subcon-po" className="pt-4">
                           <DetailedSubconPoList projects={financialFilteredProjects} />
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                <TabsContent value="material" className="pt-4 space-y-6">
                    <Tabs defaultValue="stock-purchase">
                        <TabsList>
                            <TabsTrigger value="stock-purchase">Stock Purchase</TabsTrigger>
                            <TabsTrigger value="stock-movement">Stock Movement</TabsTrigger>
                            <TabsTrigger value="stock-summary">Stock Summary</TabsTrigger>
                        </TabsList>
                        <TabsContent value="stock-purchase" className="pt-4">
                           <StockPurchaseReport deliveryOrders={deliveryOrders} materialPurchaseOrders={materialPOs} plantUnits={plantUnits} selectedYear={selectedYear} selectedMonth={selectedMonth}/>
                        </TabsContent>
                        <TabsContent value="stock-movement" className="pt-4">
                            <StockMovementReport movementData={movementData} totalMovementValue={totalStockMovement} />
                        </TabsContent>
                        <TabsContent value="stock-summary" className="pt-4">
                           <StockSummaryReport
                                {...stockReportData}
                                totalStockMovement={totalStockMovement}
                                allMovements={movementData}
                                allPurchases={purchaseData}
                                adjustments={filteredAdjustments}
                             />
                        </TabsContent>
                    </Tabs>
                </TabsContent>
                
                <TabsContent value="team" className="pt-4">
                    <TeamPnlReport projects={filteredProjects} teams={teams} plantUnits={plantUnits} />
                </TabsContent>

                <TabsContent value="executive" className="pt-4 space-y-6">
                     <Card><CardHeader><CardTitle>Executive Summary</CardTitle><CardDescription>This report is under construction.</CardDescription></CardHeader><CardContent><p>A high-level overview for executives will be available here soon.</p></CardContent></Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
