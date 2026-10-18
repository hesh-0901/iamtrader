import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
\n// Register the PWA service worker only on supported secure contexts.\nif ('serviceWorker' in navigator && import.meta.env.PROD) {\n  window.addEventListener('load', () => {\n    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;\n    void navigator.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' })\n      .then(registration => { void registration.update().catch(() => undefined); })\n      .catch(error => console.warn('IAMTRADER PWA registration notice:', error));\n  });\n}\n