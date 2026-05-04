
'use server'

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Project, PlantUnit, InHouseTeam, GeneralTeamCost, PurchaseOrder, ClientBoQItem, DailyActivityLog, Claim, MaterialRequisition, MaterialIssuance, MaterialReturn, TeamCost, DeliveryOrder, MaterialPurchaseOrder, SupplierInvoice, Company, MaterialOnSiteUsage, StockAdjustment, StockTake, StockTakeItem, OtherCost, Contract } from "@/lib/types";
import { revalidatePath } from "next/cache";

// This function safely creates the admin client only when needed.
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error("Server configuration error: Missing Supabase credentials for admin operations.");
    }
    
    return createSupabaseAdminClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
};

const sanitizeProjectData = (obj: any): any => {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.filter(item => item !== null && item !== undefined).map(sanitizeProjectData);
    }
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = sanitizeProjectData(obj[key]);
            }
        }
        return newObj;
    }
    if (typeof obj === 'number' && (isNaN(obj) || !isFinite(obj))) {
        return 0;
    }
    return obj;
};

export async function updateProject(project: Project) {
    const supabase = await createServerSupabaseClient();
    const adminSupabase = getSupabaseAdmin();
    
    const cleanProjectData = sanitizeProjectData(project);
    
    const { 
        name, projectNo, lorId, client, supervisor, planner, status, targetCompletionDate, actualCompletionDate,
        clientBoq, engineeringBoq, materialBoq, contractId, sstPercentage
    } = cleanProjectData;

    const { data: existingClient, error: findError } = await supabase
        .from('directory')
        .select('id')
        .eq('name', client)
        .maybeSingle();

    if (findError) {
        console.error('Error checking for client in directory:', findError);
        throw new Error('Could not verify client in directory.');
    }

    if (!existingClient) {
        const { error: insertError } = await supabase
        .from('directory')
        .insert({ name: client });

        if (insertError) {
        console.error('Error adding new client to directory:', insertError);
        throw new Error('Failed to add new client to directory.');
        }
        revalidatePath(`/${project.companyId}/directory`);
    }

    const dataToUpdate = {
        name,
        projectno: projectNo,
        lor_id: lorId,
        client,
        supervisor,
        planner,
        status,
        targetcompletiondate: targetCompletionDate,
        actualcompletiondate: actualCompletionDate,
        clientboq: clientBoq,
        engineeringboq: engineeringBoq,
        materialboq: materialBoq,
        contract_id: contractId,
        sst_percentage: sstPercentage,
    };
    
    const { error } = await supabase
        .from('projects')
        .update(dataToUpdate)
        .eq('id', project.id);

    if (error) {
        console.error("Error updating project details:", error);
        throw new Error(`Failed to update project details: ${error.message}`);
    }
    
    const { data: linkedProjects, error: linkedProjectsError } = await adminSupabase
        .from('projects')
        .select('id')
        .eq('originating_project_id', project.id);

    if (linkedProjects && linkedProjects.length > 0) {
        const { data: mainCompany } = await supabase.from('companies').select('name').eq('id', project.companyId).single();
        const clientPo = (project.purchaseOrders || []).find(po => po.type === 'Client');
        
        const newLinkedProjectName = `${project.name} - ${project.client}, ${clientPo?.po_no || ''}`;
        
        const linkedProjectUpdates = {
            name: newLinkedProjectName,
            supervisor: project.supervisor,
            planner: project.planner,
            targetcompletiondate: project.targetCompletionDate,
            client: mainCompany?.name || 'Main Contractor',
        };

        await adminSupabase
            .from('projects')
            .update(linkedProjectUpdates)
            .in('id', linkedProjects.map(p => p.id));
    }
    
    revalidatePath(`/${project.companyId}/projects`);
    revalidatePath(`/${project.companyId}/projects/${project.id}`);
}

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error("Login error:", error.message);
    return redirect('/login?message=Could not authenticate user')
  }

  console.log("Login successful for user:", email);
  return redirect('/select-company')
}

export async function logout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut()
  return redirect('/login')
}

