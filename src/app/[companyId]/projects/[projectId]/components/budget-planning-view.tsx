
'use client';

import type { Project, BoQItem, ClientBoQItem, PlantUnit, Company, Contract } from "@/lib/types";
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import BoqItemForm from './boq-item-form';
import { FileUp, FileDown, PlusCircle, MoreHorizontal, Pencil, Trash2, Save, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import BoqPdfForm from './boq-pdf-form';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface BudgetPlanningViewProps {
    project: Project;
    setProject: React.Dispatch<React.SetStateAction<Project>>;
    saveProjectDetails: (updatedProject?: Project) => Promise<void>;
    plantUnits: PlantUnit[];
    company?: Company | null;
    allCompanies: Company[];
    contracts: Contract[];
}

export default function BudgetPlanningView({ project, setProject, saveProjectDetails, plantUnits, company, allCompanies, contracts }: BudgetPlanningViewProps) {
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{ category: 'Client' | 'Engineering' | 'Material', item: BoQItem | ClientBoQItem } | null>(null);
    const [addingCategory, setAddingCategory] = useState<'Client' | 'Engineering' | 'Material' | null>(null);
    const [managementFeePercentage, setManagementFeePercentage] = useState(4.5);
    const [isSstEnabled, setIsSstEnabled] = useState(project.sstPercentage !== undefined && project.sstPercentage > 0);
    const [sstPercentage, setSstPercentage] = useState(project.sstPercentage ?? 6);
    const [isSaving, setIsSaving] = useState(false);
    const [isBoqPdfFormOpen, setIsBoqPdfFormOpen] = useState(false);
    const [isMultiPartPdfDialogOpen, setIsMultiPartPdfDialogOpen] = useState(false);
    const [pdfOptions, setPdfOptions] = useState({
        includeClient: true,
        includeEng: true,
        includeMat: true,
        includeSummary: true,
        orientation: 'portrait' as 'portrait' | 'landscape',
        showPuNo: true,
        showManagementFee: true,
        showSst: true,
    });
    
    const isSubconProject = !!project.originatingProjectId;

    const clientBoqItemsFromPO = useMemo(() => {
        if (!isSubconProject) return [];
        return project.purchaseOrders
            .filter(po => po.type === 'Client')
            .flatMap(po => po.items.map(item => ({...item} as ClientBoQItem)));
    }, [project.purchaseOrders, isSubconProject]);


    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };

    const handleOpenDialog = (category: 'Client' | 'Engineering' | 'Material', item: BoQItem | ClientBoQItem | null = null) => {
        if (item) {
            setEditingItem({ category, item });
        } else {
            setAddingCategory(category);
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingItem(null);
        setAddingCategory(null);
    };
    
    const handleOpenBoqPdfForm = () => {
        setIsBoqPdfFormOpen(true);
    };

    const handleSaveItem = (itemData: BoQItem | ClientBoQItem) => {
        const category = editingItem?.category || addingCategory;
        if (!category) return;

        const categoryKeyMap = {
            'Client': 'clientBoq',
            'Engineering': 'engineeringBoq',
            'Material': 'materialBoq'
        };
        const key = categoryKeyMap[category] as keyof Project;

        setProject(prevProject => {
            const items = (prevProject[key] as (BoQItem | ClientBoQItem)[]) || [];
            const existingIndex = items.findIndex(i => i.id === itemData.id);

            let newItems;
            if (existingIndex > -1) {
                // Update
                newItems = [...items];
                newItems[existingIndex] = itemData;
            } else {
                // Add
                newItems = [...items, itemData];
            }
            
            let updatedProject = { ...prevProject, [key]: newItems };

            // Automatically update status to 'Planning' if it was 'Setup'
            if (updatedProject.status === 'Setup') {
                updatedProject = { ...updatedProject, status: 'Planning' };
            }

            return updatedProject;
        });

        toast({ title: 'Success', description: `BOQ item ${editingItem ? 'updated' : 'added'} locally. Click Save Budget to persist changes.` });
        handleCloseDialog();
    };
    
    const handleDeleteItem = (category: 'Client' | 'Engineering' | 'Material', itemId: string) => {
        const categoryKeyMap = {
            'Client': 'clientBoq',
            'Engineering': 'engineeringBoq',
            'Material': 'materialBoq'
        };
        const key = categoryKeyMap[category] as keyof Project;
        
        setProject(prevProject => {
            const items = (prevProject[key] as (BoQItem | ClientBoQItem)[]) || [];
            return { ...prevProject, [key]: items.filter(i => i.id !== itemId) };
        });

        toast({ title: 'Success', description: `BOQ item deleted locally. Remember to save.` });
    };

    const handleMoveItem = (
        category: 'Client' | 'Engineering' | 'Material',
        index: number,
        direction: 'up' | 'down'
    ) => {
        const categoryKeyMap = {
            'Client': 'clientBoq',
            'Engineering': 'engineeringBoq',
            'Material': 'materialBoq'
        };
        const key = categoryKeyMap[category] as keyof Project;

        setProject(prevProject => {
            const items = [...((prevProject as any)[key] as (BoQItem | ClientBoQItem)[]) || []];
            
            const newIndex = direction === 'up' ? index - 1 : index + 1;

            if (newIndex < 0 || newIndex >= items.length) {
                return prevProject; // Invalid move
            }

            const itemToMove = items[index];
            items.splice(index, 1); // Remove item from old position
            items.splice(newIndex, 0, itemToMove); // Insert item at new position

            return { ...prevProject, [key]: items };
        });
        toast({ title: 'Item Moved', description: 'Remember to save your changes.' });
    };

    const handleSaveBudget = async () => {
        setIsSaving(true);
        const finalSstPercentage = isSstEnabled ? sstPercentage : 0;
        try {
            await saveProjectDetails({ ...project, sstPercentage: finalSstPercentage });
            toast({ title: "Budget Saved", description: "Your budget has been successfully saved to the database." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to save budget.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const { budgetedRevenue, engineeringCost, materialCost, totalBudgetedCost, totalGrossProfit, grossMargin, profitabilityStatus } = useMemo(() => {
        const clientBoq = isSubconProject ? clientBoqItemsFromPO : (project.clientBoq || []);
        
        const subtotal = clientBoq.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
        const managementFee = clientBoq.reduce((acc, item) => acc + (item.managementFee || 0), 0);
        const totalBeforeTax = subtotal + managementFee;
        const sstAmount = isSstEnabled ? totalBeforeTax * (sstPercentage / 100) : 0;
        const budgetedRevenue = totalBeforeTax + sstAmount;
        
        const engBoq = project.engineeringBoq || [];
        const engineeringCost = engBoq.reduce((acc, item) => {
            let itemRate = item.rate;
            if (item.sourceType === 'percentage' && item.sourceId && item.percentage) {
                const sourceItem = clientBoq.find(i => i.id === item.sourceId);
                if (sourceItem) {
                    itemRate = sourceItem.rate * (item.percentage / 100);
                }
            }
            return acc + (item.quantity * itemRate);
        }, 0) || 0;

        const materialCost = project.materialBoq?.reduce((acc, item) => acc + (item.quantity * item.rate), 0) || 0;
        const totalBudgetedCost = engineeringCost + materialCost;
        const totalGrossProfit = budgetedRevenue - totalBudgetedCost;
        const grossMargin = budgetedRevenue > 0 ? (totalGrossProfit / budgetedRevenue) * 100 : 0;
        const profitabilityStatus = `Project is ${grossMargin >= 0 ? 'profitable' : 'at a loss'} with ${grossMargin.toFixed(2)}% margin`;
        return { budgetedRevenue, engineeringCost, materialCost, totalBudgetedCost, totalGrossProfit, grossMargin, profitabilityStatus };
    }, [project, isSubconProject, clientBoqItemsFromPO, sstPercentage, isSstEnabled]);
    
    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const clientBoq = isSubconProject ? clientBoqItemsFromPO : (project.clientBoq || []);

        // Client BOQ Sheet
        if (clientBoq.length > 0) {
            const clientData = clientBoq.map(item => ({
                'Description': item.description,
                'Unit': item.unit,
                'Quantity': item.quantity,
                'Rate (RM)': item.rate,
                'Management Fee (RM)': item.managementFee || 0,
                'Amount (RM)': (item.quantity * item.rate) + (item.managementFee || 0),
            }));
            const wsClient = XLSX.utils.json_to_sheet(clientData);
            XLSX.utils.book_append_sheet(wb, wsClient, "Client BOQ");
        }

        // Engineering BOQ Sheet
        const engBoq = project.engineeringBoq || [];
        if (engBoq.length > 0) {
            const engData = engBoq.map(item => ({
                'Description': item.description,
                'Unit': item.unit,
                'Quantity': item.quantity,
                'Rate (RM)': item.rate,
                'Amount (RM)': item.quantity * item.rate,
            }));
            const wsEng = XLSX.utils.json_to_sheet(engData);
            XLSX.utils.book_append_sheet(wb, wsEng, "Engineering BOQ");
        }

        // Material BOQ Sheet
        const matBoq = project.materialBoq || [];
        if (matBoq.length > 0) {
            const matData = matBoq.map(item => ({
                'Description': item.description,
                'Unit': item.unit,
                'Quantity': item.quantity,
                'Rate (RM)': item.rate,
                'Amount (RM)': item.quantity * item.rate,
            }));
            const wsMat = XLSX.utils.json_to_sheet(matData);
            XLSX.utils.book_append_sheet(wb, wsMat, "Material BOQ");
        }

        // Summary Sheet
        const summaryData = [
            { Category: "Budgeted Revenue (Client BOQ)", Amount: formatCurrency(budgetedRevenue) },
            { Category: "Engineering Services Cost", Amount: formatCurrency(engineeringCost) },
            { Category: "Material Cost", Amount: formatCurrency(materialCost) },
            { Category: "Total Budgeted Cost", Amount: formatCurrency(totalBudgetedCost) },
            { Category: "Total Gross Profit", Amount: formatCurrency(totalGrossProfit) },
            { Category: "Gross Margin", Amount: `${grossMargin.toFixed(2)}%` },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        XLSX.writeFile(wb, `${project.name} - Budget Plan.xlsx`);
    };
    
    const handleExportPdf = async () => {
        const doc = new jsPDF({ orientation: pdfOptions.orientation });
        const companyName = company ? company.name : 'Structura';
        const page_width = doc.internal.pageSize.getWidth();
        const margin = 14;
        let pageCount = 0;

        const addPageHeader = (title: string, docInstance: jsPDF) => {
            if (pageCount > 0) docInstance.addPage(pdfOptions.orientation);
            pageCount++;
            
            docInstance.setFontSize(10);
            docInstance.setTextColor(150);
            docInstance.text(companyName.toUpperCase(), margin, 15);
            docInstance.setFontSize(18);
            docInstance.setTextColor(40);
            const titleLines = docInstance.splitTextToSize(title, page_width - (margin * 2));
            docInstance.text(titleLines, margin, 22);

            let y_pos = 22 + (titleLines.length * 7);

            docInstance.setFontSize(11);
            docInstance.setTextColor(100);
            const projectNameLines = docInstance.splitTextToSize(`Project: ${project.name}`, page_width - (margin * 2));
            docInstance.text(projectNameLines, margin, y_pos);
            y_pos += (projectNameLines.length * 5) + 5;
            return y_pos;
        };
        
        const plantUnitMap = new Map(plantUnits.map(pu => [pu.id, pu]));
        const getPuNo = (item: BoQItem | ClientBoQItem) => {
            if (item.sourceType === 'pu' && item.sourceId) {
                return plantUnitMap.get(item.sourceId)?.puId || 'N/A';
            }
            if (item.sourceType === 'boq' && item.sourceId) {
                const boqItem = [...(project.clientBoq || []), ...(project.engineeringBoq || []), ...(project.materialBoq || [])].find(i => i.id === item.sourceId);
                if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                    return plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                }
            }
            return null; // For custom items
        };

        const autoTableConfig = {
            theme: 'grid' as const,
            headStyles: { fillColor: [34, 48, 62], textColor: 255 },
            footStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0 },
            didParseCell: function (data: any) {
                if (data.column.index > 0) {
                    data.cell.styles.halign = 'right';
                    if (data.column.index <= 2 && data.row.section !== 'head') {
                         data.cell.styles.halign = 'left';
                    }
                }
                 if (data.column.index === 0) {
                     data.cell.styles.halign = 'center';
                 }
            }
        };

        if (pdfOptions.includeClient) {
            const clientBoq = isSubconProject ? clientBoqItemsFromPO : (project.clientBoq || []);
            const showClientPuNo = pdfOptions.showPuNo && clientBoq.some(item => getPuNo(item));
            const showManagementFee = pdfOptions.showManagementFee && clientBoq.some(item => (item.managementFee || 0) > 0);

            let startY = addPageHeader('Client Bill of Quantities', doc);
            const clientHead: any[][] = [[]];
            const headerRow = clientHead[0];
            
            headerRow.push('No.');
            if (showClientPuNo) {
              headerRow.push('PU No.');
            }
            headerRow.push('Description', 'Unit', 'Qty', 'Rate (RM)');
            if (showManagementFee) {
              headerRow.push('Mngmt. Fee (RM)');
            }
            headerRow.push('Amount (RM)');

            
            const clientBody = clientBoq.map((item, index) => {
                const amount = item.quantity * item.rate;
                const totalAmount = amount + (showManagementFee ? (item.managementFee || 0) : 0);
                
                const puNo = showClientPuNo ? getPuNo(item) || '' : null;
                
                const row: any[] = [(index + 1).toString()];
                if (showClientPuNo) {
                  row.push(puNo);
                }
                row.push(item.description, item.unit, item.quantity.toFixed(2), formatCurrency(item.rate));
                if (showManagementFee) {
                  row.push(formatCurrency(item.managementFee || 0));
                }
                row.push(formatCurrency(totalAmount));
                return row;
            });
            
            const colSpan = headerRow.length - 1;
            const subtotal = clientBoq.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
            const totalManagementFee = showManagementFee ? clientBoq.reduce((acc, item) => acc + (item.managementFee || 0), 0) : 0;
            const totalBeforeTax = subtotal + totalManagementFee;
            const sstAmount = pdfOptions.showSst && isSstEnabled ? totalBeforeTax * (sstPercentage / 100) : 0;
            const grandTotal = totalBeforeTax + sstAmount;

            const foot: any[][] = [];
            foot.push([{ content: 'Sub-Total', colSpan: colSpan, styles: { halign: 'right' } }, { content: formatCurrency(subtotal), styles: { halign: 'right' } }]);
            
            if (showManagementFee && totalManagementFee > 0) {
                foot.push([{ content: `Material Management Fee`, colSpan: colSpan, styles: { halign: 'right' } }, { content: formatCurrency(totalManagementFee), styles: { halign: 'right' } }]);
            }
            
            if (pdfOptions.showSst && sstAmount > 0) {
                foot.push([{ content: `SST (${sstPercentage}%)`, colSpan: colSpan, styles: { halign: 'right' } }, { content: formatCurrency(sstAmount), styles: { halign: 'right' } }]);
            }

            foot.push([{ content: 'Grand Total', colSpan: colSpan, styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(grandTotal), styles: { fontStyle: 'bold', halign: 'right' } }]);

            autoTable(doc, { ...autoTableConfig, head: clientHead, body: clientBody, foot: foot, startY });
        }

        if(pdfOptions.includeEng) {
            const engBoq = project.engineeringBoq || [];
            const showEngPuNo = pdfOptions.showPuNo && engBoq.some(item => getPuNo(item));
            let startY = addPageHeader('Engineering Services BOQ', doc);
            const engHead: any[] = [['No.']];
            if (showEngPuNo) engHead[0].push('PU No.');
            engHead[0].push('Description', 'Unit', 'Qty', 'Rate (RM)', 'Amount (RM)');
            
            const engBody = engBoq.map((item, index) => {
                const row: any[] = [(index + 1).toString()];
                if (showEngPuNo) row.push(getPuNo(item) || '');
                row.push(item.description, item.unit, item.quantity.toFixed(2), formatCurrency(item.rate), formatCurrency(item.quantity * item.rate));
                return row;
            });
            autoTable(doc, { ...autoTableConfig, head: engHead, body: engBody, startY });
            let finalY = (doc as any).lastAutoTable.finalY + 5;
            doc.setFont('helvetica', 'bold');
            doc.text(`Total Engineering Cost: ${formatCurrency(engineeringCost)}`, page_width - margin, finalY, { align: 'right' });
            doc.setFont('helvetica', 'normal');
        }

        if(pdfOptions.includeMat) {
            const matBoq = project.materialBoq || [];
            const showMatPuNo = pdfOptions.showPuNo && matBoq.some(item => getPuNo(item));
            let startY = addPageHeader('Material BOQ', doc);
            const matHead: any[] = [['No.']];
            if (showMatPuNo) matHead[0].push('PU No.');
            matHead[0].push('Description', 'Unit', 'Qty', 'Rate (RM)', 'Amount (RM)');

            const matBody = matBoq.map((item, index) => {
                const row: any[] = [(index + 1).toString()];
                if (showMatPuNo) row.push(getPuNo(item) || '');
                row.push(item.description, item.unit, item.quantity.toFixed(2), formatCurrency(item.rate), formatCurrency(item.quantity * item.rate));
                return row;
            });
            autoTable(doc, { ...autoTableConfig, head: matHead, body: matBody, startY });
            let finalY = (doc as any).lastAutoTable.finalY + 5;
            doc.setFont('helvetica', 'bold');
            doc.text(`Total Material Cost: ${formatCurrency(materialCost)}`, page_width - margin, finalY, { align: 'right' });
            doc.setFont('helvetica', 'normal');
        }

        if(pdfOptions.includeSummary) {
            let startY = addPageHeader('Budget Planning Summary', doc);
            const summaryBody = [
                ['Budgeted Revenue (Client BOQ)', formatCurrency(budgetedRevenue)],
                ['Engineering Services Cost', formatCurrency(engineeringCost)],
                ['Material Cost', formatCurrency(materialCost)],
                ['Total Budgeted Cost', formatCurrency(totalBudgetedCost)],
                ['Total Gross Profit', formatCurrency(totalGrossProfit)],
                ['Gross Margin', `${grossMargin.toFixed(2)}%`],
            ];
            autoTable(doc, {
                theme: 'striped',
                head: [['Description', 'Amount']],
                body: summaryBody,
                startY,
                didParseCell: (data) => {
                    if (data.column.index === 1) {
                        data.cell.styles.halign = 'right';
                    }
                    if (data.row.index >= 3) {
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            });
            
            let finalY = (doc as any).lastAutoTable.finalY + 20;

            if (finalY > doc.internal.pageSize.getHeight() - 50) {
                doc.addPage();
                finalY = 20;
            }

            autoTable(doc, {
                startY: finalY,
                body: [['', '', '']],
                theme: 'plain',
                styles: { cellPadding: { top: 15, bottom: 5 } },
                didDrawCell: function (data: any) {
                    if (data.row.section === 'body' && data.row.index === 0) {
                        doc.setLineWidth(0.2);
                        doc.line(data.cell.x + 5, data.cell.y + 12, data.cell.x + data.cell.width - 5, data.cell.y + 12);
                        doc.setFontSize(10);
                        doc.setTextColor(40);
                        let text = '';
                        if (data.column.index === 0) text = 'Prepared by';
                        if (data.column.index === 1) text = 'Checked by';
                        if (data.column.index === 2) text = 'Approved by';
                        doc.text(text, data.cell.x + data.cell.width / 2, data.cell.y + 18, { align: 'center' });
                    }
                }
            });
        }
        
        doc.save(`${project.name} - Budget Plan.pdf`);
    };

    const BoQTable = ({ title, items, category, columns, clientBoq, plantUnits }: { 
        title: string, 
        items: (BoQItem | ClientBoQItem)[], 
        category: 'Client' | 'Engineering' | 'Material', 
        columns: { key: string, label: string, className?: string }[], 
        clientBoq?: ClientBoQItem[],
        plantUnits: PlantUnit[]
    }) => {
        
        const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);
        const fullBoqMap = useMemo(() => new Map([...(project.clientBoq || []), ...(project.engineeringBoq || []), ...(project.materialBoq || [])].map(item => [item.id, item])), [project]);


        const calculatedItems = useMemo(() => {
            return items.map(item => {
                let displayRate = item.rate;
                let displayDescription = item.description;
                let sourceNote = '';
                
                let puNoToDisplay = 'Custom';
                if (item.sourceType === 'pu' && item.sourceId) {
                  puNoToDisplay = plantUnitMap.get(item.sourceId)?.puId || 'N/A';
                  sourceNote = '(from PU)';
                } else if (item.sourceType === 'boq' && item.sourceId) {
                  const boqItem = fullBoqMap.get(item.sourceId);
                  if (boqItem?.sourceType === 'pu' && boqItem.sourceId) {
                      puNoToDisplay = plantUnitMap.get(boqItem.sourceId)?.puId || 'N/A';
                  }
                  sourceNote = '(from Budget)';
                } else if (item.sourceType === 'percentage' && item.sourceId) {
                    puNoToDisplay = 'N/A';
                    if (item.percentage && clientBoq) {
                        const sourceItem = clientBoq.find(i => i.id === item.sourceId);
                        if (sourceItem) {
                            displayRate = sourceItem.rate * (item.percentage / 100);
                            displayDescription = sourceItem.description;
                            sourceNote = `(${item.percentage}% of Client BOQ)`;
                        } else {
                            displayDescription = item.description;
                            sourceNote = '(from Client BOQ)';
                        }
                    } else {
                        displayDescription = item.description;
                        sourceNote = '(from Client BOQ)';
                    }
                }

                const baseAmount = item.quantity * displayRate;
                const amount = category === 'Client' ? baseAmount + ((item as ClientBoQItem).managementFee || 0) : baseAmount;

                return { ...item, puNo: puNoToDisplay, displayRate, amount, displayDescription, sourceNote };
            });
        }, [items, clientBoq, category, plantUnitMap, fullBoqMap]);
        
        const subtotal = calculatedItems.reduce((acc, item) => acc + (item.quantity * item.displayRate), 0);
        const totalManagementFee = category === 'Client' ? calculatedItems.reduce((acc, item) => acc + ((item as ClientBoQItem).managementFee || 0), 0) : 0;
        const totalBeforeTax = subtotal + totalManagementFee;
        const sstAmount = isSstEnabled ? totalBeforeTax * (sstPercentage / 100) : 0;
        const grandTotal = totalBeforeTax + sstAmount;

        const isClientBoqForSubcon = category === 'Client' && isSubconProject;

        return (
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-xl font-headline">{title}</CardTitle>
                    </div>
                     {!isClientBoqForSubcon && (
                        <div className="flex items-center gap-4">
                            {category === 'Client' && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="mngmt-fee-perc" className="text-sm shrink-0">Material Management Fee (%)</Label>
                                        <Input 
                                            id="mngmt-fee-perc"
                                            type="number"
                                            value={managementFeePercentage} 
                                            onChange={e => setManagementFeePercentage(parseFloat(e.target.value) || 0)}
                                            className="w-20 h-9"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center space-x-2">
                                            <Switch id="sst-enabled" checked={isSstEnabled} onCheckedChange={setIsSstEnabled} />
                                            <Label htmlFor="sst-enabled" className="text-sm shrink-0">SST (%)</Label>
                                        </div>
                                        {isSstEnabled && (
                                            <Input 
                                                id="sst-perc"
                                                type="number"
                                                value={sstPercentage} 
                                                onChange={e => setSstPercentage(parseFloat(e.target.value) || 0)}
                                                className="w-20 h-9"
                                            />
                                        )}
                                    </div>
                                    <Button size="sm" variant="outline" onClick={handleOpenBoqPdfForm}>Export PDF</Button>
                                </>
                            )}
                            <Button onClick={() => handleOpenDialog(category)}><PlusCircle className="mr-2" />Add Item</Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                     {isClientBoqForSubcon && (
                        <Alert className="mb-4">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Read-Only View</AlertTitle>
                            <AlertDescription>
                                This Client BOQ is synced from the main contractor's Purchase Order and cannot be edited here.
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columns.map(col => <TableHead key={col.key} className={col.className}>{col.label}</TableHead>)}
                                    {!isClientBoqForSubcon && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {calculatedItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={columns.length + 1} className="text-center h-24 text-muted-foreground">No items added yet.</TableCell>
                                    </TableRow>
                                ) : (
                                    calculatedItems.map((item, index) => {
                                        return (
                                            <TableRow key={item.id}>
                                                {columns.map(col => (
                                                    <TableCell key={col.key} className={`${col.className} py-2`}>
                                                        {(() => {
                                                            if (col.key === 'id') {
                                                                return item.puNo;
                                                            }
                                                            
                                                            const value = col.key === 'amount' 
                                                                ? item.amount 
                                                                : col.key === 'rate'
                                                                ? item.displayRate
                                                                : col.key === 'description'
                                                                ? <>
                                                                    {item.displayDescription}
                                                                    {item.sourceNote && <span className="text-xs text-muted-foreground ml-2">{item.sourceNote}</span>}
                                                                  </>
                                                                : (item as any)[col.key];
                                                            
                                                            const currencyKeys = ['rate', 'managementFee', 'amount'];
                                                            
                                                            if (typeof value === 'number' && currencyKeys.includes(col.key)) {
                                                                return formatCurrency(Number(value));
                                                            }
                                                            
                                                            if (typeof value === 'number' && col.key === 'quantity') {
                                                                return (value as number).toFixed(2);
                                                            }
                                                
                                                            return value;
                                                        })()}
                                                    </TableCell>
                                                ))}
                                                {!isClientBoqForSubcon && (
                                                    <TableCell className="text-right py-2">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem onClick={() => handleOpenDialog(category, item)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleMoveItem(category, index, 'up')} disabled={index === 0}>
                                                                    <ArrowUp className="mr-2 h-4 w-4"/> Move Up
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleMoveItem(category, index, 'down')} disabled={index === calculatedItems.length - 1}>
                                                                    <ArrowDown className="mr-2 h-4 w-4"/> Move Down
                                                                </DropdownMenuItem>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="ghost" className="w-full justify-start text-sm text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50 dark:hover:text-red-400 font-normal px-2 py-1.5 relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors">
                                                                            <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This action cannot be undone. This will permanently delete this BOQ item.
                                                                        </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteItem(category, item.id)} className='bg-red-600 hover:bg-red-700'>Delete</AlertDialogAction></AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                            {category === 'Client' && items.length > 0 && (
                                <TableFooter>
                                     <TableRow>
                                        <TableCell colSpan={columns.length - 1} className="text-right font-semibold">Subtotal</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(subtotal)}</TableCell>
                                        {!isClientBoqForSubcon && <TableCell></TableCell>}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell colSpan={columns.length - 1} className="text-right font-semibold">Material Management Fee</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(totalManagementFee)}</TableCell>
                                        {!isClientBoqForSubcon && <TableCell></TableCell>}
                                    </TableRow>
                                    {isSstEnabled && (
                                        <TableRow>
                                            <TableCell colSpan={columns.length - 1} className="text-right font-semibold">SST ({sstPercentage}%)</TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(sstAmount)}</TableCell>
                                            {!isClientBoqForSubcon && <TableCell></TableCell>}
                                        </TableRow>
                                    )}
                                    <TableRow>
                                        <TableCell colSpan={columns.length - 1} className="text-right font-bold text-lg">Grand Total</TableCell>
                                        <TableCell className="text-right font-bold text-lg">{formatCurrency(grandTotal)}</TableCell>
                                        {!isClientBoqForSubcon && <TableCell></TableCell>}
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </div>
                    {category !== 'Client' && (
                        <div className="flex justify-end font-bold text-lg mt-4 pr-4">
                            Total Amount: {formatCurrency(subtotal)}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    const clientBoqColumns = [
        { key: 'id', label: 'PU No', className: 'w-[120px] font-mono' },
        { key: 'description', label: 'Description', className: 'w-[40%]' },
        { key: 'unit', label: 'Unit' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'rate', label: 'Rate (RM)' },
        { key: 'managementFee', label: 'Mngmt. Fee (RM)' },
        { key: 'amount', label: 'Amount (RM)' },
    ];

    const costBoqColumns = [
        { key: 'id', label: 'PU No', className: 'w-[120px] font-mono' },
        { key: 'description', label: 'Description', className: 'w-[50%]' },
        { key: 'unit', label: 'Unit' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'rate', label: 'Rate (RM)' },
        { key: 'amount', label: 'Amount (RM)' },
    ];
    
    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Export to Excel</Button>
                <Button variant="outline" onClick={() => setIsMultiPartPdfDialogOpen(true)}><FileDown className="mr-2 h-4 w-4" /> Export to PDF</Button>
                <Button onClick={handleSaveBudget} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save Budget"}
                </Button>
            </div>
            
            <BoQTable title="Client BOQ" items={isSubconProject ? clientBoqItemsFromPO : (project.clientBoq || [])} category="Client" columns={clientBoqColumns} plantUnits={plantUnits} />
            <BoQTable title="Engineering Services BOQ" items={project.engineeringBoq || []} category="Engineering" columns={costBoqColumns} clientBoq={isSubconProject ? clientBoqItemsFromPO : project.clientBoq} plantUnits={plantUnits}/>
            <BoQTable title="Material BOQ" items={project.materialBoq || []} category="Material" columns={costBoqColumns} plantUnits={plantUnits} />
            
            <Card className="bg-primary/5">
                <CardHeader>
                    <CardTitle className="font-headline">Budget Planning Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="font-semibold mb-4">Revenue & Cost Breakdown</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>Budgeted Revenue (Client BOQ):</span> <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(budgetedRevenue)}</span></div>
                            <div className="flex justify-between"><span>Engineering Services Cost:</span> <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(engineeringCost)}</span></div>
                            <div className="flex justify-between"><span>Material Cost:</span> <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(materialCost)}</span></div>
                            <div className="flex justify-between border-t pt-2 mt-2 font-bold"><span>Total Budgeted Cost:</span> <span>{formatCurrency(totalBudgetedCost)}</span></div>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-4">Profitability Analysis</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>Total Gross Profit:</span> <span className="font-bold text-primary">{formatCurrency(totalGrossProfit)}</span></div>
                            <div className="flex justify-between"><span>Gross Margin:</span> <span className="font-bold text-primary">{grossMargin.toFixed(2)}%</span></div>
                            <div className="mt-4 text-xs p-2 rounded-md bg-background">
                                <p className={`font-medium ${grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {profitabilityStatus}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit' : 'Add'} {editingItem?.category || addingCategory} BOQ Item</DialogTitle>
                    </DialogHeader>
                    <BoqItemForm
                        project={project}
                        plantUnits={plantUnits}
                        contracts={contracts}
                        directory={allCompanies}
                        itemType={editingItem?.category || addingCategory!}
                        item={editingItem?.item}
                        onSave={handleSaveItem}
                        onCancel={handleCloseDialog}
                        managementFeePercentage={(editingItem?.category || addingCategory) === 'Client' ? managementFeePercentage : undefined}
                    />
                </DialogContent>
            </Dialog>
            
            <Dialog open={isBoqPdfFormOpen} onOpenChange={setIsBoqPdfFormOpen}>
                 <DialogContent className="max-w-2xl">
                     <DialogHeader>
                        <DialogTitle>Export Bill of Quantities</DialogTitle>
                        <DialogDescription>
                            Confirm or edit the details below for the PDF export.
                        </DialogDescription>
                    </DialogHeader>
                    <BoqPdfForm
                        project={project}
                        company={company}
                        allCompanies={allCompanies}
                        clientBoq={isSubconProject ? clientBoqItemsFromPO : project.clientBoq}
                        onCancel={() => setIsBoqPdfFormOpen(false)}
                        saveProjectDetails={saveProjectDetails}
                        managementFeePercentage={managementFeePercentage}
                        plantUnits={plantUnits}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isMultiPartPdfDialogOpen} onOpenChange={setIsMultiPartPdfDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Customize PDF Export</DialogTitle>
                        <DialogDescription>Select the content and layout for your PDF report.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Sections to Include</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center space-x-2"><Checkbox id="includeClient" checked={pdfOptions.includeClient} onCheckedChange={(checked) => setPdfOptions(prev => ({...prev, includeClient: !!checked}))} /><Label htmlFor="includeClient">Client BOQ</Label></div>
                                <div className="flex items-center space-x-2"><Checkbox id="includeEng" checked={pdfOptions.includeEng} onCheckedChange={(checked) => setPdfOptions(prev => ({...prev, includeEng: !!checked}))} /><Label htmlFor="includeEng">Engineering BOQ</Label></div>
                                <div className="flex items-center space-x-2"><Checkbox id="includeMat" checked={pdfOptions.includeMat} onCheckedChange={(checked) => setPdfOptions(prev => ({...prev, includeMat: !!checked}))} /><Label htmlFor="includeMat">Material BOQ</Label></div>
                                <div className="flex items-center space-x-2"><Checkbox id="includeSummary" checked={pdfOptions.includeSummary} onCheckedChange={(checked) => setPdfOptions(prev => ({...prev, includeSummary: !!checked}))} /><Label htmlFor="includeSummary">Summary</Label></div>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Layout Options</Label>
                             <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col space-y-2">
                                    <Label>Page Orientation</Label>
                                    <Select onValueChange={(value) => setPdfOptions(prev => ({...prev, orientation: value as 'portrait' | 'landscape'}))} defaultValue={pdfOptions.orientation}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="portrait">Portrait</SelectItem>
                                            <SelectItem value="landscape">Landscape</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="pt-8 space-y-2">
                                    <div className="flex items-center space-x-2"><Checkbox id="showPuNo" checked={pdfOptions.showPuNo} onCheckedChange={(checked) => setPdfOptions(prev => ({...prev, showPuNo: !!checked}))} /><Label htmlFor="showPuNo">Show PU No.</Label></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="showMngmt" checked={pdfOptions.showManagementFee} onCheckedChange={(checked) => setPdfOptions(prev => ({...prev, showManagementFee: !!checked}))} /><Label htmlFor="showMngmt">Show Mngmt. Fee</Label></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="showSst" checked={pdfOptions.showSst} onCheckedChange={(checked) => setPdfOptions(prev => ({...prev, showSst: !!checked}))} /><Label htmlFor="showSst">Show SST</Label></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMultiPartPdfDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => { handleExportPdf(); setIsMultiPartPdfDialogOpen(false); }}>Export</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
    

    

    