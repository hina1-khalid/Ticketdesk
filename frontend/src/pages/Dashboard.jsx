import { tr } from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api';
import { useAuth } from '../context/Auth';
import { usePrefs } from '../context/Prefs';
import { Spinner, useLive, STATUS } from '../components/ui';
const PC = { low: '#8996A3', medium: '#3B6FA8', high: '#E3A02B', urgent: '#C8452C' };
const Stat = ({ label, value, sub, tone }) => <div className="card p-4"><div className="label">{label}</div><div className={`font-display text-3xl font-bold ${tone || ''}`}>{value ?? '—'}</div>{sub && <div className="text-xs muted mt-1">{sub}</div>}</div>;
export default function Dashboard() {
  const { user, can } = useAuth(); const { t } = usePrefs(); const [d, setD] = useState(null), [late, setLate] = useState([]);
  const load = useCallback(() => { api.get('/analytics/overview').then(r => setD(r.data)); api.get('/tickets', { params: { breached: 'true', limit: 5, sort: 'due' } }).then(r => setLate(r.data.items)); }, []);
  useEffect(load, [load]); useLive(load);
  if (!d) return <Spinner />;
  const pr = Object.entries(d.byPriority).map(([name, value]) => ({ name, value })), st = Object.entries(d.byStatus).map(([k, value]) => ({ name: STATUS[k], value })), cat = Object.entries(d.byCategory).map(([name, value]) => ({ name, value }));
  return <div className="space-y-5">
    <div className="flex items-end justify-between flex-wrap gap-2"><div><h1 className="text-2xl font-bold">{t('Dashboard')}</h1><p className="muted text-sm">{tr('Welcome back,')} {user.name.split(' ')[0]}.</p></div>{can('ticket:create') && <Link to="/tickets/new" className="btn btn-primary">+ {t('New ticket')}</Link>}</div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Stat label={t('Open tickets')} value={d.open} sub={`${d.total} total`} />
      <Stat label={t('Resolved tickets')} value={d.resolved} tone="text-signal-green" />
      <Stat label={t('Overdue (SLA)')} value={d.breached} tone={d.breached ? 'text-signal-red' : ''} />
      <Stat label={t('Avg resolution (h)')} value={d.avgResolutionHours} />
      <Stat label={tr("CSAT")} value={d.csat.percent != null ? d.csat.percent + '%' : '—'} sub={d.csat.responses ? `${d.csat.avg}/5 · ${d.csat.responses} ratings` : 'no ratings yet'} />
    </div>
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="card p-4 lg:col-span-2"><div className="label">{tr("Tickets created — last 30 days")}</div><ResponsiveContainer width="100%" height={220}><LineChart data={d.perDay}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#0F5C5A" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div>
      <div className="card p-4"><div className="label">{tr("By priority")}</div><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pr} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>{pr.map(p => <Cell key={p.name} fill={PC[p.name]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="flex flex-wrap gap-2 justify-center text-xs">{pr.map(p => <span key={p.name}><span className="inline-block w-2 h-2 rounded-full me-1" style={{ background: PC[p.name] }} />{p.name} ({p.value})</span>)}</div></div>
    </div>
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="card p-4"><div className="label">{tr("By status")}</div><ResponsiveContainer width="100%" height={200}><BarChart data={st}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#0F5C5A" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div className="card p-4"><div className="label">{tr("By category")}</div><ResponsiveContainer width="100%" height={200}><BarChart data={cat} layout="vertical"><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#3B6FA8" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
      <div className="card p-4"><div className="label">{tr("Needs attention (overdue)")}</div>{!late.length && <p className="text-sm muted mt-3">{tr("Nothing overdue 🎉")}</p>}<ul className="mt-2 space-y-2">{late.map(x => <li key={x._id}><Link to={'/tickets/' + x._id} className="block text-sm hover:underline"><span className="font-semibold text-signal-red">{x.code}</span> {x.title}</Link></li>)}</ul></div>
    </div>
  </div>;
}
