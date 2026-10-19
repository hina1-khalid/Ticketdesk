import { tr } from '../i18n';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { usePrefs } from '../context/Prefs';
import { Field, PriorityBadge } from '../components/ui';

export default function TicketNew() {
  const nav = useNavigate(); const { t } = usePrefs(); const [sp] = useSearchParams();
  const [f, setF] = useState({ title: sp.get('title') || '', description: '', category: '', priority: '', tags: '' }), [cf, setCf] = useState({}), [files, setFiles] = useState([]);
  const [cfg, setCfg] = useState({ categories: [], customFields: [] }), [sug, setSug] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/settings').then(r => setCfg(r.data)); }, []);
  useEffect(() => { // debounced AI suggestions
    if (f.title.length + f.description.length < 8) return setSug(null);
    const h = setTimeout(() => api.post('/tickets/suggest', { title: f.title, description: f.description, category: f.category, priority: f.priority }).then(r => setSug(r.data)).catch(() => {}), 600);
    return () => clearTimeout(h);
  }, [f.title, f.description, f.category, f.priority]);
  const cat = f.category || sug?.classification.category, fields = cfg.customFields.filter(c => c.category === cat);
  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    const fd = new FormData(); Object.entries(f).forEach(([k, v]) => v && fd.append(k, v)); fd.append('customFields', JSON.stringify(cf)); files.forEach(x => fd.append('attachments', x));
    try { const { data } = await api.post('/tickets', fd); nav('/tickets/' + data._id); } catch (x) { setErr(errMsg(x)); setBusy(false); }
  };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const ai = sug?.classification;
  return <div className="grid lg:grid-cols-3 gap-5">
    <form onSubmit={submit} className="card p-5 lg:col-span-2">
      <h1 className="text-2xl font-bold mb-4">{t('New ticket')}</h1>
      <Field label={t('Title')}><input className="input" required maxLength={200} value={f.title} onChange={set('title')} placeholder="e.g. mera login nahi ho raha" /></Field>
      <Field label={t('Description')}><textarea className="input min-h-[140px]" required value={f.description} onChange={set('description')} /></Field>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label={t('Category')}><select className="input" value={f.category} onChange={set('category')}><option value="">Auto{ai ? ` (${ai.category})` : ''}</option>{cfg.categories.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label={t('Priority')}><select className="input" value={f.priority} onChange={set('priority')}><option value="">Auto{ai ? ` (${ai.priority})` : ''}</option>{['low', 'medium', 'high', 'urgent'].map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label={tr("Tags (comma separated)")}><input className="input" value={f.tags} onChange={set('tags')} /></Field>
      </div>
      {fields.map(c => <Field key={c.key} label={c.label}><input className="input" value={cf[c.key] || ''} onChange={e => setCf({ ...cf, [c.key]: e.target.value })} /></Field>)}
      <Field label={tr("Attachments (max 5 files, 5 MB each)")}><input type="file" multiple onChange={e => setFiles([...e.target.files].slice(0, 5))} /></Field>
      {err && <p className="text-signal-red text-sm mb-2">{err}</p>}
      <button className="btn btn-primary" disabled={busy}>{t('Submit')}</button>
    </form>
    <aside className="space-y-3">
      <div className="card p-4"><div className="label">{tr("🤖 AI assistant")}</div>
        {!sug ? <p className="text-sm muted">{tr("Start typing — I will suggest a category, priority and any helpful articles.")}</p> : <div className="text-sm space-y-2">
          <p>{tr("Looks like")} <b>{ai.category}</b> · <PriorityBadge p={ai.priority} /> {ai.sentiment.label === 'negative' && <span className="pill bg-signal-red/15 text-signal-red">{tr("frustrated tone")}</span>}</p>
          {sug.estimate.hours != null && <p className="muted">Typical resolution: ~{sug.estimate.hours} h (80% within {sug.estimate.p80} h, based on {sug.estimate.samples} similar tickets)</p>}
          <button type="button" className="btn text-xs" onClick={() => setF({ ...f, category: ai.category, priority: ai.priority })}>{tr("Apply suggestion")}</button></div>}
      </div>
      {sug?.kb?.length > 0 && <div className="card p-4"><div className="label">{tr("📘 Maybe this solves it")}</div>{sug.kb.map(a => <Link key={a._id} to={'/kb/' + a._id} target="_blank" className="block text-sm text-brand underline py-0.5">{a.title}</Link>)}</div>}
      {sug?.duplicates?.length > 0 && <div className="card p-4 border-signal-amber"><div className="label">{tr("⚠ Similar open tickets")}</div>{sug.duplicates.map(d => <Link key={d._id} to={'/tickets/' + d._id} target="_blank" className="block text-sm py-0.5 hover:underline"><b>{d.code}</b> {d.title} <span className="muted">({Math.round(d.score * 100)}%)</span></Link>)}</div>}
    </aside>
  </div>;
}
