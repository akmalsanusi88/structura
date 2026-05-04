
'use client';

import type { Project, ProjectStatus, PlantUnit, InHouseTeam, Company, SiteInstruction, OtherCost, Contract } from "@/lib/types";
import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ArrowLeft, FileText, ClipboardCheck, TrendingUp, Archive, Banknote, Landmark } from 'lucide-react';
import BudgetPlanningView from "./budget-planning-view";
import ImplementationView from "./implementation-view";
import PurchaseOrderView from "./purchase-order-view";
import ProjectInfoForm from "./project-info-form";
import ProjectCloseView from "./project-close-view";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { updateProject, deleteProject as deleteProjectAction } from "@/app/login/actions";
import OtherCostsView from './other-costs-view';


interface ProjectDetailViewProps {
    initialProject: Project;
    initialPlantUnits: PlantUnit[];
    initialInHouseTeams: InHouseTeam[];
    company: Company | null;
    allCompanies: Company[];
    serialInventory: Map<string, Map<string, number>>;
    allRequisitions: string[];
    allIssuances: string[];
    allReturns: string[];
    contracts: Contract[];
}

export default function ProjectDetailView({ initialProject, initialPlantUnits, initialInHouseTeams, company, allCompanies, serialInventory, allRequisitions, allReturns, allIssuances, contracts }: ProjectDetailViewProps) {
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    const { toast } = useToast();
    
    // The main project state is now managed here again, but we will be more careful with updates.
    const [project, setProject] = useState(initialProject);
    const [activeTab, setActiveTab] = useState('project-information');

    useEffect(() => {
        setProject(initialProject);
    }, [initialProject]);

    const saveProjectDetails = async (updatedProjectData?: Project) => {
        try {
          const projectToSave = updatedProjectData || project;
          await updateProject(projectToSave);
          // Optimistically update the local state to match what was saved.
          setProject(projectToSave);
          router.refresh();
        } catch (error) {
          console.error("Failed to save project details:", error);
          throw error;
        }
    };
    
      const handleDeleteProject = async (projectId: string) => {
        try {
          await deleteProjectAction(projectId, companyId);
          toast({
            title: "Project Deleted",
            description: `Project has been permanently removed.`,
          });
          router.push(`/${companyId}/projects`);
        } catch (error) {
           console.error(error);
           toast({
            title: 'Error',
            description: 'Failed to delete project.',
            variant: 'destructive',
          });
        }
      };
    
    useEffect(() => {
        if (project.status === 'Completed' || project.status === 'Cancelled' || project.status === 'KIV' || project.status === 'Closed' || !project.targetCompletionDate) {
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        if (today > project.targetCompletionDate && project.status !== 'Overdue') {
            setProject(p => ({ ...p, status: 'Overdue' }));
        }
    }, [project.status, project.targetCompletionDate]);

    const getStatusBadgeVariant = (status: ProjectStatus) => {
        switch (status) {
          case 'Implementation':
            return 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300';
          case 'Planning':
            return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300';
          case 'Overdue':
            return 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300';
          case 'Completed':
            return 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300';
          case 'KIV':
            return 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300';
          case 'Cancelled':
          case 'Closed':
            return 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300';
          case 'Setup':
          default:
            return 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300';
        }
    };
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
          style: 'currency',
          currency: 'MYR',
          minimumFractionDigits: 2,
        }).format(amount);
    };

    const {
        clientPoCount,
        totalClientPoValue,
        physicalWorkDone,
        physicalWorkDonePercentage,
        amountInvoiced,
        amountReceived,
        actualGrossProfit,
        actualGrossMargin,
    } = useMemo(() => {
        const clientPOs = (project.purchaseOrders || []).filter(po => po.type === 'Client');
        const clientPoCount = clientPOs.length;
        const totalClientPoValue = clientPOs.reduce((total, po) =>
            total + po.items.reduce((itemTotal, item) => itemTotal + (item.quantity * item.rate) + (item.managementFee || 0), 0),
        0);

        const clientPoItemMap = new Map(clientPOs.flatMap(po => po.items).map(item => [item.id, item]));
        
        const workDoneFromLogs = (project.dailyActivities || []).reduce((total, log) => {
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
        }, 0);
        
        const workDoneFromSIs = (project.dailyActivities || [])
            .flatMap(log => log.siteInstructions || [])
            .filter((si: SiteInstruction) => si.context === 'Client')
            .reduce((total, si) => total + si.amount, 0);
            
        const physicalWorkDone = workDoneFromLogs + workDoneFromSIs;

        const physicalWorkDonePercentage = totalClientPoValue > 0 ? (physicalWorkDone / totalClientPoValue) * 100 : 0;

        const amountInvoiced = (project.clientClaims || []).reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0);
        const amountReceived = (project.clientClaims || []).filter(claim => claim.status === 'Paid').reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0);
        
        // Cost Calculations
        const subconActualCost = (project.subconClaims || []).reduce((total, claim) => total + claim.amount, 0);

        const rateMap = new Map<string, number>();
        project.materialBoq?.forEach(item => rateMap.set(item.id, item.rate));
        initialPlantUnits.filter(pu => pu.category === 'Material PU').forEach(item => rateMap.set(item.id, item.rate));
        
        const materialSummaryMap = new Map<string, { issuedQty: number; returnedQty: number }>();
        (project.materialIssuances || []).flatMap(i => i.items).forEach(item => {
            const entry = materialSummaryMap.get(item.sourceId) ?? { issuedQty: 0, returnedQty: 0 };
            entry.issuedQty += item.quantity;
            materialSummaryMap.set(item.sourceId, entry);
        });
        (project.materialReturns || []).flatMap(r => r.items).forEach(item => {
            const entry = materialSummaryMap.get(item.sourceId) ?? { issuedQty: 0, returnedQty: 0 };
            entry.returnedQty += item.quantity;
            materialSummaryMap.set(item.sourceId, entry);
        });

        let materialActualCost = 0;
        materialSummaryMap.forEach((data, sourceId) => {
            const usedQty = data.issuedQty - data.returnedQty;
            const rate = rateMap.get(sourceId) || 0;
            materialActualCost += usedQty * rate;
        });

        const teamActualCost = project.teamCosts?.reduce((sum, cost) => sum + cost.salary + cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep, 0) || 0;
        
        const totalActualCost = subconActualCost + materialActualCost + teamActualCost;

        const actualGrossProfit = physicalWorkDone - totalActualCost;
        const actualGrossMargin = physicalWorkDone > 0 ? (actualGrossProfit / physicalWorkDone) * 100 : 0;

        return {
            clientPoCount,
            totalClientPoValue,
            physicalWorkDone,
            physicalWorkDonePercentage,
            amountInvoiced,
            amountReceived,
            actualGrossProfit,
            actualGrossMargin,
        };
    }, [project, initialPlantUnits]);

    return (
        <TooltipProvider>
            <div className="flex flex-col h-full">
                <header className="p-4 md:p-6">
                    <Button variant="ghost" asChild className="mb-4 pl-0">
                        <Link href={`/${companyId}/projects`}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
                        </Link>
                    </Button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold font-headline">{project.name}</h1>
                            <p className="text-muted-foreground">Project No: {project.projectNo} | Client: {project.client}</p>
                        </div>
                        <Badge className={getStatusBadgeVariant(project.status)}>{project.status}</Badge>
                    </div>
                </header>
                <main className="flex-1 px-4 md:px-6 pb-6 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-primary">No. of Client POs</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold">{clientPoCount}</p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Total count of all Purchase Orders received from the client.</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-primary">Total Client PO Value</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold">{formatCurrency(totalClientPoValue)}</p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>The total contract value based on all Client Purchase Orders.</p>
                            </TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-primary">Physical Work Done</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold">{formatCurrency(physicalWorkDone)} <span className="text-base font-normal text-muted-foreground">({physicalWorkDonePercentage.toFixed(1)}%)</span></p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Total value of as-built work from daily logs &amp; client site instructions. This is your earned revenue.</p>
                            </TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Amount Invoiced</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold">{formatCurrency(amountInvoiced)}</p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                             <TooltipContent>
                                <p>The total value of all claims submitted to the client, net of retention.</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Amount Received</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold">{formatCurrency(amountReceived)}</p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                             <TooltipContent>
                                <p>The total value of all 'Paid' claims from the client, net of retention.</p>
                            </TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">Actual Gross Profit</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-2xl font-bold">{formatCurrency(actualGrossProfit)} <span className="text-base font-normal text-muted-foreground">({actualGrossMargin.toFixed(1)}%)</span></p>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Physical Work Done minus all actual costs (Subcon, Materials, Teams).</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    
                    <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="project-information">
                        <TabsList>
                            <TabsTrigger value="project-information"><FileText className="mr-2 h-4 w-4" /> Project Information</TabsTrigger>
                            <TabsTrigger value="budget-planning"><ClipboardCheck className="mr-2 h-4 w-4" /> Budget Planning</TabsTrigger>
                            <TabsTrigger value="purchase-order"><Banknote className="mr-2 h-4 w-4" /> Purchase Order</TabsTrigger>
                            <TabsTrigger value="implementation"><TrendingUp className="mr-2 h-4 w-4" /> Implementation</TabsTrigger>
                            <TabsTrigger value="project-claims"><Archive className="mr-2 h-4 w-4" /> Project Claims</TabsTrigger>
                            <TabsTrigger value="other-costs"><Landmark className="mr-2 h-4 w-4" /> Other Costs</TabsTrigger>
                        </TabsList>

                        <TabsContent value="project-information" className="mt-4">
                            <ProjectInfoForm
                                project={project}
                                setProject={setProject}
                                allCompanies={allCompanies}
                                saveProjectDetails={saveProjectDetails}
                                deleteProject={handleDeleteProject}
                                contracts={contracts}
                            />
                        </TabsContent>
                        <TabsContent value="budget-planning" className="mt-4">
                            <BudgetPlanningView 
                                project={project}
                                setProject={setProject}
                                saveProjectDetails={saveProjectDetails}
                                plantUnits={initialPlantUnits} 
                                company={company} 
                                allCompanies={allCompanies} 
                                contracts={contracts}
                            />
                        </TabsContent>
                        <TabsContent value="purchase-order" className="mt-4">
                            <PurchaseOrderView
                                project={project}
                                setProject={setProject}
                                plantUnits={initialPlantUnits}
                                inHouseTeams={initialInHouseTeams}
                                allCompanies={allCompanies}
                                company={company}
                                contracts={contracts}
                            />
                        </TabsContent>
                        <TabsContent value="implementation" className="mt-4">
                            <ImplementationView 
                                project={project}
                                setProject={setProject}
                                saveProjectDetails={saveProjectDetails}
                                plantUnits={initialPlantUnits} 
                                company={company} 
                                allCompanies={allCompanies}
                                serialInventory={serialInventory} 
                                inHouseTeams={initialInHouseTeams} 
                                allRequisitions={allRequisitions}
                                allIssuances={allIssuances}
                                allReturns={allReturns}
                            />
                        </TabsContent>
                        <TabsContent value="project-claims" className="mt-4">
                            <ProjectCloseView 
                                project={project} 
                                setProject={setProject}
                                plantUnits={initialPlantUnits} 
                                company={company}
                                allCompanies={allCompanies}
                            />
                        </TabsContent>
                         <TabsContent value="other-costs" className="mt-4">
                            <OtherCostsView
                                project={project}
                            />
                        </TabsContent>
                    </Tabs>
                </main>
            </div>
        </TooltipProvider>
    );
}
