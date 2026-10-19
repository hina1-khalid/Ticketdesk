import { tr } from '../i18n';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/Auth';
import { usePrefs } from '../context/Prefs';
import { PriorityBadge, Spinner, StatusBadge, toast, ago } from '../components/ui';

function Customer() {
  const { id } = useParams(); const [d, setD] = useState(null);
  useEffect(() => { api.get(`/users/${id}/profile`).then(r => setD(r.data)); }, [id]);
  if (!d) return <Spinner />;
  return <div className="space-y-4"><div className="card p-5"><h1 className="text-2xl font-bold">{d.user.name}</h1><p className="muted">{d.user.email} · {d.user.role}</p>
    <div className="flex gap-6 mt-3 text-sm"><span><b className="text-xl font-display">{d.stats.total}</b> {tr("tickets")}</span><span><b className="text-xl font-display">{d.stats.open}</b> {tr("open")}</span><span><b className="text-xl font-display">{d.stats.avgRating ?? '—'}</b> {tr("avg rating given")}</span></div></div>
    <div className="card overflow-x-auto"><table className="w-full"><tbody>{d.tickets.map(t => <tr key={t._id} className="border-b border-paper-line/60 dark:border-night-line"><td className="td font-mono text-xs">{t.code}</td><td className="td"><Link className="hover:underline" to={'/tickets/' + t._id}>{t.title}</Link></td><td className="td"><StatusBadge s={t.status} /></td><td className="td"><PriorityBadge p={t.priority} /></td><td className="td muted">{ago(t.createdAt)}</td></tr>)}</tbody></table></div></div>;
}
export default function Profile({ customer }) {
  const { user, reload } = useAuth(); const { t, setLang } = usePrefs();
  const [name, setName] = useState(user?.name || ''), [phone, setPhone] = useState(user?.phone || ''), [wa, setWa] = useState(!!user?.whatsappOptIn), [pw, setPw] = useState({ currentPassword: '', newPassword: '' }), [tf, setTf] = useState(null), [code, setCode] = useState('');
  if (customer) return <Customer />;
  const save = async body => { try { await api.put('/auth/me', body); await reload(); toast('Saved'); } catch (e) { toast(errMsg(e)); } };
  const setup = async () => setTf((await api.post('/auth/2fa/setup')).data);
  const toggle = async on => { try { await api.post(`/auth/2fa/${on ? 'enable' : 'disable'}`, { token: code }); setTf(null); setCode(''); await reload(); toast(on ? '2FA enabled' : '2FA disabled'); } catch (e) { toast(errMsg(e)); } };
  return <div className="max-w-2xl space-y-4"><h1 className="text-2xl font-bold">{t('Profile')}</h1>
    <div className="card p-5 space-y-3"><div><label className="label">{tr("Name")}</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div><p className="text-sm muted">{user.email} · role: <b>{user.role}</b></p>
      <div><label className="label">{t('Language')}</label><select className="input !w-auto" defaultValue={user.language} onChange={e => { setLang(e.target.value); save({ language: e.target.value }); }}><option value="en">English</option><option value="ur">اردو (Urdu)</option></select></div>
      <div><label className="label">{tr("WhatsApp number (optional)")}</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="03001234567 or +923001234567" />
        <label className="text-sm flex items-center gap-2 mt-2"><input type="checkbox" checked={wa} onChange={e => setWa(e.target.checked)} /> {tr("Send me ticket updates on WhatsApp")}</label>
        <p className="text-xs muted mt-1">Message the support WhatsApp number to create a ticket, or send <code>status TKT-0001</code> to check one.</p></div>
      <button className="btn btn-primary" onClick={() => save({ name, phone, whatsappOptIn: wa })}>{t('Save')}</button></div>
    <div className="card p-5 space-y-3"><h3 className="font-bold">{tr("Change password")}</h3><input className="input" type="password" placeholder={tr("Current password")} value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} /><input className="input" type="password" placeholder={tr("New password (min 8)")} value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} /><button className="btn" onClick={() => save(pw).then(() => setPw({ currentPassword: '', newPassword: '' }))}>{tr("Update password")}</button></div>
    <div className="card p-5"><h3 className="font-bold mb-2">Two-factor authentication {user.twoFactor ? <span className="pill bg-signal-green/15 text-signal-green">{tr("ON")}</span> : <span className="pill bg-slate-200 text-slate-600">{tr("OFF")}</span>}</h3>
      {!user.twoFactor && !tf && <button className="btn" onClick={setup}>{tr("Set up with authenticator app")}</button>}
      {tf && <div className="space-y-2"><img src={tf.qr} alt="QR" className="w-44 h-44" /><p className="text-xs muted">Scan with Google Authenticator / Authy, or enter key <code>{tf.secret}</code>. Then type the 6-digit code:</p><div className="flex gap-2"><input className="input !w-40" value={code} onChange={e => setCode(e.target.value)} placeholder="123456" /><button className="btn btn-primary" onClick={() => toggle(true)}>{tr("Enable")}</button></div></div>}
      {user.twoFactor && <div className="flex gap-2"><input className="input !w-40" value={code} onChange={e => setCode(e.target.value)} placeholder={tr("Code to disable")} /><button className="btn btn-danger" onClick={() => toggle(false)}>{tr("Disable 2FA")}</button></div>}</div></div>;
}
