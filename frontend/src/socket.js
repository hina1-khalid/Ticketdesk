import { io } from 'socket.io-client';
import { BASE } from './api';
let s = null;
export const connect = () => { s?.disconnect(); s = io(BASE || undefined, { auth: { token: localStorage.getItem('token') } }); return s; };
export const disconnect = () => { s?.disconnect(); s = null; };
