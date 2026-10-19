import { tr } from '../i18n';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import { usePrefs } from '../context/Prefs';
import { errMsg } from '../api';

export function AuthShell({ title, children, foot }) {
  return <div className="min-h-screen grid md:grid-cols-2">
    <div className="hidden md:flex flex-col justify-between bg-brand-dark text-white p-10 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_50%)]">
      <div className="flex items-center gap-2 font-display text-2xl font-bold"><img src="/icon.svg" className="w-8 h-8" alt="" />TicketDesk</div>
      <div><h1 className="font-display text-4xl font-bold leading-tight">{tr("Support that never")}<br />{tr("misses a deadline.")}</h1><p className="mt-3 text-white/70 max-w-sm">{tr("SLA timers, smart routing, Roman Urdu aware classification and a live agent dashboard — in one place.")}</p></div>
      <Link to="/track" className="text-white/80 underline text-sm">{tr("Track a ticket without logging in →")}</Link>
    </div>
    <div className="flex items-center justify-center p-6"><div className="w-full max-w-sm"><h2 className="font-display text-2xl font-bold mb-5">{title}</h2>{children}<div className="mt-4 text-sm muted">{foot}</div></div></div>
  </div>;
}
export default function Login() {
  const { user, login } = useAuth(); const { t } = usePrefs(); const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '', otp: '' }), [need2fa, setNeed] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const r = await login(f.email, f.password, f.otp); if (r.twoFactorRequired) setNeed(true); else nav('/'); } catch (x) { setErr(errMsg(x)); }
    setBusy(false);
  };
  return <AuthShell title={t('Sign in')} foot={<>{tr("No account?")} <Link className="text-brand underline" to="/register">{t('Register')}</Link> · <Link className="text-brand underline" to="/track">{t('Track ticket')}</Link></>}>
    <form onSubmit={submit} className="space-y-3">
      <div><label className="label">{t('Email')}</label><input className="input" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
      <div><label className="label">{t('Password')}</label><input className="input" type="password" required value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></div>
      {need2fa && <div><label className="label">{tr("Authentication code")}</label><input className="input" inputMode="numeric" autoFocus value={f.otp} onChange={e => setF({ ...f, otp: e.target.value })} placeholder={tr("6-digit code")} /></div>}
      {err && <p className="text-sm text-signal-red">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{t('Sign in')}</button>
    </form>
    <p className="mt-6 text-xs muted card p-3">Demo (after <code>npm run seed</code>): admin@demo.com · agent@demo.com · user@demo.com — password <b>Password123!</b></p>
  </AuthShell>;
}
