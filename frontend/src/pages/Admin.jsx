import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../context/Auth';
import { Field, Modal, Pager, Spinner, fmt, toast } from '../components/ui';

const run = async (fn, ok = 'Saved') => { try { await fn(); toast(ok); return true; } catch (e) { toast(errMsg(e)); return false; } };

// ---------- generic CRUD tab ----------
function Crud({ endpoint, fields, cols, title }) {
  const [items, setItems] = useState(null), [form, setForm] = useState(null);
  const load = useCallback(() => api.get(endpoint).then(r => setItems(r.data)), [endpoint]);
  useEffect(() => { load(); }, [load]);
  const open = it => setForm(it ? { ...it, ...Object.fromEntries(fields.filter(f => f.type === 'tags').map(f => [f.key, (it[f.key] || []).join(', ')])) } : Object.fromEntries(fields.map(f => [f.key, f.type === 'checkbox' ? true : ''])));
  const save = async () => {
    const body = { ...form }; fields.forEach(f => { if (f.type === 'tags') body[f.key] = String(body[f.key] || '').split(',').map(s => s.trim()).filter(Boolean); });
    if (await run(() => (form._id ? api.put(`${endpoint}/${form._id}`, body) : api.post(endpoint, body)))) { setForm(null); load(); }
  };
  if (!items) return <Spinner />;
  return <div><div className="flex justify-between mb-3"><h3 className="font-bold">{title}</h3><button className="btn btn-primary" onClick={() => open()}>+ Add</button></div>
    <div className="card overflow-x-auto"><table className="w-full"><thead><tr>{cols.map(c => <th key={c.key} className="th">{c.label}</th>)}<th /></tr></thead><tbody>{items.map(it => <tr key={it._id} className="border-t border-paper-line/60 dark:border-night-line">{cols.map(c => <td key={c.key} className="td max-w-xs truncate">{Array.isArray(it[c.key]) ? it[c.key].join(', ') : typeof it[c.key] === 'boolean' ? (it[c.key] ? '✓' : '—') : String(it[c.key] ?? '')}</td>)}
      <td className="td text-end whitespace-nowrap"><button className="btn" onClick={() => open(it)}>Edit</button> <button className="btn btn-danger" onClick={async () => { if (confirm('Delete?') && await run(() => api.delete(`${endpoint}/${it._id}`), 'Deleted')) load(); }}>×</button></td></tr>)}{!items.length && <tr><td className="td muted" colSpan={9}>Nothing yet.</td></tr>}</tbody></table></div>
    {form && <Modal title={form._id ? 'Edit' : 'New'} onClose={() => setForm(null)}>{fields.map(f => <Field key={f.key} label={f.label}>{f.type === 'textarea' ? <textarea className="input min-h-[120px]" value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} /> : f.type === 'checkbox' ? <input type="checkbox" checked={!!form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.checked })} /> : <input className="input" value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.hint} />}</Field>)}<button className="btn btn-primary" onClick={save}>Save</button></Modal>}</div>;
}

// ---------- users ----------
function Users() {
  const [users, setUsers] = useState(null), [deps, setDeps] = useState([]), [form, setForm] = useState(null);
  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); api.get('/departments').then(r => setDeps(r.data)); }, []);
  const upd = async (u, patch) => { if (await run(() => api.put('/users/' + u.id, patch))) load(); };
  if (!users) return <Spinner />;
  return <div><div className="flex justify-between mb-3"><h3 className="font-bold">Users & roles</h3><button className="btn btn-primary" onClick={() => setForm({ name: '', email: '', password: '', role: 'agent' })}>+ Add user</button></div>
    <div className="card overflow-x-auto"><table className="w-full"><thead><tr>{['Name', 'Email', 'Role', 'Senior', 'Departments', 'Active'].map(h => <th key={h} className="th">{h}</th>)}</tr></thead><tbody>{users.map(u => <tr key={u.id} className="border-t border-paper-line/60 dark:border-night-line">
      <td className="td font-medium">{u.name}</td><td className="td muted">{u.email}</td>
      <td className="td"><select className="input !py-1" value={u.role} onChange={e => upd(u, { role: e.target.value })}>{['admin', 'manager', 'viewer', 'agent', 'user'].map(r => <option key={r}>{r}</option>)}</select></td>
      <td className="td"><input type="checkbox" checked={u.isSenior} onChange={e => upd(u, { isSenior: e.target.checked })} title="Receives SLA escalations" /></td>
      <td className="td"><select multiple className="input !py-1 h-16" value={u.departments} onChange={e => upd(u, { departments: [...e.target.selectedOptions].map(o => o.value) })}>{deps.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></td>
      <td className="td"><input type="checkbox" checked={u.active} onChange={e => upd(u, { active: e.target.checked })} /></td></tr>)}</tbody></table></div>
    {form && <Modal title="New user" onClose={() => setForm(null)}><Field label="Name"><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field label="Email"><input className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field><Field label="Password"><input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field><Field label="Role"><select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{['admin', 'manager', 'viewer', 'agent', 'user'].map(r => <option key={r}>{r}</option>)}</select></Field><button className="btn btn-primary" onClick={async () => { if (await run(() => api.post('/users', form), 'User created')) { setForm(null); load(); } }}>Create</button></Modal>}</div>;
}

