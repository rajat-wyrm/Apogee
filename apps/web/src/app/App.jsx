import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';
import { useAuthStore, useUIStore } from '../store';
import { connectSocket, disconnectSocket } from '../lib/socket';
import AppLayout from '../layouts/AppLayout';
import Landing from '../pages/Landing';
import Login from '../features/auth/Login';
import Register from '../features/auth/Register';
import ForgotPassword from '../features/auth/ForgotPassword';
import TwoFactor from '../features/auth/TwoFactor';
import Dashboard from '../features/dashboard/Dashboard';
import ProjectsList from '../features/projects/ProjectsList';
import ProjectDetail from '../features/projects/ProjectDetail';
import MyTasks from '../features/tasks/MyTasks';
import DocumentsList from '../features/documents/DocumentsList';
import DocumentEditor from '../features/documents/DocumentEditor';
import Calendar from '../features/calendar/Calendar';
import Goals from '../features/goals/Goals';
import Whiteboards from '../features/whiteboards/Whiteboards';
import Wiki from '../features/wiki/Wiki';
import Helpdesk from '../features/helpdesk/Helpdesk';
import Automations from '../features/automations/Automations';
import Templates from '../features/templates/Templates';
import Reports from '../features/reports/Reports';
import Team from '../features/team/Team';
import Settings from '../features/settings/Settings';
import Billing from '../features/billing/Billing';
import Admin from '../features/admin/Admin';
import Profile from '../features/profile/Profile';
import Notifications from '../features/notifications/Notifications';
import SearchResults from '../features/search/SearchResults';
import CommandPalette from '../components/layout/CommandPalette';
import AIAssistant from '../components/layout/AIAssistant';

const Protected = () => {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/auth/login" state={{ from: location }} replace />;
  return <Outlet />;
};

const Public = () => {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/app" replace />;
  return <Outlet />;
};

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const user = useAuthStore((s) => s.user);
  const setTheme = useUIStore((s) => s.setTheme);
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    if (!user) fetchMe().catch(() => {});
  }, [user, fetchMe]);

  useEffect(() => {
    if (user) connectSocket();
    return () => disconnectSocket();
  }, [user]);

  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  return (
    <>
      <Helmet>
        <title>Apogee — Productivity, perfected.</title>
        <meta name="description" content="The all-in-one productivity platform. Projects, tasks, docs, AI." />
      </Helmet>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: 'var(--color-surface)', color: 'var(--color-fg)', border: '1px solid var(--color-border)', borderRadius: '10px', fontSize: '14px' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route element={<Public />}>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/forgot" element={<ForgotPassword />} />
          <Route path="/auth/2fa" element={<TwoFactor />} />
        </Route>
        <Route element={<Protected />}>
          <Route element={<AppLayout />}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/projects" element={<ProjectsList />} />
            <Route path="/app/projects/:id" element={<ProjectDetail />} />
            <Route path="/app/tasks" element={<MyTasks />} />
            <Route path="/app/documents" element={<DocumentsList />} />
            <Route path="/app/documents/:id" element={<DocumentEditor />} />
            <Route path="/app/calendar" element={<Calendar />} />
            <Route path="/app/goals" element={<Goals />} />
            <Route path="/app/whiteboards" element={<Whiteboards />} />
            <Route path="/app/wiki" element={<Wiki />} />
            <Route path="/app/helpdesk" element={<Helpdesk />} />
            <Route path="/app/automations" element={<Automations />} />
            <Route path="/app/templates" element={<Templates />} />
            <Route path="/app/reports" element={<Reports />} />
            <Route path="/app/team" element={<Team />} />
            <Route path="/app/settings/*" element={<Settings />} />
            <Route path="/app/billing" element={<Billing />} />
            <Route path="/app/admin/*" element={<Admin />} />
            <Route path="/app/profile" element={<Profile />} />
            <Route path="/app/notifications" element={<Notifications />} />
            <Route path="/app/search" element={<SearchResults />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CommandPalette />
      <AIAssistant />
    </>
  );
}
