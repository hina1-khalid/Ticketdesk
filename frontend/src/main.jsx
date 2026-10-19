import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/Auth';
import { PrefsProvider } from './context/Prefs';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter><PrefsProvider><AuthProvider><App /></AuthProvider></PrefsProvider></BrowserRouter>
);
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js');
