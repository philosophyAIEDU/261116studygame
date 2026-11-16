import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { registerUpdate } from './app/registerUpdate';
import { listenForInstall } from './app/install';

listenForInstall();
registerUpdate();

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
