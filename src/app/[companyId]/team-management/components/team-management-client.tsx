
'use client';

import Header from "@/components/layout/header";
import TeamManagementTabs from "./team-management-tabs";
import type { Project, InHouseTeam, PlantUnit, GeneralTeamCost } from "@/lib/types";

interface TeamManagementPageClientProps {
  projects: Project[];
  teams: InHouseTeam[];
  plantUnits: PlantUnit[];
  generalCosts: GeneralTeamCost[];
  companyName: string;
}

export default function TeamManagementPageClient({
  projects,
  teams,
  plantUnits,
  generalCosts,
  companyName,
}: TeamManagementPageClientProps) {
  return (
    <div className="flex flex-col h-full">
      <Header title="Team Management" />
      <main className="flex-1 p-4 md:p-6">
        <TeamManagementTabs
          initialProjects={projects}
          initialTeams={teams}
          plantUnits={plantUnits}
          initialGeneralCosts={generalCosts}
        />
      </main>
    </div>
  );
}