export async function addProject(
  projectData: Omit<Project, 'id' | 'companyId'>,
  companyId: string
): Promise<Project> {
  const supabase = await createServerSupabaseClient();

  const cleanProjectData = sanitizeProjectData(projectData);

  const { data: existingClient, error: findError } = await supabase
    .from('directory')
    .select('id')
    .eq('name', cleanProjectData.client)
    .single();

  if (!existingClient) {
    await supabase.from('directory').insert({ name: cleanProjectData.client });
    revalidatePath(`/${companyId}/directory`);
  }

  const dataToInsert = {
    company_id: companyId,
    name: cleanProjectData.name,
    projectno: cleanProjectData.projectNo,
    lor_id: cleanProjectData.lorId,
    client: cleanProjectData.client,
    supervisor: cleanProjectData.supervisor,
    planner: cleanProjectData.planner,
    status: cleanProjectData.status,
    budgetedcost: cleanProjectData.budgetedCost,
    actualcost: cleanProjectData.actualCost,
    revenue: cleanProjectData.revenue,
    progress: cleanProjectData.progress,
    startdate: cleanProjectData.startDate,
    targetcompletiondate: cleanProjectData.targetCompletionDate,
    actualcompletiondate: cleanProjectData.actualCompletionDate,
    clientboq: cleanProjectData.clientBoq,
    engineeringboq: cleanProjectData.engineeringBoq,
    materialboq: cleanProjectData.materialBoq,
    contract_id: cleanProjectData.contractId
  };

  const { data: newProject, error } = await supabase.from('projects').insert([dataToInsert]).select().single();

  if (error || !newProject) {
    console.error('Error adding project:', error?.message);
    throw new Error(`Failed to create new project: ${error?.message}`);
  }

  revalidatePath(`/${companyId}/projects`);
  
  const createdProject: Project = {
    id: newProject.id,
    companyId: newProject.company_id,
    name: newProject.name,
    projectNo: newProject.projectno,
    lorId: newProject.lor_id,
    client: newProject.client,
    supervisor: newProject.supervisor,
    planner: newProject.planner,
    status: newProject.status,
    budgetedCost: newProject.budgetedcost,
    actualCost: newProject.actualcost,
    revenue: newProject.revenue,
    progress: newProject.progress,
    startDate: newProject.startdate,
    targetCompletionDate: newProject.targetcompletiondate,
    actualCompletionDate: newProject.actualcompletiondate,
    clientBoq: newProject.clientboq || [],
    engineeringBoq: newProject.engineeringboq || [],
    materialBoq: newProject.materialboq || [],
    purchaseOrders: [],
    dailyActivities: [],
    materialRequisitions: [],
    materialIssuances: [],
    materialReturns: [],
    clientClaims: [],
    subconClaims: [],
    teamCosts: [],
    otherCosts: [],
  };
  return createdProject;
}

export async function deleteProject(projectId: string, companyId: string) {
    try {
        const adminSupabase = getSupabaseAdmin();

        const { data: linkedProjects } = await adminSupabase
            .from('projects')
            .select('id')
            .eq('originating_project_id', projectId);
        
        if (linkedProjects && linkedProjects.length > 0) {
            await adminSupabase.from('projects').delete().in('id', linkedProjects.map(p => p.id));
        }

        await adminSupabase.from('projects').delete().eq('id', projectId);
        revalidatePath(`/${companyId}/projects`);
    } catch (error) {
        console.error("Error deleting project:", error);
        throw error;
    }
}


export async function addPlantUnit(plantUnitData: Omit<PlantUnit, 'id' | 'companyId'>, companyId: string) {
    try {
        const supabase = await createServerSupabaseClient();
        const dataToInsert = {
            pu_id: plantUnitData.puId,
            description: plantUnitData.description,
            category: plantUnitData.category,
            unit: plantUnitData.unit,
            rate: plantUnitData.rate,
            client_name: plantUnitData.clientName,
            contract_id: plantUnitData.contractId,
            material_management_fee: plantUnitData.materialManagementFee,
            has_serial_no: plantUnitData.hasSerialNo,
            company_id: companyId
        };
        const { error } = await supabase.from('plant_units').insert(dataToInsert);
        if (error) throw new Error(`Failed to create new plant unit: ${error.message}`);
        revalidatePath(`/${companyId}/plant-units`);
    } catch (error) {
        console.error("Error adding plant unit:", error);
        throw error;
    }
}

