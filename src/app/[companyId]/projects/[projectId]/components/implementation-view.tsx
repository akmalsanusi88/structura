
'use client';
import type { Project, PlantUnit, Company, InHouseTeam, SiteInstruction } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DailyActivityView from "./daily-activity-view";
import AsBuiltSummaryView from "./as-built-summary-view";
import MaterialSettlementView from "./material-settlement-view";
import { useState, useMemo, useEffect } from "react";
import TeamDailyActivityView from "./team-daily-activity-view";
import TeamAsBuiltSummaryView from "./team-as-built-summary-view";

interface ImplementationViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
    saveProjectDetails: () => Promise<void>;
    plantUnits: PlantUnit[];
    company?: Company | null;
    allCompanies: Company[];
    serialInventory: Map<string, Map<string, number>>;
    inHouseTeams: InHouseTeam[];
    allRequisitions: string[];
    allIssuances: string[];
    allReturns: string[];
}

export default function ImplementationView({ project, setProject, saveProjectDetails, plantUnits, company, allCompanies, serialInventory, inHouseTeams, allRequisitions, allIssuances, allReturns }: ImplementationViewProps) {
    const [selectedClientPoId, setSelectedClientPoId] = useState<string>('');
    const [selectedSubconPoId, setSelectedSubconPoId] = useState<string>('');
    
    const clientPOs = useMemo(() => project.purchaseOrders.filter(po => po.type === 'Client'), [project.purchaseOrders]);
    const subconPOs = useMemo(() => project.purchaseOrders.filter(po => po.type === 'Subcontractor'), [project.purchaseOrders]);
    
    const teamsWithWork = useMemo(() => {
        const teamIdsWithWork = new Set<string>();
        (project.dailyActivities || []).forEach(log => {
            log.work.forEach(w => {
                if (w.teamId) {
                    teamIdsWithWork.add(w.teamId);
                }
            });
        });
        return inHouseTeams.filter(t => teamIdsWithWork.has(t.id));
    }, [project.dailyActivities, inHouseTeams]);


    useEffect(() => {
        if (clientPOs.length > 0 && !selectedClientPoId) {
            setSelectedClientPoId(clientPOs[0].id);
        } else if (clientPOs.length === 0) {
            setSelectedClientPoId('');
        }
    }, [clientPOs, selectedClientPoId]);

     useEffect(() => {
        if (subconPOs.length > 0 && !selectedSubconPoId) {
            setSelectedSubconPoId(subconPOs[0].id);
        } else if (subconPOs.length === 0) {
            setSelectedSubconPoId('');
        }
    }, [subconPOs, selectedSubconPoId]);
    
    return (
       <Tabs defaultValue="client" className="w-full">
            <TabsList>
                <TabsTrigger value="client">Client Works</TabsTrigger>
                <TabsTrigger value="subcon">Subcontractor Works</TabsTrigger>
                <TabsTrigger value="team">Team Works</TabsTrigger>
                <TabsTrigger value="material">Material Settlement</TabsTrigger>
            </TabsList>
            <TabsContent value="client" className="mt-4 space-y-6">
                <DailyActivityView 
                    project={project}
                    setProject={setProject}
                    plantUnits={plantUnits} 
                    poType="Client"
                    company={company}
                />
                <AsBuiltSummaryView 
                    selectedPoId={selectedClientPoId} 
                    onPoChange={setSelectedClientPoId}
                    availablePOs={clientPOs}
                    plantUnits={plantUnits} 
                    company={company} 
                    allCompanies={allCompanies}
                    project={project}
                />
            </TabsContent>
            <TabsContent value="subcon" className="mt-4 space-y-6">
                 <DailyActivityView 
                    project={project}
                    setProject={setProject}
                    plantUnits={plantUnits} 
                    poType="Subcontractor"
                    company={company}
                 />
                 <AsBuiltSummaryView 
                    selectedPoId={selectedSubconPoId} 
                    onPoChange={setSelectedSubconPoId}
                    availablePOs={subconPOs}
                    plantUnits={plantUnits} 
                    company={company}
                    allCompanies={allCompanies}
                    project={project}
                 />
            </TabsContent>
            <TabsContent value="team" className="mt-4 space-y-6">
                 <TeamDailyActivityView 
                    project={project}
                    setProject={setProject}
                    saveProjectDetails={saveProjectDetails}
                    plantUnits={plantUnits} 
                    inHouseTeams={inHouseTeams}
                 />
                 <TeamAsBuiltSummaryView
                    project={project}
                    plantUnits={plantUnits}
                    company={company}
                 />
            </TabsContent>
            <TabsContent value="material" className="mt-4">
                <MaterialSettlementView 
                    project={project}
                    setProject={setProject}
                    plantUnits={plantUnits} 
                    company={company} 
                    serialInventory={serialInventory}
                    allRequisitions={allRequisitions}
                    allIssuances={allIssuances}
                    allReturns={allReturns}
                />
            </TabsContent>
        </Tabs>
    )
}
