
import { createClient } from "@/lib/supabase/server";
import type { Project, PlantUnit, Claim, Company, Contract } from "@/lib/types";
import ProjectList from "./components/project-list";

export default async function ProjectsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const supabase = await createClient();

  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select(`
      *,
      purchase_orders ( * ),
      daily_activity_logs ( work, site_instructions ),
      claims ( type, amount, status, retention_amount ),
      team_costs ( * ),
      material_issuances ( items ),
      material_returns ( items )
    `)
    .eq('company_id', companyId)
    .range(0, 10000);

  const { data: plantUnitsData } = await supabase
    .from('plant_units')
    .select('*')
    .eq('company_id', companyId)
    .range(0, 10000);

  const { data: directoryData } = await supabase
    .from('directory')
    .select('*')
    .order('name');
  
  const { data: contractsData } = await supabase
    .from('contracts')
    .select('*')
    .eq('company_id', companyId);


  if (projectsError) {
    console.error("Error fetching projects data:", projectsError);
    return <div>Error loading data. Please check server logs.</div>;
  }
  
  // OPTIMIZATION: Batch resolve linked project names/details to avoid N+1
  const subconProjects = projectsData?.filter(p => p.originating_project_id) || [];
  const originatingIds = Array.from(new Set(subconProjects.map(p => p.originating_project_id)));
  
  let originatingDetailsMap = new Map();
  if (originatingIds.length > 0) {
    const { data: originatingData } = await supabase
      .from('projects')
      .select('id, name, client, purchase_orders(id, po_no, type)')
      .in('id', originatingIds);
    
    originatingData?.forEach(p => originatingDetailsMap.set(p.id, p));
  }

  let projects: Project[] = (projectsData || []).map((p: any) => {
    const allClaims = (p.claims || []).map((claim: any) => ({ ...claim, claimNo: claim.claim_no, invoiceNo: claim.invoice_no, statusDates: claim.status_dates, isFinal: claim.is_final, hasRetention: claim.has_retention, retentionPercentage: claim.retention_percentage, retentionAmount: claim.retention_amount, claimedItems: claim.claimed_items, purchaseOrderId: claim.purchase_order_id, purchaseOrderNo: claim.purchase_order_no }));
    
    let projectName = p.name;
    const originatingData = originatingDetailsMap.get(p.originating_project_id);
    if (originatingData) {
        const clientPo = (originatingData.purchase_orders || []).find((po: any) => po.type === 'Client');
        projectName = `${originatingData.name} - ${originatingData.client}, ${clientPo?.po_no || ''}`;
    }

    return {
      id: p.id,
      companyId: p.company_id,
      name: projectName,
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
      originatingProjectId: p.originating_project_id,
      purchaseOrders: (p.purchase_orders || []).map((po: any) => ({ ...po, poNo: po.po_no, teamId: po.team_id, poDate: po.po_date, targetCompletionDate: po.target_completion_date, originatingPoId: po.originating_po_id })),
      dailyActivities: (p.daily_activity_logs || []).map((log: any) => ({ ...log, siteInstructions: log.site_instructions })),
      teamCosts: (p.team_costs || []).map((cost: any) => ({ ...cost, teamId: cost.team_id, petrolAndToll: cost.petrol_and_toll, siteExpenses: cost.site_expenses, machineryAndUpkeep: cost.machinery_and_upkeep })),
      materialIssuances: (p.material_issuances || []),
      materialReturns: (p.material_returns || []),
      materialRequisitions: [], 
      clientClaims: allClaims.filter((c: Claim) => c.type === 'Client'),
      subconClaims: allClaims.filter((c: Claim) => c.type === 'Subcontractor'),
      otherCosts: [],
      contractId: p.contract_id,
    };
  });

  const plantUnits: PlantUnit[] = (plantUnitsData || []).map(item => ({
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

  const directory: Company[] = (directoryData || []).map(item => ({
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
  
  const contracts: Contract[] = (contractsData || []).map((c: any) => ({
    id: c.id,
    companyId: c.company_id,
    contractNo: c.contract_no,
    title: c.title,
    clientName: c.client_name,
    value: c.value,
    startDate: c.start_date,
    endDate: c.end_date,
    status: c.status,
    projects: [],
  }));


  return (
    <ProjectList initialProjects={projects} plantUnits={plantUnits} directory={directory} contracts={contracts} />
  );
}
