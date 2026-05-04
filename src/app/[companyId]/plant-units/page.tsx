

import PlantUnitList from "./components/plant-unit-list";
import { createClient } from "@/lib/supabase/server";
import type { PlantUnit, Company, Contract } from "@/lib/types";

export default async function PlantUnitsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const supabase = await createClient();

  const [plantUnitsResult, directoryResult, contractsResult] = await Promise.all([
    supabase
      .from('plant_units')
      .select('*')
      .eq('company_id', companyId)
      .range(0, 10000),
    supabase
      .from('directory')
      .select('*')
      .order('name'),
    supabase
      .from('contracts')
      .select('*')
      .eq('company_id', companyId)
      .order('contract_no')
  ]);

  const { data, error } = plantUnitsResult;
  const { data: companiesData, error: companiesError } = directoryResult;
  const { data: contractsData, error: contractsError } = contractsResult;


  if (error || companiesError || contractsError) {
      console.error("Error fetching data:", JSON.stringify(error || companiesError, null, 2));
      return (
        <div className="flex flex-col h-full p-8">
            <div className="text-red-600 bg-red-100 p-4 rounded-md">
              <h3 className="font-bold">Data Loading Error</h3>
              <p>There was an error fetching the necessary data for this page. This usually happens when Row Level Security (RLS) is enabled but no access policies have been created for new tables.</p>
            </div>
        </div>
      )
  }
  
  // Manually map snake_case from DB to camelCase for the app
  const plantUnits: PlantUnit[] = (data || []).map(item => ({
      id: item.id,
      companyId: item.company_id,
      puId: item.pu_id,
      description: item.description,
      category: item.category,
      unit: item.unit,
      rate: item.rate,
      clientName: item.client_name,
      materialManagementFee: item.material_management_fee,
      hasSerialNo: item.has_serial_no,
      contractId: item.contract_id,
  }));
  
  const directory: Company[] = (companiesData || []).map(item => ({
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
    projects: [],
  }));


  return <PlantUnitList initialPlantUnits={plantUnits} directory={directory} contracts={contracts} />;
}