// ---------- automation ----------
const FIELDS = ['category', 'priority', 'status', 'department', 'tag', 'source', 'sentiment', 'title', 'description'], OPS = ['eq', 'neq', 'contains', 'in'];
const ACTIONS = { assign_department: 'Assign department (name)', assign_agent: 'Assign agent (email)', set_priority: 'Set priority', add_tag: 'Add tag', set_status: 'Set status', notify: 'Notify (admins / assignee / requester / email)', remind: 'Send reminder to assignee' };
function Automation() {
  const [rules, setRules] = useState(null), [f, setF] = useState(null);
  const load = () => api.get('/automation').then(r => setRules(r.data));
  useEffect(() => { load(); }, []);
  if (!rules) return <Spinner />;
  const blank = { name: '', trigger: 'ticket.created', idleHours: 24, active: true, conditions: [{ field: 'category', op: 'eq', value: '' }], actions: [{ type: 'assign_department', value: '' }] };
  const upd = (k, i, p) => setF({ ...f, [k]: f[k].map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return <div><div className="flex justify-between mb-3"><div><h3 className="font-bold">Automation rules</h3><p className="text-xs muted">When a trigger fires and all conditions match, the actions run automatically.</p></div><button className="btn btn-primary" onClick={() => setF(blank)}>+ New rule</button></div>
    <div className="space-y-2">{rules.map(r => <div key={r._id} className="card p-3 text-sm flex flex-wrap items-center justify-between gap-2"><div><b>{r.name}</b> <span className="pill bg-paper dark:bg-night">{r.trigger}{r.trigger === 'ticket.idle' && ` (${r.idleHours}h)`}</span><div className="muted text-xs mt-1">IF {r.conditions.map(c => `${c.field} ${c.op} "${c.value}"`).join(' AND ') || 'always'} → {r.actions.map(a => `${a.type}${a.value ? `(${a.value})` : ''}`).join(', ')}</div></div>
      <div className="flex gap-2 items-center"><label className="text-xs"><input type="checkbox" checked={r.active} onChange={async e => { await run(() => api.put('/automation/' + r._id, { active: e.target.checked })); load(); }} /> active</label><button className="btn" onClick={() => setF(r)}>Edit</button><button className="btn btn-danger" onClick={async () => { await api.delete('/automation/' + r._id); load(); }}>×</button></div></div>)}</div>
    {f && <Modal wide title="Automation rule" onClose={() => setF(null)}>
      <Field label="Name"><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Trigger"><select className="input" value={f.trigger} onChange={e => setF({ ...f, trigger: e.target.value })}><option value="ticket.created">Ticket created</option><option value="ticket.status_changed">Status changed</option><option value="ticket.idle">No activity for N hours</option></select></Field>{f.trigger === 'ticket.idle' && <Field label="Idle hours"><input className="input" type="number" value={f.idleHours} onChange={e => setF({ ...f, idleHours: +e.target.value })} /></Field>}</div>
      <div className="label">Conditions (all must match)</div>{f.conditions.map((c, i) => <div key={i} className="flex gap-2 mb-2"><select className="input" value={c.field} onChange={e => upd('conditions', i, { field: e.target.value })}>{FIELDS.map(x => <option key={x}>{x}</option>)}</select><select className="input !w-28" value={c.op} onChange={e => upd('conditions', i, { op: e.target.value })}>{OPS.map(x => <option key={x}>{x}</option>)}</select><input className="input" value={c.value} onChange={e => upd('conditions', i, { value: e.target.value })} placeholder="value" /><button className="btn" onClick={() => setF({ ...f, conditions: f.conditions.filter((_, j) => j !== i) })}>×</button></div>)}
      <button className="btn mb-3" onClick={() => setF({ ...f, conditions: [...f.conditions, { field: 'category', op: 'eq', value: '' }] })}>+ condition</button>
      <div className="label">Actions</div>{f.actions.map((a, i) => <div key={i} className="flex gap-2 mb-2"><select className="input" value={a.type} onChange={e => upd('actions', i, { type: e.target.value })}>{Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><input className="input" value={a.value} onChange={e => upd('actions', i, { value: e.target.value })} placeholder="value" /><button className="btn" onClick={() => setF({ ...f, actions: f.actions.filter((_, j) => j !== i) })}>×</button></div>)}
      <button className="btn mb-4" onClick={() => setF({ ...f, actions: [...f.actions, { type: 'add_tag', value: '' }] })}>+ action</button><br />
      <button className="btn btn-primary" onClick={async () => { if (await run(() => (f._id ? api.put('/automation/' + f._id, f) : api.post('/automation', f)))) { setF(null); load(); } }}>Save rule</button></Modal>}</div>;
}

// ---------- settings ----------
function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get('/settings').then(r => setS({ ...r.data, categoriesText: r.data.categories.join(', '), holidaysText: r.data.holidays.join(', ') })); }, []);
  if (!s) return <Spinner />;
  const bh = s.businessHours, setBh = p => setS({ ...s, businessHours: { ...bh, ...p } });
  const save = () => run(() => api.put('/settings', { categories: s.categoriesText.split(',').map(x => x.trim()).filter(Boolean), slaHours: s.slaHours, businessHours: bh, holidays: s.holidaysText.split(',').map(x => x.trim()).filter(Boolean), customFields: s.customFields, autoArchiveDays: s.autoArchiveDays }));
  return <div className="space-y-4 max-w-3xl">
    <div className="card p-4"><Field label="Categories (comma separated)"><input className="input" value={s.categoriesText} onChange={e => setS({ ...s, categoriesText: e.target.value })} /></Field></div>
    <div className="card p-4"><div className="label">SLA — hours to first resolve (counted in business hours when enabled)</div><div className="grid grid-cols-4 gap-3">{['low', 'medium', 'high', 'urgent'].map(p => <Field key={p} label={p}><input className="input" type="number" min="0.5" step="0.5" value={s.slaHours[p]} onChange={e => setS({ ...s, slaHours: { ...s.slaHours, [p]: +e.target.value } })} /></Field>)}</div></div>
    <div className="card p-4"><label className="flex items-center gap-2 mb-3 text-sm font-semibold"><input type="checkbox" checked={bh.enabled} onChange={e => setBh({ enabled: e.target.checked })} /> SLA timer runs only in business hours</label>
      <div className="grid grid-cols-3 gap-3"><Field label="Start hour"><input className="input" type="number" min="0" max="23" value={bh.startHour} onChange={e => setBh({ startHour: +e.target.value })} /></Field><Field label="End hour"><input className="input" type="number" min="1" max="24" value={bh.endHour} onChange={e => setBh({ endHour: +e.target.value })} /></Field><Field label="UTC offset (min) — PKT = 300"><input className="input" type="number" value={bh.utcOffsetMinutes} onChange={e => setBh({ utcOffsetMinutes: +e.target.value })} /></Field></div>
      <div className="flex gap-3 text-sm mb-3">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <label key={d}><input type="checkbox" checked={bh.days.includes(i)} onChange={e => setBh({ days: e.target.checked ? [...bh.days, i] : bh.days.filter(x => x !== i) })} /> {d}</label>)}</div>
      <Field label="Holidays (YYYY-MM-DD, comma separated)"><input className="input" value={s.holidaysText} onChange={e => setS({ ...s, holidaysText: e.target.value })} placeholder="2026-12-25, 2027-03-23" /></Field></div>
    <div className="card p-4"><div className="label">Custom fields per category</div>{s.customFields.map((c, i) => <div key={i} className="flex gap-2 mb-2"><select className="input" value={c.category} onChange={e => setS({ ...s, customFields: s.customFields.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)) })}><option value="">—</option>{s.categoriesText.split(',').map(x => x.trim()).filter(Boolean).map(x => <option key={x}>{x}</option>)}</select><input className="input" placeholder="key (device)" value={c.key} onChange={e => setS({ ...s, customFields: s.customFields.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} /><input className="input" placeholder="Label" value={c.label} onChange={e => setS({ ...s, customFields: s.customFields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /><button className="btn" onClick={() => setS({ ...s, customFields: s.customFields.filter((_, j) => j !== i) })}>×</button></div>)}<button className="btn" onClick={() => setS({ ...s, customFields: [...s.customFields, { category: '', key: '', label: '' }] })}>+ field</button></div>
    <div className="card p-4"><Field label="Auto-archive closed tickets after (days, 0 = never)"><input className="input !w-32" type="number" value={s.autoArchiveDays} onChange={e => setS({ ...s, autoArchiveDays: +e.target.value })} /></Field></div>
    <button className="btn btn-primary" onClick={save}>Save settings</button></div>;
}
function Permissions() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get('/settings').then(r => setS(r.data)); }, []);
  if (!s) return <Spinner />;
  const roles = s.roles.filter(r => r !== 'admin');
  const toggle = (r, p) => setS({ ...s, permissions: { ...s.permissions, [r]: s.permissions[r].includes(p) ? s.permissions[r].filter(x => x !== p) : [...s.permissions[r], p] } });
  return <div><p className="text-xs muted mb-2">Admin always has every permission.</p><div className="card overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Permission</th>{roles.map(r => <th key={r} className="th text-center">{r}</th>)}</tr></thead><tbody>{s.allPermissions.map(p => <tr key={p} className="border-t border-paper-line/60 dark:border-night-line"><td className="td font-mono text-xs">{p}</td>{roles.map(r => <td key={r} className="td text-center"><input type="checkbox" checked={s.permissions[r].includes(p)} onChange={() => toggle(r, p)} /></td>)}</tr>)}</tbody></table></div>
    <button className="btn btn-primary mt-3" onClick={() => run(() => api.put('/settings', { permissions: s.permissions }), 'Permissions saved')}>Save permissions</button></div>;
}

