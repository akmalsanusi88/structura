

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Project, Company, Claim, ClaimStatus, PurchaseOrderItem, ClaimedItem } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useMemo, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';

const pdfSchema = z.object({
  docTitle: z.string().min(1, "Title is required."),
  clientName: z.string().min(1, "Client name is required."),
  clientAddress: z.string().optional(),
  attn: z.string().optional(),
  invoiceNo: z.string().min(1, "Invoice number is required."),
  doNo: z.string().optional(),
  date: z.date({ required_error: "A date is required." }),
  poNo: z.string().optional(),
  bankCompanyName: z.string().optional(),
  bankName: z.string().optional(),
  bankAddress: z.string().optional(),
  bankAccNo: z.string().optional(),
  showManagementFee: z.boolean().optional(),
});

type PdfFormValues = z.infer<typeof pdfSchema>;

interface ClaimPdfFormProps {
  project: Project;
  claim: Claim;
  company: Company | undefined | null;
  allCompanies: Company[];
  onCancel: () => void;
  financialSummary: {
    poAmount: number;
    workDoneValue: number; 
    managementFeeValue: number;
    previousClaims: Claim[];
    previousClaimsTotalNet: number;
  };
}

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


const wordWrap = (text: string, maxWidth: number, doc: jsPDF) => {
    return doc.splitTextToSize(text, maxWidth);
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
const formatCurrencyWithoutSymbol = (amount: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

const generateInvoicePdf = (data: PdfFormValues, project: Project, claim: Claim, financialSummary: ClaimPdfFormProps['financialSummary'], company: Company | null | undefined, toast: (props: any) => void) => {
    try {
        const doc = new jsPDF();
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 35; // Start content at 3.5cm from the top

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(data.docTitle.toUpperCase(), page_width / 2, y, { align: 'center' });
        y += 10; 
        doc.setLineWidth(0.5);
        doc.line(margin, y - 5, page_width - margin, y - 5);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('TO:', margin, y);
        doc.setFont('helvetica', 'normal');
        const clientAddress = data.clientAddress || '';
        const clientAddressLines = wordWrap(clientAddress, (page_width / 2) - margin - 5, doc);
        doc.text(`${data.clientName}\n${clientAddressLines.join('\n')}`, margin, y + 5);
        let leftBlockY = y + 5 + (clientAddressLines.length + 1) * 5;
        if(data.attn) {
            doc.setFont('helvetica', 'bold');
            doc.text('ATTN:', margin, leftBlockY);
            doc.setFont('helvetica', 'normal');
            doc.text(data.attn, margin + 12, leftBlockY);
            leftBlockY += 10;
        }
        
        const rightColX = page_width - margin;
        
        const drawRightDetail = (label: string, value: string, yPos: number) => {
            if (!value) return yPos;
            doc.setFont('helvetica', 'bold');
            doc.text(label, rightColX - 50, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(value, rightColX - 25, yPos);
            return yPos + 5;
        };

        let rightBlockY = y;
        rightBlockY = drawRightDetail('Invoice No:', data.invoiceNo, rightBlockY);
        rightBlockY = drawRightDetail('Date:', format(data.date, 'dd MMM yyyy'), rightBlockY);
        
        y = Math.max(leftBlockY, rightBlockY);

        if (y > leftBlockY && y > rightBlockY) {
            y += 5;
        } else {
            y = Math.max(leftBlockY, rightBlockY) + 5;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text('Re:', margin, y);
        doc.setFont('helvetica', 'normal');
        const reLines = wordWrap(`Project: ${project.name}`, page_width - (margin * 2) - 10, doc);
        doc.text(reLines, margin + 10, y);
        y += (reLines.length * 5) + 2;

        const claimIdentifierText = claim.claimNo ? `Claim: ${claim.claimNo}` : '';
        const claimLines = wordWrap(claimIdentifierText, page_width - (margin * 2) - 10, doc);
        doc.text(claimLines, margin + 10, y);
        y += (claimLines.length * 5) + 5;
        
        const drawInfoRow = (label: string, value: string | undefined | null, x: number, yPos: number) => {
            if (!value) return yPos;
            doc.setFont('helvetica', 'bold');
            doc.text(label, x, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(value, x + 30, yPos);
            return yPos + 5;
        };
        
        y = drawInfoRow('PO No:', data.poNo, margin, y);
        y = drawInfoRow('Project No:', project.projectNo, margin, y);

        y += 10;
        
        const { poAmount, previousClaims, previousClaimsTotalNet, workDoneValue, managementFeeValue } = financialSummary;
        
        const retentionThisClaim = claim.retentionAmount || 0;
        const sstThisClaim = claim.sstAmount || 0;
        
        const amountToBeClaimed = workDoneValue + managementFeeValue - previousClaimsTotalNet;
        
        const summaryBody: (string | { content: string, styles: any })[][] = [];
        
        summaryBody.push(['PO Amount:', `RM ${formatCurrencyWithoutSymbol(poAmount)}`]);
        summaryBody.push(['Total Work Done:', `RM ${formatCurrencyWithoutSymbol(workDoneValue)}`]);

        if (data.showManagementFee && managementFeeValue > 0) {
            summaryBody.push([`Material Management Fee:`, `RM ${formatCurrencyWithoutSymbol(managementFeeValue)}`]);
        }

        if (previousClaims && previousClaims.length > 0) {
            summaryBody.push([{ content: 'Less: Previous Claims:', styles: { fontStyle: 'bold' } }, '']);
            previousClaims.forEach(prevClaim => {
                const netClaimAmount = prevClaim.amount - (prevClaim.retentionAmount || 0);
                summaryBody.push([`  - ${prevClaim.claimNo || 'Previous Claim'}:`, `(RM ${formatCurrencyWithoutSymbol(netClaimAmount)})`]);
            });
        }
        
        if (claim.hasRetention && retentionThisClaim > 0) {
            summaryBody.push([`Less: Retention Held (${claim.retentionPercentage}%)`, `(RM ${formatCurrencyWithoutSymbol(retentionThisClaim)})`]);
        }
        
        (doc as any).autoTable({
            body: summaryBody,
            startY: y,
            theme: 'plain',
            styles: {
                cellPadding: { top: 1, bottom: 1, left: 0 },
                fontSize: 10,
            },
            columnStyles: {
                0: { halign: 'left', cellWidth: 100 },
                1: { halign: 'right' }
            }
        });

        y = (doc as any).lastAutoTable.finalY + 2;

        if (sstThisClaim > 0) {
            doc.setFont('helvetica', 'normal');
            doc.text(`SST (${claim.sstPercentage}%)`, margin, y);
            doc.text(`RM ${formatCurrencyWithoutSymbol(sstThisClaim)}`, page_width - margin, y, { align: 'right' });
            y += 6;
        }

        doc.setLineWidth(0.5);
        doc.line(margin, y, page_width - margin, y);
        y += 6;

        const finalClaimAmount = amountToBeClaimed - retentionThisClaim + sstThisClaim;

        doc.setFont('helvetica', 'bold');
        doc.text('Amount to be Claimed:', margin, y);
        doc.text(`RM ${formatCurrencyWithoutSymbol(finalClaimAmount)}`, page_width - margin, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += 8;
        
        const finalAmountForWords = finalClaimAmount;
        const ringgit = Math.floor(finalAmountForWords);
        const cents = Math.round((finalAmountForWords - ringgit) * 100);
        const totalInWords = `RINGGIT MALAYSIA ${numberToWords(ringgit)}` + (cents > 0 ? ` AND CENTS ${numberToWords(cents)} ONLY` : ' ONLY');

        doc.setFont('helvetica', 'bold');
        const totalInWordsLines = wordWrap(totalInWords.toUpperCase(), page_width - (margin * 2), doc);
        doc.text(totalInWordsLines, margin, y);
        y += (totalInWordsLines.length * 5) + 15;

        if (data.bankName) {
            doc.setFont('helvetica', 'bold');
            doc.text('Bank Details:', margin, y);
            y += 6;
            doc.setFont('helvetica', 'normal');
            if (data.bankCompanyName) {
                doc.text(`Beneficiary: ${data.bankCompanyName}`, margin, y);
                y += 5;
            }
            doc.text(`Bank: ${data.bankName}`, margin, y);
            y += 5;
            if (data.bankAccNo) {
                doc.text(`A/C No: ${data.bankAccNo}`, margin, y);
                y += 5;
            }
            if (data.bankAddress) {
                const bankAddressLines = wordWrap(`Address: ${data.bankAddress}`, (page_width / 2) - margin, doc);
                doc.text(bankAddressLines, margin, y);
                y += 5 * bankAddressLines.length;
            }
            y+= 5;
        }

        if (y > doc.internal.pageSize.getHeight() - 40) doc.addPage();
        y+=10;
        
        doc.setLineWidth(0.2);
        doc.line(margin, y + 12, margin + 60, y + 12);
        doc.setFontSize(10);
        doc.setTextColor(40);
        doc.text('Prepared by', margin, y + 18);
        y += 23;
        doc.setFont('helvetica', 'bold');
        doc.text(company?.name || 'Structura', margin, y);

        doc.save(`${data.docTitle.replace(/\s+/g, '_')}_${data.invoiceNo}.pdf`);
        toast({ title: "Success", description: `${data.docTitle} PDF generated.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: `Failed to generate PDF.`, variant: "destructive" });
    }
};

const generateDoPdf = (data: PdfFormValues, project: Project, claim: Claim, toast: (props: any) => void) => {
    try {
        const doc = new jsPDF();
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 35; // Start content at 3.5cm from the top

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('DELIVERY ORDER', page_width / 2, y, { align: 'center' });
        y += 10;
        doc.setLineWidth(0.5);
        doc.line(margin, y - 5, page_width - margin, y - 5);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('TO:', margin, y);
        doc.setFont('helvetica', 'normal');
        const clientAddress = data.clientAddress || '';
        const clientAddressLines = wordWrap(clientAddress, (page_width / 2) - margin - 5, doc);
        doc.text(`${data.clientName}\n${clientAddressLines.join('\n')}`, margin, y + 5);
        let leftBlockY = y + 5 + (clientAddressLines.length + 1) * 5;
        if(data.attn) {
            doc.setFont('helvetica', 'bold');
            doc.text('ATTN:', margin, leftBlockY);
            doc.setFont('helvetica', 'normal');
            doc.text(data.attn, margin + 12, leftBlockY);
            leftBlockY += 10;
        }

        const rightColX = page_width - margin;
        
        const drawRightDetail = (label: string, value: string, yPos: number) => {
            if (!value) return yPos;
            doc.setFont('helvetica', 'bold');
            doc.text(label, rightColX - 50, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(value, rightColX - 25, yPos);
            return yPos + 5;
        };

        let rightBlockY = y;
        rightBlockY = drawRightDetail('DO No:', data.doNo || '', rightBlockY);
        rightBlockY = drawRightDetail('Date:', format(data.date, 'dd MMM yyyy'), rightBlockY);
        
        y = Math.max(leftBlockY, rightBlockY) + 5;
        
        doc.setFont('helvetica', 'bold');
        doc.text('Re:', margin, y);
        doc.setFont('helvetica', 'normal');
        const reLines = wordWrap(`Project: ${project.name}`, page_width - (margin * 2) - 10, doc);
        doc.text(reLines, margin + 10, y);
        y += (reLines.length * 5) + 2;

        if (data.poNo) {
            const poLines = wordWrap(`PO No: ${data.poNo}`, page_width - (margin * 2) - 10, doc);
            doc.text(poLines, margin + 10, y);
            y += (poLines.length * 5) + 5;
        }

        y += 5;

        const po = project.purchaseOrders.find(p => p.id === claim.purchaseOrderId);
        const poItemsMap = new Map(po?.items.map(item => [item.id, item]));

        const head = [['No.', 'Description', 'Unit', 'Qty']];
        const body = claim.claimedItems.map((item, index) => {
            const poItem = poItemsMap.get(item.boqItemId);
            return [
                (index + 1).toString(),
                poItem?.description || 'N/A',
                poItem?.unit || 'N/A',
                item.quantity.toFixed(2),
            ];
        });

        autoTable(doc, {
            head,
            body,
            startY: y,
            headStyles: { fillColor: [34, 48, 62], textColor: 255 },
        });

        y = (doc as any).lastAutoTable.finalY + 20;

        autoTable(doc, {
            startY: y,
            body: [['', '']],
            theme: 'plain',
            styles: { cellPadding: { top: 15, bottom: 5 } },
            didDrawCell: (data: any) => {
                if (data.row.section === 'body' && data.row.index === 0) {
                    doc.setLineWidth(0.2);
                    doc.line(data.cell.x + 5, data.cell.y + 12, data.cell.x + data.cell.width - 5, data.cell.y + 12);
                    doc.setFontSize(10);
                    doc.setTextColor(40);
                    let text = '';
                    if (data.column.index === 0) text = 'Issued by';
                    if (data.column.index === 1) text = 'Received by';
                    doc.text(text, data.cell.x + data.cell.width / 2, data.cell.y + 18, { align: 'center' });
                }
            }
        });

        doc.save(`DO_${data.doNo}.pdf`);
        toast({ title: "Success", description: "Delivery Order PDF generated." });
    } catch (e) {
        console.error(e);
        toast({ title: "Error", description: `Failed to generate DO PDF.`, variant: "destructive" });
    }
};


export default function ClaimPdfForm({ project, claim, company, allCompanies, onCancel, financialSummary }: ClaimPdfFormProps) {
  const { toast } = useToast();
  
  const form = useForm<PdfFormValues>({
    resolver: zodResolver(pdfSchema),
    defaultValues: {
      docTitle: 'TAX INVOICE',
      clientName: project.client,
      attn: '',
      invoiceNo: claim.invoiceNo,
      doNo: `DO-${claim.invoiceNo}`,
      date: parseISO(claim.date),
      poNo: claim.purchaseOrderNo || '',
      showManagementFee: true,
      bankCompanyName: '',
      bankName: '',
      bankAddress: '',
      bankAccNo: '',
    },
  });
  
  useEffect(() => {
    if (company && allCompanies) {
        const clientCompany = allCompanies.find(c => c.name === project.client);
        const currentCompanyDetails = allCompanies.find(c => c.id === company.id);

        form.reset({
            docTitle: 'TAX INVOICE',
            clientName: project.client,
            clientAddress: clientCompany?.address || '',
            attn: clientCompany?.attn || '',
            invoiceNo: claim.invoiceNo,
            doNo: `DO-${claim.invoiceNo}`,
            date: parseISO(claim.date),
            poNo: claim.purchaseOrderNo || '',
            bankCompanyName: currentCompanyDetails?.name || '',
            bankName: currentCompanyDetails?.bankName || '',
            bankAddress: currentCompanyDetails?.bankAddress || '',
            bankAccNo: currentCompanyDetails?.bankAccNo || '',
            showManagementFee: true,
        });
    }
  }, [company, allCompanies, project, claim, form]);

  return (
    <ScrollArea className="max-h-[80vh]">
        <div className="p-1">
        <Form {...form}>
        <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FormField control={form.control} name="docTitle" render={({ field }) => (
                    <FormItem><FormLabel>Document Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col pt-2"><FormLabel>Date</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant="outline" className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, 'dd MMM yyyy') : <span>Pick a date</span>}</Button>
                        </FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="clientName" render={({ field }) => (
                    <FormItem><FormLabel>Client Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="attn" render={({ field }) => (
                    <FormItem><FormLabel>Attention To</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="clientAddress" render={({ field }) => (
                <FormItem className='md:col-span-2'><FormLabel>Client Address</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="invoiceNo" render={({ field }) => (
                    <FormItem><FormLabel>Invoice No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="doNo" render={({ field }) => (
                    <FormItem><FormLabel>DO No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="poNo" render={({ field }) => (
                    <FormItem><FormLabel>PO No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <div className='border-t pt-4 space-y-4'>
                <h3 className='font-medium'>Bank Details</h3>
                 <FormField control={form.control} name="bankCompanyName" render={({ field }) => (
                    <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="bankName" render={({ field }) => (
                        <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="bankAccNo" render={({ field }) => (
                        <FormItem><FormLabel>Bank Account No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="bankAddress" render={({ field }) => (
                    <FormItem><FormLabel>Bank Address</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <div className="border-t pt-4">
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
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="button" variant="outline" onClick={form.handleSubmit((data) => generateDoPdf(data, project, claim, toast))}>Generate Delivery Order</Button>
            <Button type="button" onClick={form.handleSubmit((data) => generateInvoicePdf(data, project, claim, financialSummary, company, toast))}>Generate Invoice</Button>
            </div>
        </form>
        </Form>
        </div>
    </ScrollArea>
  );
}
