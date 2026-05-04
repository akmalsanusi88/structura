
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/layout/header";
import type { Project, PlantUnit, Company, DeliveryOrder, MaterialPurchaseOrder, SupplierInvoice, StockAdjustment, StockTake } from "@/lib/types";
import MaterialDashboard from "./components/material-dashboard";
import type { StockBalanceItem } from "./components/material-dashboard";
import { parseISO, startOfMonth, endOfMonth, startOfYear } from "date-fns";

async function getInventoryData(companyId: string) {
    const supabase = await createClient();
    const [
        projectsResult,
        plantUnitsResult,
        deliveryOrdersResult,
        materialPurchaseOrdersResult,
        stockAdjustmentsResult
    ] = await Promise.all([
        supabase.from('projects').select('material_issuances(items, date), material_returns(items, date)').eq('company_id', companyId),
        supabase.from('plant_units').select('*').eq('company_id', companyId),
        supabase.from('delivery_orders').select('*').eq('company_id', companyId),
        supabase.from('material_purchase_orders').select('id, items').eq('company_id', companyId),
        supabase.from('stock_adjustments').select('*').eq('company_id', companyId)
    ]);
    
    const errors = [projectsResult.error, plantUnitsResult.error, deliveryOrdersResult.error, materialPurchaseOrdersResult.error, stockAdjustmentsResult.error].filter(Boolean);
    if (errors.length > 0) {
        console.error("Error fetching inventory data:", errors);
        return { plantUnits: [], stockBalanceData: [] };
    }

    const allProjects: Project[] = (projectsResult.data || []).map((p: any) => ({
      ...p,
      materialIssuances: p.material_issuances,
      materialReturns: p.material_returns,
    }));
    const plantUnits: PlantUnit[] = (plantUnitsResult.data || []).map((pu: any) => ({...pu, puId: pu.pu_id, hasSerialNo: pu.has_serial_no}));
    const deliveryOrders: DeliveryOrder[] = deliveryOrdersResult.data || [];
    const materialPOs: MaterialPurchaseOrder[] = materialPurchaseOrdersResult.data || [];
    const stockAdjustments: StockAdjustment[] = (stockAdjustmentsResult.data || []).map((sa: any) => ({ ...sa, adjustmentDate: sa.adjustment_date}));
    
    const plantUnitMap = new Map(plantUnits.map(pu => [pu.id, pu]));
    const poItemToSourceIdMap = new Map<string, string>();
    materialPOs.forEach(po => {
        (po.items || []).forEach(item => {
            poItemToSourceIdMap.set(item.id, item.sourceId);
        });
    });

    const stockLedger = new Map<string, { date: Date; qty: number; rate: number; serialNo?: string }[]>();

    deliveryOrders.forEach(d => {
        (d.items || []).forEach(item => {
            const sourceId = poItemToSourceIdMap.get(item.poItemId);
            if (sourceId) {
                const plantUnit = plantUnitMap.get(sourceId);
                const poItem = materialPOs.flatMap(p => p.items).find(i => i.id === item.poItemId);
                if (poItem) {
                    if (!stockLedger.has(sourceId)) stockLedger.set(sourceId, []);
                    const ledgerEntries = stockLedger.get(sourceId)!;
                    
                    if (plantUnit?.hasSerialNo && item.serials && item.serials.length > 0) {
                        item.serials.forEach(serial => {
                           ledgerEntries.push({ date: parseISO(d.date), qty: serial.quantity, rate: poItem.rate, serialNo: serial.serialNo });
                        });
                    } else {
                        ledgerEntries.push({ date: parseISO(d.date), qty: item.receivedQuantity, rate: poItem.rate });
                    }
                }
            }
        });
    });
    
    stockLedger.forEach(l => l.sort((a, b) => a.date.getTime() - b.date.getTime()));

    const allMovements = allProjects.flatMap(p => [
        ...(p.materialIssuances || []).map(i => ({...i, type: 'Issuance' as const})),
        ...(p.materialReturns || []).map(r => ({...r, type: 'Return' as const})),
    ]).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    
    const issuanceCostTracker = new Map<string, { rate: number; serialNo?: string; }[]>();

    allMovements.forEach(movement => {
        movement.items.forEach(item => {
            const plantUnit = plantUnitMap.get(item.sourceId);
            const itemLedger = stockLedger.get(item.sourceId);
            if (!itemLedger) return;

            if (movement.type === 'Issuance') {
                if (plantUnit?.hasSerialNo && item.serials && item.serials.length > 0) {
                    item.serials.forEach(serial => {
                        const key = serial.serialNo || 'N/A';
                        const trackerKey = `${item.sourceId}-${key}`;
                        if (!issuanceCostTracker.has(trackerKey)) issuanceCostTracker.set(trackerKey, []);

                        for (let i = 0; i < itemLedger.length; i++) {
                            if (itemLedger[i].serialNo === key) {
                                const useQty = Math.min(serial.quantity, itemLedger[i].qty);
                                for (let j = 0; j < useQty; j++) {
                                    issuanceCostTracker.get(trackerKey)!.push({ rate: itemLedger[i].rate, serialNo: key });
                                }
                                itemLedger[i].qty -= useQty;
                                break; 
                            }
                        }
                    });
                } else {
                    let qtyToIssue = item.quantity;
                    while (qtyToIssue > 0 && itemLedger.length > 0) {
                        const entry = itemLedger[0];
                        const useQty = Math.min(qtyToIssue, entry.qty);

                        if (!issuanceCostTracker.has(item.sourceId)) issuanceCostTracker.set(item.sourceId, []);
                        for (let i = 0; i < useQty; i++) issuanceCostTracker.get(item.sourceId)!.push({ rate: entry.rate });

                        entry.qty -= useQty;
                        qtyToIssue -= useQty;
                        if (entry.qty <= 0.001) itemLedger.shift();
                    }
                }
            } else { // Return
                if (plantUnit?.hasSerialNo && item.serials && item.serials.length > 0) {
                    item.serials.forEach(serial => {
                        const key = serial.serialNo || 'N/A';
                        const trackerKey = `${item.sourceId}-${key}`;
                        const tracker = issuanceCostTracker.get(trackerKey) || [];
                        let returnedQty = serial.quantity;
                        while(returnedQty > 0 && tracker.length > 0) {
                            const originalIssuance = tracker.pop()!;
                            itemLedger.push({ date: parseISO(movement.date), qty: 1, rate: originalIssuance.rate, serialNo: key });
                            returnedQty--;
                        }
                    });
                } else {
                    let returnedQty = item.quantity;
                    const tracker = issuanceCostTracker.get(item.sourceId) || [];
                    while(returnedQty > 0 && tracker.length > 0) {
                         const originalIssuance = tracker.pop()!;
                         itemLedger.push({ date: parseISO(movement.date), qty: 1, rate: originalIssuance.rate });
                         returnedQty--;
                    }
                }
                itemLedger.sort((a,b) => a.date.getTime() - b.date.getTime());
            }
        });
    });

    const latestAdjustments = new Map<string, StockAdjustment>();
    stockAdjustments.forEach(adj => {
        const existing = latestAdjustments.get(adj.sourceId);
        if (!existing || new Date(adj.adjustmentDate) > new Date(existing.adjustmentDate)) {
            latestAdjustments.set(adj.sourceId, adj);
        }
    });

    const stockBalanceData: StockBalanceItem[] = plantUnits
        .filter(pu => pu.category === 'Material PU')
        .map(pu => {
            const latestAdjustment = latestAdjustments.get(pu.id);
            let inventory = stockLedger.get(pu.id) || [];
            
            if (latestAdjustment) {
                // If there's an adjustment, we reset the inventory state *at that date*
                inventory = [];
                if (pu.hasSerialNo && latestAdjustment.serials) {
                    const avgRate = stockLedger.get(pu.id)?.reduce((acc, curr, _, arr) => acc + curr.rate / arr.length, 0) || pu.rate;
                    latestAdjustment.serials.forEach(s => {
                        inventory.push({
                            date: parseISO(latestAdjustment.adjustmentDate),
                            qty: s.quantity,
                            rate: avgRate,
                            serialNo: s.serialNo
                        });
                    });
                } else {
                    const avgRate = stockLedger.get(pu.id)?.reduce((acc, curr, _, arr) => acc + curr.rate / arr.length, 0) || pu.rate;
                    inventory = [{ date: parseISO(latestAdjustment.adjustmentDate), qty: latestAdjustment.quantity, rate: avgRate }];
                }
            }
            const balanceQty = inventory.reduce((sum, item) => sum + item.qty, 0);

            return {
                puId: pu.puId,
                sourceId: pu.id,
                description: pu.description,
                unit: pu.unit,
                balanceQty,
                hasSerialNo: pu.hasSerialNo,
                inventory,
            };
        });

    return { plantUnits, stockBalanceData };
}

