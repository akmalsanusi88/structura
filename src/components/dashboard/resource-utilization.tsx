
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { InHouseTeam, Project } from '@/lib/types';
import { useMemo } from 'react';

interface ResourceUtilizationProps {
    teams: InHouseTeam[];
    projects: Project[];
}

export default function ResourceUtilization({ teams, projects }: ResourceUtilizationProps) {
    const teamWorkload = useMemo(() => {
        const workload = new Map<string, Set<string>>(); // Map<team name, Set<project id>>
        
        // In-house teams
        teams.forEach(team => {
            if (!workload.has(team.name)) {
                workload.set(team.name, new Set());
            }
            projects.forEach(project => {
                if (project.status !== 'Closed' && project.purchaseOrders?.some(po => po.teamId === team.id)) {
                    workload.get(team.name)!.add(project.id);
                }
            });
        });

        // Subcontractor teams
        projects.forEach(project => {
            if (project.status !== 'Closed') {
                project.purchaseOrders?.forEach(po => {
                    if (po.type === 'Subcontractor' && !po.teamId) {
                        const subconName = po.issuer;
                        if (!workload.has(subconName)) {
                            workload.set(subconName, new Set());
                        }
                        workload.get(subconName)!.add(project.id);
                    }
                });
            }
        });
        
        const finalWorkload = Array.from(workload.entries()).map(([name, projectIds]) => ({
            name,
            projectCount: projectIds.size
        })).filter(item => item.projectCount > 0);

        return finalWorkload;

    }, [teams, projects]);

    const maxProjects = Math.max(...teamWorkload.map(t => t.projectCount), 0) || 5;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Team Workload</CardTitle>
                <CardDescription>Active project assignments per team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
                {teamWorkload.map((team, index) => (
                    <div key={`${team.name}-${index}`} className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <p className="font-medium">{team.name}</p>
                            <p className="text-muted-foreground">{team.projectCount} projects</p>
                        </div>
                        <Progress value={(team.projectCount / maxProjects) * 100} />
                    </div>
                ))}
                 {teamWorkload.length === 0 && (
                    <p className="text-sm text-center text-muted-foreground py-4">No teams with active projects.</p>
                )}
            </CardContent>
        </Card>
    );
}
