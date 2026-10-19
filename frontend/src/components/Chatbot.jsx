import { tr } from '../i18n';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { usePrefs } from '../context/Prefs';
export default function Chatbot() {
  const { t } = usePrefs(); const nav = useNavigate();
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState([{ from: 'bot', text: tr('Hi! Describe your problem and I will look for an answer.') }]), [text, setText] = useState('');
  const send = async e => {
    e.preventDefault(); const m = text.trim(); if (!m) return; setText(''); setMsgs(x => [...x, { from: 'me', text: m }]);
    try { const { data } = await api.post('/chatbot', { message: m }); setMsgs(x => [...x, { from: 'bot', text: data.reply, articles: data.articles, ticketTitle: data.createTicket ? data.title : null }]); }
    catch { setMsgs(x => [...x, { from: 'bot', text: 'Sorry, something went wrong.' }]); }
  };
  return <div className="fixed bottom-4 end-4 z-40">
    {open && <div className="card w-80 max-w-[90vw] h-[26rem] flex flex-col mb-3 shadow-xl">
      <div className="px-4 py-3 border-b border-paper-line dark:border-night-line font-display font-bold">{t('Ask the assistant')}</div>
      <div className="flex-1 overflow-auto p-3 space-y-2 text-sm">
        {msgs.map((m, i) => <div key={i} className={m.from === 'me' ? 'text-end' : ''}>
          <div className={`inline-block px-3 py-2 rounded-xl max-w-[85%] text-start ${m.from === 'me' ? 'bg-brand text-white' : 'bg-paper dark:bg-night'}`}>{m.text}</div>
          {m.articles?.map(a => <Link key={a._id} to={`/kb/${a._id}`} onClick={() => setOpen(false)} className="block mt-1 text-brand underline text-xs">📘 {a.title}</Link>)}
          {m.ticketTitle && <button className="btn btn-primary mt-1 text-xs" onClick={() => { setOpen(false); nav('/tickets/new?title=' + encodeURIComponent(m.ticketTitle)); }}>{t('Create ticket')}</button>}
        </div>)}
      </div>
      <form onSubmit={send} className="p-2 flex gap-2 border-t border-paper-line dark:border-night-line"><input className="input" value={text} onChange={e => setText(e.target.value)} placeholder="…" /><button className="btn btn-primary">➤</button></form>
    </div>}
    <button onClick={() => setOpen(!open)} className="ms-auto flex w-12 h-12 rounded-full bg-brand text-white shadow-lg items-center justify-center text-xl" aria-label="Assistant">💬</button>
  </div>;
}
