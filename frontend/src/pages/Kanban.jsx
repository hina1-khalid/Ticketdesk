import { tr } from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import { PriorityBadge, SlaBadge, Spinner, STATUS, toast, useLive } from '../components/ui';
import { usePrefs } from '../context/Prefs';
export default function Kanban() {
  const { t } = usePrefs(); const [items, setItems] = useState(null), [mine, setMine] = useState(false), [over, setOver] = useState(null);
  const load = useCallback(() => api.get('/tickets', { params: { limit: 100, sort: 'smart', status: 'open,in_progress,resolved', ...(mine ? { mine: 'true' } : {}) } }).then(r => setItems(r.data.items)), [mine]);
  useEffect(() => { load(); }, [load]); useLive(load);
  const drop = async (status, e) => {
    e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('id'); const tk = items.find(i => i._id === id); if (!tk || tk.status === status) return;
    setItems(items.map(i => (i._id === id ? { ...i, status } : i)));
    try { await api.post(`/tickets/${id}/status`, { status }); } catch (x) { toast(errMsg(x)); load(); }
  };
  if (!items) return <Spinner />;
  return <div><div className="flex items-center justify-between mb-4"><h1 className="text-2xl font-bold">{t('Kanban')}</h1><label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> {tr("Only my tickets")}</label></div>
    <div className="grid md:grid-cols-3 gap-4">{['open', 'in_progress', 'resolved'].map(s => <div key={s} onDragOver={e => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)} onDrop={e => drop(s, e)} className={`rounded-xl p-3 min-h-[60vh] transition ${over === s ? 'bg-brand-light dark:bg-night-line' : 'bg-paper-line/50 dark:bg-night-card'}`}>
      <div className="flex justify-between mb-3"><h3 className="font-bold">{t(STATUS[s])}</h3><span className="pill bg-white dark:bg-night">{items.filter(i => i.status === s).length}</span></div>
      <div className="space-y-2">{items.filter(i => i.status === s).map(x => <div key={x._id} draggable onDragStart={e => e.dataTransfer.setData('id', x._id)} className={`card p-3 cursor-grab active:cursor-grabbing ${x.sla?.breached ? 'border-signal-red' : ''}`}>
        <div className="flex justify-between text-xs muted"><span className="font-mono">{x.code}</span><PriorityBadge p={x.priority} t={t} /></div>
        <Link to={'/tickets/' + x._id} className="block font-medium text-sm mt-1 hover:underline">{x.title}</Link>
        <div className="flex justify-between items-center mt-2 text-xs"><span className="muted">{x.assignee?.name || 'Unassigned'}</span><SlaBadge ticket={x} /></div></div>)}</div></div>)}</div></div>;
}
