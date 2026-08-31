import { Navigate, Route, Routes } from "react-router-dom";

import { DashboardPage } from "@/pages/dashboard-page";
import { AccountsPage } from "@/pages/accounts-page";
import { LoginPage } from "@/pages/login-page";
import { RegisterPage } from "@/pages/register-page";
import { VerifyOtpPage } from "@/pages/verify-otp-page";
import { TransactionsPage } from "@/pages/transactions-page";
import { TransferPage } from "@/pages/transfer-page";
import { BeneficiariesPage } from "@/pages/beneficiaries-page";
import { CardsPage } from "@/pages/cards-page";
import { SettingsPage } from "@/pages/settings-page";
import { ForgotCustomerIdPage } from "@/pages/forgot-customer-id-page";
import { ForgotPasswordPage } from "@/pages/forgot-password-page";
import { ProtectedRoute } from "@/routes/protected-route";
import { AdminRoute } from "@/routes/admin-route";
import { AdminDashboardPage } from "@/pages/admin-dashboard-page";
import { AdminResourcePage, type AdminResource } from "@/pages/admin-resource-page";
import { AdminCustomersPage } from "@/pages/admin-customers-page";
import { AdminAccountRequestsPage } from "@/pages/admin-account-requests-page";
import { AdminAccountsPage } from "@/pages/admin-accounts-page";
import { AdminLoanRequestsPage } from "@/pages/admin-loan-requests-page";
import { AdminLoansPage } from "@/pages/admin-loans-page";
import { AdminCardRequestsPage } from "@/pages/admin-card-requests-page";
import { LoansPage } from "@/pages/loans-page";
import { LoanDetailsPage } from "@/pages/loan-details-page";

const adminResources: AdminResource[] = ["transactions", "employees", "branches", "atms", "cards", "audit-logs"];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route
        path="/dashboard"
        element={(
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/accounts"
        element={(
          <ProtectedRoute>
            <AccountsPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/transactions"
        element={(
          <ProtectedRoute>
            <TransactionsPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/beneficiaries"
        element={(
          <ProtectedRoute>
            <BeneficiariesPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/cards"
        element={(
          <ProtectedRoute>
            <CardsPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/settings"
        element={(
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/transfer"
        element={(
          <ProtectedRoute>
            <TransferPage />
          </ProtectedRoute>
        )}
      />
      <Route path="/loans" element={<ProtectedRoute><LoansPage /></ProtectedRoute>} />
      <Route path="/loans/:id" element={<ProtectedRoute><LoanDetailsPage /></ProtectedRoute>} />
      <Route path="/forgot-customer-id" element={<ForgotCustomerIdPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
      <Route path="/admin/customers" element={<AdminRoute><AdminCustomersPage /></AdminRoute>} />
      <Route path="/admin/account-requests" element={<AdminRoute><AdminAccountRequestsPage /></AdminRoute>} />
      <Route path="/admin/accounts" element={<AdminRoute><AdminAccountsPage /></AdminRoute>} />
      <Route path="/admin/loan-requests" element={<AdminRoute><AdminLoanRequestsPage /></AdminRoute>} />
      <Route path="/admin/loans" element={<AdminRoute><AdminLoansPage /></AdminRoute>} />
      <Route path="/admin/card-requests" element={<AdminRoute><AdminCardRequestsPage /></AdminRoute>} />
      {adminResources.map((resource) => (
        <Route key={resource} path={`/admin/${resource}`} element={<AdminRoute><AdminResourcePage key={resource} resource={resource} /></AdminRoute>} />
      ))}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
