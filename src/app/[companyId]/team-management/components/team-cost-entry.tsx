'use client';

import type { Project, InHouseTeam, TeamCost } from '@/lib/types';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { PlusCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import TeamCostForm from './team-cost-form';

interface TeamCostEntryProps {
  initialProjects: Project[];
  initialTeams: InHouseTeam[];
}

export default function TeamCostEntry({ initialProjects, initialTeams }: TeamCostEntryProps) {
    const [projects, setProjects] = useState<Project[]>(initialProjects);
    const [teams] = useState<InHouseTeam[]>(initialTeams);
    const { toast } = useToast();

    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCost, setEditingCost] = useState<TeamCost | undefined>(undefined);

    const assignedProjectsForSelectedTeam = useMemo(() => {
        if (!selectedTeamId) return [];
        return projects.filter(p => p.purchaseOrders?.some(po => po.teamId === selectedTeamId));
    }, [projects, selectedTeamId]);

    const costsForSelection = useMemo(() => {
        if (!selectedProjectId) return [];
        const project = projects.find(p => p.id === selectedProjectId);
        return project?.teamCosts?.filter(c => c.teamId === selectedTeamId) || [];
    }, [projects, selectedTeamId, selectedProjectId]);
    
    const totalCostForSelection = useMemo(() => {
        return costsForSelection.reduce((sum, cost) => sum + cost.salary + cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep, 0);
    }, [costsForSelection]);


    const handleTeamChange = (teamId: string) => {
        setSelectedTeamId(teamId);
        setSelectedProjectId(''); // Reset project selection
    };

    const handleOpenForm = (cost?: TeamCost) => {
        setEditingCost(cost);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingCost(undefined);
    };

    const handleSaveCost = (data: TeamCost) => {
        setProjects(prevProjects => {
            const projectIndex = prevProjects.findIndex(p => p.id === selectedProjectId);
            if (projectIndex === -1) return prevProjects;

            const newProjects = [...prevProjects];
            const projectToUpdate = { ...newProjects[projectIndex] };
            const costs = [...(projectToUpdate.teamCosts || [])];
            
            const costDataWithTeam = { ...data, teamId: selectedTeamId };

            const existingIndex = costs.findIndex(c => c.id === costDataWithTeam.id);
            if (existingIndex > -1) {
                costs[existingIndex] = costDataWithTeam;
            } else {
                costs.push(costDataWithTeam);
            }

            projectToUpdate.teamCosts = costs;
            newProjects[projectIndex] = projectToUpdate;
            return newProjects;
        });

        toast({ title: 'Success', description: `Cost entry has been ${editingCost ? 'updated' : 'saved'}.` });
        handleCloseForm();
    };
    
    const handleDeleteCost = (costId: string) => {
        setProjects(prevProjects => {
            const projectIndex = prevProjects.findIndex(p => p.id === selectedProjectId);
            if (projectIndex === -1) return prevProjects;
            
            const newProjects = [...prevProjects];
            const projectToUpdate = { ...newProjects[projectIndex] };
            projectToUpdate.teamCosts = (projectToUpdate.teamCosts || []).filter(c => c.id !== costId);
            newProjects[projectIndex] = projectToUpdate;
            return newProjects;
        });
        toast({ title: 'Success', description: 'Cost entry deleted.' });
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Team Cost Entry</CardTitle>
                    <CardDescription>Select a team and project to log their monthly operational costs.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                    <div className='flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-muted/50'>
                        <div className='flex-1'>
                            <label className='text-sm font-medium'>Team</label>
                            <Select value={selectedTeamId} onValueChange={handleTeamChange}>
                                <SelectTrigger><SelectValue placeholder="Select a team..." /></SelectTrigger>
                                <SelectContent>
                                    {teams.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className='flex-1'>
                            <label className='text-sm font-medium'>Project</label>
                            <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={!selectedTeamId}>
                                <SelectTrigger><SelectValue placeholder="Select a project..." /></SelectTrigger>
                                <SelectContent>
                                    {assignedProjectsForSelectedTeam.map(proj => <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    <Card>
                        <CardHeader>
                             <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className='text-xl'>Monthly Costs</CardTitle>
                                    <CardDescription>Costs for the selected team and project.</CardDescription>
                                </div>
                                <Button onClick={() => handleOpenForm()} disabled={!selectedProjectId || !selectedTeamId}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Cost Entry
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Month</TableHead>
                                            <TableHead className="text-right">Salary</TableHead>
                                            <TableHead className="text-right">Expenses</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead><span className="sr-only">Actions</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedProjectId && costsForSelection.length > 0 ? (
                                            costsForSelection.map(cost => {
                                                const total = cost.salary + cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep;
                                                const expenses = cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep;
                                                return (
                                                    <TableRow key={cost.id}>
                                                        <TableCell className="font-medium">{format(parseISO(`${cost.month}-01`), 'MMM yyyy')}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(cost.salary)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(expenses)}</TableCell>
                                                        <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                <DropdownMenuContent>
                                                                    <DropdownMenuItem onClick={() => handleOpenForm(cost)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors"><Trash2 className="mr-2 h-4 w-4"/> Delete</Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this cost entry.</AlertDialogDescription></AlertDialogHeader>
                                                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCost(cost.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        ) : (
                                            <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                {selectedProjectId ? 'No costs logged for this selection.' : 'Please select a team and project.'}
                                            </TableCell></TableRow>
                                        )}
                                    </TableBody>
                                    {costsForSelection.length > 0 && (
                                        <TableFooter>
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(totalCostForSelection)}</TableCell>
                                                <TableCell />
                                            </TableRow>
                                        </TableFooter>
                                    )}
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
            
            <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingCost ? 'Edit' : 'Add'} Monthly Team Cost</DialogTitle>
                        <DialogDescription>
                            Log costs for {teams.find(t => t.id === selectedTeamId)?.name} on project {projects.find(p => p.id === selectedProjectId)?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <TeamCostForm cost={editingCost} onSave={handleSaveCost} onCancel={handleCloseForm} />
                </DialogContent>
            </Dialog>
        </>
    );
}