export async function updatePlantUnit(plantUnitData: PlantUnit) {
    try {
        const supabase = await createServerSupabaseClient();
        const dataToUpdate = {
            pu_id: plantUnitData.puId,
            description: plantUnitData.description,
            category: plantUnitData.category,
            unit: plantUnitData.unit,
            rate: plantUnitData.rate,
            client_name: plantUnitData.clientName,
            contract_id: plantUnitData.contractId,
            material_management_fee: plantUnitData.materialManagementFee,
            has_serial_no: plantUnitData.hasSerialNo,
        };
        const { error } = await supabase.from('plant_units').update(dataToUpdate).eq('id', plantUnitData.id);
        if (error) throw new Error(`Failed to update plant unit: ${error.message}`);
        revalidatePath(`/${plantUnitData.companyId}/plant-units`);
    } catch (error) {
        console.error("Error updating plant unit:", error);
        throw error;
    }
}

export async function deletePlantUnit(plantUnitId: string, companyId: string) {
    try {
        const supabase = await createServerSupabaseClient();
        const { error } = await supabase.from('plant_units').delete().eq('id', plantUnitId);
        if (error) throw new Error(`Failed to delete plant unit: ${error.message}`);
        revalidatePath(`/${companyId}/plant-units`);
    } catch (error) {
        console.error("Error deleting plant unit:", error);
        throw error;
    }
}

export async function addOrUpdateTeam(teamData: InHouseTeam, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const isNewTeam = !teamData.id || teamData.id.startsWith('team-');
    const dataToUpsert = {
        id: isNewTeam ? undefined : teamData.id,
        name: teamData.name,
        members: teamData.members,
        company_id: companyId,
    };
    const { error } = await supabase.from('in_house_teams').upsert(dataToUpsert).select().single();
    if (error) throw new Error(`Failed to save team: ${error.message}`);
    revalidatePath(`/${companyId}/team-management`);
}


export async function deleteTeam(teamId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('in_house_teams').delete().eq('id', teamId);
    if (error) throw new Error(`Failed to delete team: ${error.message}`);
    revalidatePath(`/${companyId}/team-management`);
}

export async function addOrUpdateGeneralCost(costData: Partial<GeneralTeamCost>, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const isNew = !costData.id;
    if (isNew) {
        const { data: existing } = await supabase.from('general_team_costs').select('id').eq('team_id', costData.teamId!).eq('month', costData.month!).maybeSingle();
        if (existing) throw new Error('A general cost entry for this team and month already exists.');
        const { error } = await supabase.from('general_team_costs').insert({
            team_id: costData.teamId,
            month: costData.month,
            ppe: costData.ppe,
            vehicle_upkeep: costData.vehicleUpkeep,
            other: costData.other,
            company_id: companyId,
        });
        if (error) throw new Error(`Failed to save new general cost: ${error.message}`);
    } else {
        const { error } = await supabase.from('general_team_costs').update({
            ppe: costData.ppe,
            vehicle_upkeep: costData.vehicleUpkeep,
            other: costData.other,
        }).eq('id', costData.id!);
        if (error) throw new Error(`Failed to update general cost: ${error.message}`);
    }
    revalidatePath(`/${companyId}/team-management`);
}

export async function deleteGeneralCost(costId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('general_team_costs').delete().eq('id', costId);
    if (error) throw new Error(`Failed to delete general cost: ${error.message}`);
    revalidatePath(`/${companyId}/team-management`);
}

export async function addOrUpdateDirectoryEntry(companyData: Partial<Company>, userCompanyId: string) {
    const supabase = await createServerSupabaseClient();
    const dataToUpsert = {
        id: companyData.id,
        name: companyData.name,
        email: companyData.email,
        phone: companyData.phone,
        address: companyData.address,
        attn: companyData.attn,
        bank_name: companyData.bankName,
        bank_acc_no: companyData.bankAccNo,
        bank_address: companyData.bankAddress,
    };
    const { error } = await supabase.from('directory').upsert(dataToUpsert);
    if (error) throw new Error(`Database Error: ${error.message}`);
    revalidatePath(`/${userCompanyId}/directory`);
}

