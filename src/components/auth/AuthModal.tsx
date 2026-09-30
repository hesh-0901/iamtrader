import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { loginWithEmail, registerWithEmail, resetUserPassword } from '../../services/auth';
import { useToast } from '../common/Toast';
import { Lock, Mail, User, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        showToast('Connexion réussie', 'success');
        onClose();
      } else if (mode === 'register') {
        if (!displayName.trim()) {
          showToast('Veuillez renseigner votre nom ou pseudo', 'error');
          setIsLoading(false);
          return;
        }
        await registerWithEmail(email, password, displayName);
        showToast('Compte créé avec succès', 'success');
        onClose();
      } else if (mode === 'forgot') {
        await resetUserPassword(email);
        showToast('E-mail de réinitialisation envoyé', 'info');
        setMode('login');
      }
    } catch (err: any) {
      console.warn('Auth notification:', err.code || err.message);
      let errorMsg = 'Une erreur est survenue lors de l\'authentification.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        errorMsg = 'Identifiants incorrects. Si vous n\'avez pas encore créé de compte, cliquez sur "Inscrivez-vous gratuitement" ci-dessous.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Cette adresse e-mail est déjà utilisée. Connectez-vous avec votre mot de passe.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Le mot de passe doit comporter au moins 6 caractères.';
      } else if (err.code === 'auth/user-not-found') {
        errorMsg = 'Aucun compte associé à cette adresse e-mail. Cliquez sur "Inscrivez-vous gratuitement".';
      } else if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        errorMsg = 'Règles de sécurité Firestore : accès restreint.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'login'
          ? 'Connexion à IAMTRADER'
          : mode === 'register'
          ? 'Créer un compte IAMTRADER'
          : 'Réinitialiser le mot de passe'
      }
      subtitle="Espace sécurisé Firebase Authentication"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-neutral-300">
        {mode === 'register' && (
          <div>
            <label className="block font-medium text-neutral-400 mb-1.5">Nom / Pseudo Trader *</label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ex: Alex Trader"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>
        )}

        <div>
          <label className="block font-medium text-neutral-400 mb-1.5">Adresse E-mail *</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              placeholder="trader@iamtrader.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-medium text-neutral-400">Mot de passe *</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
                required
                minLength={6}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <span>
              {mode === 'login'
                ? 'Se connecter'
                : mode === 'register'
                ? 'Créer mon compte Trader'
                : 'Envoyer les instructions'}
            </span>
          )}
        </button>

        {/* Toggle mode links */}
        <div className="pt-3 border-t border-neutral-800 text-center text-neutral-400">
          {mode === 'login' && (
            <p>
              Pas encore de compte ?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-emerald-400 font-semibold hover:underline ml-1"
              >
                Inscrivez-vous gratuitement
              </button>
            </p>
          )}

          {mode === 'register' && (
            <p>
              Vous avez déjà un compte ?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-emerald-400 font-semibold hover:underline ml-1"
              >
                Connectez-vous
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <p>
              Retour à la{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-emerald-400 font-semibold hover:underline ml-1"
              >
                connexion
              </button>
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
