'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TeamCost, InHouseTeam, Project } from '@/lib/types';

const teamCostSchema = z.object({
  teamId: z.string().min(1, "Please select a team."),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format."),
  salary: z.coerce.number().min(0, "Salary must be a positive number."),
  petrolAndToll: z.coerce.number().min(0, "Value must be positive."),
  siteExpenses: z.coerce.number().min(0, "Value must be positive."),
  machineryAndUpkeep: z.coerce.number().min(0, "Value must be positive."),
});

type TeamCostFormValues = z.infer<typeof teamCostSchema>;

interface TeamCostFormProps {
  project: Project;
  cost?: TeamCost;
  onSave: (data: TeamCost) => void;
  onCancel: () => void;
}

export default function TeamCostForm({ project, cost, onSave, onCancel }: TeamCostFormProps) {
    const assignedTeams = project.purchaseOrders
        ?.filter(po => po.type === 'Subcontractor' && po.teamId)
        .map(po => ({ id: po.teamId!, name: po.issuer })) || [];
  
  const form = useForm<TeamCostFormValues>({
    resolver: zodResolver(teamCostSchema),
    defaultValues: cost || {
        teamId: '',
        month: '',
        salary: 0,
        petrolAndToll: 0,
        siteExpenses: 0,
        machineryAndUpkeep: 0,
    }
  });

  const onSubmit = (data: TeamCostFormValues) => {
    const newCost: TeamCost = {
      id: cost?.id || `tc-${Date.now()}`,
      ...data,
    };
    onSave(newCost);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="teamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!cost}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an assigned team" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {assignedTeams.length > 0 ? (
                            assignedTeams.map(team => (
                                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                            ))
                        ) : (
                            <SelectItem value="disabled" disabled>No in-house teams on this project</SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Month</FormLabel>
                  <FormControl>
                    <Input placeholder="YYYY-MM" {...field} disabled={!!cost} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        
        <FormField
            control={form.control}
            name="salary"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Wages / Salary</FormLabel>
                <FormControl>
                <Input type="number" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        
        <div className="grid grid-cols-3 gap-4">
            <FormField
                control={form.control}
                name="petrolAndToll"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Petrol & Toll</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="siteExpenses"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Site Expenses</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="machineryAndUpkeep"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Machinery/Vehicle</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save Cost Entry</Button>
        </div>
      </form>
    </Form>
  );
}