export async function deleteDirectoryEntry(companyId: string) {
    try {
        const supabase = await createServerSupabaseClient();
        const { error } = await supabase.from('directory').delete().eq('id', companyId);
        if (error) throw new Error(`Failed to delete directory entry: ${error.message}`);
    } catch (error) {
        console.error("Error deleting directory entry:", error);
        throw error;
    }
}

export async function addOrUpdateContract(contractData: Partial<Contract>, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const isNew = !contractData.id;
    if (contractData.clientName) {
        const { data: existingClient } = await supabase.from('directory').select('id').eq('name', contractData.clientName).maybeSingle();
        if (!existingClient) {
            await supabase.from('directory').insert({ name: contractData.clientName });
            revalidatePath(`/${companyId}/directory`);
        }
    }
    const dataToUpsert = {
        id: isNew ? undefined : contractData.id,
        company_id: companyId,
        contract_no: contractData.contract_no,
        title: contractData.title,
        client_name: contractData.clientName,
        value: contractData.value,
        start_date: contractData.startDate,
        end_date: contractData.endDate,
        status: contractData.status,
    };
    const { error } = await supabase.from('contracts').upsert(dataToUpsert);
    if (error) throw new Error(`Failed to save contract: ${error.message}`);
    revalidatePath(`/${companyId}/contracts`);
}

export async function deleteContract(contractId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('contracts').delete().eq('id', contractId);
    if (error) throw new Error(`Failed to delete contract: ${error.message}`);
    revalidatePath(`/${companyId}/contracts`);
}

// OPTIMIZED PO SAVE ACTION
export async function addOrUpdatePurchaseOrder(poData: PurchaseOrder, projectId: string | null, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const adminSupabase = getSupabaseAdmin();
    
    // 1. Parallelize initial checks
    const [subconCheck, mainCompanyCheck, projectStatusCheck] = await Promise.all([
        poData.type === 'Subcontractor' && poData.issuer 
            ? supabase.from('companies').select('id').eq('name', poData.issuer).maybeSingle()
            : Promise.resolve({ data: null }),
        supabase.from('companies').select('name').eq('id', companyId).single(),
        projectId ? supabase.from('projects').select('status, name, projectno, supervisor, planner, targetcompletiondate, engineeringboq, materialboq, client').eq('id', projectId).single() : Promise.resolve({ data: null })
    ]);

    const subconCompanyId = subconCheck.data?.id || null;
    const isNew = !poData.id || poData.id.startsWith('po-');

    const dataToUpsert = {
        id: isNew ? undefined : poData.id,
        project_id: projectId,
        company_id: companyId,
        type: poData.type,
        po_no: poData.poNo,
        po_date: poData.poDate,
        target_completion_date: poData.targetCompletionDate,
        issuer: poData.issuer,
        subcontractor_company_id: subconCompanyId,
        team_id: poData.teamId,
        items: poData.items,
        sst_percentage: poData.sstPercentage,
    };

    const { data: savedPo, error } = await supabase.from('purchase_orders').upsert(dataToUpsert).select().single();
    if (error) throw new Error(`Database Error: ${error.message}`);

    // 2. Optimized Subcon Project Creation
    if (projectId && poData.type === 'Subcontractor' && subconCompanyId && savedPo) {
        const { data: existingLinkedProject } = await adminSupabase.from('projects').select('id').eq('originating_project_id', projectId).eq('company_id', subconCompanyId).maybeSingle();

        let linkedProjectId = existingLinkedProject?.id;
        if (!linkedProjectId && projectStatusCheck.data) {
            const mainProject = projectStatusCheck.data;
            const { data: clientPo } = await supabase.from('purchase_orders').select('po_no').eq('project_id', projectId).eq('type', 'Client').limit(1).maybeSingle();
            
            const newProjectData = {
                company_id: subconCompanyId,
                name: `${mainProject.name} - ${mainProject.client}, ${clientPo?.po_no || ''}`,
                projectno: mainProject.projectno,
                supervisor: mainProject.supervisor,
                planner: mainProject.planner,
                targetcompletiondate: mainProject.targetcompletiondate,
                client: mainCompanyCheck.data?.name || 'Main Contractor',
                status: 'Implementation' as const,
                engineeringboq: mainProject.engineeringboq || [],
                materialboq: mainProject.materialboq || [],
                originating_project_id: projectId,
            };
            const { data: newProject } = await adminSupabase.from('projects').insert(newProjectData).select('id').single();
            linkedProjectId = newProject?.id;
        }

        if (linkedProjectId) {
            const { data: existingLinkedPo } = await adminSupabase.from('purchase_orders').select('id').eq('originating_po_id', savedPo.id).maybeSingle();
            const linkedPoData = {
                id: existingLinkedPo?.id,
                project_id: linkedProjectId,
                company_id: subconCompanyId,
                type: 'Client' as const,
                po_no: savedPo.po_no,
                po_date: savedPo.po_date,
                target_completion_date: savedPo.target_completion_date,
                issuer: mainCompanyCheck.data?.name || 'Main Contractor',
                items: savedPo.items.map((item: any) => ({ ...item, sourceType: 'boq' })),
                originating_project_id: projectId,
                originating_po_id: savedPo.id,
            };
            await adminSupabase.from('purchase_orders').upsert(linkedPoData);
        }
    }

    if (projectId) {
        revalidatePath(`/${companyId}/projects/${projectId}`);
    }
    revalidatePath(`/${companyId}/material-management`);
    return savedPo;
}


