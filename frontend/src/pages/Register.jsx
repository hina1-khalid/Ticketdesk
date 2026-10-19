import { tr } from '../i18n';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { errMsg } from '../api';
import { AuthShell } from './Login';
export default function Register() {
  const { register } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', mode: 'join', orgSlug: 'demo', orgName: '' }), [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault(); setErr('');
    try { await register({ name: f.name, email: f.email, password: f.password, ...(f.mode === 'join' ? { orgSlug: f.orgSlug } : { orgName: f.orgName }) }); nav('/'); } catch (x) { setErr(errMsg(x)); }
  };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  return <AuthShell title={tr("Create account")} foot={<>{tr("Already registered?")} <Link className="text-brand underline" to="/login">{tr("Sign in")}</Link></>}>
    <form onSubmit={submit} className="space-y-3">
      <input className="input" placeholder={tr("Full name")} required value={f.name} onChange={set('name')} />
      <input className="input" type="email" placeholder="Email" required value={f.email} onChange={set('email')} />
      <input className="input" type="password" placeholder={tr("Password (min 8 chars)")} required minLength={8} value={f.password} onChange={set('password')} />
      <div className="flex gap-4 text-sm"><label><input type="radio" checked={f.mode === 'join'} onChange={() => setF({ ...f, mode: 'join' })} /> {tr("Join an organization")}</label><label><input type="radio" checked={f.mode === 'new'} onChange={() => setF({ ...f, mode: 'new' })} /> {tr("Create new")}</label></div>
      {f.mode === 'join' ? <input className="input" placeholder={tr("Organization code (e.g. demo)")} required value={f.orgSlug} onChange={set('orgSlug')} /> : <input className="input" placeholder={tr("Organization name (you become admin)")} required value={f.orgName} onChange={set('orgName')} />}
      {err && <p className="text-sm text-signal-red">{err}</p>}
      <button className="btn btn-primary w-full">Register</button>
    </form>
  </AuthShell>;
}
