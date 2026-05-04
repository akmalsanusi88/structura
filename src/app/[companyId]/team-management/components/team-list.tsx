
'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MoreVertical, Users, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import type { Project, InHouseTeam } from '@/lib/types';
import TeamForm from './team-form';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { addOrUpdateTeam, deleteTeam } from '@/app/login/actions';

interface TeamListProps {
  initialProjects: Project[];
  initialTeams: InHouseTeam[];
}

export default function TeamList({ initialProjects, initialTeams }: TeamListProps) {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const [teams, setTeams] = useState<InHouseTeam[]>(initialTeams);
  const [projects] = useState<Project[]>(initialProjects);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<InHouseTeam | undefined>(undefined);
  const { toast } = useToast();

  const handleOpenForm = (team?: InHouseTeam) => {
    setEditingTeam(team);
    setIsFormOpen(true);
  };
  
  const handleCloseForm = () => {
      setIsFormOpen(false);
      setEditingTeam(undefined);
  }

  const handleSaveTeam = async (teamData: InHouseTeam) => {
    handleCloseForm();
    try {
      await addOrUpdateTeam(teamData, companyId);
      toast({ title: "Success", description: `Team ${editingTeam ? 'updated' : 'created'} successfully.` });
      router.refresh();
    } catch (error) {
      console.error("Error saving team:", error);
      toast({ title: "Error", description: "Failed to save team.", variant: "destructive" });
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await deleteTeam(teamId, companyId);
      toast({ title: "Success", description: "Team deleted." });
      router.refresh();
    } catch (error) {
      console.error("Error deleting team:", error);
      toast({ title: "Error", description: "Failed to delete team.", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold font-headline">Manage Teams</h2>
                <p className="text-muted-foreground">Create and manage your in-house teams.</p>
            </div>
            <Button onClick={() => handleOpenForm()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Team
            </Button>
        </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team => (
          <Card key={team.id}>
            <CardHeader className='flex-row items-start justify-between'>
              <div>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {team.name}
                </CardTitle>
                <CardDescription>{team.members.length} members</CardDescription>
              </div>
               <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className='h-8 w-8 -mt-2'>
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleOpenForm(team)}><Pencil className='mr-2 h-4 w-4'/>Edit</DropdownMenuItem>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors">
                                    <Trash2 className='mr-2 h-4 w-4'/>Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete the team. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTeam(team.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent>
                <div className='space-y-4'>
                    <div>
                        <h4 className='font-semibold text-sm mb-2'>Members</h4>
                        <ul className="text-sm text-muted-foreground list-disc pl-5">
                            {team.members.map(member => <li key={member}>{member}</li>)}
                        </ul>
                    </div>
                </div>
            </CardContent>
          </Card>
        ))}
      </div>

       <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Edit' : 'Create'} Team</DialogTitle>
            <DialogDescription>
              {editingTeam ? 'Update the details for your team.' : 'Add a new team to manage.'}
            </DialogDescription>
          </DialogHeader>
          <TeamForm onSave={handleSaveTeam} onCancel={handleCloseForm} team={editingTeam} companyId={companyId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