export async function deletePurchaseOrder(poId: string, companyId: string, projectId: string) {
    const supabase = await createServerSupabaseClient();
    await supabase.from('purchase_orders').delete().eq('id', poId);
    revalidatePath(`/${companyId}/projects/${projectId}`);
}

export async function addOrUpdateDailyLog(logData: DailyActivityLog, projectId: string, companyId: string, selectedPoId: string | null, selectedTeamId?: string | null) {
    const supabase = await createServerSupabaseClient();
    const isNewLog = !logData.id || logData.id.startsWith('dalog-');

    if (isNewLog) {
        const dataToInsert = {
            project_id: projectId,
            date: logData.date,
            description: logData.description,
            work: logData.work,
            site_instructions: logData.siteInstructions,
        };
        await supabase.from('daily_activity_logs').insert(dataToInsert);
    } else {
        const { data: existingLog } = await supabase.from('daily_activity_logs').select('*').eq('id', logData.id).single();
        if (!existingLog) throw new Error("The log could not be found.");

        let finalWork: DailyActivityWork[] = existingLog.work || [];
        if (selectedPoId) {
            const { data: po } = await supabase.from('purchase_orders').select('items').eq('id', selectedPoId).single();
            const poItemIds = new Set((po?.items || []).map((i: any) => i.id));
            finalWork = finalWork.filter(w => !poItemIds.has(w.boqItemId));
            finalWork.push(...logData.work);
        } else if (selectedTeamId) {
            finalWork = finalWork.filter(w => w.teamId !== selectedTeamId);
            finalWork.push(...logData.work);
        }

        await supabase.from('daily_activity_logs').update({ 
            work: finalWork, 
            site_instructions: logData.siteInstructions, 
            date: logData.date, 
            description: logData.description 
        }).eq('id', logData.id);
    }
    revalidatePath(`/${companyId}/projects/${projectId}`);
}


