

'use client';
import type { Project, DailyActivityLog, InHouseTeam, DailyActivityWork, SiteInstruction, PlantUnit } from '@/lib/types';
import { useState, useMemo, Fragment } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Pencil, Trash2, ChevronDown, FileDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import WorkRecordForm from './work-record-form';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { useRouter, useParams } from 'next/navigation';
import { addOrUpdateDailyLog, deleteDailyLogForPO } from '@/app/login/actions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';


interface TeamDailyActivityViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
    saveProjectDetails: () => Promise<void>;
    plantUnits: any[]; 
    inHouseTeams: InHouseTeam[];
}

export default function TeamDailyActivityView({ project, setProject, saveProjectDetails, plantUnits, inHouseTeams }: TeamDailyActivityViewProps) {
    const router = useRouter();
    const params = useParams();
    const companyId = params.companyId as string;
    const { toast } = useToast();

    const [isLogFormOpen, setIsLogFormOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<DailyActivityLog | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const rowsPerPage = 10;
    
    const teamNameMap = useMemo(() => {
        return new Map(inHouseTeams.map(team => [team.id, team.name]));
    }, [inHouseTeams]);

    const filteredLogs = useMemo(() => {
        return (project.dailyActivities || [])
            .map(log => {
                const teamsInLog = new Set<string>();
                log.work.forEach(w => { if (w.teamId) teamsInLog.add(w.teamId) });
                (log.siteInstructions || []).forEach(si => { if (si.teamId) teamsInLog.add(si.teamId) });

                return Array.from(teamsInLog).map(teamId => ({
                    ...log,
                    teamId: teamId,
                }));
            })
            .flat()
            .filter((log): log is DailyActivityLog & { teamId: string } => !!log.teamId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [project.dailyActivities]);

    const totalPages = useMemo(() => Math.ceil(filteredLogs.length / rowsPerPage), [filteredLogs, rowsPerPage]);

    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredLogs.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredLogs, currentPage, rowsPerPage]);
    
    const toggleLogExpansion = (logId: string) => {
        setExpandedLogs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(logId)) {
                newSet.delete(logId);
            } else {
                newSet.add(logId);
            }
            return newSet;
        });
    };

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    const handleNextPage = () => goToPage(currentPage + 1);
    const handlePrevPage = () => goToPage(currentPage - 1);
    const goToFirstPage = () => setCurrentPage(1);
    const goToLastPage = () => goToPage(totalPages);
    
    const handleOpenLogForm = (log?: DailyActivityLog) => {
        setEditingLog(log || null);
        setIsLogFormOpen(true);
    };

    const handleSaveLog = async (logDataFromForm: DailyActivityLog, poId: string | null, teamId?: string | null) => {
        setIsLogFormOpen(false);

        // Optimistic UI Update
        setProject(prevProject => {
            const logs = [...(prevProject.dailyActivities || [])];
            const existingLogIndex = logs.findIndex(l => l.id === logDataFromForm.id);

            if (existingLogIndex > -1) {
                // Update existing log
                const existingLog = logs[existingLogIndex];
                
                const workForOtherTeams = (existingLog.work || []).filter((w: any) => w.teamId !== teamId);
                const siForOtherTeams = (existingLog.siteInstructions || []).filter((si: any) => si.teamId !== teamId);

                const workForThisTeam = (logDataFromForm.work || []).map(w => ({ ...w, teamId }));
                const siForThisTeam = (logDataFromForm.siteInstructions || []).map(si => ({...si, teamId }));

                logs[existingLogIndex] = { 
                    ...logDataFromForm,
                    work: [...workForOtherTeams, ...workForThisTeam], 
                    siteInstructions: [...siForOtherTeams, ...siForThisTeam],
                };
            } else {
                 const logWithTeamId = {
                    ...logDataFromForm,
                    work: (logDataFromForm.work || []).map(w => ({ ...w, teamId })),
                    siteInstructions: (logDataFromForm.siteInstructions || []).map(si => ({ ...si, teamId })),
                };
                logs.push(logWithTeamId);
            }
            return { ...prevProject, dailyActivities: logs };
        });

        try {
            await addOrUpdateDailyLog(logDataFromForm, project.id, companyId, null, teamId);
            toast({ title: 'Success', description: `Daily Log ${editingLog ? 'updated' : 'saved'} successfully.` });
        } catch (error) {
            console.error('Failed to save log:', error);
            toast({ title: 'Error', description: 'Could not save daily log.', variant: 'destructive' });
            router.refresh();
        } finally {
            setEditingLog(null);
        }
    };

    const handleDeleteLog = async (logToDelete: DailyActivityLog) => {
        if (!logToDelete.teamId) return;
        try {
            await deleteDailyLogForPO(logToDelete.id, project.id, companyId, null, logToDelete.teamId);
            toast({ title: 'Success', description: `Log entries for this team deleted.` });
            router.refresh();
        } catch (error) {
            console.error('Failed to delete log:', error);
            toast({ title: 'Error', description: 'Could not delete daily log.', variant: 'destructive' });
        }
    };

    const handleExportPdf = (log: DailyActivityLog & { teamId: string }) => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Team Daily Work Record", 14, 22);

        let y_pos = 29;
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Project: ${project.name}`, 14, y_pos);
        y_pos += 7;
        doc.text(`Date: ${format(parseISO(log.date), 'PPP')}`, 14, y_pos);
        y_pos += 7;
        doc.text(`Team: ${teamNameMap.get(log.teamId) || 'N/A'}`, 14, y_pos);
        y_pos += 10;
        
        if (log.description) {
            doc.setFontSize(10);
            doc.text("Description:", 14, y_pos);
            y_pos += 5;
            const descriptionLines = doc.splitTextToSize(log.description, doc.internal.pageSize.width - 28);
            doc.text(descriptionLines, 14, y_pos);
            y_pos += descriptionLines.length * 5 + 5;
        }

        const head = [['Description', 'Quantity', 'Unit']];
        const body = [
            ...(log.work || []).filter(w => w.teamId === log.teamId).map(w => {
                const boqItem = project.engineeringBoq.find(i => i.id === w.boqItemId) || plantUnits.find(i => i.id === w.boqItemId);
                return [boqItem?.description || 'N/A', w.quantity.toFixed(2), boqItem?.unit || 'N/A'];
            }),
            ...(log.siteInstructions || []).filter(si => si.teamId === log.teamId).map(si => [
                `${si.description} (SI)`,
                si.quantity?.toFixed(2) || '-',
                si.unit || '-'
            ]),
        ];

        autoTable(doc, { head, body, startY: y_pos });
        
        let finalY = (doc as any).lastAutoTable.finalY || 80;
        
        if (finalY > doc.internal.pageSize.getHeight() - 50) doc.addPage();
        
        autoTable(doc, {
            startY: finalY + 20,
            body: [['', '']],
            theme: 'plain',
            styles: { cellPadding: { top: 15, bottom: 5 } },
            didDrawCell: (data) => {
                if (data.row.index === 0) {
                    doc.setLineWidth(0.2);
                    doc.line(data.cell.x + 5, data.cell.y + 12, data.cell.x + data.cell.width - 5, data.cell.y + 12);
                    doc.text('Prepared by', data.cell.x + data.cell.width / 2, data.cell.y + 18, { align: 'center' });
                    
                    doc.line(data.cell.x + data.cell.width + 5, data.cell.y + 12, data.cell.x + (data.cell.width * 2) - 5, data.cell.y + 12);
                    doc.text('Checked by', data.cell.x + data.cell.width + data.cell.width / 2, data.cell.y + 18, { align: 'center' });
                }
            }
        });

        doc.save(`Team_WorkLog_${log.date}_${teamNameMap.get(log.teamId)}.pdf`);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>In-house Team Work Records</CardTitle>
                            <CardDescription>Log daily work completed by your in-house teams against Plant Units.</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenLogForm()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Daily Log
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Team Name</TableHead>
                                    <TableHead>Items Recorded</TableHead>
                                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedLogs.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No daily logs found for any team.
                                    </TableCell></TableRow>
                                ) : (
                                    paginatedLogs.map((log) => {
                                        const uniqueKey = `${log.id}-${log.teamId}`;
                                        const isExpanded = expandedLogs.has(uniqueKey);
                                        const workItemsForTeam = log.work.filter(w => w.teamId === log.teamId);
                                        const siForTeam = (log.siteInstructions || []).filter(si => si.teamId === log.teamId);
                                        const totalItems = workItemsForTeam.length + siForTeam.length;

                                        return (
                                        <Fragment key={uniqueKey}>
                                            <TableRow onClick={() => toggleLogExpansion(uniqueKey)} className="cursor-pointer">
                                                <TableCell className="py-2 px-4">
                                                    <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                                </TableCell>
                                                <TableCell className="py-2 px-4">{format(parseISO(log.date), 'PPP')}</TableCell>
                                                <TableCell className="py-2 px-4">{teamNameMap.get(log.teamId) || 'N/A'}</TableCell>
                                                <TableCell className="py-2 px-4">{totalItems}</TableCell>
                                                <TableCell className="text-right py-2 px-4">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onSelect={() => handleOpenLogForm(log)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleExportPdf(log)}><FileDown className="mr-2 h-4 w-4" /> Export PDF</DropdownMenuItem>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors"><Trash2 className='mr-2 h-4 w-4'/>Delete</Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>This will delete all work items for this team on this date. Other teams' work on the same log will not be affected. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteLog(log)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                    <TableCell colSpan={5} className="p-0">
                                                        <div className="p-4">
                                                            <h4 className="font-semibold mb-2 text-sm">Recorded Items</h4>
                                                            <Table>
                                                                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Unit</TableHead></TableRow></TableHeader>
                                                                <TableBody>
                                                                    {workItemsForTeam.map(w => {
                                                                        const boqItem = project.engineeringBoq.find(i => i.id === w.boqItemId) || plantUnits.find(i => i.id === w.boqItemId);
                                                                        return <TableRow key={w.id}><TableCell className="py-1">{boqItem?.description || 'N/A'}</TableCell><TableCell className="text-right py-1">{w.quantity.toFixed(2)}</TableCell><TableCell className="py-1">{boqItem?.unit}</TableCell></TableRow>
                                                                    })}
                                                                    {siForTeam.map(si => (
                                                                        <TableRow key={si.id} className="bg-blue-50/50"><TableCell className="py-1">{si.description} <Badge variant="outline">Custom</Badge></TableCell><TableCell className="text-right py-1">{si.quantity?.toFixed(2)}</TableCell><TableCell className="py-1">{si.unit}</TableCell></TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                     {totalPages > 1 && (
                        <div className="flex items-center justify-end w-full space-x-4 pt-4">
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </span>
                            <div className="flex items-center space-x-2">
                                <Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1}>
                                    First
                                </Button>
                                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                                    Previous
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages}>
                                    Next
                                </Button>
                                <Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage >= totalPages}>
                                    Last
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isLogFormOpen} onOpenChange={(isOpen) => { if(!isOpen) { setIsLogFormOpen(false); setEditingLog(null); }}}>
                <DialogContent className="max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>{editingLog ? 'Edit' : 'Add'} Daily Work Log for Team</DialogTitle>
                        <DialogDescription>
                           Select a team and date, then add all work items completed by the team on that day.
                        </DialogDescription>
                    </DialogHeader>
                    <WorkRecordForm
                        project={project}
                        selectedPoId={null}
                        inHouseTeams={inHouseTeams}
                        editingLog={editingLog}
                        onSave={handleSaveLog}
                        onCancel={() => { setIsLogFormOpen(false); setEditingLog(null); }}
                        plantUnits={plantUnits}
                        context="Team"
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
