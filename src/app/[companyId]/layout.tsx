import { createClient } from '@/lib/supabase/server';
import MainLayout from '@/components/layout/main-layout';
import type { Company } from '@/lib/types';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';


export default async function CompanyAppLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: companyUser } = await supabase
    .from('company_users')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .single();

  if (!companyUser) {
    // User does not belong to this company, or company doesn't exist
    notFound();
  }
  
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    notFound();
  }

  return (
      <MainLayout userEmail={user.email!} companyName={company.name}>{children}</MainLayout>
  );
}
