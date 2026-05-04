
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./components/dashboard-client";
import type { Project, PlantUnit, Company, InHouseTeam, DeliveryOrder, MaterialPurchaseOrder, SupplierInvoice } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default async function DashboardPage({ params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const supabase = await createClient();

  // Fetch base dashboard data
  const [
    projectsResult,
    plantUnitsResult,
    companyResult,
    teamsResult,
    generalPOsResult,
    deliveryOrdersResult,
    supplierInvoicesResult
  ] = await Promise.all([
    supabase.from('projects').select(`
      *,
      claims ( type, amount, status, date, retention_amount ),
      purchase_orders ( type, items, po_no, po_date ),
      daily_activity_logs ( work ),
      team_costs ( * ),
      material_issuances ( items, date ),
      material_returns ( items )
    `).eq('company_id', companyId).range(0, 10000),
    supabase.from('plant_units').select('*').eq('company_id', companyId).range(0, 10000),
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase.from('in_house_teams').select('*').eq('company_id', companyId),
    supabase.from('material_purchase_orders').select('*').eq('company_id', companyId),
    supabase.from('delivery_orders').select('*').eq('company_id', companyId),
    supabase.from('supplier_invoices').select('*').eq('company_id', companyId)
  ]);


  if (projectsResult.error || plantUnitsResult.error || companyResult.error || teamsResult.error) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // OPTIMIZATION: Resolve N+1 for subcon project dates using a single batch query
  const subconProjects = projectsResult.data.filter(p => p.originating_project_id);
  const originatingIds = Array.from(new Set(subconProjects.map(p => p.originating_project_id)));
  
  let originatingDetailsMap = new Map();
  if (originatingIds.length > 0) {
    const { data: originatingData } = await supabase
      .from('projects')
      .select('id, startdate, targetcompletiondate')
      .in('id', originatingIds);
    
    originatingData?.forEach(p => originatingDetailsMap.set(p.id, p));
  }

  const projects: Project[] = (projectsResult.data || []).map((p: any) => {
    const originatingData = originatingDetailsMap.get(p.originating_project_id);
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
      startDate: originatingData ? originatingData.startdate : p.startdate,
      targetCompletionDate: originatingData ? originatingData.targetcompletiondate : p.targetcompletiondate,
      actualCompletionDate: p.actualcompletiondate,
      clientBoq: p.clientboq || [],
      engineeringBoq: p.engineeringboq || [],
      materialBoq: p.materialboq || [],
      originatingProjectId: p.originating_project_id,
      purchaseOrders: (p.purchase_orders || []).map((po: any) => ({ ...po, projectId: po.project_id, poDate: po.po_date, targetCompletionDate: po.target_completion_date, teamId: po.team_id, originatingProjectId: po.originating_project_id, originatingPoId: po.originating_po_id, poNo: po.po_no })),
      dailyActivities: (p.daily_activity_logs || []).map((log: any) => ({ ...log, projectId: log.project_id, siteInstructions: log.site_instructions })),
      teamCosts: (p.team_costs || []).map((cost: any) => ({ ...cost, projectId: cost.project_id, teamId: cost.team_id, petrolAndToll: cost.petrol_and_toll, siteExpenses: cost.site_expenses, machineryAndUpkeep: cost.machinery_and_upkeep })),
      materialIssuances: (p.material_issuances || []),
      materialReturns: (p.material_returns || []),
      materialRequisitions: [],
      claims: [],
      clientClaims: (p.claims || []).filter((c: any) => c.type === 'Client').map((c: any) => ({ ...c, retentionAmount: c.retention_amount })),
      subconClaims: (p.claims || []).filter((c: any) => c.type === 'Subcontractor').map((c: any) => ({ ...c, retentionAmount: c.retention_amount })),
    };
  });
  
  const plantUnits: PlantUnit[] = (plantUnitsResult.data || []).map(item => ({
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
  }));
  const company: Company | null = companyResult.data;
  const teams: InHouseTeam[] = teamsResult.data || [];
  
  const generalPurchaseOrders: MaterialPurchaseOrder[] = (generalPOsResult.data || []).map((po: any) => ({
      id: po.id,
      company_id: po.company_id,
      poNo: po.po_no,
      poDate: po.po_date,
      supplier: po.supplier,
      items: po.items || [],
      refQuotationNo: po.ref_quotation_no,
      projectId: po.project_id,
      projectName: po.project_name,
      projectNo: po.project_no,
      projectPoNo: po.project_po_no,
      sstPercentage: po.sst_percentage,
      includeDeliveryInSst: po.include_delivery_in_sst ?? true,
  }));

  const deliveryOrders: DeliveryOrder[] = (deliveryOrdersResult.data || []).map((d: any) => ({
    ...d,
    companyId: d.company_id,
    materialPurchaseOrderId: d.material_purchase_order_id,
    doNo: d.do_no,
    poNo: '',
  }));

  const supplierInvoices: SupplierInvoice[] = (supplierInvoicesResult.data || []).map((inv: any) => ({
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

  return <DashboardClient 
            projects={projects} 
            plantUnits={plantUnits} 
            company={company} 
            companyId={companyId} 
            teams={teams}
            generalPurchaseOrders={generalPurchaseOrders}
            deliveryOrders={deliveryOrders}
            supplierInvoices={supplierInvoices}
        />;
}
