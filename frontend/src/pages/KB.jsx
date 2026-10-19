import { tr } from '../i18n';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { Spinner, toast } from '../components/ui';
import { usePrefs } from '../context/Prefs';
export default function KB() {
  const { id } = useParams(); const nav = useNavigate(); const { t } = usePrefs();
  const [q, setQ] = useState(''), [list, setList] = useState(null), [a, setA] = useState(null);
  useEffect(() => { const h = setTimeout(() => api.get('/kb', { params: { q } }).then(r => setList(r.data)), 250); return () => clearTimeout(h); }, [q]);
  useEffect(() => { setA(null); if (id) api.get('/kb/' + id).then(r => setA(r.data)).catch(() => nav('/kb')); }, [id, nav]);
  if (id) return !a ? <Spinner /> : <article className="card p-6 max-w-3xl mx-auto"><Link to="/kb" className="text-sm text-brand underline">← {t('Knowledge base')}</Link>
    <h1 className="text-3xl font-bold mt-2">{a.title}</h1><p className="muted text-xs mb-4">{a.category} · {a.views} views</p><div className="whitespace-pre-wrap leading-relaxed">{a.body}</div>
    <div className="mt-6 pt-4 border-t border-paper-line dark:border-night-line flex items-center gap-3 text-sm">{tr("Did this help?")} <button className="btn" onClick={() => { api.post(`/kb/${a._id}/helpful`); toast('Thanks!'); }}>{tr("👍 Yes")}</button><Link to={'/tickets/new?title=' + encodeURIComponent(a.title)} className="btn">{tr("No, create a ticket")}</Link></div></article>;
  return <div className="max-w-3xl mx-auto"><h1 className="text-2xl font-bold mb-3">{t('Knowledge base')}</h1>
    <input className="input mb-4" placeholder={tr("Search articles (English / Roman Urdu)…")} value={q} onChange={e => setQ(e.target.value)} />
    {!list ? <Spinner /> : <div className="space-y-2">{list.map(x => <Link key={x._id} to={'/kb/' + x._id} className="card p-4 block hover:border-brand"><div className="font-semibold">{x.title}</div><div className="text-xs muted">{x.category} · {x.views} views</div></Link>)}{!list.length && <p className="muted">{tr("No articles found.")} <Link className="text-brand underline" to="/tickets/new">{tr("Create a ticket")}</Link></p>}</div>}</div>;
}
