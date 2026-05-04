
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { PurchaseOrder, Company, Project } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const poPdfSchema = z.object({
  poNo: z.string(),
  poDate: z.string(),
  supplierName: z.string().min(1, "Supplier name is required."),
  supplierAddress: z.string().min(1, "Supplier address is required."),
  attn: z.string().min(1, "Attention person is required."),
  poTitle: z.string().min(1, "PO Title is required."),
  paymentTerms: z.string().min(1, "Payment terms are required."),
  refQuotationNo: z.string().optional(),
  projectRefInfo: z.string().optional(),
  showManagementFee: z.boolean().optional(),
  enableSst: z.boolean().optional(),
  sstPercentage: z.coerce.number().optional(),
});

type PoPdfFormValues = z.infer<typeof poPdfSchema>;

interface SubconPoPdfFormProps {
  purchaseOrder: PurchaseOrder;
  project: Project;
  company: Company | undefined | null;
  allCompanies: Company[];
  onCancel: () => void;
}

const wordWrap = (text: string, maxWidth: number, doc: jsPDF) => {
    return doc.splitTextToSize(text, maxWidth);
};

// Function to convert number to words
const numberToWords = (num: number): string => {
    const a = [
        '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
        'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
    ];
    const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const g = ['', 'THOUSAND', 'MILLION', 'BILLION', 'TRILLION'];

    const toWords = (n: number): string => {
        let str = '';
        if (n >= 100) {
            str += a[Math.floor(n / 100)] + ' HUNDRED ';
            n %= 100;
        }
        if (n >= 20) {
            str += b[Math.floor(n / 10)] + ' ';
            n %= 10;
        }
        if (n > 0) {
            str += a[n] + ' ';
        }
        return str;
    };
    
    if (num === 0) return 'ZERO';

    let words = '';
    let i = 0;

    do {
        let n = num % 1000;
        if (n !== 0) {
            words = toWords(n) + g[i] + ' ' + words;
        }
        i++;
        num = Math.floor(num / 1000);
    } while (num > 0);

    return words.trim();
};

