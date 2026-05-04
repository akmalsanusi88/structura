
'use client';

import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import SidebarNav from './sidebar-nav';

export default function MainLayout({ children, userEmail, companyName }: { children: React.ReactNode, userEmail: string, companyName: string }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarNav userEmail={userEmail} companyName={companyName} />
      </Sidebar>
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
