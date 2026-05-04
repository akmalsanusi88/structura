
'use client';
import type { Project, PlantUnit, SiteInstruction, Company, InHouseTeam } from "@/lib/types";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import { FileUp, FileDown } from "lucide-react";

interface TeamAsBuiltSummaryViewProps {
    project: Project;
    plantUnits: PlantUnit[];
    company?: Company | null;
}

interface SummaryItem {
    sourceId: string;
    description: string;
    unit: string;
    rate: number;
    totalQuantity: number;
    totalValue: number;
    sourceType?: 'boq' | 'pu' | 'si';
}

export default function TeamAsBuiltSummaryView({ project, plantUnits, company }: TeamAsBuiltSummaryViewProps) {
    
    const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);
    
    const engineeringBoqMap = useMemo(() => new Map(project.engineeringBoq.map(item => [item.id, item])), [project.engineeringBoq]);

    const workSummary = useMemo(() => {
        const summary = new Map<string, SummaryItem>();

        // Process daily work logs
        project.dailyActivities?.forEach(log => {
            log.work.forEach(workRecord => {
                if (workRecord.teamId) {
                    let rate = 0;
                    let description = 'Unknown';
                    let unit = 'unit';
                    let sourceType: 'boq' | 'pu' | undefined;

                    const engBoqItem = engineeringBoqMap.get(workRecord.boqItemId);
                    if (engBoqItem) {
                        rate = engBoqItem.rate;
                        description = engBoqItem.description;
                        unit = engBoqItem.unit;
                        sourceType = 'boq';
                    } else {
                        const pu = plantUnitMap.get(workRecord.boqItemId);
                        if (pu) {
                            rate = pu.rate;
                            description = pu.description;
                            unit = pu.unit;
                            sourceType = 'pu';
                        }
                    }

                    let entry = summary.get(workRecord.boqItemId);
                    if (!entry) {
                        entry = {
                            sourceId: workRecord.boqItemId,
                            description,
                            unit,
                            rate,
                            totalQuantity: 0,
                            totalValue: 0,
                            sourceType,
                        };
                        summary.set(workRecord.boqItemId, entry);
                    }
                    entry.totalQuantity += workRecord.quantity;
                    entry.totalValue += workRecord.quantity * rate;
                }
            });

            // Process site instructions
            (log.siteInstructions || []).forEach(si => {
                if(si.teamId) {
                    const key = `si-${si.id}`;
                    let entry = summary.get(key);
                     if (!entry) {
                        entry = {
                            sourceId: key,
                            description: si.description,
                            unit: si.unit || '',
                            rate: si.rate || 0,
                            totalQuantity: si.quantity || 0,
                            totalValue: si.amount,
                            sourceType: 'si',
                        };
                        summary.set(key, entry);
                    }
                }
            });
        });

        return Array.from(summary.values());
    }, [project.dailyActivities, plantUnitMap, engineeringBoqMap]);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };

    const totalValue = workSummary.reduce((acc, item) => acc + item.totalValue, 0);
    
    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const data = workSummary.map(item => ({
            'Description': item.description,
            'Quantity': item.totalQuantity,
            'Unit': item.unit,
            'Rate (RM)': item.rate,
            'Total Value (RM)': item.totalValue,
        }));
        
        data.push({} as any); // Spacer row
        data.push({
            'Description': 'Total Work Value',
            'Total Value (RM)': totalValue,
        } as any);

        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, `Team Work Summary`);
        XLSX.writeFile(wb, `${project.name} - Team Work Summary.xlsx`);
    };

    const handleExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        
        const companyName = company ? company.name : 'Structura';

        const doc = new jsPDF({ orientation: 'portrait' });
        
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(companyName.toUpperCase(), 14, 15);

        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text("Team Work Summary", 14, 22);

        let y_pos = 29;
        doc.setFontSize(11);
        doc.setTextColor(100);

        const projectNameText = doc.splitTextToSize(`Project: ${project.name}`, doc.internal.pageSize.getWidth() - 28);
        doc.text(projectNameText, 14, y_pos);
        y_pos += doc.getTextDimensions(projectNameText).h + 5;

        const head = [['Description', 'Quantity', 'Unit', 'Rate', 'Total Value']];
        const body = workSummary.map(item => [
            item.description,
            item.totalQuantity.toFixed(2),
            item.unit,
            formatCurrency(item.rate),
            formatCurrency(item.totalValue)
        ]);

        autoTable(doc, {
            head,
            body,
            startY: y_pos,
            headStyles: { fillColor: [41, 128, 185] },
            theme: 'striped',
            foot: [
                ['Total Work Value', '', '', '', formatCurrency(totalValue)]
            ],
            footStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0 },
            didParseCell: function (data) {
                if (data.column.index > 0) {
                    data.cell.styles.halign = 'right';
                     if (data.column.index <= 2 && data.row.section !== 'head') {
                         data.cell.styles.halign = 'left';
                    }
                }
            }
        });

        doc.save(`${project.name} - Team Work Summary.pdf`);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Team Work Summary</CardTitle>
                        <CardDescription>A summary of all work done by all in-house teams.</CardDescription>
                    </div>
                     <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                        <Button variant="outline" size="sm" onClick={handleExportPdf}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50%]">Description</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead className="text-right">Rate</TableHead>
                                <TableHead className="text-right">Total Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {workSummary.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No work recorded for any team.</TableCell>
                                </TableRow>
                            ) : (
                                workSummary.map((item) => (
                                    <TableRow key={item.sourceId}>
                                        <TableCell className="font-medium py-2 px-4">{item.description}</TableCell>
                                        <TableCell className="py-2 px-4">{item.totalQuantity.toFixed(2)} {item.unit}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(item.rate)}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(item.totalValue)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={3} className="text-right font-bold py-2 px-4">Total Work Value:</TableCell>
                                <TableCell className="text-right font-bold py-2 px-4">{formatCurrency(totalValue)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
