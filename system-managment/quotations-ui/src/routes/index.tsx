import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/app-shell'
import { ProtectedRoute } from '../components/layout/protected-route'
import { AdminRoute } from '../components/layout/admin-route'
import { ManagerRoute } from '../components/layout/manager-route'
// Eager: must always be available to render if a lazy chunk fails to load.
import ErrorPage from '../features/quotations/pages/error-page'

// Route-level code splitting: every page is loaded on demand so the initial
// bundle only contains the shell + login. Named-export pages are wrapped
// so each lazy() call resolves to a default component.

const LoginPage = lazy(() => import('../features/auth/pages/login-page'))
const GuestQuotationsPage = lazy(() => import('../features/quotations/pages/guest-quotations-page'))

// Daily Operations (landing page)
const TodayPage = lazy(() => import('../features/today/pages/today-page'))

// Operations pages
const DashboardPage = lazy(() => import('../features/quotations/pages/dashboard-page'))
const QuotationsPage = lazy(() => import('../features/quotations/pages/quotations-page'))
const QuotationDetailPage = lazy(() => import('../features/quotations/pages/quotation-detail-page'))
const QuotationPrintPage = lazy(() => import('../features/quotations/pages/quotation-print-page'))
const QuotationFormPage = lazy(() => import('../features/quotations/pages/quotation-form-page'))
const CategoriesPage = lazy(() => import('../features/quotations/pages/categories-page'))
const SettingsPage = lazy(() => import('../features/quotations/pages/settings-page'))
const ProfilePage = lazy(() => import('../features/quotations/pages/profile-page'))
const BillsListPage = lazy(() => import('../features/quotations/pages/bills-list-page'))
const CreateBillPage = lazy(() => import('../features/quotations/pages/create-bill-page'))
const BillDetailPage = lazy(() => import('../features/quotations/pages/bill-detail-page'))
const InvoiceCreatePage = lazy(() => import('../features/quotations/pages/invoice-create-page'))
const StatementPage = lazy(() => import('../features/quotations/pages/statement-page'))
const GatePassesPage = lazy(() => import('../features/quotations/pages/gatepasses-page'))
const CreateGatePassPage = lazy(() => import('../features/quotations/pages/create-gatepass-page'))
const GatePassDetailPage = lazy(() => import('../features/quotations/pages/gatepass-detail-page'))
const DeliveriesPage = lazy(() => import('../features/quotations/pages/deliveries-page'))
const CreateDeliveryPage = lazy(() => import('../features/quotations/pages/create-delivery-page'))
const DispatchPage = lazy(() => import('../features/quotations/pages/dispatch-page'))
const DeliveryDetailPage = lazy(() => import('../features/quotations/pages/delivery-detail-page'))
const HotelLinenFlowPage = lazy(() => import('../features/quotations/pages/hotel-linen-flow-page'))
const ReportsPage = lazy(() => import('../features/quotations/pages/reports-page'))
const BusinessDashboardPage = lazy(() => import('../features/quotations/pages/business-dashboard-page'))
const LiveChatPage = lazy(() => import('../features/quotations/pages/live-chat-page'))
const UsersPage = lazy(() => import('../features/quotations/pages/users-page'))
const NotificationsPage = lazy(() => import('../features/quotations/pages/notifications-page'))
const DatabaseSyncPage = lazy(() => import('../features/quotations/pages/database-sync-page'))
const CustomersPage = lazy(() => import('../features/quotations/pages/customers-page'))
const ReturnsPage = lazy(() => import('../features/quotations/pages/returns-page'))
const CreateReturnPage = lazy(() => import('../features/quotations/pages/create-return-page'))
const ReturnDetailPage = lazy(() => import('../features/quotations/pages/return-detail-page'))

// Shop Bills pages
const ShopBillsListPage = lazy(() => import('../features/shop-bills/pages/shop-bills-list-page'))
const CreateShopBillPage = lazy(() => import('../features/shop-bills/pages/create-shop-bill-page'))
const ShopBillDetailPage = lazy(() => import('../features/shop-bills/pages/shop-bill-detail-page'))
const ShopBillsDashboardPage = lazy(() => import('../features/shop-bills/pages/shop-bills-dashboard-page'))
const LegacyInvoicePage = lazy(() => import('../features/shop-bills/pages/legacy-invoice-page'))

