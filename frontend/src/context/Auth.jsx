import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';
import { connect, disconnect } from '../socket';
const Ctx = createContext();
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [perms, setPerms] = useState([]), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { const { data } = await api.get('/auth/me'); setUser(data.user); setPerms(data.permissions); connect(); }
    catch { setUser(null); }
    setLoading(false);
  }, []);
  useEffect(() => { localStorage.getItem('token') ? load() : setLoading(false); }, [load]);
  const finish = async data => { if (data.twoFactorRequired) return data; localStorage.setItem('token', data.token); await load(); return data; };
  const login = async (email, password, otp) => finish((await api.post('/auth/login', { email, password, otp })).data);
  const register = async body => finish((await api.post('/auth/register', body)).data);
  const logout = () => { localStorage.removeItem('token'); disconnect(); setUser(null); setPerms([]); };
  return <Ctx.Provider value={{ user, loading, login, register, logout, reload: load, can: p => perms.includes(p), perms }}>{children}</Ctx.Provider>;
}
