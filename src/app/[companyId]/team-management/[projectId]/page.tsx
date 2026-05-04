

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProjectTeamCostView from "./components/project-team-cost-view";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Project, PlantUnit, Company, InHouseTeam } from "@/lib/types";

export default async function ProjectTeamCostPage({ params }: { params: Promise<{ companyId: string, projectId: string }> }) {
  const { companyId, projectId } = await params;
  const supabase = await createClient();
  
  const [projectResult, plantUnitsResult, companyResult, teamsResult] = await Promise.all([
    supabase
      .from('projects')
      .select('*, purchase_orders(*), team_costs(*), daily_activity_logs(id, date, work)')
      .eq('id', projectId)
      .single(),
    supabase
      .from('plant_units')
      .select('*')
      .eq('company_id', companyId),
    supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single(),
    supabase
        .from('in_house_teams')
        .select('*')
        .eq('company_id', companyId)
  ]);
  
  const { data: projectData, error } = projectResult;
  const { data: plantUnitsData, error: plantUnitsError } = plantUnitsResult;
  const { data: companyData, error: companyError } = companyResult;
  const { data: teamsData, error: teamsError } = teamsResult;


  if (error || !projectData || plantUnitsError || companyError || teamsError) {
    console.error("Error fetching data for team cost page:", error || plantUnitsError || companyError || teamsError);
    notFound();
  }

  // Correctly map the fetched data to the Project type
  const project: Project = {
    id: projectData.id,
    companyId: projectData.company_id,
    name: projectData.name,
    projectNo: projectData.projectno,
    client: projectData.client,
    supervisor: projectData.supervisor,
    planner: projectData.planner,
    status: projectData.status,
    budgetedCost: projectData.budgetedcost,
    actualCost: projectData.actualcost,
    revenue: projectData.revenue,
    progress: projectData.progress,
    startDate: projectData.startdate,
    targetCompletionDate: projectData.targetcompletiondate,
    actualCompletionDate: projectData.actualcompletiondate,
    clientBoq: projectData.clientboq || [],
    engineeringBoq: projectData.engineeringboq || [],
    materialBoq: projectData.materialboq || [],
    purchaseOrders: (projectData.purchase_orders || []).map((po: any) => ({ ...po, poNo: po.po_no, teamId: po.team_id, poDate: po.po_date, targetCompletionDate: po.target_completion_date, issuer: po.issuer })),
    teamCosts: (projectData.team_costs || []).map((cost: any) => ({ ...cost, teamId: cost.team_id, petrolAndToll: cost.petrol_and_toll, siteExpenses: cost.site_expenses, machineryAndUpkeep: cost.machinery_and_upkeep })),
    dailyActivities: (projectData.daily_activity_logs || []).map((log: any) => ({ ...log, work: log.work || [] })),
    // These are not needed for this specific page, so they can be empty arrays
    materialRequisitions: [],
    materialIssuances: [],
    materialReturns: [],
    clientClaims: [],
    subconClaims: [],
  };

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
  
  const company: Company | null = companyData;
  const teams: InHouseTeam[] = teamsData || [];

  return (
    <div className="flex flex-col h-full">
        <Header title={`Team Costs: ${project.name}`} />
        <main className="flex-1 p-4 md:p-6 space-y-6">
             <Link href={`/${params.companyId}/team-management?tab=project-costs`}>
                <Button variant="ghost" className="pl-0">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Team Management
                </Button>
            </Link>
            <ProjectTeamCostView initialProject={project} plantUnits={plantUnits} company={company} inHouseTeams={teams} />
        </main>
    </div>
    );
}
