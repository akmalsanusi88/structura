import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProjectDetailView from "./components/project-detail-view";
import type { PlantUnit, InHouseTeam, Company, Project, PurchaseOrder, DailyActivityLog, Claim, TeamCost, MaterialRequisition, MaterialIssuance, MaterialReturn, DailyActivityWork, SiteInstruction, DeliveryOrder, MaterialOnSiteUsage } from "@/lib/types";

export default async function ProjectDetailsPage({ params }: { params: { companyId: string, projectId: string } }) {
  const { companyId, projectId } = params;
  const supabase = createClient();

  // Step 1: Fetch all data concurrently
  const [
    projectResult,
    plantUnitsResult,
    inHouseTeamsResult,
    companyResult,
    allCompaniesResult,
    allProjectsForSerialsResult,
    deliveryOrdersResult,
    materialPurchaseOrdersResult,
    companyMaterialRequisitionsResult,
    companyMaterialIssuancesResult,
    companyMaterialReturnsResult,
    onSiteUsageResult,
  ] = await Promise.all([
    supabase.from('projects').select(`*, purchase_orders(*), daily_activity_logs(*), claims(*), team_costs(*), material_requisitions(*), material_issuances(*), material_returns(*)`).eq('id', projectId).eq('company_id', companyId).single(),
    supabase.from('plant_units').select('*').eq('company_id', companyId).range(0, 10000),
    supabase.from('in_house_teams').select('*').eq('company_id', companyId),
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase.from('directory').select('*').order('name'),
    supabase.from('projects').select('material_issuances(*), material_returns(*)').eq('company_id', companyId),
    supabase.from('delivery_orders').select('*').eq('company_id', companyId),
    supabase.from('material_purchase_orders').select('id, items').eq('company_id', companyId),
    supabase.from('material_requisitions').select('requisition_no').eq('company_id', companyId),
    supabase.from('material_issuances').select('goods_issue_no').eq('company_id', companyId),
    supabase.from('material_returns').select('goods_return_no').eq('company_id', companyId),
    supabase.from('material_on_site_usage').select('*').eq('project_id', projectId),
  ]);

  if (projectResult.error || !projectResult.data) {
    console.error("Project not found or error fetching:", projectResult.error);
    notFound();
  }
  
  const p = projectResult.data;
  
  // Step 2: Fetch linked subcontractor data and sync it
  const { data: linkedProjectsData, error: linkedError } = await supabase
    .from('projects')
    .select('id, originating_project_id, purchase_orders(*), daily_activity_logs(*), claims(*)')
    .eq('originating_project_id', projectId);

  if (linkedError) {
      console.error("Error fetching linked subcontractor projects:", linkedError);
  }
  
  // The daily_activity_logs from the subcon project ARE the source of truth for that subcon's work.
  const subconLogs = linkedProjectsData?.flatMap(lp => lp.daily_activity_logs || []) || [];

  const syncedClaims: Claim[] = [];

  if (linkedProjectsData) {
      linkedProjectsData.forEach(subconProject => {
          // Map subcon PO IDs to main project PO IDs
          const subconPoMap = new Map((subconProject.purchase_orders || []).map((po: any) => [po.id, po.originating_po_id]));
          
          // Sync claims
          const subconClientClaims: any[] = (subconProject.claims || []).filter((c: any) => c.type === 'Client');
          subconClientClaims.forEach(claim => {
              const mainPoId = subconPoMap.get(claim.purchase_order_id);
              const mainContractorPo = (p.purchase_orders || []).find((po:any) => po.id === mainPoId);
              
              if (mainPoId && mainContractorPo) {
                  syncedClaims.push({
                      ...claim,
                      type: 'Subcontractor',
                      purchaseOrderId: mainPoId,
                      purchaseOrderNo: mainContractorPo.po_no || claim.purchase_order_no,
                      claimNo: claim.claim_no,
                      invoiceNo: claim.invoice_no,
                      statusDates: claim.status_dates,
                      isFinal: claim.is_final,
                      hasRetention: claim.has_retention,
                      retentionPercentage: claim.retention_percentage,
                      retentionAmount: claim.retention_amount,
                      claimedItems: claim.claimed_items
                  });
              }
          });
      });
  }
  
  const allClaims = (p.claims || []).map((claim: any) => ({ ...claim, projectId: claim.project_id, purchaseOrderId: claim.purchase_order_id, purchaseOrderNo: claim.purchase_order_no, type: claim.type, claimNo: claim.claim_no, invoiceNo: claim.invoice_no, date: claim.date, amount: claim.amount, status: claim.status, statusDates: claim.status_dates, isFinal: claim.is_final, hasRetention: claim.has_retention, retentionPercentage: claim.retention_percentage, retentionAmount: claim.retention_amount, claimedItems: claim.claimed_items, purchaseOrderId: claim.purchase_order_id, purchaseOrderNo: claim.purchase_order_no }));

  const project: Project = {
    id: p.id, companyId: p.company_id, name: p.name, projectNo: p.projectno, lorId: p.lor_id, client: p.client, supervisor: p.supervisor, planner: p.planner, status: p.status, budgetedCost: p.budgetedcost, actualCost: p.actualcost, revenue: p.revenue, progress: p.progress, startDate: p.startdate, targetCompletionDate: p.targetcompletiondate, actualCompletionDate: p.actualcompletiondate, clientBoq: p.clientboq || [], engineeringBoq: p.engineeringboq || [], materialBoq: p.materialboq || [], originatingProjectId: p.originating_project_id, originatingPoId: p.originating_po_id, boqPdfDetails: p.boq_pdf_details,
    purchaseOrders: (p.purchase_orders || []).map((po: any) => ({ ...po, projectId: po.project_id, poDate: po.po_date, targetCompletionDate: po.target_completion_date, teamId: po.team_id, originatingProjectId: po.originating_project_id, originatingPoId: po.originating_po_id, poNo: po.po_no, subcontractorCompanyId: po.subcontractor_company_id })),
    dailyActivities: [...(p.daily_activity_logs || []), ...subconLogs].map((log: any) => ({
      ...log,
      projectId: log.project_id,
      siteInstructions: (log.site_instructions || []).map((si: any): SiteInstruction => ({
          id: si.id,
          description: si.description,
          amount: si.amount,
          quantity: si.quantity,
          unit: si.unit,
          rate: si.rate,
          sourceType: si.sourceType || 'custom',
          sourceId: si.sourceId,
          discountPercentage: si.discountPercentage,
          managementFee: si.managementFee,
          hasManagementFee: si.hasManagementFee,
          context: si.context,
          purchaseOrderId: si.purchaseOrderId,
      })),
      work: (log.work || []).map((w: any) => ({...w})),
    })),
    clientClaims: allClaims.filter((c: Claim) => c.type === 'Client'),
    subconClaims: [ ...allClaims.filter((c: Claim) => c.type === 'Subcontractor'), ...syncedClaims ],
    teamCosts: (p.team_costs || []).map((cost: any) => ({ ...cost, projectId: cost.project_id, teamId: cost.team_id, petrolAndToll: cost.petrol_and_toll, siteExpenses: cost.site_expenses, machineryAndUpkeep: cost.machinery_and_upkeep })),
    materialRequisitions: (p.material_requisitions || []).map((req: any) => ({...req, projectId: req.project_id, requisitionNo: req.requisition_no})),
    materialIssuances: (p.material_issuances || []).map((iss: any) => ({...iss, projectId: iss.project_id, goodsIssueNo: iss.goods_issue_no})),
    materialReturns: (p.material_returns || []).map((ret: any) => ({...ret, projectId: ret.project_id, goodsReturnNo: ret.goods_return_no})),
    materialOnSiteUsage: (onSiteUsageResult.data || []).map((usage: any): MaterialOnSiteUsage => ({ id: usage.id, projectId: usage.project_id, companyId: usage.company_id, sourceId: usage.source_id, quantity: usage.quantity})),
  };

  const plantUnits: PlantUnit[] = (plantUnitsResult.data || []).map(item => ({ id: item.id, companyId: item.company_id, puId: item.pu_id, description: item.description, category: item.category, unit: item.unit, rate: item.rate, clientName: item.client_name, materialManagementFee: item.material_management_fee, hasSerialNo: item.has_serial_no }));
  const inHouseTeams: InHouseTeam[] = inHouseTeamsResult.data || [];
  const company: Company | null = companyResult.data || null;
  const allCompanies: Company[] = (allCompaniesResult.data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      phone: c.phone,
      email: c.email,
      attn: c.attn,
      bankName: c.bank_name,
      bankAccNo: c.bank_acc_no,
      bankAddress: c.bank_address,
  }));
  
  // Step 3: Calculate Serial Number Inventory
  const allIssuancesForCompany = allProjectsForSerialsResult.data?.flatMap(p => p.material_issuances) || [];
  const allReturnsForCompany = allProjectsForSerialsResult.data?.flatMap(p => p.material_returns) || [];
  const allDeliveries: DeliveryOrder[] = (deliveryOrdersResult.data || []).map((d: any) => ({ ...d, materialPurchaseOrderId: d.material_purchase_order_id, doNo: d.do_no }));
  const allMaterialPoItems: any[] = materialPurchaseOrdersResult.data?.flatMap((po: any) => po.items) || [];
  
  const poItemToSourceIdMap = new Map<string, string>();
  allMaterialPoItems.forEach(item => { if (item && item.id && item.sourceId) poItemToSourceIdMap.set(item.id, item.sourceId); });

  const serialInventory = new Map<string, Map<string, number>>();

  // 1. Add all received items from delivery orders to the inventory
  allDeliveries.forEach(delivery => {
      (delivery.items || []).forEach(item => {
          const sourceId = poItemToSourceIdMap.get(item.poItemId);
          if (sourceId) {
              if (!serialInventory.has(sourceId)) serialInventory.set(sourceId, new Map<string, number>());
              const serialsMap = serialInventory.get(sourceId)!;
              (item.serials || []).forEach(serial => {
                  const key = serial.serialNo || 'N/A';
                  serialsMap.set(key, (serialsMap.get(key) || 0) + (serial.quantity || 0));
              });
          }
      });
  });
  
  // 2. Subtract all issued items from the inventory
  allIssuancesForCompany.forEach(issuance => {
      (issuance.items || []).forEach(item => {
          if (serialInventory.has(item.sourceId)) {
              const serialsMap = serialInventory.get(item.sourceId)!;
              (item.serials || []).forEach(serial => {
                  const key = serial.serialNo || 'N/A';
                  serialsMap.set(key, (serialsMap.get(key) || 0) - (serial.quantity || 0));
              });
          }
      });
  });

  // 3. Add back all returned items to the inventory
  allReturnsForCompany.forEach(ret => {
      (ret.items || []).forEach(item => {
          if (serialInventory.has(item.sourceId)) {
              const serialsMap = serialInventory.get(item.sourceId)!;
              (item.serials || []).forEach(serial => {
                  const key = serial.serialNo || 'N/A';
                  serialsMap.set(key, (serialsMap.get(key) || 0) + (serial.quantity || 0));
              });
          }
      });
  });
  
  const allRequisitions = (companyMaterialRequisitionsResult.data || []).map(r => r.requisition_no);
  const allIssuances = (companyMaterialIssuancesResult.data || []).map(i => i.goods_issue_no);
  const allReturns = (companyMaterialReturnsResult.data || []).map(r => r.goods_return_no);

  return (
    <ProjectDetailView 
        initialProject={project} 
        initialPlantUnits={plantUnits} 
        initialInHouseTeams={inHouseTeams} 
        company={company} 
        allCompanies={allCompanies} 
        serialInventory={serialInventory}
        allRequisitions={allRequisitions}
        allIssuances={allIssuances}
        allReturns={allReturns}
    />
  );
}