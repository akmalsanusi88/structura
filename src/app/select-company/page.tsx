
'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Building2, LogOut, Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons';
import { logout } from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

interface Company {
    id: string;
    name: string;
}

export default function CompanySelectionPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserCompanies = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            router.push('/login');
            return;
        }

        const { data: companyUsers, error: companyUsersError } = await supabase
            .from('company_users')
            .select('company_id')
            .eq('user_id', user.id);

        if (companyUsersError) {
            console.error('Error fetching company users:', companyUsersError);
            setLoading(false);
            return;
        }

        if (companyUsers.length === 0) {
            setCompanies([]);
            setLoading(false);
            return;
        }
        
        const companyIds = companyUsers.map(cu => cu.company_id);
        const { data: companiesData, error: companiesError } = await supabase
            .from('companies')
            .select('id, name')
            .in('id', companyIds);
        
        if (companiesError) {
            console.error('Error fetching companies:', companiesError);
        } else {
            setCompanies(companiesData || []);
        }

        setLoading(false);
    };
    fetchUserCompanies();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  const handleCompanyClick = (companyId: string) => {
    setNavigatingTo(companyId);
    router.push(`/${companyId}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/50 p-4">
      <div className='mb-8 flex items-center gap-2'>
        <Logo className="w-10 h-10 text-primary" />
        <h1 className="text-3xl font-bold font-headline">
            Structura
        </h1>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">Select a Company</CardTitle>
          <CardDescription>Choose which company workspace you want to access.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {loading ? (
            <div className='space-y-4'>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
          ) : companies.length > 0 ? (
            companies.map((company) => (
              <Button
                key={company.id}
                variant="outline"
                className="h-auto justify-start p-4 transition-all hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleCompanyClick(company.id)}
                isPending={navigatingTo === company.id}
              >
                  <div className="flex items-center gap-4 w-full">
                    <div className="bg-primary/10 p-3 rounded-full shrink-0">
                        <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-left">{company.name}</p>
                    </div>
                  </div>
              </Button>
            ))
          ) : (
            <p className="text-center text-muted-foreground">You are not a member of any company.</p>
          )}
        </CardContent>
         <CardFooter>
            <form action={handleLogout} className="w-full">
                <Button variant="outline" className="w-full" type="submit" isPending={isLoggingOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </Button>
            </form>
        </CardFooter>
      </Card>
    </div>
  );
}
