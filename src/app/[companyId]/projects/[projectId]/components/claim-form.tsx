
'use client';

import * as React from 'react';
import { useState, useMemo, Fragment, useEffect } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Claim, ClaimStatus, Project, PurchaseOrderType, DailyActivityWork, PurchaseOrderItem, ClaimedItem, Company } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CalendarIcon, RefreshCcw, FileDown, Edit, RotateCcw } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ClaimPdfForm from "./claim-pdf-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const getClaimType = (claimNo: string | undefined): string => {
    if (!claimNo) return '';
    const lower = claimNo.toLowerCase();
    if (lower.includes('progress claim')) return 'Progress Claim';
    if (lower.includes('final claim')) return 'Final Claim';
    if (lower.includes('retention claim')) return 'Retention Claim';
    return 'Progress Claim';
};

const claimedItemSchema = z.object({
  boqItemId: z.string(),
  quantity: z.coerce.number().min(0, "Must be a positive number.").default(0),
});

const claimSchema = z.object({
  claimType: z.string().min(1, "Please select a claim type."),
  claimNo: z.string().min(1, 'Claim identifier is required'),
  invoiceNo: z.string().min(1, 'Invoice number is required'),
  purchaseOrderId: z.string().min(1, "A Purchase Order must be selected."),
  date: z.date({ required_error: "Claim date is required." }),
  status: z.enum(["Draft", "Submitted", "Paid", "Disputed"]),
  hasRetention: z.boolean().default(false),
  retentionType: z.enum(['percentage', 'amount']).optional(),
  retentionPercentage: z.coerce.number().optional(),
  retentionAmount: z.coerce.number().optional(),
  isFinal: z.boolean().default(false),
  claimedItems: z.array(claimedItemSchema).optional(),
  amount: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.claimType === 'Retention Claim') {
        if (data.amount === undefined || data.amount <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A positive claim amount is required for retention claims.",
                path: ['amount'],
            });
        }
    } else {
        if (!data.claimedItems || !data.claimedItems.some(item => item.quantity > 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "You must claim a quantity for at least one item.",
                path: ['claimedItems'],
            });
        }
    }
  
    if (data.hasRetention && data.claimType !== 'Retention Claim') {
        if (data.retentionType === 'percentage' && (data.retentionPercentage === undefined || data.retentionPercentage <= 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Retention % is required when holding retention by percentage.',
                path: ['retentionPercentage'],
            });
        }
        if (data.retentionType === 'amount' && (data.retentionAmount === undefined || data.retentionAmount <= 0)) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'A positive retention amount is required.',
                path: ['retentionAmount'],
            });
        }
    }
});

type ClaimFormValues = z.infer<typeof claimSchema>;

interface ClaimFormProps {
  project: Project;
  claim?: Claim;
  poType: 'client' | 'subcon';
  onSave: (data: Claim) => void;
  onCancel: () => void;
  company: Company | null;
  allCompanies: Company[];
}

