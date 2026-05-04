
'use client';

import type { Project, ProjectStatus, PlantUnit, SiteInstruction, Company, Contract } from '@/lib/types';
import { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname, useParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Plus, Briefcase, TrendingUp, DollarSign, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ProjectForm from './project-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addProject } from '@/app/[companyId]/projects/actions';
import { Progress } from '@/components/ui/progress';

const statusTabs: { label: string, value: ProjectStatus | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Setup', value: 'Setup' },
    { label: 'Planning', value: 'Planning' },
    { label: 'Implementation', value: 'Implementation' },
    { label: 'Overdue', value: 'Overdue' },
    { label: 'KIV', value: 'KIV' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Cancelled', value: 'Cancelled' },
    { label: 'Closed', value: 'Closed' },
];

const getStatusBadgeVariant = (status: ProjectStatus) => {
  switch (status) {
    case 'Implementation':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300';
    case 'Planning':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300';
    case 'Overdue':
      return 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300';
    case 'Completed':
       return 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300';
    case 'KIV':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300';
    case 'Cancelled':
    case 'Closed':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300';
    case 'Setup':
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300';
  }
};

type SortKey = 'name' | 'client' | 'supervisor' | 'status' | 'progress' | 'clientPoValue' | 'actualRevenue';
type CalculatedProject = Project & {
    progress: number;
    actualRevenue: number;
    clientPoNo: string;
    clientPoValue: number;
};


export default function ProjectList({ initialProjects, plantUnits, directory, contracts }: { initialProjects: Project[], plantUnits: PlantUnit[], directory: Company[], contracts: Contract[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const companyId = params.companyId as string;
  
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState<ProjectStatus | 'all'>(searchParams.get('status') as ProjectStatus | 'all' || 'all');
  const [selectedYear, setSelectedYear] = useState<string>(searchParams.get('year') || 'all');
  const [selectedClient, setSelectedClient] = useState<string>(searchParams.get('client') || 'all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(() => {
    const sort = searchParams.get('sort');
    const direction = searchParams.get('dir');
    if (sort && direction) {
      return { key: sort as SortKey, direction: direction as 'asc' | 'desc' };
    }
    return null;
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const rowsPerPage = 25;

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (activeTab !== 'all') params.set('status', activeTab);
    if (selectedYear !== 'all') params.set('year', selectedYear);
    if (selectedClient !== 'all') params.set('client', selectedClient);
    if (sortConfig) {
      params.set('sort', sortConfig.key);
      params.set('dir', sortConfig.direction);
    }
    if (currentPage > 1) params.set('page', String(currentPage));

    router.replace(`${pathname}?${params.toString()}`);
  }, [searchTerm, activeTab, selectedYear, selectedClient, sortConfig, currentPage, router, pathname]);

  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    initialProjects.forEach(p => {
        if (p.targetCompletionDate) {
            years.add(new Date(p.targetCompletionDate).getFullYear().toString());
        }
    });
    return ['all', ...Array.from(years).sort((a, b) => Number(b) - Number(a))];
  }, [initialProjects]);

  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    initialProjects.forEach(p => clients.add(p.client));
    return ['all', ...Array.from(clients).sort()];
  }, [initialProjects]);


  const projectsWithCalculatedValues = useMemo(() => {
    return initialProjects.map(project => {
        const clientPOs = (project.purchaseOrders || []).filter(po => po?.type === 'Client');
        const clientPoNo = clientPOs.map(po => po.poNo).filter(Boolean).join(', ') || 'N/A';
        const clientPoValue = clientPOs.reduce((total, po) => total + (po.items || []).reduce((itemTotal, item) => itemTotal + (item.quantity * item.rate) + (item.managementFee || 0), 0), 0);

        const clientPoItemMap = new Map(clientPOs.flatMap(po => po.items).map(item => [item.id, item]));
        
        const workDoneFromLogs = (project.dailyActivities || []).reduce((total, log) => {
            return total + log.work.reduce((dayTotal, workRecord) => {
                const poItem = clientPoItemMap.get(workRecord.boqItemId);
                if (poItem) {
                    const workValue = workRecord.quantity * poItem.rate;
                     let feePortion = 0;
                    if (poItem.managementFee && poItem.quantity > 0) {
                        feePortion = (workRecord.quantity / poItem.quantity) * poItem.managementFee;
                    }
                    return dayTotal + workValue + feePortion;
                }
                return dayTotal;
            }, 0);
        }, 0);
        
        const workDoneFromSIs = (project.dailyActivities || [])
            .flatMap(log => log.siteInstructions || [])
            .filter((si: SiteInstruction) => si.context === 'Client')
            .reduce((total, si) => total + si.amount, 0);

        const actualRevenue = workDoneFromLogs + workDoneFromSIs;
        
        let progress = 0;
        if (clientPoValue > 0) {
            progress = Math.round((actualRevenue / clientPoValue) * 100);
        } else if (project.status === 'Completed' || project.status === 'Closed') {
            progress = 100;
        }

        const calculatedBudgetedCost = (project.engineeringBoq?.length || project.materialBoq?.length)
            ? (project.engineeringBoq.reduce((acc, item) => acc + (item.quantity * item.rate), 0)) + (project.materialBoq.reduce((acc, item) => acc + (item.quantity * item.rate), 0))
            : project.budgetedCost;
            
        const subconPoItems = (project.purchaseOrders || []).filter(po => po.type === 'Subcontractor').flatMap(po => po.items);
        const subconPoItemMap = new Map(subconPoItems.map(item => [item.id, item]));
        const subconActualCost = project.dailyActivities?.reduce((total, log) => {
            return total + log.work.reduce((dayTotal, workRecord) => {
                const poItem = subconPoItemMap.get(workRecord.boqItemId);
                if (poItem) {
                    return dayTotal + (workRecord.quantity * (poItem?.rate || 0));
                }
                return dayTotal;
            }, 0);
        }, 0) || 0;
        
        const rateMap = new Map<string, number>();
        (project.materialBoq || []).forEach(item => rateMap.set(item.id, item.rate));
        plantUnits.forEach(item => {
          if (!rateMap.has(item.id)) rateMap.set(item.id, item.rate)
        });
        
        const materialSummaryMap = new Map<string, { issuedQty: number; returnedQty: number }>();
        (project.materialIssuances || []).flatMap(i => i.items).forEach(item => {
            const entry = materialSummaryMap.get(item.sourceId) ?? { issuedQty: 0, returnedQty: 0 };
            entry.issuedQty += item.quantity;
            materialSummaryMap.set(item.sourceId, entry);
        });
        (project.materialReturns || []).flatMap(r => r.items).forEach(item => {
            const entry = materialSummaryMap.get(item.sourceId) ?? { issuedQty: 0, returnedQty: 0 };
            entry.returnedQty += item.quantity;
            materialSummaryMap.set(item.sourceId, entry);
        });

        let materialActualCost = 0;
        materialSummaryMap.forEach((data, sourceId) => {
            const usedQty = data.issuedQty - data.returnedQty;
            const rate = rateMap.get(sourceId) || 0;
            materialActualCost += usedQty * rate;
        });

        const teamActualCost = (project.teamCosts || []).reduce((sum, cost) => sum + cost.salary + cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep, 0) || 0;
        const totalActualCost = subconActualCost + materialActualCost + teamActualCost;

        const estGrossProfit = clientPoValue - calculatedBudgetedCost;
        const actualGrossProfit = actualRevenue - totalActualCost;

        return {
            ...project,
            progress: Math.min(progress, 100),
            budgetedCost: calculatedBudgetedCost,
            actualCost: totalActualCost,
            revenue: clientPoValue,
            actualRevenue,
            estGrossProfit,
            actualGrossProfit,
            clientPoNo,
            clientPoValue
        };
    });
  }, [initialProjects, plantUnits]);

  const filteredProjects = useMemo(() => {
    let sortableItems: CalculatedProject[] = [...projectsWithCalculatedValues];
    
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        return 0;
      });
    }

    return sortableItems
      .filter((project) => activeTab === 'all' || project.status === activeTab)
      .filter((project) => selectedClient === 'all' || project.client === selectedClient)
      .filter(
        (project) => {
            const lowerSearchTerm = searchTerm.toLowerCase();
            return (
                project.name.toLowerCase().includes(lowerSearchTerm) ||
                (project.projectNo && project.projectNo.toLowerCase().includes(lowerSearchTerm)) ||
                project.client.toLowerCase().includes(lowerSearchTerm) ||
                (project.clientPoNo && project.clientPoNo.toLowerCase().includes(lowerSearchTerm))
            )
        }
      );
  }, [projectsWithCalculatedValues, searchTerm, activeTab, selectedClient, sortConfig]);

  const projectStats = useMemo(() => {
    const yearFilteredProjects = projectsWithCalculatedValues.filter(p =>
      selectedYear === 'all' || (p.targetCompletionDate && new Date(p.targetCompletionDate).getFullYear().toString() === selectedYear)
    );

    const totalProjects = initialProjects.length;
    const activeProjects = initialProjects.filter(p => p.status !== 'Closed' && p.status !== 'Completed' && p.status !== 'Cancelled').length;
    
    const totalBudgetedRevenue = yearFilteredProjects.reduce((acc, p) => acc + p.revenue, 0);
    const totalActualRevenue = yearFilteredProjects.reduce((acc, p) => acc + p.actualRevenue, 0);

    return { totalProjects, activeProjects, totalBudgetedRevenue, totalActualRevenue };
  }, [initialProjects, projectsWithCalculatedValues, selectedYear]);
  
  const totalPages = Math.ceil(filteredProjects.length / rowsPerPage);
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredProjects.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredProjects]);
  
  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const renderSortableHeader = (label: string, sortKey: SortKey) => (
    <TableHead>
        <Button variant="ghost" onClick={() => requestSort(sortKey)}>
            {label}
            {getSortIcon(sortKey)}
        </Button>
    </TableHead>
  );

  const renderSortableHeaderNumeric = (label: string, sortKey: SortKey) => (
    <TableHead className="text-right">
        <Button variant="ghost" onClick={() => requestSort(sortKey)}>
            {label}
            {getSortIcon(sortKey)}
        </Button>
    </TableHead>
  );

  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  const handleNextPage = () => goToPage(currentPage + 1);
  const handlePrevPage = () => goToPage(currentPage - 1);
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => goToPage(totalPages);

  const handleAddProject = async (projectData: Omit<Project, 'id' | 'companyId'>) => {
    setIsAdding(true);
    try {
        const newProject = await addProject(projectData, companyId);
        setIsFormOpen(false);
        router.push(`/${companyId}/projects/${newProject.id}`);
    } catch(error) {
        console.error("Failed to add project:", error);
    } finally {
        setIsAdding(false);
    }
  }

  const handleRowClick = (projectId: string) => {
    setNavigatingTo(projectId);
    router.push(`/${companyId}/projects/${projectId}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: 2,
    }).format(amount);
  };
  
  const PaginationControls = () => (
    <div className="flex items-center justify-end w-full space-x-4">
        <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages > 0 ? totalPages : 1}
        </span>
        <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1}>
                First
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                Previous
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages}>
                Next
            </Button>
            <Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage >= totalPages}>
                Last
            </Button>
        </div>
    </div>
  );

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold font-headline">Projects</h1>
                <p className="text-muted-foreground">Manage and track all your projects</p>
            </div>
            <Button onClick={() => setIsFormOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Project</Button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{projectStats.totalProjects}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{projectStats.activeProjects}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Amount PO</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(projectStats.totalBudgetedRevenue)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total As-Built Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(projectStats.totalActualRevenue)}</div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Filter Projects</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="relative md:col-span-3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Search by project name, number, or client..."
                          className="pl-8"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {uniqueYears.map(year => (
                                <SelectItem key={year} value={year}>{year === 'all' ? 'All Years' : year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Client" />
                        </SelectTrigger>
                        <SelectContent>
                            {uniqueClients.map(client => (
                                <SelectItem key={client} value={client}>{client === 'all' ? 'All Clients' : client}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className='flex items-center gap-2 w-full overflow-x-auto'>
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProjectStatus | 'all')} className='w-full'>
                        <TabsList className="w-full">
                            {statusTabs.map(tab => (
                            <TabsTrigger key={tab.value} value={tab.value} className='flex-1'>{tab.label}</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <Button variant="outline" className='shrink-0'>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Project List</CardTitle>
                <CardDescription>Click on any project row to view details and manage modules</CardDescription>
                <div className="pt-2">
                    <PaginationControls />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="border-t rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                    <TableRow>
                        {renderSortableHeader('Project', 'name')}
                        {renderSortableHeader('Client', 'client')}
                        {renderSortableHeader('Person in Charge', 'supervisor')}
                        {renderSortableHeader('Status', 'status')}
                        {renderSortableHeaderNumeric('Progress', 'progress')}
                        <TableHead>PO No.</TableHead>
                        {renderSortableHeaderNumeric('PO Value', 'clientPoValue')}
                        {renderSortableHeaderNumeric('As-Built Value', 'actualRevenue')}
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {paginatedProjects.map((project) => (
                        <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(project.id)}>
                        <TableCell className="py-2 px-4">
                            <div className="font-medium text-sm flex items-center gap-2">
                                {navigatingTo === project.id && <Loader2 className="animate-spin" />}
                                {project.name}
                            </div>
                            <div className="text-xs text-muted-foreground">{project.projectNo}</div>
                        </TableCell>
                        <TableCell className="py-2 px-4 text-xs">{project.client}</TableCell>
                        <TableCell className="py-2 px-4 text-xs">{project.supervisor}</TableCell>
                        <TableCell className="py-2 px-4 text-xs">
                            <Badge className={getStatusBadgeVariant(project.status)} variant="outline">
                            {project.status}
                            </Badge>
                        </TableCell>
                         <TableCell className="py-2 px-4 text-xs">
                            <div className="flex items-center gap-2 justify-end">
                                <Progress value={project.progress} className="w-20" />
                                <span>{project.progress}%</span>
                            </div>
                        </TableCell>
                        <TableCell className="py-2 px-4 text-xs">{project.clientPoNo}</TableCell>
                        <TableCell className="py-2 px-4 text-xs text-right">{formatCurrency(project.clientPoValue)}</TableCell>
                        <TableCell className="py-2 px-4 text-xs text-right">{formatCurrency(project.actualRevenue)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
            <CardFooter className="py-4">
                <PaginationControls />
            </CardFooter>
        </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-headline">Create New Project</DialogTitle>
            <DialogDescription>
                Fill in the details to set up a new project.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm onSave={handleAddProject} onCancel={() => setIsFormOpen(false)} directory={directory} contracts={contracts} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
