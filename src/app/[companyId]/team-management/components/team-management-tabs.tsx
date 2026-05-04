
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TeamList from './team-list';
import TeamProjectList from './team-project-list';
import GeneralCostView from './general-cost-view';
import TeamPerformanceDashboard from './team-performance-dashboard';
import type { Project, InHouseTeam, PlantUnit, GeneralTeamCost } from '@/lib/types';
import { useSearchParams } from 'next/navigation';

interface TeamManagementTabsProps {
  initialProjects: Project[];
  initialTeams: InHouseTeam[];
  plantUnits: PlantUnit[];
  initialGeneralCosts: GeneralTeamCost[];
}

export default function TeamManagementTabs({
  initialProjects,
  initialTeams,
  plantUnits,
  initialGeneralCosts,
}: TeamManagementTabsProps) {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab');

  return (
    <Tabs defaultValue={tab || "teams"} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
        <TabsTrigger value="teams">Teams</TabsTrigger>
        <TabsTrigger value="project-costs">Project Costs</TabsTrigger>
        <TabsTrigger value="general-costs">General Costs</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
      </TabsList>
      <TabsContent value="teams" className="pt-4">
        <TeamList initialProjects={initialProjects} initialTeams={initialTeams} />
      </TabsContent>
      <TabsContent value="project-costs" className="pt-4">
        <TeamProjectList initialProjects={initialProjects} />
      </TabsContent>
      <TabsContent value="general-costs" className="pt-4">
        <GeneralCostView initialTeams={initialTeams} initialGeneralCosts={initialGeneralCosts} />
      </TabsContent>
      <TabsContent value="performance" className="pt-4">
        <TeamPerformanceDashboard projects={initialProjects} teams={initialTeams} plantUnits={plantUnits} generalCosts={initialGeneralCosts} />
      </TabsContent>
    </Tabs>
  );
}
