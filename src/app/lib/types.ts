
export interface Company {
  id: string;
  name: string;
  displayName?: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  attn?: string;
  bankName?: string;
  bankAccNo?: string;
  bankAddress?: string;
}

export type ProjectStatus = "Setup" | "Planning" | "Implementation" | "Overdue" | "KIV" | "Completed" | "Cancelled" | "Closed";

export interface BoQItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number; // Final rate
  baseRate?: number;
  discountPercentage?: number;
  sourceType?: 'pu' | 'percentage' | 'custom' | 'boq';
  sourceId?: string; // ID of Plant Unit OR ClientBoqItem
  percentage?: number;
}

export interface ClientBoQItem extends BoQItem {
  managementFee: number;
  includesMaterialCost?: boolean;
}

export interface SiteInstruction {
  id: string;
  description: string;
  amount: number;
  quantity?: number;
  unit?: string;
  rate?: number;
  sourceType?: 'custom' | 'pu' | 'percentage';
  sourceId?: string; // ID of Plant Unit
  discountPercentage?: number;
  managementFee?: number;
  hasManagementFee?: boolean;
  context?: 'Client' | 'Subcontractor' | 'Team';
  purchaseOrderId?: string;
  teamId?: string;
}

export interface DailyActivityWork {
  id: string;
  boqItemId: string; // links to PurchaseOrderItem or PlantUnit
  quantity: number;
  teamId?: string;
}

export interface DailyActivityLog {
  id:string;
  date: string; // YYYY-MM-DD
  work: DailyActivityWork[];
  siteInstructions: SiteInstruction[];
}

export interface SerialInfo {
  serialNo?: string;
  quantity: number;
}

export interface MaterialRequisitionItem {
  id: string; // Unique ID for this line item, e.g., 'mri-123'
  sourceId: string; // The ID of the BOQ item or Plant Unit, e.g., 'mb-001' or 'MPU-001'
  description: string;
  unit: string;
  quantity: number;
  serials?: SerialInfo[];
}

export interface MaterialRequisition {
  id: string;
  requisitionNo: string;
  date: string; // YYYY-MM-DD
  items: MaterialRequisitionItem[];
}

export interface MaterialIssuanceItem {
    id: string;
    sourceId: string;
    description: string;
    unit: string;
    quantity: number;
    onSiteUse?: number;
    serials?: SerialInfo[];
}

export interface MaterialIssuance {
  id: string;
  date: string;
  goodsIssueNo: string;
  items: MaterialIssuanceItem[];
}

export interface MaterialReturn {
  id: string;
  date: string;
  goodsReturnNo: string;
  items: MaterialRequisitionItem[];
}

export interface PurchaseOrderItem extends BoQItem {
    percentage?: number;
}

export type PurchaseOrderType = 'Client' | 'Subcontractor';

export interface PurchaseOrder {
  id: string;
  type: PurchaseOrderType;
  poNo: string;
  poDate: string; // YYYY-MM-DD
  targetCompletionDate?: string; // YYYY-MM-DD
  items: PurchaseOrderItem[];
  issuer: string; // Client name or Subcontractor Name
  originatingProjectId?: string;
  originatingPoId?: string;
  subcontractorCompanyId?: string;
  teamId?: string;
}

export interface MaterialPurchaseOrderItem {
  id: string;
  sourceId: string;
  description: string;
  unit: string;
  rate: number;
  quantity: number;
}

export interface MaterialPurchaseOrder {
    id: string;
    companyId: string;
    poNo: string;
    poDate: string;
    supplier: string;
    items: MaterialPurchaseOrderItem[];
    deliveryCost?: number;
    refQuotationNo?: string;
    projectId?: string;
    projectName?: string;
    projectNo?: string;
    projectPoNo?: string;
    sstPercentage?: number;
    includeDeliveryInSst?: boolean;
}

export interface DeliveryOrderItem {
  poItemId: string;
  description: string;
  unit: string;
  poQuantity: number;
  receivedQuantity: number;
  serials?: SerialInfo[];
}

export interface DeliveryOrder {
  id: string;
  companyId: string;
  materialPurchaseOrderId: string;
  poNo: string;
  doNo: string;
  date: string; // YYYY-MM-DD
  supplier: string;
  items: DeliveryOrderItem[];
}

