
'use client';

import Header from "@/components/layout/header";
import InvoiceList from './components/invoice-list';
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { Project, SupplierInvoice } from "@/lib/types";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function InvoicingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const companyId = params.companyId as string;
  
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      const supabase = createClient();
      
      const { data: mainProjects, error: mainProjectsError } = await supabase
        .from('projects')
        .select(`*, claims ( * ), purchase_orders ( * )`)
        .eq('company_id', companyId);

      if (mainProjectsError) {
        console.error("Error loading projects for invoicing:", mainProjectsError);
        setLoading(false);
        return;
      }
      
      const mainProjectIds = mainProjects.map(p => p.id);
      
      if (mainProjectIds.length > 0) {
        const { data: linkedProjectsData } = await supabase
          .from('projects')
          .select('id, originating_project_id, claims(*), purchase_orders(id, originating_po_id, po_no)')
          .in('originating_project_id', mainProjectIds);

        if (linkedProjectsData) {
            const mainProjectsMap = new Map(mainProjects.map(p => [p.id, p]));

            linkedProjectsData.forEach(subconProject => {
                const mainProject = mainProjectsMap.get(subconProject.originating_project_id);
                if (!mainProject) return;

                const subconClientClaims = (subconProject.claims || []).filter((c: any) => c.type === 'Client');
                
                subconClientClaims.forEach((claim: any) => {
                    const subconClientPo = (subconProject.purchase_orders || []).find((p: any) => p.id === claim.purchase_order_id);
                    if (!subconClientPo || !subconClientPo.originating_po_id) return;

                    const mainContractorPo = (mainProject.purchase_orders || []).find((p:any) => p.id === subconClientPo.originating_po_id);
                    if (!mainContractorPo) return;
                    
                    const mappedClaim = {
                        ...claim,
                        type: 'Subcontractor',
                        purchaseOrderId: subconClientPo.originating_po_id,
                        purchase_order_id: subconClientPo.originating_po_id,
                        purchaseOrderNo: mainContractorPo.po_no,
                    };
                    
                    if (!mainProject.claims) {
                        mainProject.claims = [];
                    }
                    mainProject.claims.push(mappedClaim);
                });
            });
        }
      }
      
      setProjects((mainProjects || []).map((p: any) => ({
            id: p.id,
            companyId: p.company_id,
            name: p.name,
            projectNo: p.projectno,
            client: p.client,
            supervisor: p.supervisor,
            planner: p.planner,
            status: p.status,
            budgetedCost: p.budgetedcost,
            actualCost: p.actualcost,
            revenue: p.revenue,
            progress: p.progress,
            startDate: p.startdate,
            targetCompletionDate: p.targetcompletiondate,
            actualCompletionDate: p.actualcompletiondate,
            clientBoq: p.clientboq || [],
            engineeringBoq: p.engineeringboq || [],
            materialBoq: p.materialboq || [],
            purchaseOrders: (p.purchase_orders || []).map((po: any) => ({...po, poNo: po.po_no})),
            dailyActivities: [],
            materialRequisitions: [],
            materialIssuances: [],
            materialReturns: [],
            clientClaims: (p.claims || []).filter((c: any) => c.type === 'Client').map((claim: any) => ({ ...claim, projectId: claim.project_id, purchaseOrderId: claim.purchase_order_id, claimNo: claim.claim_no, invoiceNo: claim.invoice_no, statusDates: claim.status_dates, isFinal: claim.is_final, hasRetention: claim.has_retention, retentionPercentage: claim.retention_percentage, retentionAmount: claim.retention_amount, claimedItems: claim.claimed_items })),
            subconClaims: (p.claims || []).filter((c: any) => c.type === 'Subcontractor').map((claim: any) => ({ ...claim, projectId: claim.project_id, purchaseOrderId: claim.purchase_order_id, claimNo: claim.claim_no, invoiceNo: claim.invoice_no, statusDates: claim.status_dates, isFinal: claim.is_final, hasRetention: claim.has_retention, retentionPercentage: claim.retention_percentage, retentionAmount: claim.retention_amount, claimedItems: claim.claimed_items })),
            teamCosts: [],
        })) || []);

      const { data: supplierInvoicesData, error: supplierInvoicesError } = await supabase.from('supplier_invoices').select('*').eq('company_id', companyId);
      const { data: materialPOsResult, error: materialPOsError } = await supabase.from('material_purchase_orders').select('id, po_no').eq('company_id', companyId);

      if (supplierInvoicesError || materialPOsError) {
          console.error("Error fetching material invoices or POs:", supplierInvoicesError || materialPOsError);
      } else {
        const poNoMap = new Map(materialPOsResult?.map(po => [po.id, po.po_no]) || []);
        setSupplierInvoices((supplierInvoicesData || []).map((inv: any) => ({
            id: inv.id,
            companyId: inv.company_id,
            invoiceNo: inv.invoice_no,
            invoiceDate: inv.invoice_date,
            dueDate: inv.due_date,
            supplier: inv.supplier,
            materialPurchaseOrderId: inv.material_purchase_order_id,
            poNo: poNoMap.get(inv.material_purchase_order_id) || 'N/A',
            deliveryOrderIds: inv.delivery_order_ids || [],
            amount: inv.amount,
            status: inv.status,
            statusDates: inv.status_dates
        })));
      }
        
      setLoading(false);
    };

    if (companyId) {
      fetchAllData();
    }
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Invoicing" />
        <main className="flex-1 p-4 md:p-6 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-64 w-full" />
        </main>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-full">
        <Header title="Invoicing" />
        <main className="flex-1 p-4 md:p-6">
            <InvoiceList allProjects={projects} supplierInvoices={supplierInvoices} />
        </main>
    </div>
  )
}
