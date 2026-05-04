
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/layout/header";
import DirectoryList from "./components/directory-list";
import type { Company } from "@/lib/types";

export default async function DirectoryPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params;
    const supabase = await createClient();
    
    const { data, error } = await supabase.from('directory').select('*').order('name');

    if (error) {
        console.error("Error fetching companies:", error);
        return <div>Error loading directory. Check console for details.</div>
    }

    const companies: Company[] = (data || []).map(item => ({
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
            <Header title="Directory" />
            <main className="flex-1 p-4 md:p-6">
                <DirectoryList companies={companies || []} companyId={params.companyId} />
            </main>
        </div>
    )
}
