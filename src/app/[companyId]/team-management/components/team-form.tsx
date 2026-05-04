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
import { Textarea } from '@/components/ui/textarea';
import type { InHouseTeam } from '@/lib/types';

const teamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  members: z.string().min(1, 'Please list at least one member'),
});

type TeamFormValues = z.infer<typeof teamSchema>;

interface TeamFormProps {
  team?: InHouseTeam;
  onSave: (data: InHouseTeam) => void;
  onCancel: () => void;
  companyId: string;
}

export default function TeamForm({ team, onSave, onCancel, companyId }: TeamFormProps) {
  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: team 
      ? { ...team, members: team.members.join('\n') } 
      : { name: '', members: '' },
  });

  const onSubmit = (data: TeamFormValues) => {
    const newTeam: InHouseTeam = {
      id: team?.id || `team-${Date.now()}`,
      name: data.name,
      members: data.members.split('\n').filter(m => m.trim() !== ''),
      companyId: companyId,
    };
    onSave(newTeam);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Alpha Builders" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="members"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Members</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter one member name per line"
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save Team</Button>
        </div>
      </form>
    </Form>
  );
}
