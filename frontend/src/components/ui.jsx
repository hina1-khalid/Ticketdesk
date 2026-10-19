import { tr } from '../i18n';
import { useEffect } from 'react';
export const STATUS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const toast = m => window.dispatchEvent(new CustomEvent('toast', { detail: m }));
const SC = { open: 'bg-signal-blue/15 text-signal-blue', in_progress: 'bg-signal-amber/20 text-amber-700 dark:text-signal-amber', resolved: 'bg-signal-green/15 text-signal-green', closed: 'bg-slate-200 text-slate-600 dark:bg-night-line dark:text-slate-300' };
const PC = { low: 'bg-slate-200 text-slate-600 dark:bg-night-line dark:text-slate-300', medium: 'bg-signal-blue/15 text-signal-blue', high: 'bg-signal-amber/20 text-amber-700 dark:text-signal-amber', urgent: 'bg-signal-red/15 text-signal-red' };
export const StatusBadge = ({ s, t = x => x }) => <span className={`pill ${SC[s]}`}>{t(STATUS[s])}</span>;
export const PriorityBadge = ({ p, t = x => x }) => <span className={`pill ${PC[p]}`}>{t(p[0].toUpperCase() + p.slice(1))}</span>;
export const Spinner = () => <div className="p-10 text-center muted text-sm">{tr("Loading…")}</div>;
export const ago = d => { const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
export const fmt = d => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function SlaBadge({ ticket }) {
  const due = ticket.sla?.dueAt && new Date(ticket.sla.dueAt);
  if (!due) return null;
  if (['resolved', 'closed'].includes(ticket.status)) return ticket.sla.breached ? <span className="pill bg-signal-red/15 text-signal-red">{tr("SLA missed")}</span> : <span className="pill bg-signal-green/15 text-signal-green">{tr("SLA met")}</span>;
  const h = (due - Date.now()) / 36e5;
  if (h < 0) return <span className="pill bg-signal-red text-white">Overdue {Math.max(1, Math.round(-h))}h</span>;
  return <span className={`pill ${h < 4 ? 'bg-signal-amber/25 text-amber-700 dark:text-signal-amber' : 'bg-slate-100 text-slate-600 dark:bg-night-line dark:text-slate-300'}`}>Due {h < 1 ? '<1' : Math.round(h)}h</span>;
}
export function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return <div className="flex items-center justify-center gap-3 py-3 text-sm"><button className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>{tr("‹ Prev")}</button><span className="muted">{tr('Page')} {page} / {pages}</span><button className="btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>{tr("Next ›")}</button></div>;
}
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => { const h = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-auto" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-5 mt-10`}><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{title}</h3><button className="muted text-xl leading-none" onClick={onClose}>×</button></div>{children}</div></div>;
}
export const Field = ({ label, children }) => <label className="block mb-3"><span className="label">{label}</span>{children}</label>;
export function useLive(cb) {
  useEffect(() => { window.addEventListener('ticket-changed', cb); return () => window.removeEventListener('ticket-changed', cb); }, [cb]);
}
