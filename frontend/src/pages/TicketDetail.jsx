import { tr } from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg, fileUrl } from '../api';
import { useAuth } from '../context/Auth';
import { usePrefs } from '../context/Prefs';
import { fmt, PriorityBadge, SlaBadge, Spinner, StatusBadge, STATUS, toast, useLive, Modal } from '../components/ui';

const Mention = ({ text }) => text.split(/(@\w+)/g).map((p, i) => (p.startsWith('@') ? <b key={i} className="text-brand">{p}</b> : p));

export default function TicketDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { user, can } = useAuth(); const { t } = usePrefs();
  const [tk, setTk] = useState(null), [agents, setAgents] = useState([]), [canned, setCanned] = useState([]), [cfg, setCfg] = useState({ categories: [] }), [sug, setSug] = useState(null), [err, setErr] = useState('');
  const [body, setBody] = useState(''), [internal, setInternal] = useState(false), [mentions, setMentions] = useState({}), [ment, setMent] = useState(null);
  const [time, setTime] = useState({ minutes: '', note: '' }), [fb, setFb] = useState({ rating: 5, comment: '' }), [target, setTarget] = useState(''), [mergeModal, setMergeModal] = useState(null), [tagInput, setTagInput] = useState('');
  const staff = can('ticket:update'), isReq = tk && String(tk.requester?._id) === String(user.id);
  const load = useCallback(() => api.get('/tickets/' + id).then(r => setTk(r.data)).catch(e => setErr(errMsg(e))), [id]);
  useEffect(() => { load(); }, [load]); useLive(load);
  useEffect(() => { api.get('/settings').then(r => setCfg(r.data)); if (can('ticket:view_all')) api.get('/users', { params: { role: 'agent,admin' } }).then(r => setAgents(r.data)); if (can('canned:use')) api.get('/canned').then(r => setCanned(r.data)); }, []); // eslint-disable-line
  const act = async (fn, ok) => { try { await fn(); if (ok) toast(ok); load(); } catch (e) { toast(errMsg(e)); } };
  if (err) return <p className="text-signal-red">{err}</p>; if (!tk) return <Spinner />;

  const onBody = e => { const v = e.target.value; setBody(v); const m = v.match(/@(\w*)$/); setMent(m && can('ticket:internal') ? m[1].toLowerCase() : null); };
  const pick = a => { const h = a.name.replace(/\s+/g, ''); setBody(body.replace(/@\w*$/, '@' + h + ' ')); setMentions({ ...mentions, [h]: a.id }); setMent(null); };
  const send = e => { e.preventDefault(); if (!body.trim()) return;
    const ids = Object.entries(mentions).filter(([h]) => body.includes('@' + h)).map(([, v]) => v);
    act(async () => { await api.post(`/tickets/${id}/comments`, { body, internal, mentions: ids }); setBody(''); setMentions({}); }, 'Sent'); };
  const sugg = async () => setSug((await api.get(`/tickets/${id}/suggestions`)).data);
  const saveTags = tags => act(() => api.put('/tickets/' + id, { tags }));
  const done = ['resolved', 'closed'].includes(tk.status);
  const mentionList = ment !== null ? agents.filter(a => a.name.replace(/\s+/g, '').toLowerCase().startsWith(ment)).slice(0, 5) : [];

  return <div className="grid lg:grid-cols-3 gap-5">
    <div className="lg:col-span-2 space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-mono font-semibold">{tk.code}</span><StatusBadge s={tk.status} t={t} /><PriorityBadge p={tk.priority} t={t} /><SlaBadge ticket={tk} />{tk.sentiment?.label === 'negative' && <span className="pill bg-signal-red/15 text-signal-red">{tr("😠 frustrated")}</span>}{tk.archived && <span className="pill bg-slate-200 text-slate-600">{tr("archived")}</span>}{tk.deleted && <span className="pill bg-signal-red text-white">{tr("deleted")}</span>}{tk.mergedInto && <Link to={'/tickets/' + tk.mergedInto._id} className="pill bg-signal-amber/20">merged → {tk.mergedInto.code}</Link>}</div>
        <h1 className="text-2xl font-bold mt-2">{tk.title}</h1>
        <p className="muted text-xs mt-1">by {can('ticket:view_all') ? <Link className="underline" to={'/customers/' + tk.requester?._id}>{tk.requester?.name}</Link> : tk.requester?.name} · {fmt(tk.createdAt)} · via {tk.source}</p>
        <p className="mt-4 whitespace-pre-wrap">{tk.description}</p>
        {!!tk.attachments?.length && <div className="mt-4 flex flex-wrap gap-2">{tk.attachments.map(a => <a key={a.url} href={fileUrl(a.url)} className="btn text-xs" target="_blank" rel="noreferrer">📎 {a.name}</a>)}</div>}
        {Object.keys(tk.customFields || {}).length > 0 && <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">{Object.entries(tk.customFields).map(([k, v]) => <div key={k}><dt className="label">{cfg.customFields?.find(c => c.key === k)?.label || k}</dt><dd>{v}</dd></div>)}</dl>}
        <div className="mt-4 flex flex-wrap gap-2 items-center">{tk.tags?.map(g => <span key={g} className="pill bg-paper dark:bg-night">#{g}{staff && <button className="ms-1 opacity-60" onClick={() => saveTags(tk.tags.filter(x => x !== g))}>×</button>}</span>)}
          {staff && <form onSubmit={e => { e.preventDefault(); if (tagInput.trim()) { saveTags([...tk.tags, tagInput.trim()]); setTagInput(''); } }}><input className="input !w-28 !py-1 text-xs" placeholder={tr("+ tag")} value={tagInput} onChange={e => setTagInput(e.target.value)} /></form>}</div>
      </div>

      {isReq && done && !tk.feedback?.rating && <div className="card p-5 border-brand"><h3 className="font-bold mb-2">{t('Rate your experience')}</h3>
        <div className="flex gap-1 text-2xl">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setFb({ ...fb, rating: n })} className={n <= fb.rating ? 'text-signal-amber' : 'text-slate-300'}>★</button>)}</div>
        <textarea className="input mt-2" placeholder={tr("Anything we could do better? (optional)")} value={fb.comment} onChange={e => setFb({ ...fb, comment: e.target.value })} />
        <button className="btn btn-primary mt-2" onClick={() => act(() => api.post(`/tickets/${id}/feedback`, fb), 'Thank you!')}>{t('Submit')}</button></div>}
      {tk.feedback?.rating && <div className="card p-4 text-sm">{tr("Customer rating:")} <span className="text-signal-amber">{'★'.repeat(tk.feedback.rating)}</span><span className="text-slate-300">{'★'.repeat(5 - tk.feedback.rating)}</span> {tk.feedback.comment && <span className="muted">— {tk.feedback.comment}</span>}</div>}

      <div className="card p-5"><h3 className="font-bold mb-3">{t('Comments')} ({tk.comments.length})</h3>
        <div className="space-y-3">{tk.comments.map(c => <div key={c._id} className={`rounded-lg p-3 text-sm ${c.internal ? 'bg-signal-amber/10 border border-signal-amber/40' : 'bg-paper dark:bg-night'}`}>
          <div className="flex justify-between text-xs muted mb-1"><span><b className="text-ink dark:text-slate-200">{c.author?.name}</b> {c.author?.role !== 'user' && <span className="pill bg-brand-light text-brand-dark">{tr("staff")}</span>} {c.internal && <span className="pill bg-signal-amber/30">🔒 {t('Internal note')}</span>}</span><span>{fmt(c.createdAt)}</span></div>
          <p className="whitespace-pre-wrap"><Mention text={c.body} /></p></div>)}{!tk.comments.length && <p className="muted text-sm">{tr("No comments yet.")}</p>}</div>
        <form onSubmit={send} className="mt-4 relative">
          <textarea className="input min-h-[90px]" placeholder={internal ? 'Internal note — customers cannot see this. Use @name to mention a teammate' : 'Write a reply…'} value={body} onChange={onBody} />
          {mentionList.length > 0 && <div className="card absolute z-10 bottom-14 shadow-lg">{mentionList.map(a => <button type="button" key={a.id} onClick={() => pick(a)} className="block w-full text-start px-3 py-1.5 text-sm hover:bg-paper dark:hover:bg-night">@{a.name}</button>)}</div>}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button className="btn btn-primary">{internal ? t('Internal note') : t('Reply')}</button>
            {can('ticket:internal') && <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} /> 🔒 {t('Internal note')}</label>}
            {canned.length > 0 && <select className="input !w-auto text-sm" value="" onChange={e => { const c = canned.find(x => x._id === e.target.value); if (c) setBody(body + (body ? '\n' : '') + c.body); }}><option value="">{tr("Canned response…")}</option>{canned.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}</select>}
            {can('ticket:internal') && <button type="button" className="btn" onClick={sugg}>{tr("🤖 Suggest reply")}</button>}
          </div></form>
        {sug && <div className="mt-4 rounded-lg border border-brand/40 p-3 text-sm space-y-2"><b>{tr("AI suggestions")}</b>
          {sug.llm && <div><div className="label">Draft (LLM)</div><p className="whitespace-pre-wrap">{sug.llm}</p><button className="btn text-xs mt-1" onClick={() => setBody(sug.llm)}>{tr("Use draft")}</button></div>}
          {sug.replies.map((r, i) => <div key={i}><div className="label">From solved {r.from}</div><p className="whitespace-pre-wrap">{r.body}</p><button className="btn text-xs mt-1" onClick={() => setBody(r.body)}>{tr("Use")}</button></div>)}
          {!sug.llm && !sug.replies.length && <p className="muted">{tr("No earlier solutions found. Try a canned response.")}</p>}
          {sug.similar.length > 0 && <div><div className="label">{tr("Similar tickets")}</div>{sug.similar.map(s => <div key={s._id} className="flex justify-between items-center py-0.5"><Link to={'/tickets/' + s._id} className="hover:underline">{s.code} {s.title} <span className="muted">({Math.round(s.score * 100)}%)</span></Link><button className="btn text-xs" onClick={() => setMergeModal(s)}>{tr("Merge into…")}</button></div>)}</div>}</div>}
      </div>
    </div>

    <aside className="space-y-4">
      <div className="card p-4 space-y-3">
        {staff ? <>
          <div><label className="label">{t('Status')}</label><select className="input" value={tk.status} onChange={e => act(() => api.post(`/tickets/${id}/status`, { status: e.target.value }), 'Status updated')}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></div>
          <div><label className="label">{t('Priority')}</label><select className="input" value={tk.priority} onChange={e => act(() => api.put('/tickets/' + id, { priority: e.target.value }), 'Priority updated (SLA recalculated)')}>{['low', 'medium', 'high', 'urgent'].map(p => <option key={p}>{p}</option>)}</select></div>
          <div><label className="label">{t('Category')}</label><select className="input" value={tk.category} onChange={e => act(() => api.put('/tickets/' + id, { category: e.target.value }))}>{cfg.categories.map(c => <option key={c}>{c}</option>)}</select></div>
          {can('ticket:assign') && <div><label className="label">{t('Assignee')}</label><div className="flex gap-2"><select className="input" value={tk.assignee?._id || ''} onChange={e => act(() => api.post(`/tickets/${id}/assign`, { assignee: e.target.value || null }), 'Assigned')}><option value="">{tr("Unassigned")}</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="btn" title={tr("Auto-assign to least busy agent")} onClick={() => act(() => api.post(`/tickets/${id}/assign`, {}), 'Auto-assigned')}>⚡</button></div></div>}
          <p className="text-xs muted">Department: {tk.department?.name || '—'} · Reopened {tk.reopenCount}×</p>
        </> : <>
          <p className="text-sm">{tr("Assigned to:")} <b>{tk.assignee?.name || 'Pending'}</b></p>
          {tk.status === 'resolved' && <button className="btn btn-primary w-full" onClick={() => act(() => api.post(`/tickets/${id}/status`, { status: 'closed' }), 'Closed')}>{tr("Confirm solved & close")}</button>}
        </>}
        {done && <button className="btn w-full" onClick={() => act(() => api.post(`/tickets/${id}/reopen`), 'Reopened')}>↺ {t('Reopen')}</button>}
        <p className="text-xs muted">SLA due: {fmt(tk.sla?.dueAt)}{tk.sla?.escalated && ' · escalated'}</p>
      </div>

      {staff && <div className="card p-4"><div className="label">⏱ Time tracking — {tk.timeLogs.reduce((s, l) => s + l.minutes, 0)} min total</div>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); act(async () => { await api.post(`/tickets/${id}/time`, time); setTime({ minutes: '', note: '' }); }, 'Logged'); }}><input className="input !w-20" type="number" min="1" placeholder="min" required value={time.minutes} onChange={e => setTime({ ...time, minutes: e.target.value })} /><input className="input" placeholder="note" value={time.note} onChange={e => setTime({ ...time, note: e.target.value })} /><button className="btn">+</button></form>
        <ul className="mt-2 text-xs muted space-y-0.5">{tk.timeLogs.slice(-4).map(l => <li key={l._id}>{l.user?.name}: {l.minutes} min {l.note && `— ${l.note}`}</li>)}</ul></div>}

      {staff && <div className="card p-4"><div className="label">{tr("🔗 Linked tickets")}</div>
        {tk.links.map(l => <div key={l._id} className="flex justify-between text-sm"><Link to={'/tickets/' + l._id} className="hover:underline">{l.code} {l.title}</Link><button className="muted" onClick={() => act(() => api.delete(`/tickets/${id}/link/${l._id}`))}>×</button></div>)}
        <div className="flex gap-2 mt-2"><input className="input" placeholder="TKT-0001" value={target} onChange={e => setTarget(e.target.value)} /><button className="btn" onClick={() => act(async () => { await api.post(`/tickets/${id}/link`, { target }); setTarget(''); }, 'Linked')}>{tr("Link")}</button><button className="btn" onClick={() => setMergeModal({ code: target })}>{tr("Merge")}</button></div></div>}

      {staff && <div className="card p-4 flex flex-wrap gap-2"><button className="btn" onClick={() => act(() => api.post(`/tickets/${id}/archive`))}>{tk.archived ? tr('Unarchive') : tr('Archive')}</button>
        {can('ticket:delete') && (tk.deleted ? <button className="btn" onClick={() => act(() => api.post(`/tickets/${id}/restore`), 'Restored')}>{tr("Restore")}</button> : <button className="btn btn-danger" onClick={() => confirm('Soft-delete this ticket? (admins can restore it)') && act(async () => { await api.delete('/tickets/' + id); nav('/tickets'); })}>{tr("Delete")}</button>)}</div>}

      <div className="card p-4"><div className="label">{tr("History")}</div><ol className="text-xs space-y-1.5 max-h-72 overflow-auto">{[...tk.history].reverse().map((h, i) => <li key={i}><span className="muted">{fmt(h.at)}</span> — <b>{h.by?.name || 'System'}</b> {h.action === 'changed' ? <>changed {h.field}: {h.from || '∅'} → {h.to || '∅'}</> : h.action.replace('_', ' ')}{h.field && h.action !== 'changed' ? ` (${h.field})` : ''}</li>)}</ol></div>
    </aside>
    {mergeModal && <Modal title={`Merge ${tk.code} into ${mergeModal.code || ''}`} onClose={() => setMergeModal(null)}><p className="text-sm mb-4">{tr("This ticket will be closed and its public comments copied to the target ticket. Continue?")}</p>
      <div className="flex gap-2 justify-end"><button className="btn" onClick={() => setMergeModal(null)}>Cancel</button><button className="btn btn-primary" onClick={() => act(async () => { await api.post(`/tickets/${id}/merge`, { target: mergeModal.code }); setMergeModal(null); }, 'Merged')}>{tr("Merge")}</button></div></Modal>}
  </div>;
}
