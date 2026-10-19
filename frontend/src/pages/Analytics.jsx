import { tr } from '../i18n';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api';
import { Spinner } from '../components/ui';
import { usePrefs } from '../context/Prefs';
export default function Analytics() {
  const { t } = usePrefs(); const [ag, setAg] = useState(null), [fc, setFc] = useState(null), [an, setAn] = useState(null), [ov, setOv] = useState(null);
  useEffect(() => { api.get('/analytics/agents').then(r => setAg(r.data)); api.get('/analytics/forecast').then(r => setFc(r.data)); api.get('/analytics/anomalies').then(r => setAn(r.data)); api.get('/analytics/overview').then(r => setOv(r.data)); }, []);
  if (!ag || !fc || !an || !ov) return <Spinner />;
  const series = [...fc.history.map(w => ({ week: w.week.slice(5), actual: w.count })), ...fc.forecast.map(w => ({ week: w.week.slice(5), forecast: w.count, low: w.low, high: w.high }))];
  const hourly = an.now.hourly.map((c, i) => ({ h: i - 71, c }));
  return <div className="space-y-5"><h1 className="text-2xl font-bold">{t('Analytics')}</h1>
    <div className="card overflow-x-auto"><div className="p-4 pb-0 label">{tr("Agent performance")}</div><table className="w-full"><thead><tr>{['Agent', 'Assigned', 'Open (workload)', 'Resolved', 'SLA breaches', 'Avg resolution (h)', 'Avg rating', 'Time logged (h)'].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{ag.map(a => <tr key={a.id} className="border-t border-paper-line/60 dark:border-night-line"><td className="td font-medium">{a.name}</td><td className="td">{a.assigned}</td><td className="td">{a.open}</td><td className="td">{a.resolved}</td><td className={`td ${a.breached ? 'text-signal-red font-semibold' : ''}`}>{a.breached}</td><td className="td">{a.avgResolutionHours ?? '—'}</td><td className="td">{a.avgRating ? '★ ' + a.avgRating : '—'}</td><td className="td">{(a.minutesLogged / 60).toFixed(1)}</td></tr>)}</tbody></table></div>
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-4"><div className="label">{tr("Resolved per agent vs open workload")}</div><ResponsiveContainer width="100%" height={240}><BarChart data={ag}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="resolved" fill="#3C8D5A" radius={[4, 4, 0, 0]} /><Bar dataKey="open" fill="#E3A02B" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div className="card p-4"><div className="text-[11px] muted float-right">{fc.model ? `${fc.model.name} (α=${fc.model.alpha}, β=${fc.model.beta})` : 'not enough data yet'}</div><div className="label">Ticket volume forecast (next 4 weeks, faint lines = 80% range)</div><ResponsiveContainer width="100%" height={240}><LineChart data={series}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="week" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Line dataKey="actual" stroke="#0F5C5A" strokeWidth={2.5} dot={false} connectNulls /><Line dataKey="forecast" stroke="#C8452C" strokeWidth={2.5} strokeDasharray="6 4" connectNulls /><Line dataKey="high" stroke="#C8452C" strokeOpacity={0.3} dot={false} connectNulls legendType="none" /><Line dataKey="low" stroke="#C8452C" strokeOpacity={0.3} dot={false} connectNulls legendType="none" /></LineChart></ResponsiveContainer></div>
    </div>
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="card p-4"><div className="label">{tr("CSAT")}</div><div className="font-display text-4xl font-bold">{ov.csat.percent != null ? ov.csat.percent + '%' : '—'}</div><p className="text-sm muted">Satisfied = rating 4–5. {ov.csat.responses} responses, average {ov.csat.avg ?? '—'}/5.</p></div>
      <div className={`card p-4 lg:col-span-2 ${an.now.anomaly ? 'border-signal-red' : ''}`}><div className="label">Spike detection (last 72 h)</div>
        <p className="text-sm mb-2">{an.now.anomaly ? <b className="text-signal-red">⚠ Unusual spike: {an.now.recentPerHour}/h vs normal {an.now.baselinePerHour}/h</b> : <>Normal — {an.now.recentPerHour}/h now, baseline {an.now.baselinePerHour}/h.</>} {an.daily.filter(d => d.anomaly).length > 0 && <span className="muted">Anomalous days: {an.daily.filter(d => d.anomaly).map(d => d.date).join(', ')}</span>}</p>
        <ResponsiveContainer width="100%" height={110}><BarChart data={hourly}><XAxis dataKey="h" hide /><Tooltip labelFormatter={v => `${-v}h ago`} /><Bar dataKey="c" fill={an.now.anomaly ? '#C8452C' : '#8996A3'} /></BarChart></ResponsiveContainer></div>
    </div></div>;
}
