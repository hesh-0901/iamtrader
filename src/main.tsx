import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Capture the native install event globally; Settings may mount after the browser emits it.
declare global {
  interface Window {
    __iamtraderInstallPrompt?: Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
    };
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  window.__iamtraderInstallPrompt = event as Window['__iamtraderInstallPrompt'];
  window.dispatchEvent(new Event('iamtrader:install-available'));
});
window.addEventListener('appinstalled', () => {
  window.__iamtraderInstallPrompt = undefined;
  window.dispatchEvent(new Event('iamtrader:installed'));
});

createRoot(document.getElementById('root')!).render(<App />);

// Register the PWA service worker only on supported secure contexts.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
    void navigator.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' })
      .then(registration => { void registration.update().catch(() => undefined); })
      .catch(error => console.warn('IAMTRADER PWA registration notice:', error));
  });
}
