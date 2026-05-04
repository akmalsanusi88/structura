
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
import type { GeneralTeamCost, InHouseTeam } from '@/lib/types';

const generalCostSchema = z.object({
  teamId: z.string().min(1, "Please select a team."),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format."),
  ppe: z.coerce.number().min(0, "Value must be positive."),
  vehicleUpkeep: z.coerce.number().min(0, "Value must be positive."),
  other: z.coerce.number().min(0, "Value must be positive."),
});

type GeneralCostFormValues = z.infer<typeof generalCostSchema>;

interface GeneralCostFormProps {
  cost?: GeneralTeamCost;
  teams: InHouseTeam[];
  onSave: (data: Omit<GeneralTeamCost, 'id' | 'companyId'>) => void;
  onCancel: () => void;
}

export default function GeneralCostForm({ cost, teams, onSave, onCancel }: GeneralCostFormProps) {
  const form = useForm<GeneralCostFormValues>({
    resolver: zodResolver(generalCostSchema),
    defaultValues: {
        teamId: cost?.teamId || '',
        month: cost?.month || '',
        ppe: cost?.ppe || 0,
        vehicleUpkeep: cost?.vehicleUpkeep || 0,
        other: cost?.other || 0,
    }
  });

  const onSubmit = (data: GeneralCostFormValues) => {
    onSave(data);
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
                        <SelectValue placeholder="Select a team" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {teams.map(team => (
                            <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))}
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
                    <Input type='month' placeholder="YYYY-MM" {...field} disabled={!!cost} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
                control={form.control}
                name="ppe"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>PPE</FormLabel>
                    <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="vehicleUpkeep"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Vehicle Upkeep</FormLabel>
                    <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="other"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Other</FormLabel>
                    <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
