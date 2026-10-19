import axios from 'axios';
// Local dev uses the Vite proxy ('/api'); when deployed on separate hosts set VITE_API_URL=https://your-backend
export const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const fileUrl = u => BASE + u;
const api = axios.create({ baseURL: BASE + '/api' });
api.interceptors.request.use(c => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = 'Bearer ' + t; return c; });
api.interceptors.response.use(r => r, e => {
  const open = ['/login', '/register', '/track'].some(p => location.pathname.startsWith(p));
  if (e.response?.status === 401 && !open) { localStorage.removeItem('token'); location.href = '/login'; }
  return Promise.reject(e);
});
export const errMsg = e => e?.response?.data?.message || e?.message || 'Something went wrong';
export async function download(url, params, filename) {
  const r = await api.get(url, { params, responseType: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
export default api;