export default function ClaimForm({ project, claim, poType, onSave, onCancel, company, allCompanies }: ClaimFormProps) {
    const [isPdfFormOpen, setIsPdfFormOpen] = useState(false);
    const [claimForPdf, setClaimForPdf] = useState<Claim & { workDoneValue?: number; managementFeeValue?: number } | undefined>(undefined);
    const [triggerRecalculation, setTriggerRecalculation] = useState(0);
    const [showManagementFee, setShowManagementFee] = useState(true);
  
    const form = useForm<ClaimFormValues>({
        resolver: zodResolver(claimSchema),
        defaultValues: claim
        ? {
            claimType: getClaimType(claim.claimNo),
            claimNo: claim.claimNo || '',
            invoiceNo: claim.invoiceNo || '',
            purchaseOrderId: claim.purchaseOrderId || '',
            date: claim ? parseISO(claim.date) : new Date(),
            status: claim.status || 'Draft',
            hasRetention: claim.hasRetention || false,
            retentionType: (claim.retentionPercentage && claim.retentionPercentage > 0) ? 'percentage' : 'amount',
            retentionPercentage: claim.retentionPercentage || 10,
            retentionAmount: claim.retentionAmount || 0,
            isFinal: claim.isFinal || false,
            claimedItems: claim.claimedItems?.map(ci => ({...ci})) || [],
            amount: claim.amount || 0,
        }
        : {
            claimType: '',
            claimNo: '',
            invoiceNo: '',
            purchaseOrderId: '',
            date: new Date(),
            status: 'Draft',
            hasRetention: false,
            retentionType: 'percentage',
            retentionPercentage: 10,
            retentionAmount: 0,
            isFinal: false,
            claimedItems: [],
            amount: 0,
        },
    });

  const { control, watch, setValue, setError, clearErrors, getValues } = form;
  const { fields, replace } = useFieldArray({ control, name: 'claimedItems' });
  
  const watchedItems = watch('claimedItems');
  const watchedAmount = watch('amount');
  const selectedPoId = watch('purchaseOrderId');
  const claimType = watch('claimType');
  const hasRetention = watch('hasRetention');
  const watchedRetentionPercentage = watch('retentionPercentage');
  const retentionType = watch('retentionType');
  const retentionAmountInput = watch('retentionAmount');

  const availablePOs = React.useMemo(() => {
    const relevantPoType: PurchaseOrderType = poType === 'client' ? 'Client' : 'Subcontractor';
    return project.purchaseOrders.filter(po => po.type === relevantPoType);
  }, [project.purchaseOrders, poType]);
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
  
  const poItemDataMap = React.useMemo(() => {
    const map = new Map<string, PurchaseOrderItem>();
    const selectedPO = project.purchaseOrders.find(po => po.id === selectedPoId);
    if(selectedPO) {
        selectedPO.items.forEach(item => {
            map.set(item.id, item);
        });
    }
    return map;
  }, [selectedPoId, project.purchaseOrders]);

  const claimableItemsDetails = React.useMemo(() => {
    if (!selectedPoId) return [];

    const selectedPO = project.purchaseOrders.find(po => po.id === selectedPoId);
    if (!selectedPO) return [];

    const allClaimsForPo = (poType === 'client' ? project.clientClaims : project.subconClaims)
        ?.filter(c => c.purchaseOrderId === selectedPoId) || [];
    
    const previousClaims = claim?.id 
        ? allClaimsForPo.filter(c => c.id !== claim.id && new Date(c.date) <= new Date(claim.date))
        : allClaimsForPo;


    const poItemSummary = new Map<string, { poItem: PurchaseOrderItem; asBuiltQty: number; prevClaimedQty: number; prevClaimedFee: number; }>();
    
    selectedPO.items.forEach(poItem => {
        poItemSummary.set(poItem.id, {
            poItem,
            asBuiltQty: 0,
            prevClaimedQty: 0,
            prevClaimedFee: 0,
        });
    });

    (project.dailyActivities || []).forEach(log => {
        (log.work || []).forEach(work => {
            if (poItemSummary.has(work.boqItemId)) {
                const summary = poItemSummary.get(work.boqItemId)!;
                summary.asBuiltQty = (summary.asBuiltQty || 0) + (work.quantity || 0);
            }
        });
    });

    previousClaims.forEach(c => {
        if (getClaimType(c.claimNo) === 'Retention Claim') return;

        (c.claimedItems || []).forEach(claimedItem => {
            if (poItemSummary.has(claimedItem.boqItemId)) {
                const summary = poItemSummary.get(claimedItem.boqItemId)!;
                summary.prevClaimedQty = (summary.prevClaimedQty || 0) + (claimedItem.quantity || 0);
                
                const poItem = poItemDataMap.get(claimedItem.boqItemId);
                if (poItem && poItem.managementFee && poItem.quantity > 0) {
                     const feePerUnit = (poItem.managementFee || 0) / poItem.quantity;
                    summary.prevClaimedFee += (claimedItem.quantity || 0) * feePerUnit;
                }
            }
        });
    });
    
    return Array.from(poItemSummary.values());

  }, [project, poType, claim, selectedPoId, poItemDataMap]);
  
  const previousSummary = React.useMemo(() => {
    if (!selectedPoId) return null;
    const selectedPO = project.purchaseOrders.find(po => po.id === selectedPoId);
    if (!selectedPO) return null;

    const allClaimsForPo = (poType === 'client' ? project.clientClaims : project.subconClaims)
        ?.filter(c => c.purchaseOrderId === selectedPoId)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];
    
    const claimsBefore = claim?.id 
        ? allClaimsForPo.filter(c => c.id !== claim.id && new Date(c.date) <= new Date(claim.date))
        : allClaimsForPo;
    
    let prevWorkDone = 0;
    let prevMngmtFee = 0;
    let prevNetPaid = 0;
    let totalRetentionHeld = 0;
    let totalRetentionReleased = 0;

    claimsBefore.forEach(c => {
        const type = getClaimType(c.claimNo);
        if (type === 'Retention Claim') {
            totalRetentionReleased += c.amount;
        } else {
            prevNetPaid += (c.amount - (c.retentionAmount || 0));
            totalRetentionHeld += (c.retentionAmount || 0);
            
            (c.claimedItems || []).forEach(ci => {
                const poItem = poItemDataMap.get(ci.boqItemId);
                if (poItem) {
                    prevWorkDone += (ci.quantity || 0) * poItem.rate;
                    if (poItem.managementFee && poItem.quantity > 0) {
                        const feePerUnit = poItem.managementFee / poItem.quantity;
                        prevMngmtFee += (ci.quantity || 0) * feePerUnit;
                    }
                }
            });
        }
    });

    const poAmount = selectedPO.items.reduce((sum, item) => sum + (item.quantity * item.rate) + (item.managementFee || 0), 0);

    return {
        poAmount,
        prevWorkDone,
        prevMngmtFee,
        prevNetPaid,
        pendingRetention: totalRetentionHeld - totalRetentionReleased,
        sstPercentage: selectedPO.sstPercentage || 0,
        previousClaims: claimsBefore,
        previousClaimsTotalNet: prevNetPaid
    };
  }, [selectedPoId, project, poType, claim, poItemDataMap]);

  const currentTotals = React.useMemo(() => {
    let workDone = 0;
    let mngmtFee = 0;

    (watchedItems || []).forEach(item => {
        const poItem = poItemDataMap.get(item.boqItemId);
        if (poItem) {
            workDone += (item.quantity || 0) * poItem.rate;
            if (showManagementFee && poItem.managementFee && poItem.quantity > 0) {
                const feePerUnit = poItem.managementFee / poItem.quantity;
                mngmtFee += (item.quantity || 0) * feePerUnit;
            }
        }
    });

    return { workDone, mngmtFee, gross: workDone + mngmtFee };
  }, [watchedItems, poItemDataMap, showManagementFee, triggerRecalculation]);

  const totalThisClaim = React.useMemo(() => {
      if (claimType === 'Retention Claim') return watchedAmount || 0;
      return currentTotals.gross;
  }, [claimType, currentTotals, watchedAmount]);

  const retentionValue = React.useMemo(() => {
      if (!hasRetention || claimType === 'Retention Claim') return 0;
      if (retentionType === 'percentage') {
          return totalThisClaim * ((watchedRetentionPercentage || 0) / 100);
      }
      return retentionAmountInput || 0;
  }, [hasRetention, claimType, retentionType, watchedRetentionPercentage, retentionAmountInput, totalThisClaim]);

  const poFinancialSummary = React.useMemo(() => {
      if (!previousSummary) return null;
      return {
          ...previousSummary,
          totalWorkDone: previousSummary.prevWorkDone + currentTotals.workDone,
          totalMaterialMngmtFee: previousSummary.prevMngmtFee + currentTotals.mngmtFee,
          retentionIsClaimable: previousSummary.pendingRetention > 0.01,
      };
  }, [previousSummary, currentTotals]);

  const netPayable = totalThisClaim - retentionValue;
  const sstPercentage = poFinancialSummary?.sstPercentage || 0;
  const sstValue = netPayable * (sstPercentage / 100);
  const netClaimAmount = netPayable + sstValue;


  React.useEffect(() => {
    if (claimType === 'Retention Claim' && selectedPoId && !claim?.id) {
        if (!poFinancialSummary) return;
        setValue('amount', parseFloat(poFinancialSummary.pendingRetention.toFixed(2)));
    }
  }, [claimType, selectedPoId, setValue, claim?.id, poFinancialSummary]);


  React.useEffect(() => {
    if (!selectedPoId || claimType === 'Retention Claim') {
        replace([]);
        return;
    }
    
    const po = project.purchaseOrders.find(p => p.id === selectedPoId);
    const poHasFee = po?.items.some(item => item.managementFee && item.managementFee > 0);
    setShowManagementFee(!!poHasFee);

    const newFormItems = claimableItemsDetails.map(details => {
        const existingClaimedItem = claim?.claimedItems?.find(ci => ci.boqItemId === details.poItem.id);
        return {
            boqItemId: details.poItem.id,
            quantity: existingClaimedItem?.quantity || 0,
        };
    });
    replace(newFormItems);
  }, [claimableItemsDetails, claim, replace, selectedPoId, claimType, project.purchaseOrders]);
  
  React.useEffect(() => {
    if (claim?.id) {
      return;
    }

    if (claimType === 'Progress Claim') {
      if (selectedPoId) {
        const claimsForPo = (poType === 'client' ? project.clientClaims : project.subconClaims)
            ?.filter(c => c.purchaseOrderId === selectedPoId) || [];
        const progressClaimCount = claimsForPo.filter(c => c.claimNo?.startsWith('Progress Claim')).length;
        setValue('claimNo', `Progress Claim ${progressClaimCount + 1}`);
      } else {
        setValue('claimNo', ''); 
      }
    } else if (claimType === 'Final Claim') {
      if (previousSummary?.previousClaims.some(c => c.isFinal)) {
        setError('claimType', { message: 'A final claim already exists for this PO.' });
      } else {
        setValue('claimNo', 'Final Claim');
      }
    } else if (claimType) {
      setValue('claimNo', claimType);
    } else {
      setValue('claimNo', ''); 
    }
  }, [claimType, selectedPoId, project, poType, setValue, claim, previousSummary, setError]);

  const onFinalSave = (data: ClaimFormValues) => {
    const po = project.purchaseOrders.find(p => p.id === data.purchaseOrderId);
    if (!po) {
        console.error("Selected PO not found during submission");
        return;
    }

    let finalAmount = 0;
    let finalClaimedItems: ClaimedItem[] = [];

    if (data.claimType === 'Retention Claim') {
        finalAmount = data.amount || 0;
    } else {
        const detailsMap = new Map(claimableItemsDetails.map(d => [d.poItem.id, d]));
        
        for (const item of (data.claimedItems || [])) {
            const details = detailsMap.get(item.boqItemId);
            if (!details) continue;

            const availableToClaim = (details?.asBuiltQty || 0) - (details?.prevClaimedQty || 0);
            if (item.quantity > availableToClaim + 0.001) {
                setError(`claimedItems`, { type: 'manual', message: `Claimed quantity for "${details.poItem.description}" cannot exceed the available balance of ${availableToClaim.toFixed(2)}.` });
                return;
            }
        }
        clearErrors('claimedItems');
        
        (data.claimedItems || []).forEach(item => {
            if (item.quantity > 0) {
                finalClaimedItems.push({ boqItemId: item.boqItemId, quantity: item.quantity, workRecordId: '' });
            }
        });
        
        finalAmount = totalThisClaim;
    }
    
    const retentionHeld = retentionValue;
    
    const sstPercentageOnPo = poFinancialSummary?.sstPercentage || 0;
    const netPayableForSst = totalThisClaim - retentionHeld;
    const sstAmountOnClaim = netPayableForSst * (sstPercentageOnPo / 100);

    const newStatusDates = { ...(claim?.statusDates || {}) };
    if (!claim || !claim.statusDates || (claim && claim.status !== data.status)) {
        newStatusDates[data.status] = format(new Date(), 'yyyy-MM-dd');
    }

    const newClaim: Claim = {
      id: claim?.id || `claim-${Date.now()}`,
      claimNo: data.claimNo,
      invoiceNo: data.invoiceNo,
      purchaseOrderId: data.purchaseOrderId,
      purchaseOrderNo: po.poNo,
      type: poType === 'client' ? 'Client' : 'Subcontractor',
      date: format(data.date, 'yyyy-MM-dd'),
      status: data.status,
      statusDates: newStatusDates,
      isFinal: data.claimType === 'Retention Claim' ? false : data.isFinal,
      hasRetention: data.claimType === 'Retention Claim' ? false : data.hasRetention,
      retentionPercentage: data.retentionType === 'percentage' ? data.retentionPercentage : undefined,
      amount: finalAmount,
      retentionAmount: Math.round(retentionHeld * 100) / 100,
      sstPercentage: sstPercentageOnPo,
      sstAmount: sstAmountOnClaim,
      claimedItems: finalClaimedItems,
    };

    onSave(newClaim);
  }

  const handleGeneratePdf = () => {
    const data = getValues();
    const po = project.purchaseOrders.find(p => p.id === data.purchaseOrderId);
    if (!po) {
        console.error("Selected PO not found during PDF generation");
        return;
    }

    const formValues = getValues();
    const finalClaimedItems = (formValues.claimedItems || [])
      .filter(item => item.quantity > 0)
      .map(item => ({ boqItemId: item.boqItemId, quantity: item.quantity, workRecordId: '' }));
      
    const clientPoItemMap = new Map(po.items.map(item => [item.id, item]));

    const currentClaimWorkValue = finalClaimedItems.reduce((sum, ci) => {
        const poItem = clientPoItemMap.get(ci.boqItemId);
        if (poItem) {
            return sum + ((ci.quantity || 0) * (poItem.rate || 0));
        }
        return sum;
    }, 0);
    
    const previousClaimsWorkValue = (previousSummary?.prevWorkDone || 0);
    const cumulativeWorkDoneValue = previousClaimsWorkValue + currentClaimWorkValue;
    
    const previousClaimsManagementFee = (previousSummary?.prevMngmtFee || 0);
    const currentClaimManagementFee = finalClaimedItems.reduce((sum, ci) => {
        const poItem = clientPoItemMap.get(ci.boqItemId);
        if(poItem && poItem.managementFee && poItem.quantity > 0) {
            const feePerUnit = (poItem.managementFee || 0) / poItem.quantity;
            return sum + ((ci.quantity || 0) * feePerUnit);
        }
        return sum;
    }, 0);

    const cumulativeManagementFee = previousClaimsManagementFee + currentClaimManagementFee;
    
    const finalAmount = totalThisClaim;
    const sstPercentageOnPo = poFinancialSummary?.sstPercentage || 0;
    
    const retentionHeld = retentionValue;
    const netPayableForSst = totalThisClaim - retentionHeld;
    const sstAmountOnClaim = netPayableForSst * (sstPercentageOnPo / 100);

    const currentClaimForPdf: Claim = {
        id: claim?.id || `claim-temp-${Date.now()}`,
        claimNo: data.claimNo,
        invoiceNo: data.invoiceNo,
        purchaseOrderId: data.purchaseOrderId,
        purchaseOrderNo: po.poNo,
        type: poType === 'client' ? 'Client' : 'Subcontractor',
        date: format(data.date, 'yyyy-MM-dd'),
        status: data.status,
        hasRetention: data.claimType === 'Retention Claim' ? false : data.hasRetention,
        isFinal: data.claimType === 'Retention Claim' ? false : data.isFinal,
        retentionPercentage: data.retentionType === 'percentage' ? data.retentionPercentage : undefined,
        amount: finalAmount,
        retentionAmount: Math.round(retentionHeld * 100) / 100,
        sstPercentage: sstPercentageOnPo,
        sstAmount: sstAmountOnClaim,
        claimedItems: finalClaimedItems,
    };

    setClaimForPdf({
        ...currentClaimForPdf,
        workDoneValue: cumulativeWorkDoneValue,
        managementFeeValue: showManagementFee ? cumulativeManagementFee : 0,
    });
    setIsPdfFormOpen(true);
  };

  const statuses: ClaimStatus[] = ["Draft", "Submitted", "Paid", "Disputed"];

  return (
    <>
        <Form {...form}>
        <form className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 flex flex-col space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={control}
                    name="claimType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Claim Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!claim}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Progress Claim">Progress Claim</SelectItem>
                                <SelectItem value="Final Claim">Final Claim</SelectItem>
                                <SelectItem value="Retention Claim" disabled={!poFinancialSummary?.retentionIsClaimable}>
                                    Retention Claim
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                        control={control}
                        name="claimNo"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Claim Identifier</FormLabel>
                            <FormControl>
                                <Input placeholder="Auto-generated" {...field} readOnly />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name="invoiceNo"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Invoice No.</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., INV-2024-001" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name="date"
                        render={({ field }) => (
                            <FormItem className="flex flex-col pt-2">
                                <FormLabel>Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name="status"
                        render={({ field }) => (
                            <FormItem className="col-span-1 md:col-span-2 flex flex-col pt-2">
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a status" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                
                <FormField
                    control={control}
                    name="purchaseOrderId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Purchase Order</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!!claim}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a PO to claim against" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {availablePOs.map(po => <SelectItem key={po.id} value={po.id}>{po.poNo} - {poType === 'client' ? project.client : po.issuer}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                {poFinancialSummary && (
                    <Card>
                        <CardHeader className='flex-row items-center justify-between pb-2'>
                            <CardTitle className="text-base">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">PO Amount:</span>
                                <span className="font-medium">{formatCurrency(poFinancialSummary.poAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Work Done:</span>
                                <span className="font-bold">{formatCurrency(poFinancialSummary.totalWorkDone)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Material Mngmt. Fee:</span>
                                <span className="font-bold">{formatCurrency(poFinancialSummary.totalMaterialMngmtFee)}</span>
                            </div>
                             <div className="flex justify-between items-start pt-2 border-t mt-2">
                                <span className="text-muted-foreground font-semibold">Previous Claims (Net):</span>
                                <div className="text-right">
                                    {previousSummary && previousSummary.previousClaims.length === 0 ? (
                                        <span className="font-medium">RM 0.00</span>
                                    ) : (
                                        previousSummary?.previousClaims.map(c => (
                                            <div key={c.id} className="flex justify-end gap-4">
                                                <span>{c.claimNo}:</span>
                                                <span className="font-medium w-24 text-right">{formatCurrency((c.amount || 0) - (c.retentionAmount || 0))}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {claimType === 'Retention Claim' && (
                    <FormField
                        control={control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Retention Claim Amount</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" placeholder="Enter total retention amount to claim" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                
                <div className="flex-grow"></div>

                <Card className="bg-muted/50 mt-auto">
                <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm font-semibold items-center">
                        <span>Total This Claim</span>
                         <span className='font-bold'>{formatCurrency(totalThisClaim)}</span>
                    </div>
                    {hasRetention && claimType !== 'Retention Claim' && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Retention Held ({retentionType === 'percentage' ? `${watchedRetentionPercentage || 0}%` : 'Fixed'})</span>
                            <span className="font-medium text-red-500">- {formatCurrency(retentionValue)}</span>
                        </div>
                    )}
                    {sstValue > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">SST ({poFinancialSummary?.sstPercentage || 0}%)</span>
                            <span className="font-medium text-blue-500">+ {formatCurrency(sstValue)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                        <span>Net Amount Payable</span>
                        <span>{formatCurrency(netClaimAmount)}</span>
                    </div>
                </CardContent>
                </Card>

            </div>

            <div className="lg:col-span-3">
                {claimType !== 'Retention Claim' ? (
                    <div className="flex flex-col h-full space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-medium">As-Built Items to Claim</h3>
                             <div className="flex items-center gap-4">
                                {poType === 'client' && (
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="show-management-fee"
                                            checked={showManagementFee}
                                            onCheckedChange={(checked) => setShowManagementFee(!!checked)}
                                        />
                                        <Label htmlFor="show-management-fee" className="text-sm font-medium">Show Mngmt. Fee</Label>
                                    </div>
                                )}
                                <Button type="button" size="sm" variant="outline" onClick={() => setTriggerRecalculation(v => v + 1)}>
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Update Quantities
                                </Button>
                            </div>
                        </div>
                        <div className="border rounded-md overflow-hidden flex-grow">
                        <ScrollArea className="h-[450px]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-secondary z-10">
                                    <TableRow>
                                        <TableHead className="w-[25%] text-xs py-1 px-2">Description</TableHead>
                                        <TableHead className="text-right text-xs py-1 px-2">Rate</TableHead>
                                        <TableHead className="text-right text-xs py-1 px-2">Unit</TableHead>
                                        <TableHead className="text-right text-xs py-1 px-2">As-Built</TableHead>
                                        <TableHead className="text-right text-xs py-1 px-2">Prev. Claimed</TableHead>
                                        <TableHead className="text-right text-xs py-1 px-2">Claim Qty</TableHead>
                                        <TableHead className="text-right text-xs font-bold py-1 px-2">Total Claim Qty</TableHead>
                                        <TableHead className="text-right text-xs py-1 px-2">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!selectedPoId ? (
                                        <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Please select a Purchase Order above.</TableCell></TableRow>
                                    ) : fields.length === 0 ? (
                                        <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No claimable items found for this PO.</TableCell></TableRow>
                                    ) : fields.map((field, index) => {
                                        const details = claimableItemsDetails.find(d => d.poItem.id === field.boqItemId);
                                        if (!details) return null;
                                        
                                        const claimedQty = Number(watchedItems?.[index]?.quantity) || 0;
                                        const prevClaimedQtySafe = Number(details.prevClaimedQty) || 0;
                                        const totalClaimedQty = prevClaimedQtySafe + claimedQty;
                                        
                                        const amountValue = claimedQty * (details.poItem.rate || 0);

                                        let feePortionValue = 0;
                                        const poItem = poItemDataMap.get(field.boqItemId);
                                        if (poType === 'client' && poItem?.managementFee && poItem.quantity > 0) {
                                            const feePerUnit = (poItem.managementFee || 0) / poItem.quantity;
                                            feePortionValue = claimedQty * feePerUnit;
                                        }

                                        return (
                                            <Fragment key={field.id}>
                                                <TableRow>
                                                    <TableCell className="text-xs py-1 px-2">{details.poItem.description}</TableCell>
                                                    <TableCell className="text-right text-xs py-1 px-2">{formatCurrency(details.poItem.rate)}</TableCell>
                                                    <TableCell className="text-right text-xs py-1 px-2">{details.poItem.unit}</TableCell>
                                                    <TableCell className="text-right text-xs py-1 px-2">{(details.asBuiltQty || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-right text-xs py-1 px-2">{(prevClaimedQtySafe || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-right text-xs py-1 px-2">
                                                        <FormField
                                                            control={control}
                                                            name={`claimedItems.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    {...field}
                                                                    className="h-8 w-24 text-right ml-auto"
                                                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                                    max={Number(details.asBuiltQty || 0) - Number(details.prevClaimedQty || 0)}
                                                                />
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs font-bold py-1 px-2">{totalClaimedQty.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right text-xs py-1 px-2">{formatCurrency(amountValue)}</TableCell>
                                                </TableRow>
                                                {showManagementFee && poType === 'client' && (
                                                    <TableRow className="bg-muted/30 text-muted-foreground text-xs">
                                                        <TableCell colSpan={7} className="text-right italic pr-4 py-0.5 text-xs">Material Management Fee (This Claim)</TableCell>
                                                        <TableCell className="text-right py-0.5 text-xs">{formatCurrency(feePortionValue)}</TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        )
                                    })}
                                </TableBody>
                                {fields.length > 0 &&
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-right font-semibold text-xs py-1">Sub-Total</TableCell>
                                            <TableCell className="text-right font-semibold text-xs py-1">{formatCurrency(currentTotals.workDone)}</TableCell>
                                        </TableRow>
                                        {showManagementFee && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-right font-semibold text-xs py-1">Material Mngmt. Fee</TableCell>
                                                <TableCell className="text-right font-semibold text-xs py-1">{formatCurrency(currentTotals.mngmtFee)}</TableCell>
                                            </TableRow>
                                        )}
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-right font-bold text-sm py-1">Total</TableCell>
                                            <TableCell className="text-right font-bold text-sm py-1">{formatCurrency(currentTotals.gross)}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                }
                            </Table>
                        </ScrollArea>
                        </div>
                                
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="rounded-lg border p-4">
                                <FormField
                                    control={control}
                                    name="hasRetention"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between col-span-2">
                                            <FormLabel>Hold Retention</FormLabel>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                {hasRetention && (
                                    <div className="col-span-2 pt-4">
                                        <Controller
                                            control={control}
                                            name="retentionType"
                                            render={({ field }) => (
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    className="flex gap-4 mb-2"
                                                >
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="percentage" /></FormControl>
                                                        <FormLabel className="font-normal">Percentage</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="amount" /></FormControl>
                                                        <FormLabel className="font-normal">Fixed Amount</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            )}
                                        />
                                        {retentionType === 'percentage' ? (
                                            <FormField
                                                control={control}
                                                name="retentionPercentage"
                                                render={({ field }) => (
                                                    <FormItem>
                                                    <FormLabel className="text-xs text-muted-foreground">Percentage (%)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" placeholder="10" {...field} className="h-8"/>
                                                    </FormControl>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        ) : (
                                            <FormField
                                                control={control}
                                                name="retentionAmount"
                                                render={({ field }) => (
                                                    <FormItem>
                                                    <FormLabel className="text-xs text-muted-foreground">Retention Amount (RM)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.01" placeholder="Enter amount" {...field} className="h-8"/>
                                                    </FormControl>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2 rounded-lg border p-4">
                                <FormField
                                    control={control}
                                    name="isFinal"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between">
                                            <FormLabel>Final Claim</FormLabel>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={(checked) => {
                                                        field.onChange(checked);
                                                        if (checked) {
                                                            setValue('claimNo', 'Final Claim');
                                                        } else {
                                                            const claimsForPo = (poType === 'client' ? project.clientClaims : project.subconClaims)?.filter(c => c.purchaseOrderId === selectedPoId) || [];
                                                            const progressClaimCount = claimsForPo.filter(c => c.claimNo.startsWith('Progress Claim')).length;
                                                            setValue('claimNo', `Progress Claim ${progressClaimCount + 1}`);
                                                        }
                                                    }}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <p className="text-xs text-muted-foreground pt-1">
                                    Mark this as the final claim for this PO.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Final Claim Summary</CardTitle>
                            <CardDescription>
                                These are the final total quantities claimed for this Purchase Order.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="border rounded-md overflow-hidden">
                                <ScrollArea className="h-[450px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Final Claimed Qty</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead className="text-right">Mngmt. Fee</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {!selectedPoId ? (
                                             <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Please select a Purchase Order.</TableCell></TableRow>
                                        ) : claimableItemsDetails.length === 0 ? (
                                             <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No items found.</TableCell></TableRow>
                                        ) : (
                                            claimableItemsDetails.map(details => {
                                                const totalClaimed = details.prevClaimedQty;
                                                const amount = totalClaimed * details.poItem.rate;
                                                const fee = details.prevClaimedFee;
                                                return (
                                                    <TableRow key={details.poItem.id}>
                                                        <TableCell>{details.poItem.description}</TableCell>
                                                        <TableCell className="text-right">{totalClaimed.toFixed(2)}</TableCell>
                                                        <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                                                         <TableCell className="text-right">{formatCurrency(fee)}</TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                    {claimableItemsDetails.length > 0 && poFinancialSummary && (
                                        <TableFooter>
                                             <TableRow>
                                                <TableCell colSpan={3} className="text-right font-bold">Total Work Done</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(poFinancialSummary.totalWorkDone + poFinancialSummary.totalMaterialMngmtFee)}</TableCell>
                                             </TableRow>
                                        </TableFooter>
                                    )}
                                </Table>
                                </ScrollArea>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              {poType === 'client' && <Button type="button" variant="outline" onClick={handleGeneratePdf}><FileDown className="mr-2 h-4 w-4" /> Generate PDF</Button>}
            <Button type="button" onClick={form.handleSubmit(onFinalSave)}>Save Claim</Button>
            </div>
        </form>
        </Form>

        <Dialog open={isPdfFormOpen} onOpenChange={setIsPdfFormOpen}>
            <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Export Claim Documents</DialogTitle>
                <DialogDescription>Fill in the details below to generate an Invoice.</DialogDescription>
            </DialogHeader>
            {claimForPdf && poFinancialSummary && (
                <ClaimPdfForm
                    project={project}
                    claim={claimForPdf}
                    company={company}
                    allCompanies={allCompanies}
                    onCancel={() => setIsPdfFormOpen(false)}
                    financialSummary={{
                      ...poFinancialSummary,
                      workDoneValue: claimForPdf.workDoneValue as number,
                      managementFeeValue: claimForPdf.managementFeeValue as number,
                    }}
                />
            )}
            </DialogContent>
        </Dialog>
    </>
  );
}