export default function SubconPoPdfForm({ purchaseOrder, project, company, allCompanies, onCancel }: SubconPoPdfFormProps) {
  const { toast } = useToast();

  const subconCompany = allCompanies.find(c => c.name === purchaseOrder.issuer);
  
  const form = useForm<PoPdfFormValues>({
    resolver: zodResolver(poPdfSchema),
    defaultValues: {
      poNo: purchaseOrder.poNo,
      poDate: format(parseISO(purchaseOrder.poDate), 'dd MMM yyyy'),
      supplierName: purchaseOrder.issuer,
      supplierAddress: subconCompany?.address || '',
      attn: subconCompany?.attn || '',
      poTitle: 'PURCHASE ORDER',
      paymentTerms: '30 days upon receipt of invoice.',
      refQuotationNo: '',
      projectRefInfo: `Project: ${project.name}, Project No: ${project.projectNo || 'N/A'}`,
      showManagementFee: purchaseOrder.items.some(i => (i.managementFee || 0) > 0),
      enableSst: (purchaseOrder.sstPercentage || 0) > 0,
      sstPercentage: purchaseOrder.sstPercentage || 6,
    },
  });

  const watchEnableSst = form.watch('enableSst');

  const onSubmit = (data: PoPdfFormValues) => {
    try {
        const doc = new jsPDF();
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 15;
        const max_width = page_width - margin * 2;
        let y = 50; // Start lower to leave space for letterhead

        // PO Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(data.poTitle.toUpperCase(), page_width / 2, y, { align: 'center' });
        y += 10;
        
        doc.setLineWidth(0.5);
        doc.line(margin, y - 5, page_width - margin, y - 5);

        // Supplier and PO Details
        const half_width = page_width / 2;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('TO:', margin, y);
        
        doc.setFont('helvetica', 'normal');
        const supplierAddressLines = wordWrap(data.supplierAddress, half_width - margin - 5, doc);
        doc.text(`${data.supplierName}\n${supplierAddressLines.join('\n')}`, margin, y + 5);
        
        const attn_y = y + 5 + (supplierAddressLines.length + 1) * 5;
        doc.setFont('helvetica', 'bold');
        doc.text('ATTN:', margin, attn_y);
        doc.setFont('helvetica', 'normal');
        doc.text(data.attn, margin + 12, attn_y);

        // --- PO Details (Right aligned) ---
        let details_y = y;
        const right_margin = page_width - margin;
        
        const drawDetailRow = (label: string, value: string, yPos: number) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, right_margin - 40, yPos, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.text(value, right_margin, yPos, { align: 'right' });
            return yPos + 5;
        };
        
        details_y = drawDetailRow('PO No.:', data.poNo, details_y);
        details_y = drawDetailRow('Date:', data.poDate, details_y);

        if (data.refQuotationNo) {
            details_y = drawDetailRow('Ref. Quotation No.:', data.refQuotationNo, details_y);
        }

        y = Math.max(attn_y, details_y) + 10;

        if (data.projectRefInfo) {
            doc.setFont('helvetica', 'bold');
            doc.text('Re:', margin, y);
            doc.setFont('helvetica', 'normal');
            const projectRefLines = wordWrap(data.projectRefInfo, max_width - 10, doc);
            doc.text(projectRefLines, margin + 10, y);
            y += (projectRefLines.length * 5) + 5;
        }

        const formatNumber = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const itemsSubtotal = purchaseOrder.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const itemsMmfTotal = data.showManagementFee ? purchaseOrder.items.reduce((sum, item) => sum + (item.managementFee || 0), 0) : 0;
        const totalBeforeTax = itemsSubtotal + itemsMmfTotal;
        const sstAmount = data.enableSst ? (totalBeforeTax * (data.sstPercentage || 0) / 100) : 0;
        const grandTotal = totalBeforeTax + sstAmount;

        const showMmfColumn = data.showManagementFee && purchaseOrder.items.some(i => (i.managementFee || 0) > 0);
        
        // Table Head
        const headRow = ['No.', 'PU No.', 'Description', 'Unit', 'Qty', 'Unit Price (RM)'];
        if (showMmfColumn) headRow.push('Mngmt Fee (RM)');
        headRow.push('Amount (RM)');
        const head = [headRow];

        // Table Body
        const body = purchaseOrder.items.map((item, index) => {
            const baseAmount = item.quantity * item.rate;
            const finalAmount = baseAmount + (showMmfColumn ? (item.managementFee || 0) : 0);
            const row = [
                (index + 1).toString(),
                item.puNo || 'N/A',
                item.description,
                item.unit,
                formatNumber(item.quantity),
                formatNumber(item.rate)
            ];
            if (showMmfColumn) row.push(formatNumber(item.managementFee || 0));
            row.push(formatNumber(finalAmount));
            return row;
        });

        const labelColSpan = head[0].length - 1;
        const foot: any[][] = [
            [{content: 'Subtotal', colSpan: labelColSpan, styles: { halign: 'right' }}, formatNumber(itemsSubtotal)],
        ];

        if (showMmfColumn && itemsMmfTotal > 0) {
            foot.push([{content: 'Material Management Fee', colSpan: labelColSpan, styles: { halign: 'right' }}, formatNumber(itemsMmfTotal)]);
        }

        if (data.enableSst && sstAmount > 0) {
            foot.push([{content: `SST (${data.sstPercentage}%)`, colSpan: labelColSpan, styles: { halign: 'right' }}, formatNumber(sstAmount)]);
        }
        
        foot.push([{content: 'Grand Total', colSpan: labelColSpan, styles: { fontStyle: 'bold', halign: 'right' }}, formatNumber(grandTotal)]);


        (doc as any).autoTable({
            head,
            body,
            foot,
            startY: y,
            theme: 'grid',
            headStyles: { fillColor: [34, 48, 62], textColor: 255, fontSize: 8 },
            footStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0, fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            didParseCell: function(data: any) {
                if (data.column.index > 3 && data.row.section !== 'head') {
                    data.cell.styles.halign = 'right';
                }
                 if (data.column.index === 0) {
                     data.cell.styles.halign = 'center';
                 }
            }
        });
        
        y = (doc as any).lastAutoTable.finalY + 10;

        // Total in words
        const ringgit = Math.floor(grandTotal);
        const cents = Math.round((grandTotal - ringgit) * 100);
        const totalInWords = `RINGGIT MALAYSIA ${numberToWords(ringgit)}` + (cents > 0 ? ` AND CENTS ${numberToWords(cents)} ONLY` : ' ONLY');

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const totalInWordsLines = wordWrap(totalInWords, max_width, doc);
        doc.text(totalInWordsLines, margin, y);

        y += totalInWordsLines.length * 5 + 15;


        // Footer - Payment Terms and Signature
        doc.setFont('helvetica', 'bold');
        doc.text('Payment Terms:', margin, y);
        doc.setFont('helvetica', 'normal');
        const paymentTermsLines = wordWrap(data.paymentTerms, max_width, doc);
        doc.text(paymentTermsLines, margin, y + 5);
        y += paymentTermsLines.length * 5 + 20;
        
        doc.setFont('helvetica', 'bold');
        doc.text(company?.name || 'Structura', margin, y);
        
        doc.save(`${data.poTitle.replace(/\s+/g, '_')}_${data.poNo}.pdf`);
        toast({ title: "Success", description: "PDF has been generated." });
        onCancel();

    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
        <FormField
          control={form.control}
          name="poTitle"
          render={({ field }) => (
            <FormItem className="md:col-span-3">
              <FormLabel>PO Title</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="poNo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PO No.</FormLabel>
              <FormControl><Input {...field} readOnly /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="poDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PO Date</FormLabel>
              <FormControl><Input {...field} readOnly /></FormControl>
            </FormItem>
          )}
        />
        <div /> 
        <FormField
          control={form.control}
          name="supplierName"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Subcontractor Name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="attn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Attention To</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="supplierAddress"
          render={({ field }) => (
            <FormItem className="md:col-span-3">
              <FormLabel>Subcontractor Address</FormLabel>
              <FormControl><Textarea {...field} rows={2} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="projectRefInfo"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Project Ref. Info</FormLabel>
              <FormControl><Textarea placeholder="e.g. Project: Skyscraper One, PO: CL-001" {...field} rows={2} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="refQuotationNo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ref. Quotation No.</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="paymentTerms"
          render={({ field }) => (
            <FormItem className="md:col-span-3">
              <FormLabel>Payment Terms</FormLabel>
              <FormControl><Textarea {...field} rows={2} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="md:col-span-3 flex flex-wrap items-center gap-6 pt-4 border-t">
            <FormField
                control={form.control}
                name="showManagementFee"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between gap-2 space-y-0">
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <FormLabel>Show Material Management Fee</FormLabel>
                    </FormItem>
                )}
            />
            <div className="flex items-center gap-4">
                <FormField control={form.control} name="enableSst" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between gap-2 space-y-0">
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel>Enable SST</FormLabel>
                    </FormItem>
                )} />
                {watchEnableSst && (
                    <FormField control={form.control} name="sstPercentage" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                            <FormLabel className='text-sm'>Rate (%):</FormLabel>
                            <FormControl><Input type="number" step="0.1" className="w-20 h-8" {...field} /></FormControl>
                        </FormItem>
                    )} />
                )}
            </div>
        </div>
        <div className="md:col-span-3 flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Proceed Export PDF</Button>
        </div>
      </form>
    </Form>
  );
}