export default async function MaterialManagementPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const supabase = await createClient();

  // Fetch all data concurrently
  const [
    projectsResult,
    allCompaniesResult,
    deliveryOrdersResult,
    generalPOsResult,
    supplierInvoicesResult,
    stockAdjustmentsResult,
    stockTakesResult,
  ] = await Promise.all([
    supabase
      .from('projects')
      .select(`id, name, projectno, purchase_orders(*), materialboq, material_requisitions (id, requisition_no, date, items), material_issuances (id, goods_issue_no, date, items), material_returns (id, goods_return_no, date, items)`)
      .eq('company_id', companyId),
    supabase
      .from('directory')
      .select('*'),
    supabase
      .from('delivery_orders')
      .select('*')
      .eq('company_id', companyId),
    supabase
      .from('material_purchase_orders')
      .select('*')
      .eq('company_id', companyId),
    supabase
      .from('supplier_invoices')
      .select('*')
      .eq('company_id', companyId),
    supabase
      .from('stock_adjustments')
      .select('*')
      .eq('company_id', companyId),
    supabase
      .from('stock_takes')
      .select('*, stock_take_items(*)')
      .eq('company_id', companyId),
  ]);
  
  const { plantUnits, stockBalanceData } = await getInventoryData(companyId);

  const errors = [
    projectsResult.error,
    allCompaniesResult.error,
    deliveryOrdersResult.error,
    generalPOsResult.error,
    supplierInvoicesResult.error,
    stockAdjustmentsResult.error,
    stockTakesResult.error
  ].filter(Boolean);

  if (errors.length > 0) {
    console.error("Error fetching material management data:", errors);
    return (
        <div className="flex flex-col h-full">
            <Header title="Material Management" />
            <main className="flex-1 p-4 md:p-6 space-y-4">
                <div className="text-red-600 bg-red-100 p-4 rounded-md">
                  <h3 className="font-bold">Data Loading Error</h3>
                  <p>There was an error fetching the necessary data for this page. This usually happens when Row Level Security (RLS) is enabled but no access policies have been created for new tables.</p>
                </div>
            </main>
      </div>
    );
  }

  const { data: projectsData } = projectsResult;
  const { data: allCompaniesData } = allCompaniesResult;
  const { data: deliveryOrdersData } = deliveryOrdersResult;
  const { data: generalPOsData } = generalPOsResult;
  const { data: supplierInvoicesData } = supplierInvoicesResult;
  const { data: stockAdjustmentsData } = stockAdjustmentsResult;
  const { data: stockTakesData } = stockTakesResult;


  const projects: Project[] = (projectsData || []).map((p: any) => ({
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
    purchaseOrders: (p.purchase_orders || []).map((po: any) => ({...po, poNo: po.po_no})),
    materialRequisitions: (p.material_requisitions || []).map((req: any) => ({...req, requisitionNo: req.requisition_no})),
    materialIssuances: (p.material_issuances || []).map((iss: any) => ({...iss, goodsIssueNo: iss.goods_issue_no})),
    materialReturns: (p.material_returns || []).map((ret: any) => ({...ret, goodsReturnNo: ret.goods_return_no})),
    dailyActivities: [],
    clientClaims: [],
    subconClaims: [],
    teamCosts: [],
  }));

  const allCompanies: Company[] = (allCompaniesData || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      address: item.address,
      phone: item.phone,
      email: item.email,
      attn: item.attn,
      bankName: item.bank_name,
      bankAccNo: item.bank_acc_no,
      bankAddress: item.bank_address,
    }));
  const deliveryOrders: DeliveryOrder[] = (deliveryOrdersData || []).map((d: any) => ({
    ...d,
    companyId: d.company_id,
    materialPurchaseOrderId: d.material_purchase_order_id,
    doNo: d.do_no,
    poNo: '',
  }));
  
  const generalPurchaseOrders: MaterialPurchaseOrder[] = (generalPOsData || []).map((po: any) => ({
      id: po.id,
      companyId: po.company_id,
      poNo: po.po_no,
      poDate: po.po_date,
      supplier: po.supplier,
      items: po.items || [],
      deliveryCost: po.delivery_cost,
      refQuotationNo: po.ref_quotation_no,
      projectId: po.project_id,
      projectName: po.project_name,
      projectNo: po.project_no,
      projectPoNo: po.project_po_no,
      sstPercentage: po.sst_percentage || 0,
      includeDeliveryInSst: po.include_delivery_in_sst ?? true,
  }));

  const supplierInvoices: SupplierInvoice[] = (supplierInvoicesData || []).map((inv: any) => ({
    id: inv.id,
    companyId: inv.company_id,
    invoiceNo: inv.invoice_no,
    invoiceDate: inv.invoice_date,
    dueDate: inv.due_date,
    supplier: inv.supplier,
    materialPurchaseOrderId: inv.material_purchase_order_id,
    poNo: generalPurchaseOrders.find(po => po.id === inv.material_purchase_order_id)?.poNo || 'N/A',
    deliveryOrderIds: inv.delivery_order_ids || [],
    amount: inv.amount,
    status: inv.status,
  }));
  
  const stockAdjustments: StockAdjustment[] = (stockAdjustmentsData || []).map((sa: any) => ({
    id: sa.id,
    companyId: sa.company_id,
    sourceId: sa.source_id,
    quantity: sa.quantity,
    adjustmentDate: sa.adjustment_date,
    serials: sa.serials,
  }));

  const stockTakes: StockTake[] = (stockTakesData || []).map((st: any) => ({
    id: st.id,
    companyId: st.company_id,
    name: st.name,
    takeDate: st.take_date,
    items: (st.stock_take_items || []).map((item: any) => ({
      id: item.id,
      stockTakeId: item.stock_take_id,
      sourceId: item.source_id,
      countedQuantity: item.counted_quantity,
      serials: item.serials,
    }))
  }));

  return (
    <div className="flex flex-col h-full">
        <Header title="Material Management" />
        <main className="flex-1 p-4 md:p-6">
            <MaterialDashboard 
              allProjects={projects} 
              allPlantUnits={plantUnits}
              allCompanies={allCompanies}
              initialDeliveryOrders={deliveryOrders}
              initialGeneralPurchaseOrders={generalPurchaseOrders}
              initialSupplierInvoices={supplierInvoices}
              initialStockAdjustments={stockAdjustments}
              initialStockTakes={stockTakes}
              stockBalanceData={stockBalanceData}
            />
        </main>
    </div>
  );
}
