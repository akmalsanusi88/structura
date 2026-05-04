
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Project, Company, ClientBoQItem, BoqPdfDetails, PlantUnit } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useMemo, useState } from 'react';


const boqPdfSchema = z.object({
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

type PoPdfFormValues = z.infer<typeof boqPdfSchema>;

interface BoqPdfFormProps {
  project: Project;
  company: Company | undefined | null;
  allCompanies: Company[];
  clientBoq: ClientBoQItem[];
  plantUnits: PlantUnit[];
  onCancel: () => void;
  saveProjectDetails: (updatedProject?: Project) => Promise<void>;
  managementFeePercentage: number;
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

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);


export default function BoqPdfForm({ project, company, allCompanies, clientBoq, plantUnits, onCancel, saveProjectDetails, managementFeePercentage }: BoqPdfFormProps) {
  const { toast } = useToast();
  const clientCompany = allCompanies.find(c => c.name === project.client);
  const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);
  
  const form = useForm<PoPdfFormValues>({
    resolver: zodResolver(boqPdfSchema),
    defaultValues: {
      docTitle: project.boqPdfDetails?.docTitle || 'BILL OF QUANTITIES',
      docDate: project.boqPdfDetails?.docDate ? parseISO(project.boqPdfDetails.docDate) : new Date(),
      clientName: project.boqPdfDetails?.clientName || project.client,
      clientAddress: project.boqPdfDetails?.clientAddress || clientCompany?.address || '',
      attn: project.boqPdfDetails?.attn || clientCompany?.attn || '',
      projectRefInfo: project.boqPdfDetails?.projectRefInfo || `Re: ${project.name}`,
      refQuotationNo: project.boqPdfDetails?.refQuotationNo || '',
      termsAndConditions: project.boqPdfDetails?.termsAndConditions || "Validity : 30 Days\nPayment : 30 Days upon submission of invoice. Interest of 1.5% per month shall be chargeable for late payment.\nMisc :\na) For the above works, we do not include insurance & third party damaged.\nb) Not including any fees for authorities (way leave & work permit application)",
      showManagementFee: project.boqPdfDetails?.showManagementFee ?? true,
      enableSst: project.sstPercentage !== undefined && project.sstPercentage > 0,
      sstPercentage: project.sstPercentage ?? 6,
    },
  });
  
  const watchEnableSst = form.watch('enableSst');

  const showPuNoColumn = useMemo(() => {
    return clientBoq.some(item => {
        if (item.sourceType === 'pu' && item.sourceId) {
            const pu = plantUnitMap.get(item.sourceId);
            return !!pu; // If there's any valid PU link, show the column
        }
        return false;
    });
  }, [clientBoq, plantUnitMap]);


  const onSubmit = async (data: PoPdfFormValues) => {
    try {
        const doc = new jsPDF();
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 15;
        const max_width = page_width - margin * 2;
        let y = 30;

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
        const clientAddress = data.clientAddress || '';
        const clientAddressLines = wordWrap(clientAddress, half_width - margin - 5, doc);
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
        
        const drawDetailRow = (label: string, value: string, yPos: number) => {
            if (!value) return yPos;
            doc.setFont('helvetica', 'bold');
            doc.text(label, page_width - margin - 40, yPos, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.text(value, page_width - margin, yPos, { align: 'right' });
            return yPos + 5;
        };
        
        rightBlockY = drawDetailRow('Date:', format(data.docDate, 'dd MMM yyyy'), rightBlockY);
        if (data.refQuotationNo) {
            rightBlockY = drawDetailRow('Our Ref:', data.refQuotationNo, rightBlockY);
        }
        
        y = Math.max(leftBlockY, rightBlockY);

        if (y > leftBlockY && y > rightBlockY) {
            y += 2;
        } else {
            y = Math.max(leftBlockY, rightBlockY) + 2;
        }
        
        if (data.projectRefInfo) {
            doc.setFont('helvetica', 'bold');
            doc.text('Re:', margin, y);
            doc.setFont('helvetica', 'normal');
            const projectRefLines = wordWrap(data.projectRefInfo, max_width - 10, doc);
            doc.text(projectRefLines, margin + 10, y);
            y += (projectRefLines.length * 5);
        }

        y += 5;
        doc.setFont('helvetica', 'normal');
        const introText = "The above matter is referred. Please find the quotation for our services for your consideration acceptance.";
        const introLines = wordWrap(introText, max_width, doc);
        doc.text(introLines, margin, y);

        y += (introLines.length * 5) + 8;
        
        const formatNumber = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const subTotal = clientBoq.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
        const shouldShowManagementFeeColumn = data.showManagementFee && clientBoq.some(item => (item.managementFee || 0) > 0);
        const totalManagementFee = shouldShowManagementFeeColumn ? clientBoq.reduce((acc, item) => acc + (item.managementFee || 0), 0) : 0;

        const totalBeforeTax = subTotal + totalManagementFee;
        const sstAmount = data.enableSst ? (totalBeforeTax * (data.sstPercentage || 0)) / 100 : 0;
        const grandTotal = totalBeforeTax + sstAmount;

        
        // Table
        const head: any[][] = [[]];
        const headerRow = head[0];
        
        headerRow.push('No.');
        if (showPuNoColumn) {
          headerRow.push('PU No.');
        }
        headerRow.push('Description', 'Unit', 'Qty', 'Rate (RM)');
        if (shouldShowManagementFeeColumn) {
          headerRow.push('Mngmt. Fee (RM)');
        }
        headerRow.push('Amount (RM)');

        
        const body = clientBoq.map((item, index) => {
            const amount = item.quantity * item.rate;
            const totalAmount = amount + (shouldShowManagementFeeColumn ? (item.managementFee || 0) : 0);
            
            const pu = item.sourceType === 'pu' && item.sourceId ? plantUnitMap.get(item.sourceId) : null;
            const puNo = pu ? pu.puId : 'Custom';
            
            const row: any[] = [(index + 1).toString()];
            if (showPuNoColumn) {
              row.push(puNo);
            }
            row.push(item.description, item.unit, formatNumber(item.quantity), formatNumber(item.rate));
            if (shouldShowManagementFeeColumn) {
              row.push(formatNumber(item.managementFee || 0));
            }
            row.push(formatNumber(totalAmount));
            return row;
        });
        
        const colCount = head[0].length;
        const labelColSpan = colCount - 1;

        const foot: any[] = [];
        foot.push([{ content: 'Sub-Total', colSpan: labelColSpan, styles: { halign: 'right' } }, { content: formatNumber(subTotal), styles: { halign: 'right' } }]);
        
        if (shouldShowManagementFeeColumn) {
            foot.push([{ content: `Material Management Fee`, colSpan: labelColSpan, styles: { halign: 'right' } }, { content: formatNumber(totalManagementFee), styles: { halign: 'right' } }]);
        }

        if (data.enableSst && sstAmount > 0) {
            foot.push([{ content: `SST (${data.sstPercentage}%)`, colSpan: labelColSpan, styles: { halign: 'right' } }, { content: formatNumber(sstAmount), styles: { halign: 'right' } }]);
        }
        
        foot.push([{ content: 'Grand Total', colSpan: labelColSpan, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatNumber(grandTotal), styles: { fontStyle: 'bold', halign: 'right' } }]);

        autoTable(doc, {
            head,
            body,
            foot,
            startY: y,
            theme: 'grid',
            headStyles: { fillColor: [34, 48, 62], textColor: 255 },
            footStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: 0, lineWidth: 0.1, line_color: 200 },
        });
        
        let finalY = (doc as any).lastAutoTable.finalY + 8;
        
        // Total in words
        const finalTotalForWords = grandTotal;
        const ringgit = Math.floor(finalTotalForWords);
        const cents = Math.round((finalTotalForWords - ringgit) * 100);
        const totalInWords = `RINGGIT MALAYSIA ${numberToWords(ringgit)}` + (cents > 0 ? ` AND CENTS ${numberToWords(cents)} ONLY` : ' ONLY');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const totalInWordsLines = wordWrap(totalInWords.toUpperCase(), max_width, doc);
        doc.text(totalInWordsLines, margin, finalY);
        finalY += totalInWordsLines.length * 5 + 8;

        if (data.termsAndConditions) {
            doc.setFont('helvetica', 'bold');
            doc.text('Terms & Conditions:', margin, finalY);
            finalY += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const termsLines = wordWrap(data.termsAndConditions, max_width, doc);
            doc.text(termsLines, margin, finalY);
            finalY += termsLines.length * 4 + 8;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('We hope to hear a favorable reply from your side.', margin, finalY);
        finalY += 5;
        doc.text('Thank you & regards.', margin, finalY);
        finalY += 8;

        // Signature
        if (finalY > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage();
            finalY = 20;
        }
        
        finalY += 15;
        
        autoTable(doc, {
            startY: finalY,
            body: [
                ['', '']
            ],
            theme: 'plain',
            columnStyles: { 0: { cellWidth: page_width / 2 - margin}, 1: { cellWidth: page_width / 2 - margin } },
            didDrawCell: (data) => {
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


        // Save form details to project
        await saveProjectDetails({
            ...project,
            boqPdfDetails: {
                ...data,
                docDate: format(data.docDate, 'yyyy-MM-dd')
            },
            sstPercentage: data.enableSst ? data.sstPercentage : 0,
        });
        
        toast({ title: "Success", description: "PDF generated and details saved." });
        onCancel();
        doc.save(`${data.docTitle.replace(/\s+/g, '_')}_${project.name}.pdf`);

    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="docTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Document Title</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
             <FormField
                control={form.control}
                name="docDate"
                render={({ field }) => (
                <FormItem className="flex flex-col pt-2">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
            control={form.control}
            name="projectRefInfo"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Project Reference</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="clientName"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Client Name</FormLabel>
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
        </div>
        <FormField
          control={form.control}
          name="clientAddress"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Address</FormLabel>
              <FormControl><Textarea {...field} rows={2} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
            control={form.control}
            name="refQuotationNo"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Quotation Ref. No.</FormLabel>
                <FormControl><Input placeholder="Your quotation number, e.g., Q-2024-101" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
         <FormField
            control={form.control}
            name="termsAndConditions"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Terms & Conditions</FormLabel>
                <FormControl><Textarea {...field} rows={4} /></FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
         <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="showManagementFee"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <FormLabel>Show Material Management Fee</FormLabel>
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
             <FormField
                control={form.control}
                name="enableSst"
                render={({ field }) => (
                     <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
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
                )}
            />
            {watchEnableSst && (
                <FormField
                    control={form.control}
                    name="sstPercentage"
                    render={({ field }) => (
                        <FormItem className="rounded-lg border p-3 col-span-2">
                            <div className="flex items-center justify-between">
                                <FormLabel>SST Percentage (%)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.1" className="w-24 h-8" {...field} />
                                </FormControl>
                            </div>
                            <FormMessage/>
                        </FormItem>
                    )}
                />
            )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Proceed & Export PDF</Button>
        </div>
      </form>
    </Form>
  );
}
