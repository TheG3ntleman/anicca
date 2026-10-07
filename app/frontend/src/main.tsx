import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/theme.css';
import './styles/global.css';
import { AppShell } from './components/AppShell/AppShell';
import { initializeViewport } from './viewport';

const disposeViewport = initializeViewport();
if (import.meta.hot) import.meta.hot.dispose(disposeViewport);

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
