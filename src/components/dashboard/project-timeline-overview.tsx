
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { Project, ProjectStatus } from '@/lib/types';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ProjectTimelineOverviewProps {
    projects: Project[];
    className?: string;
}

const getStatus = (status: ProjectStatus) => {
    switch (status) {
        case 'Implementation': return { text: 'On Track', variant: 'bg-blue-100 text-blue-800' };
        case 'Overdue': return { text: 'At Risk', variant: 'bg-orange-100 text-orange-800' };
        case 'Completed': return { text: 'Complete', variant: 'bg-green-100 text-green-800' };
        case 'Closed': return { text: 'Complete', variant: 'bg-green-100 text-green-800' };
        case 'Planning': return { text: 'On Track', variant: 'bg-blue-100 text-blue-800' };
        case 'KIV': return { text: 'On Hold', variant: 'bg-purple-100 text-purple-800' };
        case 'Cancelled': return { text: 'Cancelled', variant: 'bg-gray-100 text-gray-800' };
        default: return { text: status, variant: 'bg-gray-100 text-gray-800' };
    }
};

export default function ProjectTimelineOverview({ projects, className }: ProjectTimelineOverviewProps) {
    const ongoingProjects = projects.filter(p => p.status !== 'Completed' && p.status !== 'Closed' && p.status !== 'Cancelled');

    return (
        <Card className={cn("flex flex-col", className)}>
            <CardHeader>
                <CardTitle>Project Timeline Overview</CardTitle>
                <CardDescription>Current status of ongoing projects</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <ScrollArea className="h-[500px]">
                    <div className="space-y-6">
                        {ongoingProjects.map(project => (
                            <div key={project.id} className="grid gap-2">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold">{project.name}</p>
                                    </div>
                                    <Badge variant="outline" className={`${getStatus(project.status).variant} border-transparent font-semibold shrink-0`}>{getStatus(project.status).text}</Badge>
                                </div>
                                <Progress value={project.progress} />
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>{project.startDate ? format(new Date(project.startDate), 'yyyy-MM-dd') : 'N/A'}</span>
                                    <span>{project.targetCompletionDate ? format(new Date(project.targetCompletionDate), 'yyyy-MM-dd') : 'N/A'}</span>
                                </div>
                            </div>
                        ))}
                         {ongoingProjects.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">No ongoing projects.</div>
                         )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