// ---------- API & webhooks ----------
function Integrations() {
  const [keys, setKeys] = useState([]), [name, setName] = useState(''), [raw, setRaw] = useState(null);
  const load = () => api.get('/apikeys').then(r => setKeys(r.data));
  useEffect(() => { load(); }, []);
  return <div className="space-y-6"><div><h3 className="font-bold mb-2">API keys</h3><p className="text-xs muted mb-2">Use header <code>x-api-key</code> with <code>/api/v1/tickets</code>. Power BI: <code>/api/v1/powerbi/tickets</code> (see docs/POWERBI.md).</p>
    <div className="flex gap-2 mb-3"><input className="input !w-60" placeholder="Key name" value={name} onChange={e => setName(e.target.value)} /><button className="btn btn-primary" onClick={async () => { const r = await api.post('/apikeys', { name }); setRaw(r.data.key); setName(''); load(); }}>Generate</button></div>
    {raw && <div className="card p-3 border-signal-amber mb-3 text-sm">Copy now — it will not be shown again:<br /><code className="break-all">{raw}</code></div>}
    <div className="card">{keys.map(k => <div key={k._id} className="flex justify-between px-3 py-2 text-sm border-b border-paper-line/60 dark:border-night-line"><span>{k.name} <code className="muted">{k.prefix}…</code> <span className="muted text-xs">last used {k.lastUsed ? fmt(k.lastUsed) : 'never'}</span></span><button className="btn btn-danger" onClick={async () => { await api.delete('/apikeys/' + k._id); load(); }}>Revoke</button></div>)}{!keys.length && <p className="p-3 text-sm muted">No keys.</p>}</div></div>
    <Crud title="Webhooks" endpoint="/webhooks" cols={[{ key: 'url', label: 'URL' }, { key: 'events', label: 'Events' }, { key: 'active', label: 'Active' }]} fields={[{ key: 'url', label: 'URL' }, { key: 'events', label: 'Events (ticket.created, ticket.status_changed, ticket.assigned, ticket.sla_breached, anomaly.detected)', type: 'tags' }, { key: 'secret', label: 'Signing secret (HMAC-SHA256 in X-TicketDesk-Signature)' }, { key: 'active', label: 'Active', type: 'checkbox' }]} /></div>;
}
function Audit() {
  const [d, setD] = useState(null), [page, setPage] = useState(1);
  useEffect(() => { api.get('/audit', { params: { page } }).then(r => setD(r.data)); }, [page]);
  if (!d) return <Spinner />;
  return <div className="card overflow-x-auto"><table className="w-full"><thead><tr>{['When', 'User', 'Action', 'Entity', 'Details'].map(h => <th key={h} className="th">{h}</th>)}</tr></thead><tbody>{d.items.map(a => <tr key={a._id} className="border-t border-paper-line/60 dark:border-night-line"><td className="td whitespace-nowrap">{fmt(a.createdAt)}</td><td className="td">{a.user?.name}</td><td className="td">{a.action}</td><td className="td">{a.entity}</td><td className="td muted text-xs">{a.meta ? JSON.stringify(a.meta) : ''}</td></tr>)}</tbody></table><Pager page={page} pages={d.pages} onChange={setPage} /></div>;
}
function Import() {
  const [res, setRes] = useState(null);
  const up = async e => { const fd = new FormData(); fd.append('file', e.target.files[0]); try { setRes((await api.post('/tickets/import', fd)).data); } catch (x) { toast(errMsg(x)); } };
  return <div className="card p-5 max-w-xl"><h3 className="font-bold mb-2">Import tickets from CSV</h3><p className="text-sm muted mb-3">Columns: <code>title, description, requester_email</code> (required) and optional <code>category, priority, status, created</code>. Max 2000 rows. Unknown requesters are created automatically.</p><input type="file" accept=".csv" onChange={up} />{res && <div className="mt-3 text-sm"><b>{res.imported}</b> imported, {res.failed} failed.{res.errors.map((e, i) => <div key={i} className="text-signal-red text-xs">{e}</div>)}</div>}</div>;
}

