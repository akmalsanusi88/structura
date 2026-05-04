
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import TeamManagementPageClient from "./components/team-management-client";
import type { Project, InHouseTeam, PlantUnit, GeneralTeamCost, DailyActivityWork, SiteInstruction, Claim } from "@/lib/types";

export default async function TeamManagementPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const supabase = await createClient();
  
  const [
    projectsRes, 
    teamsRes, 
    plantUnitsRes, 
    generalCostsRes, 
    companyRes
  ] = await Promise.all([
    supabase.from('projects').select('*, purchase_orders(*), daily_activity_logs(*), team_costs(*), claims(*)').eq('company_id', companyId).range(0, 10000),
    supabase.from('in_house_teams').select('*').eq('company_id', companyId),
    supabase.from('plant_units').select('*').eq('company_id', companyId).range(0, 10000),
    supabase.from('general_team_costs').select('*').eq('company_id', companyId),
    supabase.from('companies').select('name').eq('id', companyId).single(),
  ]);

  const errors = [projectsRes.error, teamsRes.error, plantUnitsRes.error, generalCostsRes.error, companyRes.error].filter(Boolean);
  if (errors.length > 0) {
    console.error("Error fetching data for team management:", errors);
    notFound();
  }
  
  const projects: Project[] = (projectsRes.data || []).map((p: any) => {
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
          purchaseOrders: (p.purchase_orders || []).map((po: any) => ({ ...po, projectId: po.project_id, poDate: po.po_date, targetCompletionDate: po.target_completion_date, teamId: po.team_id, originatingProjectId: po.originating_project_id, originatingPoId: po.originating_po_id, poNo: po.po_no })),
          dailyActivities: (p.daily_activity_logs || []).map((log: any) => ({
              id: log.id,
              date: log.date,
              work: (log.work || []).map((w: any): DailyActivityWork => ({
                  id: w.id,
                  boqItemId: w.boqItemId,
                  quantity: w.quantity,
                  teamId: w.teamId,
              })),
              siteInstructions: [], // Not needed on this page
          })),
          teamCosts: (p.team_costs || []).map((cost: any) => ({ ...cost, projectId: cost.project_id, teamId: cost.team_id, petrolAndToll: cost.petrol_and_toll, siteExpenses: cost.site_expenses, machineryAndUpkeep: cost.machinery_and_upkeep })),
          materialRequisitions: [],
          materialIssuances: [],
          materialReturns: [],
          clientClaims: allClaims.filter((c: Claim) => c.type === 'Client'),
          subconClaims: allClaims.filter((c: Claim) => c.type === 'Subcontractor'),
      }
  });
  
  const teams: InHouseTeam[] = teamsRes.data || [];
  
  const plantUnits: PlantUnit[] = (plantUnitsRes.data || []).map(item => ({
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
  
  const generalCosts: GeneralTeamCost[] = (generalCostsRes.data || []).map((gc: any) => ({
      id: gc.id,
      teamId: gc.team_id,
      companyId: gc.company_id,
      month: gc.month,
      ppe: gc.ppe,
      vehicleUpkeep: gc.vehicle_upkeep,
      other: gc.other
  }));
  
  const companyName = companyRes.data?.name || 'Structura';

  return (
    <TeamManagementPageClient 
      projects={projects}
      teams={teams}
      plantUnits={plantUnits}
      generalCosts={generalCosts}
      companyName={companyName}
    />
  );
}