export async function deleteDailyLogForPO(logId: string, projectId: string, companyId: string, selectedPoId: string | null, selectedTeamId?: string | null) {
    const supabase = await createServerSupabaseClient();
    const { data: log } = await supabase.from('daily_activity_logs').select('*').eq('id', logId).single();
    if (!log) return;
    
    let remainingWork = log.work || [];
    let remainingSIs = log.site_instructions || [];

    if (selectedPoId && selectedPoId !== 'unlinked') {
        const { data: po } = await supabase.from('purchase_orders').select('items').eq('id', selectedPoId).single();
        const selectedPoItemIds = new Set((po?.items || []).map((item: any) => item.id));
        remainingWork = remainingWork.filter((w: any) => !selectedPoItemIds.has(w.boqItemId));
        remainingSIs = remainingSIs.filter((si: any) => si.purchaseOrderId !== selectedPoId);
    } else if (selectedPoId === 'unlinked') {
        remainingSIs = remainingSIs.filter((si: any) => si.purchaseOrderId || si.context !== 'Client');
    } else if (selectedTeamId) {
        remainingWork = remainingWork.filter((w: any) => w.teamId !== selectedTeamId);
        remainingSIs = remainingSIs.filter((si: any) => si.teamId !== selectedTeamId);
    }
    
    if (remainingWork.length === 0 && remainingSIs.length === 0) {
        await supabase.from('daily_activity_logs').delete().eq('id', logId);
    } else {
        await supabase.from('daily_activity_logs').update({ work: remainingWork, site_instructions: remainingSIs }).eq('id', logId);
    }
    revalidatePath(`/${companyId}/projects/${projectId}`);
}

export async function addOrUpdateMaterialRequisition(reqData: MaterialRequisition, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const isNew = !reqData.id || reqData.id.startsWith('mr-');
    const dataToUpsert = {
        id: isNew ? undefined : reqData.id,
        project_id: projectId,
        requisition_no: reqData.requisitionNo,
        date: reqData.date,
        items: reqData.items,
    };
    await supabase.from('material_requisitions').upsert(dataToUpsert);
    revalidatePath(`/${companyId}/projects/${projectId}`);
}


export async function deleteMaterialRequisition(id: string, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    await supabase.from('material_requisitions').delete().eq('id', id);
    revalidatePath(`/${companyId}/projects/${projectId}`);
}

export async function addOrUpdateMaterialIssuance(issuanceData: MaterialIssuance, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const isNew = !issuanceData.id || issuanceData.id.startsWith('mi-');
    const dataToUpsert = {
        id: isNew ? undefined : issuanceData.id,
        project_id: projectId,
        goods_issue_no: issuanceData.goodsIssueNo,
        date: issuanceData.date,
        items: issuanceData.items,
    };
    await supabase.from('material_issuances').upsert(dataToUpsert);
    revalidatePath(`/${companyId}/projects/${projectId}`);
}

export async function deleteMaterialIssuance(id: string, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    await supabase.from('material_issuances').delete().eq('id', id);
    revalidatePath(`/${companyId}/projects/${projectId}`);
}

export async function addOrUpdateMaterialReturn(returnData: MaterialReturn, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const isNew = !returnData.id || returnData.id.startsWith('mr-ret-');
    const dataToUpsert = {
        id: isNew ? undefined : returnData.id,
        project_id: projectId,
        goods_return_no: returnData.goodsReturnNo,
        date: returnData.date,
        items: returnData.items,
    };
    await supabase.from('material_returns').upsert(dataToUpsert);
    revalidatePath(`/${companyId}/projects/${projectId}`);
}

export async function deleteMaterialReturn(id: string, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    await supabase.from('material_returns').delete().eq('id', id);
    revalidatePath(`/${companyId}/projects/${projectId}`);
}

export async function addOrUpdateTeamCost(costData: TeamCost, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const isNew = !costData.id || costData.id.startsWith('tc-');
    if (isNew) {
        await supabase.from('team_costs').insert({
            project_id: projectId,
            team_id: costData.teamId,
            month: costData.month,
            salary: costData.salary,
            petrol_and_toll: costData.petrolAndToll,
            site_expenses: costData.siteExpenses,
            machinery_and_upkeep: costData.machineryAndUpkeep,
            company_id: companyId,
        });
    } else {
        await supabase.from('team_costs').update({
            salary: costData.salary,
            petrol_and_toll: costData.petrolAndToll,
            site_expenses: costData.siteExpenses,
            machinery_and_upkeep: costData.machineryAndUpkeep,
        }).eq('id', costData.id);
    }
    revalidatePath(`/${companyId}/team-management/${projectId}`);
}

