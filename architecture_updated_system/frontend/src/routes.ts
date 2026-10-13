// Route registry mirroring the legacy quotations-ui route map (Stage 1 audit).
// `status` records whether the page has been recreated: "foundation" means the
// route exists but the full workflow is still backlog.
export interface AppRoute {
  path: string;
  label: string;
  group: string;
  status: "foundation" | "backlog";
}

export const ROUTES: AppRoute[] = [
  { path: "today", label: "Today", group: "Operations", status: "backlog" },
  { path: "dashboard", label: "Dashboard", group: "Operations", status: "foundation" },
  { path: "business-dashboard", label: "Business Dashboard", group: "Operations", status: "backlog" },
  { path: "notifications", label: "Notifications", group: "Operations", status: "backlog" },
  { path: "quotations", label: "Quotations", group: "Sales", status: "backlog" },
  { path: "quotations/new", label: "New Quotation", group: "Sales", status: "backlog" },
  { path: "bills", label: "Bills", group: "Sales", status: "backlog" },
  { path: "bills/new", label: "New Bill", group: "Sales", status: "backlog" },
  { path: "statements", label: "Statements", group: "Sales", status: "backlog" },
  { path: "gate-passes", label: "Gate Passes", group: "Logistics", status: "backlog" },
  { path: "deliveries", label: "Deliveries", group: "Logistics", status: "backlog" },
  { path: "hotel-linen-flow", label: "Hotel Linen Flow", group: "Logistics", status: "backlog" },
  { path: "monthly-operations", label: "Monthly Operations", group: "Logistics", status: "backlog" },
  { path: "dispatch", label: "Dispatch", group: "Logistics", status: "backlog" },
  { path: "returns", label: "Returns", group: "Logistics", status: "backlog" },
  { path: "shop-bills", label: "Shop Bills", group: "Retail", status: "backlog" },
  { path: "legacy-invoice", label: "Legacy Invoice", group: "Retail", status: "backlog" },
  { path: "workers", label: "Workers", group: "Workforce", status: "backlog" },
  { path: "linen", label: "Linen", group: "Linen", status: "backlog" },
  { path: "live-chat", label: "Live Chat", group: "Support", status: "backlog" },
  { path: "management", label: "Management", group: "Management", status: "foundation" },
  { path: "management/transactions", label: "Transactions", group: "Management", status: "backlog" },
  { path: "management/customers", label: "Customers", group: "Management", status: "backlog" },
  { path: "management/expenses", label: "Expenses", group: "Management", status: "backlog" },
  { path: "management/employees", label: "Employees", group: "Management", status: "backlog" },
  { path: "management/salary-slip", label: "Salary Slip", group: "Management", status: "backlog" },
];

export const GROUPS = Array.from(new Set(ROUTES.map((r) => r.group)));
