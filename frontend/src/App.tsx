import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import ExpensesPage from './pages/ExpensesPage';
import SettlementsPage from './pages/SettlementsPage';
import BalancesPage from './pages/BalancesPage';
import ImportCSVPage from './pages/ImportCSVPage';
import ImportReviewPage from './pages/ImportReviewPage';
import ImportReportPage from './pages/ImportReportPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/groups" replace />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="groups/:groupId" element={<GroupDetailPage />} />
            <Route path="groups/:groupId/expenses" element={<ExpensesPage />} />
            <Route path="groups/:groupId/settlements" element={<SettlementsPage />} />
            <Route path="groups/:groupId/balances" element={<BalancesPage />} />
            <Route path="groups/:groupId/import" element={<ImportCSVPage />} />
            <Route path="groups/:groupId/import/:batchId/review" element={<ImportReviewPage />} />
            <Route path="groups/:groupId/import/:batchId/report" element={<ImportReportPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
export { App };