export async function deleteTeamCost(id: string, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    await supabase.from('team_costs').delete().eq('id', id);
    revalidatePath(`/${companyId}/projects/${projectId}`);
    revalidatePath(`/${companyId}/team-management`);
}

export async function addOrUpdateClaim(claimData: Claim, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const isNew = !claimData.id || claimData.id.startsWith('claim-');
    const dataToUpsert = {
        id: isNew ? undefined : claimData.id,
        project_id: projectId,
        purchase_order_id: claimData.purchaseOrderId,
        type: claimData.type,
        claim_no: claimData.claimNo,
        invoice_no: claimData.invoiceNo,
        date: claimData.date,
        amount: claimData.amount,
        status: claimData.status,
        status_dates: claimData.statusDates,
        is_final: claimData.isFinal,
        has_retention: claimData.hasRetention,
        retention_percentage: claimData.retentionPercentage,
        retention_amount: claimData.retentionAmount,
        sst_percentage: claimData.sstPercentage,
        sst_amount: claimData.sstAmount,
        claimed_items: claimData.claimedItems,
    };
    await supabase.from('claims').upsert(dataToUpsert);
    if (claimData.type === 'Client' && claimData.isFinal) {
        await supabase.from('projects').update({ status: 'Completed', actualcompletiondate: claimData.date }).eq('id', projectId);
    }
    revalidatePath(`/${companyId}/projects/${projectId}`);
    revalidatePath(`/${companyId}/invoicing`);
}

export async function deleteClaim(claimId: string, projectId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    await supabase.from('claims').delete().eq('id', claimId);
    revalidatePath(`/${companyId}/projects/${projectId}`);
}


export async function addOrUpdateMaterialPurchaseOrder(poData: MaterialPurchaseOrder, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const dataToUpsert = {
        id: poData.id.startsWith('mpo-') ? undefined : poData.id,
        company_id: companyId,
        po_no: poData.poNo,
        po_date: poData.poDate,
        supplier: poData.supplier,
        items: poData.items,
        ref_quotation_no: poData.refQuotationNo,
        project_id: (poData.projectId === '' || !poData.projectId) ? null : poData.projectId,
        project_name: poData.projectName,
        project_no: poData.projectNo,
        project_po_no: poData.projectPoNo,
        delivery_cost: poData.deliveryCost,
        sst_percentage: poData.sstPercentage,
        include_delivery_in_sst: poData.includeDeliveryInSst,
    };
    await supabase.from('material_purchase_orders').upsert(dataToUpsert);
    revalidatePath(`/${companyId}/material-management`);
}

export async function deleteMaterialPurchaseOrder(poId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    await supabase.from('material_purchase_orders').delete().eq('id', poId);
    revalidatePath(`/${companyId}/material-management`);
}

export async function addOrUpdateDeliveryOrder(doData: DeliveryOrder, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const dataToUpsert = {
        id: doData.id.startsWith('do-') ? undefined : doData.id,
        company_id: companyId,
        material_purchase_order_id: doData.materialPurchaseOrderId,
        do_no: doData.doNo,
        date: doData.date,
        supplier: doData.supplier,
        items: doData.items,
    };
    await supabase.from('delivery_orders').upsert(dataToUpsert);
    revalidatePath(`/${companyId}/material-management`);
}

export async function deleteDeliveryOrder(doId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    await supabase.from('delivery_orders').delete().eq('id', doId);
    revalidatePath(`/${companyId}/material-management`);
}

export async function addOrUpdateSupplierInvoice(invoiceData: SupplierInvoice, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const isNew = !invoiceData.id || invoiceData.id.startsWith('si-');
    const dataToUpsert: any = {
        id: isNew ? undefined : invoiceData.id,
        company_id: companyId,
        invoice_no: invoiceData.invoiceNo,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,
        supplier: invoiceData.supplier,
        material_purchase_order_id: invoiceData.materialPurchaseOrderId,
        delivery_order_ids: invoiceData.deliveryOrderIds,
        amount: invoiceData.amount,
        status: invoiceData.status,
    };
    await supabase.from('supplier_invoices').upsert(dataToUpsert);
    revalidatePath(`/${companyId}/material-management`);
    revalidatePath(`/${companyId}/invoicing`);
}

