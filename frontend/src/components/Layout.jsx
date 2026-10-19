import { tr } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/Auth';
import { usePrefs } from '../context/Prefs';
import { connect } from '../socket';
import { ago } from './ui';
import Chatbot from './Chatbot';

function Bell() {
  const [items, setItems] = useState([]), [unread, setUnread] = useState(0), [open, setOpen] = useState(false); const { t } = usePrefs(); const nav = useNavigate();
  const load = () => api.get('/notifications').then(r => { setItems(r.data.items); setUnread(r.data.unread); }).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { const h = () => load(); window.addEventListener('notification', h); return () => window.removeEventListener('notification', h); }, []);
  const go = async n => { await api.post(`/notifications/${n._id}/read`); setOpen(false); load(); if (n.ticket) nav('/tickets/' + n.ticket._id); };
  return <div className="relative">
    <button className="btn !px-2.5 relative" onClick={() => setOpen(!open)} aria-label="Notifications">🔔{unread > 0 && <span className="absolute -top-1 -end-1 bg-signal-red text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center">{unread}</span>}</button>
    {open && <div className="card absolute end-0 mt-2 w-80 max-h-96 overflow-auto z-40 shadow-xl">
      <div className="flex justify-between px-3 py-2 border-b border-paper-line dark:border-night-line text-sm font-semibold">{t('Notifications')}<button className="text-brand text-xs" onClick={async () => { await api.post('/notifications/read-all'); load(); }}>{t('Mark all read')}</button></div>
      {!items.length && <p className="p-4 text-sm muted">{tr("Nothing yet")}</p>}
      {items.map(n => <button key={n._id} onClick={() => go(n)} className={`block w-full text-start px-3 py-2 text-sm border-b border-paper-line/60 dark:border-night-line hover:bg-paper dark:hover:bg-night ${n.read ? 'opacity-60' : 'font-medium'}`}>{n.message}<div className="text-xs muted">{ago(n.createdAt)}</div></button>)}
    </div>}
  </div>;
}

export default function Layout() {
  const { user, logout, can } = useAuth(); const { t, theme, setTheme, lang, setLang } = usePrefs(); const nav = useNavigate();
  const [menu, setMenu] = useState(false), [toasts, setToasts] = useState([]), [help, setHelp] = useState(false), [q, setQ] = useState(''); const searchRef = useRef();

  useEffect(() => { // realtime
    const s = connect();
    s.on('notification', n => { window.dispatchEvent(new Event('notification')); window.dispatchEvent(new CustomEvent('toast', { detail: n.message })); });
    s.on('ticket:changed', () => window.dispatchEvent(new Event('ticket-changed')));
    return () => s.off();
  }, []);
  useEffect(() => { const h = e => { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, m: e.detail }]); setTimeout(() => setToasts(x => x.filter(t => t.id !== id)), 4000); }; window.addEventListener('toast', h); return () => window.removeEventListener('toast', h); }, []);
  useEffect(() => { // keyboard shortcuts
    const h = e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey) return;
      const map = { '/': () => { e.preventDefault(); searchRef.current?.focus(); }, n: () => nav('/tickets/new'), t: () => nav('/tickets'), d: () => nav('/'), k: () => can('ticket:update') && nav('/kanban'), '?': () => setHelp(x => !x) };
      map[e.key]?.();
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [nav, can]);

  const links = [['/', 'Dashboard', true], ['/tickets', can('ticket:view_all') ? 'Tickets' : 'My tickets', true], ['/tickets/new', 'New ticket', can('ticket:create')], ['/kanban', 'Kanban', can('ticket:update')], ['/kb', 'Knowledge base', true], ['/analytics', 'Analytics', can('report:view')], ['/admin', 'Admin', can('settings:manage') || can('user:manage') || can('kb:manage') || can('audit:view') || can('automation:manage')], ['/profile', 'Profile', true]];
  const NL = ({ to, label }) => <NavLink to={to} end={to === '/' || to === '/tickets'} onClick={() => setMenu(false)} className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>{t(label)}</NavLink>;

  return <div className="min-h-screen md:flex">
    <aside className={`${menu ? 'block' : 'hidden'} md:block md:w-56 shrink-0 bg-brand-dark text-white p-4 md:sticky md:top-0 md:h-screen fixed inset-x-0 top-14 z-30 md:z-auto`}>
      <Link to="/" className="hidden md:flex items-center gap-2 font-display text-xl font-bold mb-6"><img src="/icon.svg" className="w-7 h-7" alt="" />TicketDesk</Link>
      <nav className="space-y-1">{links.filter(l => l[2]).map(l => <NL key={l[0]} to={l[0]} label={l[1]} />)}</nav>
      <p className="hidden md:block absolute bottom-4 start-4 text-[11px] text-white/50">Press <kbd className="bg-white/15 px-1 rounded">?</kbd> for shortcuts</p>
    </aside>
    <div className="flex-1 min-w-0">
      <header className="h-14 flex items-center gap-2 px-4 border-b border-paper-line dark:border-night-line bg-paper-card dark:bg-night-card sticky top-0 z-30">
        <button className="md:hidden btn !px-2.5" onClick={() => setMenu(!menu)} aria-label="Menu">☰</button>
        <form className="flex-1 max-w-md" onSubmit={e => { e.preventDefault(); if (q.trim()) nav('/tickets?q=' + encodeURIComponent(q.trim())); }}>
          <input ref={searchRef} className="input" placeholder={`${t('Search')} — ID, title, comments ( / )`} value={q} onChange={e => setQ(e.target.value)} />
        </form>
        <div className="flex-1" />
        <button className="btn !px-2.5" onClick={() => setLang(lang === 'en' ? 'ur' : 'en')} title={t('Language')}>{lang === 'en' ? 'اردو' : 'EN'}</button>
        <button className="btn !px-2.5" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? t('Light') : t('Dark')}>{theme === 'dark' ? '☀️' : '🌙'}</button>
        <Bell />
        <button className="btn hidden sm:inline-flex" onClick={() => { logout(); nav('/login'); }}>{t('Sign out')} <span className="muted text-xs">({user.name.split(' ')[0]})</span></button>
      </header>
      <main className="p-4 md:p-6 max-w-7xl mx-auto"><Outlet /></main>
    </div>
    <Chatbot />
    <div className="fixed top-16 end-4 z-50 space-y-2">{toasts.map(x => <div key={x.id} className="card px-4 py-2 text-sm shadow-lg max-w-xs border-l-4 border-l-brand">{x.m}</div>)}</div>
    {help && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setHelp(false)}><div className="card p-5 text-sm space-y-1"><h3 className="font-bold mb-2">{tr("Keyboard shortcuts")}</h3>{[['/', 'Focus search'], ['n', 'New ticket'], ['t', 'Tickets'], ['d', 'Dashboard'], ['k', 'Kanban'], ['?', 'This help']].map(([k, v]) => <div key={k}><kbd className="bg-paper dark:bg-night px-1.5 rounded border border-paper-line dark:border-night-line">{k}</kbd> {v}</div>)}</div></div>}
  </div>;
}
