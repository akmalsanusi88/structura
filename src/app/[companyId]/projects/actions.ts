

'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import type { Project } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const sanitizeProjectData = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== null && item !== undefined)
      .map(sanitizeProjectData);
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

export async function addProject(
  projectData: Omit<Project, 'id' | 'companyId'>,
  companyId: string
): Promise<Project> {
  const supabase = await createClient();

  const cleanProjectData = sanitizeProjectData(projectData);

  // Check if client exists in directory, if not, add it.
  const { data: existingClient, error: findError } = await supabase
    .from('directory')
    .select('id')
    .eq('name', cleanProjectData.client)
    .single();

  if (findError && findError.code !== 'PGRST116') { // 'PGRST116' is "exact one row not found"
    console.error('Error checking for client in directory:', findError);
    throw new Error('Could not verify client in directory.');
  }

  if (!existingClient) {
    const { error: insertError } = await supabase
      .from('directory')
      .insert({ name: cleanProjectData.client });

    if (insertError) {
      console.error('Error adding new client to directory:', insertError);
      throw new Error('Failed to add new client to directory.');
    }
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
  };
  return createdProject;
}
