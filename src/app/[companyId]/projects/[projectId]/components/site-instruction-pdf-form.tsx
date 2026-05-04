
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SiteInstruction, Company, Project, PurchaseOrder } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';

const siPdfSchema = z.object({
  docTitle: z.string().min(1, "Title is required."),
  docDate: z.date({ required_error: "A date is required." }),
  clientName: z.string().min(1, "Client name is required."),
  clientAddress: z.string().optional(),
  attn: z.string().optional(),
  projectRefInfo: z.string().optional(),
  refQuotationNo: z.string().optional(),
  termsAndConditions: z.string().optional(),
  showManagementFee: z.boolean().default(true),
  enableSst: z.boolean().default(false),
  sstPercentage: z.coerce.number().optional(),
});

type PdfFormValues = z.infer<typeof siPdfSchema>;

interface SiteInstructionPdfFormProps {
  siteInstructions: SiteInstruction[];
  project: Project;
  company: Company | undefined | null;
  allCompanies: Company[];
  purchaseOrder: PurchaseOrder;
  onCancel: () => void;
}

const wordWrap = (text: string, maxWidth: number, doc: jsPDF) => {
    return doc.splitTextToSize(text, maxWidth);
};

const numberToWords = (num: number): string => {
    const a = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const g = ['', 'THOUSAND', 'MILLION', 'BILLION', 'TRILLION'];

    const toWords = (n: number): string => {
        let str = '';
        if (n >= 100) { str += a[Math.floor(n / 100)] + ' HUNDRED '; n %= 100; }
        if (n >= 20) { str += b[Math.floor(n / 10)] + ' '; n %= 10; }
        if (n > 0) { str += a[n] + ' '; }
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

export default function SiteInstructionPdfForm({ siteInstructions, project, company, allCompanies, purchaseOrder, onCancel }: SiteInstructionPdfFormProps) {
  const { toast } = useToast();
  const clientCompany = allCompanies.find(c => c.name === project.client);
  
  const form = useForm<PdfFormValues>({
    resolver: zodResolver(siPdfSchema),
    defaultValues: {
      docTitle: 'QUOTATION FOR ADDITIONAL WORK',
      docDate: new Date(),
      clientName: project.client,
      clientAddress: clientCompany?.address || '',
      attn: clientCompany?.attn || '',
      projectRefInfo: `Re: ${project.name}`,
      refQuotationNo: '',
      termsAndConditions: "Validity : 30 Days\nPayment : 30 Days upon submission of invoice. Interest of 1.5% per month shall be chargeable for late payment.",
      showManagementFee: siteInstructions.some(si => (si.managementFee || 0) > 0),
      enableSst: purchaseOrder.sstPercentage ? purchaseOrder.sstPercentage > 0 : false,
      sstPercentage: purchaseOrder.sstPercentage || 6,
    },
  });
  
  const watchEnableSst = form.watch('enableSst');
  const watchShowManagementFee = form.watch('showManagementFee');

  const onSubmit = (data: PdfFormValues) => {
    try {
        const doc = new jsPDF();
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 15;
        const max_width = page_width - margin * 2;
        let y = 35;

        // Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(data.docTitle.toUpperCase(), page_width / 2, y, { align: 'center' });
        y += 10;
        
        doc.setLineWidth(0.5);
        doc.line(margin, y - 5, page_width - margin, y - 5);

        // Client and Doc Details
        const half_width = page_width / 2;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('TO:', margin, y);
        
        doc.setFont('helvetica', 'normal');
        const clientAddressLines = wordWrap(data.clientAddress || '', half_width - margin - 5, doc);
        doc.text(`${data.clientName}\n${clientAddressLines.join('\n')}`, margin, y + 5);
        
        let leftBlockY = y + 5 + (clientAddressLines.length + 1) * 5;
        if(data.attn) {
            doc.setFont('helvetica', 'bold');
            doc.text('ATTN:', margin, leftBlockY);
            doc.setFont('helvetica', 'normal');
            doc.text(data.attn, margin + 12, leftBlockY);
            leftBlockY += 10;
        }

        let rightBlockY = y;
        const rightColX = page_width - margin;
        const drawDetailRow = (label: string, value: string, yPos: number) => {
            if (!value) return yPos;
            doc.setFont('helvetica', 'bold');
            doc.text(label, rightColX - 50, yPos, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.text(value, rightColX, yPos, { align: 'right' });
            return yPos + 5;
        };
        rightBlockY = drawDetailRow('Date:', format(data.docDate, 'dd MMM yyyy'), rightBlockY);
        if (data.refQuotationNo) {
            rightBlockY = drawDetailRow('Our Ref:', data.refQuotationNo, rightBlockY);
        }
        
        y = Math.max(leftBlockY, rightBlockY) + 5;

        if (data.projectRefInfo) {
            doc.setFont('helvetica', 'bold');
            doc.text('Re:', margin, y);
            doc.setFont('helvetica', 'normal');
            const projectRefLines = wordWrap(data.projectRefInfo, max_width - 10, doc);
            doc.text(projectRefLines, margin + 10, y);
            y += (projectRefLines.length * 5) + 5;
        }

        const formatNumber = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const subtotal = siteInstructions.reduce((sum, si) => sum + (si.rate || 0) * (si.quantity || 0), 0);
        const totalManagementFee = watchShowManagementFee ? siteInstructions.reduce((sum, si) => sum + (si.managementFee || 0), 0) : 0;
        const totalBeforeTax = subtotal + totalManagementFee;
        const sstAmount = data.enableSst ? totalBeforeTax * ((data.sstPercentage || 0) / 100) : 0;
        const totalAmount = totalBeforeTax + sstAmount;

        const head: any[][] = [[]];
        const headerRow = head[0];

        headerRow.push('No.', 'PU No.', 'Description', 'Unit', 'Qty', 'Rate (RM)');
        if (watchShowManagementFee) {
            headerRow.push('Mngmt. Fee (RM)');
        }
        headerRow.push('Amount (RM)');

        const body = siteInstructions.map((si, index) => {
            const baseAmount = (si.rate || 0) * (si.quantity || 0);
            const finalAmount = baseAmount + (watchShowManagementFee ? (si.managementFee || 0) : 0);
            const row = [
                (index + 1).toString(),
                si.puNo || 'N/A',
                si.description,
                si.unit || '-',
                (si.quantity || 0).toFixed(2),
                formatNumber(si.rate || 0),
            ];
            if (watchShowManagementFee) {
                row.push(formatNumber(si.managementFee || 0));
            }
            row.push(formatNumber(finalAmount));
            return row;
        });
        
        const colCount = headerRow.length;
        const labelColSpan = colCount - 1;

        const foot: any[][] = [
            [{ content: 'Sub-Total', colSpan: labelColSpan, styles: { halign: 'right' } }, { content: formatNumber(subtotal), styles: { halign: 'right' } }],
        ];

        if (watchShowManagementFee && totalManagementFee > 0) {
            foot.push([{ content: 'Material Management Fee', colSpan: labelColSpan, styles: { halign: 'right' } }, { content: formatNumber(totalManagementFee), styles: { halign: 'right' } }]);
        }
        
        if (data.enableSst && sstAmount > 0) {
            foot.push([{ content: `SST (${data.sstPercentage}%)`, colSpan: labelColSpan, styles: { halign: 'right' } }, { content: formatNumber(sstAmount), styles: { halign: 'right' } }]);
        }

        foot.push([{ content: 'Grand Total', colSpan: labelColSpan, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatNumber(totalAmount), styles: { fontStyle: 'bold', halign: 'right' } }]);

        (doc as any).autoTable({
            head, body, foot, startY: y,
            theme: 'grid',
            headStyles: { fillColor: [34, 48, 62], textColor: 255 },
            footStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.1, line_color: 200 },
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
        
        const ringgit = Math.floor(totalAmount);
        const cents = Math.round((totalAmount - ringgit) * 100);
        const totalInWords = `RINGGIT MALAYSIA ${numberToWords(ringgit)}` + (cents > 0 ? ` AND CENTS ${numberToWords(cents)} ONLY` : ' ONLY');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const wrappedTotal = wordWrap(totalInWords.toUpperCase(), max_width, doc);
        doc.text(wrappedTotal, margin, y);
        y += wrappedTotal.length * 5 + 10;

        if (data.termsAndConditions) {
            doc.setFont('helvetica', 'bold');
            doc.text('Terms & Conditions:', margin, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const termsLines = wordWrap(data.termsAndConditions, max_width, doc);
            doc.text(termsLines, margin, y);
            y += termsLines.length * 4 + 10;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('We hope to hear a favorable reply from your side.', margin, y);
        y += 5;
        doc.text('Thank you & regards.', margin, y);
        y += 10;

        // Signature Block
        if (y > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage();
            y = 20;
        }
        
        y += 10;
        
        (doc as any).autoTable({
            startY: y,
            body: [
                ['', '']
            ],
            theme: 'plain',
            columnStyles: { 0: { cellWidth: page_width / 2 - margin}, 1: { cellWidth: page_width / 2 - margin } },
            didDrawCell: (data: any) => {
                if (data.row.index === 0) {
                    if (data.column.index === 0) {
                         doc.setLineWidth(0.2);
                        doc.line(data.cell.x + 5, data.cell.y + 12, data.cell.x + data.cell.width - 5, data.cell.y + 12);
                        doc.setFontSize(10);
                        doc.setTextColor(40);
                        doc.text('Prepared by', data.cell.x + 5, data.cell.y + 18);
                        doc.setFont('helvetica', 'bold');
                        doc.text(company?.name || 'Structura', data.cell.x + 5, data.cell.y + 23);
                    }
                    if (data.column.index === 1) {
                        doc.setDrawColor(150);
                        doc.setLineWidth(0.2);
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height + 25);
                        doc.setFontSize(8);
                        doc.setFont('helvetica', 'normal');
                        const acceptanceText = "I hereby agreed & accepted the rates, terms & condition stipulated herein :";
                        const acceptanceLines = wordWrap(acceptanceText, data.cell.width - 10, doc);
                        doc.text(acceptanceLines, data.cell.x + 5, data.cell.y + 5);

                        doc.text('(Sign & Company Stamp)', data.cell.x + 5, data.cell.y + 25);
                    }
                }
            }
        });

        doc.save(`${data.docTitle.replace(/\s+/g, '_')}_${purchaseOrder.poNo}.pdf`);
        toast({ title: "Success", description: "PDF has been generated." });
        onCancel();

    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="docTitle" render={({ field }) => (
            <FormItem><FormLabel>Document Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <FormField control={form.control} name="clientName" render={({ field }) => (
                <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="attn" render={({ field }) => (
                <FormItem><FormLabel>Attention To</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="clientAddress" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Client Address</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="projectRefInfo" render={({ field }) => (
                <FormItem><FormLabel>Project Reference</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="refQuotationNo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation Ref. No.</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )}/>
        </div>
        <FormField control={form.control} name="termsAndConditions" render={({ field }) => (
            <FormItem><FormLabel>Terms & Conditions</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
        )}/>
         <div className="grid grid-cols-2 gap-4 pt-2">
             <FormField
                control={form.control}
                name="showManagementFee"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <FormLabel>Show Mngmt. Fee</FormLabel>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
            <div className="rounded-lg border p-3">
                <FormField control={form.control} name="enableSst" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                            <FormLabel>Enable SST</FormLabel>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                )}/>
                {watchEnableSst && (
                    <FormField control={form.control} name="sstPercentage" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0 mt-2">
                            <FormLabel className='text-sm'>Rate (%):</FormLabel>
                            <FormControl><Input type="number" step="0.1" className="w-20 h-8" {...field} /></FormControl>
                        </FormItem>
                    )}/>
                )}
            </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Proceed & Export PDF</Button>
        </div>
      </form>
    </Form>
  );
}
