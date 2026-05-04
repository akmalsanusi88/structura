
import Header from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import type { Contract, Project, Company } from "@/lib/types";
import ContractList from "./components/contract-list";

export default async function ContractsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const supabase = await createClient();

  const { data: contractsData, error: contractsError } = await supabase
    .from('contracts')
    .select('*, projects(id, name, status)')
    .eq('company_id', companyId);
    
  const { data: directoryData, error: directoryError } = await supabase
    .from('directory')
    .select('*')
    .order('name');


  if (contractsError || directoryError) {
    console.error("Error fetching data:", contractsError || directoryError);
    return <div>Error loading data. Please check server logs.</div>;
  }
  
  const contracts: Contract[] = (contractsData || []).map((c: any) => ({
    id: c.id,
    companyId: c.company_id,
    contractNo: c.contract_no,
    title: c.title,
    clientName: c.client_name,
    value: c.value,
    startDate: c.start_date,
    endDate: c.end_date,
    status: c.status,
    projects: (c.projects || []) as Project[],
  }));

  const directory: Company[] = (directoryData || []).map(item => ({
      id: item.id,
      name: item.name,
      address: item.address,
      phone: item.phone,
      email: item.email,
      attn: item.attn,
      bankName: item.bank_name,
      bankAccNo: item.bank_acc_no,
      bankAddress: item.bank_address,
  }));


  return (
    <div className="flex flex-col h-full">
      <Header title="Contract Records" />
      <main className="flex-1 p-4 md:p-6">
        <ContractList initialContracts={contracts} directory={directory} />
      </main>
    </div>
  );
}
