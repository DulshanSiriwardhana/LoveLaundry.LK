export type CurrencyCode = "LKR";
export type ReportStatus = "draft" | "reviewed" | "approved" | "invoiced" | "closed";
export type PricingStatus = "priced" | "missing_rate" | "waived";

export interface InventoryItem {
  _id: string;
  organizationId: string;
  sectionId: string;
  sectionCode: string;
  itemCode: string;
  itemNo: number;
  name: string;
  unitOfMeasure: "piece";
  currency: CurrencyCode;
  defaultUnitRateLkr: number | null;
  rateStatus: "configured" | "missing_rate";
  billingCategoryCode: string | null;
  billingCategoryName: string | null;
  active: boolean;
  sortOrder: number;
}

export interface DailyInventoryEntry {
  _id: string;
  organizationId: string;
  reportId: string;
  customerId: string | null;
  sectionCode: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  billingCategoryCode: string | null;
  billingCategoryName: string | null;
  serviceDate: string; // YYYY-MM-DD; local business date, Asia/Colombo
  dayOfMonth: number;
  quantity: number;
  unitOfMeasure: "piece";
  unitRateLkr: number | null; // snapshot at entry time
  lineAmountLkr: number;      // quantity * unitRate; 0 when missing rate, but flagged
  pricingStatus: PricingStatus;
}

export interface MonthlyReport {
  _id: string;
  organizationId: string;
  customerId: string | null;
  reportName: string;
  monthKey: string; // YYYY-MM
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  timezone: "Asia/Colombo";
  currency: CurrencyCode;
  status: ReportStatus;
  invoiceStatus: "not_generated" | "draft" | "issued" | "paid";
}

export interface InvoiceSummaryLine {
  billingCategoryCode: string;
  billingCategoryName: string;
  quantity: number;
  amountLkr: number;
  unpricedQuantity: number;
}