export default function Admin() {
  const { can } = useAuth();
  const tabs = [
    ['users', 'Users', can('user:manage'), <Users />],
    ['departments', 'Departments', can('settings:manage'), <Crud title="Departments / teams" endpoint="/departments" cols={[{ key: 'name', label: 'Name' }, { key: 'categories', label: 'Categories routed here' }]} fields={[{ key: 'name', label: 'Name' }, { key: 'categories', label: 'Categories (comma separated, e.g. IT, Bug)', type: 'tags' }]} />],
    ['automation', 'Automation', can('automation:manage'), <Automation />],
    ['canned', 'Canned responses', can('settings:manage'), <Crud title="Canned responses" endpoint="/canned" cols={[{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'body', label: 'Text' }]} fields={[{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category (optional)' }, { key: 'body', label: 'Text', type: 'textarea' }]} />],
    ['kb', 'Knowledge base', can('kb:manage'), <Crud title="Knowledge base articles" endpoint="/kb-admin" cols={[{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'published', label: 'Published' }, { key: 'views', label: 'Views' }]} fields={[{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'tags', label: 'Tags (comma separated)', type: 'tags' }, { key: 'body', label: 'Article', type: 'textarea' }, { key: 'published', label: 'Published', type: 'checkbox' }]} />],
    ['settings', 'SLA & settings', can('settings:manage'), <Settings />],
    ['perms', 'Permissions', can('settings:manage'), <Permissions />],
    ['api', 'API & webhooks', can('apikey:manage'), <Integrations />],
    ['import', 'CSV import', can('settings:manage'), <Import />],
    ['audit', 'Audit log', can('audit:view'), <Audit />]
  ].filter(t => t[2]);
  const [tab, setTab] = useState(tabs[0]?.[0]);
  if (!tabs.length) return <p className="muted">You do not have access to admin tools.</p>;
  return <div><h1 className="text-2xl font-bold mb-4">Admin</h1><div className="flex gap-1 flex-wrap mb-5 border-b border-paper-line dark:border-night-line">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-brand text-brand' : 'border-transparent muted hover:text-ink'}`}>{l}</button>)}</div>{tabs.find(t => t[0] === tab)?.[3]}</div>;
}
