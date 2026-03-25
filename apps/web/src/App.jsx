import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from './store/authStore';
import useThemeStore from './store/themeStore';
import ToastProvider from './components/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import AppShell from './components/layout/AppShell';
import { Spinner, TooltipProvider } from './components/ui';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Tasks = lazy(() => import('./pages/Tasks'));
const TasksKanban = lazy(() => import('./pages/TasksKanban'));
const Documents = lazy(() => import('./pages/Documents'));
const DocumentEditor = lazy(() => import('./pages/DocumentEditor'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const Goals = lazy(() => import('./pages/Goals'));
const Whiteboards = lazy(() => import('./pages/Whiteboards'));
const WhiteboardEditor = lazy(() => import('./pages/WhiteboardEditor'));
const Wiki = lazy(() => import('./pages/Wiki'));
const Helpdesk = lazy(() => import('./pages/Helpdesk'));
const Automations = lazy(() => import('./pages/Automations'));
const Templates = lazy(() => import('./pages/Templates'));
const Reports = lazy(() => import('./pages/Reports'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Team = lazy(() => import('./pages/Team'));
const Settings = lazy(() => import('./pages/Settings'));
const Billing = lazy(() => import('./pages/Billing'));
const Admin = lazy(() => import('./pages/Admin'));
const Profile = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Search = lazy(() => import('./pages/Search'));
const CRMDashboard = lazy(() => import('./pages/CRM'));
const CRMCompanies = lazy(() => import('./pages/CRMCompanies'));
const CRMContacts = lazy(() => import('./pages/CRMContacts'));
const CRMDeals = lazy(() => import('./pages/CRMDeals'));
const CRMLeads = lazy(() => import('./pages/CRMLeads'));
const AICopilot = lazy(() => import('./pages/AICopilot'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Spinner size="xl" />
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <Spinner size="xl" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user } = useAuthStore();
  if (user) return <Navigate to="/app" replace />;
  return children;
}

function App() {
  const { fetchUser } = useAuthStore();
  const initTheme = useThemeStore((s) => s.init);

  useEffect(() => {
    fetchUser();
    initTheme();
  }, [fetchUser, initTheme]);

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider />
          <TooltipProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Landing />} />

                  <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
                  <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
                  <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPassword /></RedirectIfAuthed>} />

                  <Route
                    path="/app"
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="projects/:id" element={<ProjectDetail />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="tasks/kanban" element={<TasksKanban />} />
                    <Route path="documents" element={<Documents />} />
                    <Route path="documents/:id" element={<DocumentEditor />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="goals" element={<Goals />} />
                    <Route path="whiteboards" element={<Whiteboards />} />
                    <Route path="whiteboards/:id" element={<WhiteboardEditor />} />
                    <Route path="wiki" element={<Wiki />} />
                    <Route path="helpdesk" element={<Helpdesk />} />
                    <Route path="automations" element={<Automations />} />
                    <Route path="templates" element={<Templates />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="team" element={<Team />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="billing" element={<Billing />} />
                    <Route path="admin" element={<Admin />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="search" element={<Search />} />
                    <Route path="ai" element={<AICopilot />} />
                    <Route path="crm" element={<CRMDashboard />} />
                    <Route path="crm/companies" element={<CRMCompanies />} />
                    <Route path="crm/contacts" element={<CRMContacts />} />
                    <Route path="crm/deals" element={<CRMDeals />} />
                    <Route path="crm/leads" element={<CRMLeads />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