export async function deleteSupplierInvoice(invoiceId: string, companyId: string) {
    const supabase = await createServerSupabaseClient();
    await supabase.from('supplier_invoices').delete().eq('id', invoiceId);
    revalidatePath(`/${companyId}/material-management`);
    revalidatePath(`/${companyId}/invoicing`);
}

export async function addOrUpdateStockAdjustments(adjustments: Omit<StockAdjustment, 'id' | 'created_at' | 'adjustmentDate'>[]) {
    const supabase = await createServerSupabaseClient();
    const adjustmentDate = new Date().toISOString().split('T')[0];
    const dataToUpsert = adjustments.map(adj => ({
        company_id: adj.companyId,
        source_id: adj.sourceId,
        quantity: adj.quantity,
        adjustment_date: adjustmentDate,
        serials: adj.serials,
    }));
    await supabase.from('stock_adjustments').upsert(dataToUpsert, { onConflict: 'company_id,source_id,adjustment_date' });
    revalidatePath(`/${adjustments[0].companyId}/material-management`);
}

export async function addOrUpdateStockTake(stockTake: StockTake, companyId: string) {
    const supabase = await createServerSupabaseClient();
    const adminSupabase = getSupabaseAdmin();
    const isNew = stockTake.id.startsWith('st-');
    const { data: savedST } = await supabase.from('stock_takes').upsert({ id: isNew ? undefined : stockTake.id, name: stockTake.name, take_date: stockTake.takeDate, company_id: companyId }).select('id').single();
    if (savedST) {
        if (!isNew) await adminSupabase.from('stock_take_items').delete().eq('stock_take_id', savedST.id);
        const itemsToInsert = stockTake.items.map(item => ({ stock_take_id: savedST.id, source_id: item.sourceId, counted_quantity: item.countedQuantity, serials: item.serials }));
        if (itemsToInsert.length > 0) await adminSupabase.from('stock_take_items').insert(itemsToInsert);
    }
    revalidatePath(`/${companyId}/material-management?tab=stock-take`);
}


export async function deleteStockTake(stockTakeId: string, companyId: string) {
    const supabase = createServerSupabaseClient();
    await supabase.from('stock_takes').delete().eq('id', stockTakeId);
    revalidatePath(`/${companyId}/material-management`);
}

export async function addOrUpdateOnSiteUse(data: Pick<MaterialOnSiteUsage, 'projectId' | 'companyId' | 'sourceId' | 'quantity'>) {
    const supabase = createServerSupabaseClient();
    const { projectId, companyId, sourceId, quantity } = data;
    const { data: existing } = await supabase.from('material_on_site_usage').select('id').eq('project_id', projectId).eq('source_id', sourceId).maybeSingle();
    if (existing) {
        await supabase.from('material_on_site_usage').update({ quantity }).eq('id', existing.id);
    } else {
        await supabase.from('material_on_site_usage').insert({ project_id: projectId, company_id: companyId, source_id: sourceId, quantity: quantity });
    }
    revalidatePath(`/${companyId}/projects/${projectId}`);
}

export async function addOrUpdateOtherCost(costData: OtherCost, projectId: string, companyId: string) {
    const supabase = createServerSupabaseClient();
    const isNew = !costData.id || costData.id.startsWith('oc-');
    const dataToUpsert = {
        id: isNew ? undefined : costData.id,
        project_id: projectId,
        company_id: companyId,
        category: costData.category,
        description: costData.description,
        cost: costData.cost,
        start_date: costData.startDate,
        end_date: costData.endDate,
        expiry_date: costData.expiryDate,
        quotation_no: costData.quotationNo,
        purchase_order_no: costData.purchaseOrderNo,
        invoice_no: costData.invoiceNo,
    };
    await supabase.from('other_costs').upsert(dataToUpsert);
    revalidatePath(`/${companyId}/projects/${projectId}`);
}

export async function deleteOtherCost(costId: string, companyId: string) {
    const supabase = createServerSupabaseClient();
    await supabase.from('other_costs').delete().eq('id', costId);
    revalidatePath(`/${companyId}/projects`);
}
