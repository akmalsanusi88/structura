
'use client';

import type { Project, InHouseTeam, PlantUnit, GeneralTeamCost } from '@/lib/types';
import { useMemo, useState, useCallback } from 'react';
import YearlyFinancialSummary from './yearly-financial-summary';
import MonthlyTeamPerformance from './monthly-team-performance';

interface TeamPerformanceDashboardProps {
  projects: Project[];
  teams: InHouseTeam[];
  plantUnits: PlantUnit[];
  generalCosts: GeneralTeamCost[];
}

export default function TeamPerformanceDashboard({ projects, teams, plantUnits, generalCosts }: TeamPerformanceDashboardProps) {

  return (
    <div className="space-y-6">
        <YearlyFinancialSummary
            projects={projects}
            teams={teams}
            plantUnits={plantUnits}
            generalCosts={generalCosts}
        />
        <MonthlyTeamPerformance 
            projects={projects}
            teams={teams}
            plantUnits={plantUnits}
            generalCosts={generalCosts}
        />
    </div>
  );
}
