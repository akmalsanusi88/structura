
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
import type { Company } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  attn: z.string().optional(),
  bankName: z.string().optional(),
  bankAccNo: z.string().optional(),
  bankAddress: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

interface CompanyFormProps {
  company?: Company;
  onSave: (data: Partial<Company>) => Promise<void>;
  onCancel: () => void;
}

export default function CompanyForm({ company, onSave, onCancel }: CompanyFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name || '',
      email: company?.email || '',
      phone: company?.phone || '',
      address: company?.address || '',
      attn: company?.attn || '',
      bankName: company?.bankName || '',
      bankAccNo: company?.bankAccNo || '',
      bankAddress: company?.bankAddress || '',
    },
  });

  const onSubmit = async (data: CompanyFormValues) => {
    setIsSaving(true);
    try {
      await onSave({ ...company, ...data });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not save company.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Global Construction Sdn Bhd" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="attn"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Person in Charge (PIC)</FormLabel>
                <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" placeholder="e.g., contact@global.com" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
             <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input placeholder="e.g., 012-3456789" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

         <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl><Textarea placeholder="Company address" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
        />

        <div className="space-y-4 border-t pt-4">
            <h3 className='font-medium'>Bank Details</h3>
             <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Bank Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Maybank" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="bankAccNo"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl><Input placeholder="e.g., 1234567890" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="bankAddress"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Bank Address</FormLabel>
                    <FormControl><Textarea placeholder="Bank branch address" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" isPending={isSaving}>Save Company</Button>
        </div>
      </form>
    </Form>
  );
}
