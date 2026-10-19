import { tr } from '../i18n';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { StatusBadge, PriorityBadge, fmt } from '../components/ui';
import { useEffect } from 'react';
export default function Track() {
  const { code } = useParams(); const nav = useNavigate();
  const [q, setQ] = useState(code || ''), [data, setData] = useState(null), [err, setErr] = useState('');
  useEffect(() => { if (code) api.get('/public/track/' + code).then(r => { setData(r.data); setErr(''); }).catch(e => { setData(null); setErr(errMsg(e)); }); }, [code]);
  return <div className="min-h-screen flex items-start justify-center p-6"><div className="w-full max-w-lg mt-12">
    <Link to="/login" className="text-sm text-brand underline">{tr("← Back to sign in")}</Link>
    <h1 className="font-display text-3xl font-bold mt-3 mb-4">{tr("Track your ticket")}</h1>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); q.trim() && nav('/track/' + q.trim()); }}><input className="input" placeholder={tr("Ticket ID, e.g. TKT-0012")} value={q} onChange={e => setQ(e.target.value)} /><button className="btn btn-primary">{tr("Track")}</button></form>
    {err && <p className="mt-4 text-signal-red text-sm">{err}</p>}
    {data && <div className="card p-5 mt-4">
      <div className="flex items-center gap-2 flex-wrap"><b className="font-display text-lg">{data.code}</b><StatusBadge s={data.status} /><PriorityBadge p={data.priority} /></div>
      <p className="mt-1">{data.title}</p>
      <ol className="mt-4 border-s-2 border-brand/30 ps-4 space-y-3">{data.timeline.map((t, i) => <li key={i} className="text-sm"><div className="font-medium">{t.text}</div><div className="muted text-xs">{fmt(t.at)}</div></li>)}</ol>
      {data.dueAt && !['resolved', 'closed'].includes(data.status) && <p className="mt-4 text-sm muted">Expected response by {fmt(data.dueAt)}</p>}
    </div>}
  </div></div>;
}