export type ClaimStatus = 'Draft' | 'Submitted' | 'Received' | 'Paid' | 'Disputed';

export interface ClaimedItem {
  boqItemId: string; // This can link to a PurchaseOrderItem ID now
  workRecordId: string; // Links to DailyActivityWork id
  quantity: number;
}


export interface Claim {
  id: string;
  purchaseOrderId: string;
  purchaseOrderNo?: string;
  type?: 'Client' | 'Subcontractor';
  claimNo: string; // e.g., "Progress Claim 1", "Final Claim"
  invoiceNo: string;
  date: string; // YYYY-MM-DD
  amount: number;
  status: ClaimStatus;
  statusDates?: {
      [key in ClaimStatus]?: string;
  };
  isFinal: boolean;
  hasRetention: boolean;
  retentionPercentage?: number;
  retentionAmount?: number;
  claimedItems: ClaimedItem[];
}

export interface InHouseTeam {
  id: string;
  name: string;
  members: string[];
  companyId: string;
}

export interface TeamCost {
  id: string;
  teamId: string;
  month: string; // YYYY-MM
  salary: number;
  petrolAndToll: number;
  siteExpenses: number;
  machineryAndUpkeep: number;
}

export interface GeneralTeamCost {
  id: string;
  teamId: string;
  companyId: string;
  month: string; // YYYY-MM
  ppe: number;
  vehicleUpkeep: number;
  other: number;
}

export interface BoqPdfDetails {
    docTitle: string;
    docDate: string;
    clientName: string;
    clientAddress?: string;
    attn?: string;
    projectRefInfo?: string;
    refQuotationNo?: string;
    termsAndConditions?: string;
}

export interface MaterialOnSiteUsage {
    id: string;
    projectId: string;
    companyId: string;
    sourceId: string;
    quantity: number;
}

export interface StockAdjustment {
    id: string;
    companyId: string;
    sourceId: string; // plant_unit id
    quantity: number;
    adjustmentDate: string; // YYYY-MM-DD
    serials?: SerialInfo[];
}

export interface StockTakeItem {
    id: string;
    stockTakeId: string;
    sourceId: string; // plant_unit id
    countedQuantity: number;
    serials?: SerialInfo[];
}

export interface StockTake {
    id: string;
    companyId: string;
    takeDate: string;
    name: string;
    items: StockTakeItem[];
}


// The Project type now reflects the main table,
// while the array properties will be populated by relational queries.
export interface Project {
  id: string;
  companyId: string;
  name: string;
  projectNo: string | null;
  lorId?: string | null;
  client: string;
  supervisor: string | null;
  planner: string | null;
  status: ProjectStatus;
  budgetedCost: number;
  actualCost: number;
  revenue: number;
  progress: number;
  startDate: string;
  targetCompletionDate?: string | null;
  actualCompletionDate?: string | null;
  isHidden?: boolean;
  // BOQ columns are still on the projects table as per schema
  clientBoq: ClientBoQItem[];
  engineeringBoq: BoQItem[];
  materialBoq: BoQItem[];
  // These will be populated by relational queries
  purchaseOrders: PurchaseOrder[];
  dailyActivities: DailyActivityLog[];
  materialRequisitions: MaterialRequisition[];
  materialIssuances: MaterialIssuance[];
  materialReturns: MaterialReturns[];
  clientClaims: Claim[];
  subconClaims: Claim[];
  teamCosts: TeamCost[];
  materialOnSiteUsage?: MaterialOnSiteUsage[];
  originatingProjectId?: string;
  originatingPoId?: string;
}

export type PlantUnitCategory = "Client PU" | "Engineering Services PU" | "Material PU";

export interface PlantUnit {
  id: string; // The internal UUID
  companyId: string;
  puId: string; // The user-facing custom ID
  description: string;
  unit: string;
  rate: number;
  category: PlantUnitCategory;
  materialManagementFee?: boolean;
  hasSerialNo?: boolean;
  clientName?: string;
}

export type SupplierInvoiceStatus = 'Draft' | 'Received' | 'Paid';

export interface SupplierInvoice {
    id: string;
    companyId: string;
    invoiceNo: string;
    invoiceDate: string;
    dueDate: string;
    supplier: string;
    materialPurchaseOrderId: string;
    poNo: string; // for display
    deliveryOrderIds?: string[];
    amount: number;
    status: SupplierInvoiceStatus;
}
