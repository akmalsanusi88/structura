
'use client';

import type { Project, TeamCost, PlantUnit, Company, InHouseTeam } from '@/lib/types';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import TeamCostForm from './team-cost-form';
import { addOrUpdateTeamCost, deleteTeamCost } from '@/app/login/actions';
import { useRouter, useParams } from 'next/navigation';

interface MonthlyPnlItem {
    key: string; // teamId-month
    teamId: string;
    teamName: string;
    month: string;
    revenue: number;
    expenses: {
        salary: number;
        petrolAndToll: number;
        siteExpenses: number;
        machineryAndUpkeep: number;
        total: number;
    };
    grossProfit: number;
}

interface ProjectTeamCostViewProps {
    initialProject: Project;
    plantUnits: PlantUnit[];
    company: Company | null;
    inHouseTeams: InHouseTeam[];
}

export default function ProjectTeamCostView({ initialProject, plantUnits, company, inHouseTeams }: ProjectTeamCostViewProps) {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    const projectId = params.projectId as string;
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCost, setEditingCost] = useState<TeamCost | undefined>(undefined);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
    
    const teamNameMap = useMemo(() => {
        const map = new Map<string, string>();
        inHouseTeams.forEach(team => {
            map.set(team.id, team.name);
        });
        initialProject.purchaseOrders?.forEach(po => {
            if (po.teamId && !map.has(po.teamId)) {
                map.set(po.teamId, po.issuer);
            }
        });
        return map;
    }, [initialProject.purchaseOrders, inHouseTeams]);

    const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);
    const engineeringBoqMap = useMemo(() => new Map(initialProject.engineeringBoq.map(item => [item.id, item])), [initialProject.engineeringBoq]);

    const monthlyPnlData = useMemo(() => {
        const pnlMap = new Map<string, MonthlyPnlItem>();
        
        const processEntry = (teamId: string, month: string) => {
            const key = `${teamId}-${month}`;
            if (!pnlMap.has(key)) {
                pnlMap.set(key, {
                    key,
                    teamId,
                    teamName: teamNameMap.get(teamId) || 'Unknown Team',
                    month,
                    revenue: 0,
                    expenses: { salary: 0, petrolAndToll: 0, siteExpenses: 0, machineryAndUpkeep: 0, total: 0 },
                    grossProfit: 0,
                });
            }
            return pnlMap.get(key)!;
        };

        // Process Revenue from Daily Activities
        initialProject.dailyActivities?.forEach(log => {
            const month = log.date.substring(0, 7);
            log.work.forEach(workRecord => {
                if (workRecord.teamId) {
                    const entry = processEntry(workRecord.teamId, month);
                    
                    let rate = 0;
                    const engBoqItem = engineeringBoqMap.get(workRecord.boqItemId);
                    if (engBoqItem) {
                        rate = engBoqItem.rate;
                    } else {
                        const pu = plantUnitMap.get(workRecord.boqItemId);
                        if (pu) rate = pu.rate;
                    }
                    entry.revenue += workRecord.quantity * rate;
                }
            });
        });

        // Process Expenses from Team Costs
        (initialProject.teamCosts || []).forEach(cost => {
            const entry = processEntry(cost.teamId, cost.month);
            entry.expenses.salary += cost.salary;
            entry.expenses.petrolAndToll += cost.petrolAndToll;
            entry.expenses.siteExpenses += cost.siteExpenses;
            entry.expenses.machineryAndUpkeep += cost.machineryAndUpkeep;
        });
        
        // Final calculations
        pnlMap.forEach(entry => {
            entry.expenses.total = entry.expenses.salary + entry.expenses.petrolAndToll + entry.expenses.siteExpenses + entry.expenses.machineryAndUpkeep;
            entry.grossProfit = entry.revenue - entry.expenses.total;
        });

        return Array.from(pnlMap.values()).sort((a,b) => b.month.localeCompare(a.month) || a.teamName.localeCompare(b.teamName));
    }, [initialProject, teamNameMap, plantUnitMap, engineeringBoqMap]);
    
    const handleOpenForm = (cost?: TeamCost) => {
        setEditingCost(cost);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingCost(undefined);
    };
    
    const handleSaveCost = async (data: TeamCost) => {
        handleCloseForm();
        try {
            await addOrUpdateTeamCost(data, projectId, companyId);
            toast({ title: 'Success', description: `Cost entry has been ${editingCost ? 'updated' : 'saved'}.` });
            router.refresh();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to save cost entry.', variant: 'destructive' });
        }
    };

    const handleDeleteCost = async (costId: string) => {
        try {
            await deleteTeamCost(costId, projectId, companyId);
            toast({ title: 'Success', description: 'Cost entry deleted.' });
            router.refresh();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete cost entry.', variant: 'destructive' });
        }
    };

    const totals = monthlyPnlData.reduce((acc, item) => {
        acc.revenue += item.revenue;
        acc.wages += item.expenses.salary;
        acc.petrolAndToll += item.expenses.petrolAndToll;
        acc.siteExpenses += item.expenses.siteExpenses;
        acc.machineryAndUpkeep += item.expenses.machineryAndUpkeep;
        acc.totalExpenses += item.expenses.total;
        acc.grossProfit += item.grossProfit;
        return acc;
    }, { revenue: 0, wages: 0, petrolAndToll: 0, siteExpenses: 0, machineryAndUpkeep: 0, totalExpenses: 0, grossProfit: 0});

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>In-house Team P&L</CardTitle>
                            <CardDescription>Track monthly revenue and costs for your teams on this project.</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" /> Add Monthly Cost</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead rowSpan={2} className="align-bottom">Team</TableHead>
                                    <TableHead rowSpan={2} className="align-bottom">Month</TableHead>
                                    <TableHead rowSpan={2} className="align-bottom text-right">Revenue</TableHead>
                                    <TableHead colSpan={4} className="text-center border-l">Expenses</TableHead>
                                    <TableHead rowSpan={2} className="align-bottom text-right border-l">Gross Profit</TableHead>
                                    <TableHead rowSpan={2} className="align-bottom"><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                                <TableRow>
                                    <TableHead className="text-right border-l">Wages/Salary</TableHead>
                                    <TableHead className="text-right">Petrol &amp; Toll</TableHead>
                                    <TableHead className="text-right">Site Expenses</TableHead>
                                    <TableHead className="text-right">Machinery/Vehicle</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyPnlData.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No cost or work entries logged for any team yet.</TableCell></TableRow>
                                ) : (
                                    monthlyPnlData.map(item => {
                                        const costEntry = initialProject.teamCosts?.find(c => c.teamId === item.teamId && c.month === item.month);
                                        return (
                                            <TableRow key={item.key}>
                                                <TableCell className="font-medium">{item.teamName}</TableCell>
                                                <TableCell>{format(parseISO(`${item.month}-01`), 'MMM yyyy')}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                                                <TableCell className="text-right border-l">{formatCurrency(item.expenses.salary)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.expenses.petrolAndToll)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.expenses.siteExpenses)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.expenses.machineryAndUpkeep)}</TableCell>
                                                <TableCell className={`text-right font-bold border-l ${item.grossProfit < 0 ? 'text-red-500' : ''}`}>{formatCurrency(item.grossProfit)}</TableCell>
                                                <TableCell className="text-right">
                                                     <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => handleOpenForm(costEntry)} disabled={!costEntry}><Pencil className="mr-2 h-4 w-4"/>Edit Costs</DropdownMenuItem>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors" disabled={!costEntry}>
                                                                        <Trash2 className="mr-2 h-4 w-4"/> Delete Costs
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>This will permanently delete the cost entry for this month. Revenue will not be affected.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCost(costEntry!.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                             {monthlyPnlData.length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-right font-bold">Total</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(totals.revenue)}</TableCell>
                                        <TableCell className="text-right font-bold border-l">{formatCurrency(totals.wages)}</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(totals.petrolAndToll)}</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(totals.siteExpenses)}</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(totals.machineryAndUpkeep)}</TableCell>
                                        <TableCell className={`text-right font-bold border-l ${totals.grossProfit < 0 ? 'text-red-500' : ''}`}>{formatCurrency(totals.grossProfit)}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingCost ? 'Edit' : 'Add'} Monthly Team Cost</DialogTitle>
                        <DialogDescription>Log the costs for an in-house team for a specific month.</DialogDescription>
                    </DialogHeader>
                    <TeamCostForm
                        project={initialProject}
                        cost={editingCost}
                        onSave={handleSaveCost}
                        onCancel={handleCloseForm}
                        inHouseTeams={inHouseTeams}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
