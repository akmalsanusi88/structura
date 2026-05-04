
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ClientPerformanceData {
    clientName: string;
    projectCount: number;
    totalRevenue: number;
    satisfaction: number;
}

interface ClientPerformanceAnalysisProps {
    data: ClientPerformanceData[];
    className?: string;
}

export default function ClientPerformanceAnalysis({ data, className }: ClientPerformanceAnalysisProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <Card id="client-performance-analysis-chart" className={cn("flex flex-col", className)}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Client Performance Analysis</CardTitle>
                        <CardDescription>Revenue and satisfaction by client</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1">
                <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                        {data.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                No client data available.
                            </div>
                        ) : (
                            data.map(client => (
                                <div key={client.clientName} className="border rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold">{client.clientName}</h3>
                                            <p className="text-sm text-muted-foreground">{client.projectCount} projects</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">{formatCurrency(client.totalRevenue)}</p>
                                            <p className="text-sm text-muted-foreground">{client.satisfaction}% satisfaction</p>
                                        </div>
                                    </div>
                                    <Progress value={client.satisfaction} />
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
