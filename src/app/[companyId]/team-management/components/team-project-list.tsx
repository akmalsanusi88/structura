
'use client';

import type { Project } from '@/lib/types';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface TeamProjectListProps {
  initialProjects: Project[];
}

export default function TeamProjectList({ initialProjects }: TeamProjectListProps) {
  const params = useParams();
  const companyId = params.companyId as string;

  const teamProjects = useMemo(() => {
    return initialProjects.filter(p => {
        // A project has team involvement if either:
        // 1. A purchase order is issued to an in-house team.
        const hasTeamPO = p.purchaseOrders?.some(po => !!po.teamId);
        // 2. Any daily activity work log is associated with a team.
        const hasTeamWork = p.dailyActivities?.some(log => log.work.some(w => !!w.teamId));
        return hasTeamPO || hasTeamWork;
    });
  }, [initialProjects]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Cost Management</CardTitle>
        <CardDescription>Select a project to manage its in-house team costs.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
            {teamProjects.length > 0 ? (
              teamProjects.map(project => (
                <div key={project.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="mb-4 sm:mb-0">
                        <h3 className="font-semibold">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">{project.projectNo}</p>
                        <p className="text-sm text-muted-foreground">Client: {project.client}</p>
                    </div>
                    <Link href={`/${companyId}/team-management/${project.id}`}>
                      <Button>
                        Manage Costs <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-muted-foreground">No projects with assigned in-house teams found.</p>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
