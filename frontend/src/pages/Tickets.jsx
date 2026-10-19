import { tr } from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { download, errMsg } from '../api';
import { useAuth } from '../context/Auth';
import { usePrefs } from '../context/Prefs';
import { Pager, PriorityBadge, SlaBadge, Spinner, StatusBadge, STATUS, toast, useLive, ago } from '../components/ui';

export default function Tickets() {
  const { can } = useAuth(); const { t } = usePrefs();
  const [sp, setSp] = useSearchParams(); const [data, setData] = useState(null), [sel, setSel] = useState([]), [cfg, setCfg] = useState({ categories: [] }), [agents, setAgents] = useState([]), [views, setViews] = useState([]);
  const [bulk, setBulk] = useState({ action: '', value: '' });
  const p = Object.fromEntries(sp);
  const load = useCallback(() => api.get('/tickets', { params: p }).then(r => { setData(r.data); setSel([]); }), [sp]); // eslint-disable-line
  useEffect(() => { load(); }, [load]); useLive(load);
  useEffect(() => { api.get('/settings').then(r => setCfg(r.data)); api.get('/filters').then(r => setViews(r.data)); if (can('ticket:view_all')) api.get('/users', { params: { role: 'agent,admin' } }).then(r => setAgents(r.data)); }, []); // eslint-disable-line
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== 'page') n.delete('page'); setSp(n); };
  const saveView = async () => { const name = prompt('Name this view'); if (!name) return; await api.post('/filters', { name, query: p }); api.get('/filters').then(r => setViews(r.data)); toast('View saved'); };
  const runBulk = async () => {
    try { await api.post('/tickets/bulk', { ids: sel, ...bulk }); toast('Done'); setBulk({ action: '', value: '' }); load(); } catch (e) { toast(errMsg(e)); }
  };
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const staff = can('ticket:view_all');
  return <div className="space-y-4">
    <div className="flex items-center justify-between flex-wrap gap-2"><h1 className="text-2xl font-bold">{staff ? t('Tickets') : t('My tickets')}</h1>
      <div className="flex gap-2">{staff && <><button className="btn" onClick={() => download('/tickets/export', { ...p, format: 'csv' }, 'tickets.csv')}>⬇ CSV</button><button className="btn" onClick={() => download('/tickets/export', { ...p, format: 'pdf' }, 'tickets.pdf')}>⬇ PDF</button></>}{can('ticket:create') && <Link to="/tickets/new" className="btn btn-primary">+ {t('New ticket')}</Link>}</div></div>

    {!!views.length && <div className="flex gap-2 flex-wrap items-center text-sm"><span className="muted">{tr("Views:")}</span>{views.map(v => <span key={v._id} className="pill bg-brand-light text-brand-dark dark:bg-night-line dark:text-slate-200 gap-1 cursor-pointer" onClick={() => setSp(new URLSearchParams(v.query))}>{v.name}<button className="opacity-60 hover:opacity-100" onClick={async e => { e.stopPropagation(); await api.delete('/filters/' + v._id); api.get('/filters').then(r => setViews(r.data)); }}>×</button></span>)}</div>}

    <div className="card p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
      <input className="input col-span-2" placeholder={t('Search') + '…'} defaultValue={p.q || ''} key={p.q} onKeyDown={e => e.key === 'Enter' && set('q', e.target.value)} />
      <select className="input" value={p.status || ''} onChange={e => set('status', e.target.value)}><option value="">{t('Status')}</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select>
      <select className="input" value={p.priority || ''} onChange={e => set('priority', e.target.value)}><option value="">{t('Priority')}</option>{['low', 'medium', 'high', 'urgent'].map(x => <option key={x}>{x}</option>)}</select>
      <select className="input" value={p.category || ''} onChange={e => set('category', e.target.value)}><option value="">{t('Category')}</option>{cfg.categories.map(x => <option key={x}>{x}</option>)}</select>
      {staff && <select className="input" value={p.assignee || ''} onChange={e => set('assignee', e.target.value)}><option value="">{t('Assignee')}</option><option value="me">{tr("Me")}</option><option value="unassigned">{tr("Unassigned")}</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
      <select className="input" value={p.sort || 'newest'} onChange={e => set('sort', e.target.value)}><option value="newest">{tr("Newest")}</option><option value="oldest">{tr("Oldest")}</option><option value="updated">{tr("Recently updated")}</option><option value="smart">{tr("Smart (urgency + mood)")}</option><option value="due">{tr("SLA due soon")}</option></select>
      <input type="date" className="input" value={p.from || ''} onChange={e => set('from', e.target.value)} title={tr("From")} />
      <input type="date" className="input" value={p.to || ''} onChange={e => set('to', e.target.value)} title={tr("To")} />
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={p.breached === 'true'} onChange={e => set('breached', e.target.checked ? 'true' : '')} /> {tr("Overdue")}</label>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={p.archived === 'true'} onChange={e => set('archived', e.target.checked ? 'true' : '')} /> {tr("Archived")}</label>
      <div className="col-span-2 flex gap-2 justify-end"><button className="btn" onClick={saveView}>{t('Save view')}</button><button className="btn" onClick={() => setSp({})}>{tr("Clear")}</button></div>
    </div>

    {sel.length > 0 && can('ticket:update') && <div className="card p-3 flex flex-wrap items-center gap-2 border-brand"><b className="text-sm">{sel.length} selected</b>
      <select className="input !w-auto" value={bulk.action} onChange={e => setBulk({ action: e.target.value, value: '' })}><option value="">{tr("Bulk action…")}</option><option value="status">{tr("Change status")}</option>{can('ticket:assign') && <option value="assign">{tr("Assign")}</option>}<option value="tag">{tr("Add tag")}</option><option value="archive">{tr("Archive")}</option>{can('ticket:delete') && <option value="delete">{tr("Delete")}</option>}</select>
      {bulk.action === 'status' && <select className="input !w-auto" value={bulk.value} onChange={e => setBulk({ ...bulk, value: e.target.value })}><option value="">…</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
      {bulk.action === 'assign' && <select className="input !w-auto" value={bulk.value} onChange={e => setBulk({ ...bulk, value: e.target.value })}><option value="">{tr("Auto-assign")}</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
      {bulk.action === 'tag' && <input className="input !w-auto" placeholder={tr("tag")} value={bulk.value} onChange={e => setBulk({ ...bulk, value: e.target.value })} />}
      <button className="btn btn-primary" disabled={!bulk.action} onClick={runBulk}>{tr("Apply")}</button></div>}

    {!data ? <Spinner /> : <div className="card overflow-x-auto"><table className="w-full">
      <thead className="border-b border-paper-line dark:border-night-line"><tr>{can('ticket:update') && <th className="th w-8"><input type="checkbox" checked={sel.length === data.items.length && data.items.length > 0} onChange={e => setSel(e.target.checked ? data.items.map(i => i._id) : [])} /></th>}<th className="th">{tr("ID")}</th><th className="th">{t('Title')}</th><th className="th">{t('Status')}</th><th className="th">{t('Priority')}</th>{staff && <th className="th">{t('Assignee')}</th>}{staff && <th className="th">{t('Requester')}</th>}<th className="th">SLA</th><th className="th">{t('Created')}</th></tr></thead>
      <tbody>{data.items.map(x => { const late = x.sla?.dueAt && new Date(x.sla.dueAt) < new Date() && ['open', 'in_progress'].includes(x.status);
        return <tr key={x._id} className={`border-b border-paper-line/60 dark:border-night-line hover:bg-paper/60 dark:hover:bg-night ${late ? 'bg-signal-red/5 border-s-4 border-s-signal-red' : ''}`}>
          {can('ticket:update') && <td className="td"><input type="checkbox" checked={sel.includes(x._id)} onChange={() => toggle(x._id)} /></td>}
          <td className="td font-mono text-xs">{x.code}</td>
          <td className="td"><Link to={'/tickets/' + x._id} className="font-medium hover:underline">{x.title}</Link>{x.sentiment?.label === 'negative' && <span title={tr("Negative sentiment")}> 😠</span>}<div className="flex gap-1 mt-0.5 flex-wrap"><span className="text-xs muted">{x.category}</span>{x.tags?.slice(0, 3).map(g => <span key={g} className="text-[11px] px-1.5 rounded bg-paper dark:bg-night muted">#{g}</span>)}</div></td>
          <td className="td"><StatusBadge s={x.status} t={t} /></td><td className="td"><PriorityBadge p={x.priority} t={t} /></td>
          {staff && <td className="td">{x.assignee?.name || <span className="muted">—</span>}</td>}{staff && <td className="td">{x.requester ? <Link className="hover:underline" to={'/customers/' + x.requester._id}>{x.requester.name}</Link> : '—'}</td>}
          <td className="td"><SlaBadge ticket={x} /></td><td className="td muted whitespace-nowrap">{ago(x.createdAt)}</td></tr>; })}
        {!data.items.length && <tr><td className="td muted text-center py-10" colSpan={9}>{tr("No tickets match.")}</td></tr>}</tbody></table>
      <Pager page={data.page} pages={data.pages} onChange={n => set('page', String(n))} /><div className="px-3 pb-3 text-xs muted">{data.total} tickets</div></div>}
  </div>;
}
