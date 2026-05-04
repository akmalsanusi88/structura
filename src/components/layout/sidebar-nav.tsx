
'use client';

import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { usePathname, useParams, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Briefcase,
  Wrench,
  Users,
  FileText,
  Banknote,
  LogOut,
  User as UserIcon,
  Building,
  Package,
  Contact,
  FileSignature,
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { logout } from '@/app/login/actions';
import { Button } from '../ui/button';
import { useState, useEffect, useTransition } from 'react';
import { Loader2 } from 'lucide-react';


export default function SidebarNav({ userEmail, companyName }: { userEmail: string, companyName: string }) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const [isNavigating, setIsNavigating] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPending, startTransition] = useTransition();

  const links = [
    {
      href: `/${companyId}`,
      label: 'Dashboard',
      icon: LayoutGrid,
    },
    {
      href: `/${companyId}/contracts`,
      label: 'Contracts',
      icon: FileSignature,
    },
    {
      href: `/${companyId}/projects`,
      label: 'Projects',
      icon: Briefcase,
    },
    {
      href: `/${companyId}/invoicing`,
      label: 'Invoicing',
      icon: Banknote,
    },
    {
      href: `/${companyId}/plant-units`,
      label: 'Plant Units',
      icon: Wrench,
    },
    {
      href: `/${companyId}/team-management`,
      label: 'Team Management',
      icon: Users,
    },
    {
      href: `/${companyId}/material-management`,
      label: 'Material Management',
      icon: Package,
    },
    {
      href: `/${companyId}/reports`,
      label: 'Reports',
      icon: FileText,
    },
     {
      href: `/${companyId}/directory`,
      label: 'Directory',
      icon: Contact,
    },
  ];

  const handleNavClick = (href: string) => {
    if (pathname !== href) {
        setIsNavigating(href);
        startTransition(() => {
            router.push(href);
        });
    }
  };
  
  useEffect(() => {
    if (!isPending) {
      setIsNavigating(null);
    }
  }, [pathname, isPending]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Logo className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold font-headline text-sidebar-foreground">
            Structura
          </h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {links.map((link) => (
            <SidebarMenuItem key={link.href}>
              <SidebarMenuButton
                isActive={pathname.startsWith(link.href) && (link.href.length > `/${companyId}`.length || pathname === link.href)}
                className="justify-start"
                onClick={() => handleNavClick(link.href)}
              >
                  {isNavigating === link.href ? <Loader2 className="animate-spin" /> : <link.icon className="h-4 w-4" />}
                  <span>{link.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
         <div className="p-2 flex flex-col gap-1 text-sm text-sidebar-foreground/80">
            <div className='flex items-center gap-2 px-2 py-1.5'>
                <UserIcon className="h-4 w-4 shrink-0" />
                <span className='truncate' title={userEmail}>{userEmail}</span>
            </div>
             <Link href="/select-company" className='flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'>
                <Building className="h-4 w-4 shrink-0" />
                <span className='truncate' title={companyName}>{companyName}</span>
            </Link>
        </div>
        <SidebarSeparator />
        <form action={handleLogout}>
            <Button type="submit" variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground" isPending={isLoggingOut}>
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
            </Button>
        </form>
      </SidebarFooter>
    </>
  );
}
