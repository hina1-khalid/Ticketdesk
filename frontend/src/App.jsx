import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/Auth';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Register from './pages/Register';
import Track from './pages/Track';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketNew from './pages/TicketNew';
import TicketDetail from './pages/TicketDetail';
import Kanban from './pages/Kanban';
import KB from './pages/KB';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import Profile from './pages/Profile';

function Guard({ children }) { const { user, loading } = useAuth(); if (loading) return <Spinner />; return user ? children : <Navigate to="/login" replace />; }
const Need = ({ perm, children }) => { const { can } = useAuth(); return can(perm) ? children : <Navigate to="/" replace />; };

export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/track" element={<Track />} />
    <Route path="/track/:code" element={<Track />} />
    <Route element={<Guard><Layout /></Guard>}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/tickets" element={<Tickets />} />
      <Route path="/tickets/new" element={<Need perm="ticket:create"><TicketNew /></Need>} />
      <Route path="/tickets/:id" element={<TicketDetail />} />
      <Route path="/kanban" element={<Need perm="ticket:update"><Kanban /></Need>} />
      <Route path="/kb" element={<KB />} />
      <Route path="/kb/:id" element={<KB />} />
      <Route path="/analytics" element={<Need perm="report:view"><Analytics /></Need>} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/customers/:id" element={<Need perm="ticket:view_all"><Profile customer /></Need>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