// Workers pages (named exports)
const WorkersPage = lazy(() =>
  import('../features/workers/pages/workers-page').then(m => ({ default: m.WorkersPage })),
)
const DailyTasksPage = lazy(() =>
  import('../features/workers/pages/daily-tasks-page').then(m => ({ default: m.DailyTasksPage })),
)

// Linen Tracking pages
const LinenDashboard = lazy(() => import('../features/linen/pages/linen-dashboard'))
const LinenInventory = lazy(() => import('../features/linen/pages/linen-inventory'))
const LinenProfile = lazy(() => import('../features/linen/pages/linen-profile'))
const LinenScanner = lazy(() => import('../features/linen/pages/linen-scanner'))
const LinenBulkScan = lazy(() => import('../features/linen/pages/linen-bulk-scan'))
const LinenTagGenerator = lazy(() => import('../features/linen/pages/linen-tag-generator'))

// Gate Pass (Camelot) receipt templates
const GatePassHub = lazy(() => import('../features/gatepass/pages/gate-pass-hub'))
const CamelotLinenReceipt = lazy(() => import('../features/gatepass/pages/linen-receipt'))
const CamelotUniformReceipt = lazy(() => import('../features/gatepass/pages/uniform-receipt'))

// Management module pages
const ManagementDashboard = lazy(() => import('../features/management/pages/management-dashboard'))
const HistoricalEntry = lazy(() => import('../features/management/pages/historical-entry'))
const ImportWizard = lazy(() => import('../features/management/pages/import-wizard'))
const ManagementCustomers = lazy(() => import('../features/management/pages/management-customers'))
const ManagementItems = lazy(() => import('../features/management/pages/management-items'))
const ManagementExpenses = lazy(() => import('../features/management/pages/management-expenses'))
const ManagementEmployees = lazy(() => import('../features/management/pages/management-employees'))
const ManagementTransactions = lazy(() => import('../features/management/pages/management-transactions'))
const ManagementPayments = lazy(() => import('../features/management/pages/management-payments'))
const ManagementReports = lazy(() => import('../features/management/pages/management-reports'))
const SalarySlipPage = lazy(() => import('../features/management/pages/salary-slip-page'))
const SalaryHistoryPage = lazy(() => import('../features/management/pages/salary-history-page'))
const AdvancesPage = lazy(() => import('../features/management/pages/advances-page'))
const HolidaysPage = lazy(() => import('../features/management/pages/holidays-page'))
const ExtraWorkPage = lazy(() => import('../features/management/pages/extra-work-page'))
const AttendancePage = lazy(() => import('../features/management/pages/attendance-page'))
const AttendanceLogPage = lazy(() => import('../features/management/pages/attendance-log-page'))
const CompanySettingsPage = lazy(() => import('../features/management/pages/company-settings-page'))
const ReportsBackupPage = lazy(() => import('../features/reports-backup/reports-backup-page'))

// AI Insights pages
const AiInsightsPage = lazy(() => import('../features/ai/pages/ai-insights-page'))

const NotFoundPage = lazy(() => import('../features/quotations/pages/not-found-page'))

