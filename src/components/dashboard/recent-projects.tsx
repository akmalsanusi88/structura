
'use client';

import type { Project, ProjectStatus } from "@/lib/types";
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CalculatedProject = Project & {
    actualRevenue?: number;
};

interface RecentProjectsProps {
    projects: CalculatedProject[];
}

const getStatusBadgeVariant = (status: ProjectStatus) => {
  switch (status) {
    case 'Implementation':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300';
    case 'Planning':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300';
    case 'Overdue':
      return 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300';
    case 'Closed':
      return 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300';
    case 'Setup':
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300';
  }
};

export default function RecentProjects({ projects }: RecentProjectsProps) {
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;

    const handleViewClick = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        router.push(`/${companyId}/projects/${projectId}`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const recentProjects = projects.filter(p => p.status !== 'Closed').slice(0, 3);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Latest project updates and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {recentProjects.map(project => (
                    <div key={project.id} className="border rounded-lg p-4 space-y-2 transition-all hover:shadow-md">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{project.name}</p>
                                <p className="text-sm text-muted-foreground">{project.client}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={(e) => handleViewClick(e, project.id)}>View</Button>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <Badge variant="outline" className={`${getStatusBadgeVariant(project.status)} border-transparent font-semibold`}>
                                {project.status}
                            </Badge>
                            <span className="text-muted-foreground">
                                {formatCurrency(project.actualRevenue || 0)} / {formatCurrency(project.revenue)}
                            </span>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
