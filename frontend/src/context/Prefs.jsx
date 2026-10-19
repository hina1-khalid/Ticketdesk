import { createContext, Fragment, useContext, useEffect, useState } from 'react';
import { ur } from '../i18n';
const Ctx = createContext();
export const usePrefs = () => useContext(Ctx);
export function PrefsProvider({ children }) {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'en');
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr'; document.documentElement.lang = lang; localStorage.setItem('lang', lang); }, [lang]);
  const t = s => (lang === 'ur' ? ur[s] || s : s);
  return <Ctx.Provider value={{ theme, setTheme, lang, setLang, t }}><Fragment key={lang}>{children}</Fragment></Ctx.Provider>;
}