export const router = createBrowserRouter([
  // ── Public routes ─────────────────────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/guest/shop',
    element: <GuestQuotationsPage />,
    errorElement: <ErrorPage />,
  },

  // ── Protected routes (require auth) ──────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/today" replace /> },
          { path: 'today', element: <TodayPage /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'business-dashboard', element: <BusinessDashboardPage /> },
          { path: 'notifications', element: <NotificationsPage /> },

          // Contracts
          { path: 'quotations', element: <QuotationsPage /> },
          { path: 'quotations/new', element: <QuotationFormPage /> },
          { path: 'quotations/:id', element: <QuotationDetailPage /> },
          { path: 'quotations/:id/edit', element: <QuotationFormPage /> },
          { path: 'quotations/:id/print', element: <QuotationPrintPage /> },

          // Billing
          { path: 'bills', element: <BillsListPage /> },
          { path: 'bills/new', element: <CreateBillPage /> },
          { path: 'bills/:id', element: <BillDetailPage /> },
          { path: 'statements', element: <StatementPage /> },
          { path: 'invoices/new', element: <InvoiceCreatePage /> },

          // Gate Passes (Receiving)
          { path: 'gate-passes', element: <GatePassesPage /> },
          { path: 'gate-passes/new', element: <CreateGatePassPage /> },
          { path: 'gate-passes/:id', element: <GatePassDetailPage /> },

          // Deliveries
          { path: 'deliveries', element: <DeliveriesPage /> },
          { path: 'deliveries/new', element: <CreateDeliveryPage /> },
          { path: 'deliveries/:id', element: <DeliveryDetailPage /> },
          { path: 'hotel-linen-flow', element: <HotelLinenFlowPage /> },

          // Dispatch (pickup / delivery scheduling)
          { path: 'dispatch', element: <DispatchPage /> },

          // Returns
          { path: 'returns', element: <ReturnsPage /> },
          { path: 'returns/new', element: <CreateReturnPage /> },
          { path: 'returns/:id', element: <ReturnDetailPage /> },

          // Shop Bills
          { path: 'shop-bills', element: <ShopBillsListPage /> },
          { path: 'shop-bills/dashboard', element: <ShopBillsDashboardPage /> },
          { path: 'shop-bills/new', element: <CreateShopBillPage /> },
          { path: 'shop-bills/:id', element: <ShopBillDetailPage /> },
          { path: 'legacy-invoice', element: <LegacyInvoicePage /> },

          // Workers
          { path: 'workers', element: <WorkersPage /> },
          { path: 'workers/daily-tasks', element: <DailyTasksPage /> },

          // Linen Tracking
          { path: 'linen', element: <LinenDashboard /> },
          { path: 'linen/inventory', element: <LinenInventory /> },
          { path: 'linen/gate-pass', element: <GatePassHub /> },
          { path: 'linen/gate-pass/linen', element: <CamelotLinenReceipt /> },
          { path: 'linen/gate-pass/uniform', element: <CamelotUniformReceipt /> },
          { path: 'linen/:id', element: <LinenProfile /> },
          { path: 'linen/scanner', element: <LinenScanner /> },
          { path: 'linen/bulk-scan', element: <LinenBulkScan /> },
          { path: 'linen/tags', element: <LinenTagGenerator /> },

          // Public chatbot (ADMIN / MANAGER)
          { path: 'live-chat', element: <LiveChatPage /> },

          // Management Module
          { path: 'management', element: <ManagementDashboard /> },
          { path: 'management/transactions', element: <ManagementTransactions /> },
          { path: 'management/customers', element: <ManagementCustomers /> },
          { path: 'management/items', element: <ManagementItems /> },
          { path: 'management/payments', element: <ManagementPayments /> },

          // Payroll, HR, expenses and reporting. Guarded because a STAFF
          // session can reach every URL in the app, and the sidebar is only a
          // set of links — hiding a link is not access control.
          {
            element: <ManagerRoute />,
            children: [
              { path: 'management/historical-entry', element: <HistoricalEntry /> },
              { path: 'management/import', element: <ImportWizard /> },
              { path: 'management/expenses', element: <ManagementExpenses /> },
              { path: 'management/employees', element: <ManagementEmployees /> },
              { path: 'management/salary-slip', element: <SalarySlipPage /> },
              { path: 'management/salary-history', element: <SalaryHistoryPage /> },
              { path: 'management/advances', element: <AdvancesPage /> },
              { path: 'management/holidays', element: <HolidaysPage /> },
              { path: 'management/extra-work', element: <ExtraWorkPage /> },
              { path: 'management/attendance', element: <AttendancePage /> },
              { path: 'management/attendance-log', element: <AttendanceLogPage /> },
              { path: 'management/company-settings', element: <CompanySettingsPage /> },
              { path: 'management/reports', element: <ManagementReports /> },
            ],
          },

          // Analytics
          { path: 'reports', element: <ReportsPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'ai-insights', element: <AiInsightsPage /> },

          // System
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'settings', element: <SettingsPage /> },

          // Admin-only routes
          {
            element: <AdminRoute />,
            children: [
              { path: 'users', element: <UsersPage /> },
              { path: 'database-sync', element: <DatabaseSyncPage /> },
              { path: 'reports-backup', element: <ReportsBackupPage /> },
            ],
          },

          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },

  // Catch-all redirect
  { path: '*', element: <Navigate to="/login" replace /> },
])