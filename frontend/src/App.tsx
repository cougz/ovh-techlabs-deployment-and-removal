import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { RootState } from './store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkshopList from './pages/WorkshopList';
import WorkshopDetail from './pages/WorkshopDetail';
import CreateWorkshop from './pages/CreateWorkshop';
import AttendeeView from './pages/AttendeeView';
import Settings from './pages/Settings';
import PCIProjects from './pages/ovh/PCIProjects';
import IAMUsers from './pages/ovh/IAMUsers';
import IAMPolicies from './pages/ovh/IAMPolicies';

function App() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workshops" element={<WorkshopList />} />
        <Route path="/workshops/new" element={<CreateWorkshop />} />
        <Route path="/workshops/:id" element={<WorkshopDetail />} />
        <Route path="/attendees/:id" element={<AttendeeView />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ovh/pci-projects" element={<PCIProjects />} />
        <Route path="/ovh/iam-users" element={<IAMUsers />} />
        <Route path="/ovh/iam-policies" element={<IAMPolicies />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;