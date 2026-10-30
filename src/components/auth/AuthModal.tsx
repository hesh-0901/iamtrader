import React, { useRef, useState } from 'react';
import { Modal } from '../common/Modal';
import { loginWithEmail, registerWithEmail, resetUserPassword } from '../../services/auth';
import { useToast } from '../common/Toast';
import { Lock, Mail, User, Globe2, Phone, Check } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

const REGISTER_AVATARS = Array.from({ length: 28 }, (_, index) => {
  const number = String(index + 1).padStart(3, '0');
  return { id: `avatar-${number}`, url: `/avatars/${number}.png` };
});

const fieldClass = 'w-full rounded-xl border border-[#DCE5EC] bg-white px-3 py-2.5 !text-[#0B1F35] placeholder:!text-[#9AA9B8] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(REGISTER_AVATARS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const avatarRailRef = useRef<HTMLDivElement>(null);

  const switchMode = (nextMode: 'login' | 'register' | 'forgot') => {
    setMode(nextMode);
    if (nextMode === 'register') {
      setPassword('');
      setConfirmPassword('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      if (password !== confirmPassword) {
        showToast('Les deux mots de passe ne correspondent pas.', 'error');
        return;
      }
      if (!displayName.trim() || !country.trim() || !whatsapp.trim()) {
        showToast('Veuillez compléter les informations obligatoires.', 'error');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        showToast('Connexion réussie', 'success');
        onClose();
      } else if (mode === 'register') {
        await registerWithEmail(email, password, displayName.trim(), {
          country: country.trim(),
          whatsapp: whatsapp.trim(),
          avatarId: selectedAvatar.id,
          avatarURL: selectedAvatar.url
        });
        showToast('Compte créé avec succès', 'success');
        onClose();
      } else {
        await resetUserPassword(email);
        showToast('E-mail de réinitialisation envoyé', 'info');
        switchMode('login');
      }
    } catch (err: any) {
      console.warn('Auth notification:', err.code || err.message);
      let errorMsg = 'Une erreur est survenue lors de l’authentification.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        errorMsg = 'Identifiants incorrects. Si vous n’avez pas encore créé de compte, inscrivez-vous gratuitement.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Cette adresse e-mail est déjà utilisée. Connectez-vous avec votre mot de passe.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Le mot de passe doit comporter au moins 6 caractères.';
      } else if (err.code === 'auth/user-not-found') {
        errorMsg = 'Aucun compte associé à cette adresse e-mail.';
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
      title={mode === 'login' ? 'Connexion à IAMTRADER' : mode === 'register' ? 'Créer un compte IAMTRADER' : 'Réinitialiser le mot de passe'}
      subtitle="Espace sécurisé Firebase Authentication"
      maxWidth={mode === 'register' ? 'max-w-2xl' : 'max-w-md'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-neutral-300">
        <div className="flex justify-center pb-1">
          <img src="/brand/logo-iamtrader-symbol.png" alt="IAMTRADER" className="h-11 w-11 object-contain" />
        </div>

        {mode === 'register' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block font-semibold text-neutral-500">Nom / Pseudo Trader *</span>
                <span className="relative block">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <input type="text" autoComplete="nickname" placeholder="Ex. Alex Trader" value={displayName} onChange={e => setDisplayName(e.target.value)} className={`${fieldClass} pl-9`} required />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block font-semibold text-neutral-500">Pays de résidence *</span>
                <span className="relative block">
                  <Globe2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <input type="text" autoComplete="country-name" placeholder="Ex. République démocratique du Congo" value={country} onChange={e => setCountry(e.target.value)} className={`${fieldClass} pl-9`} required />
                </span>
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block font-semibold text-neutral-500">Numéro WhatsApp *</span>
              <span className="relative block">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input type="tel" autoComplete="tel" placeholder="Ex. +243..." value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className={`${fieldClass} pl-9`} required />
              </span>
            </label>

            <section className="rounded-2xl border border-[#DCE5EC] bg-[#F8FBFA] p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0B1F35]">Choisissez votre avatar</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">Faites glisser horizontalement pour parcourir la bibliothèque.</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{selectedAvatar.id.replace('avatar-', '#')}</span>
              </div>
              <div
                ref={avatarRailRef}
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
                aria-label="Galerie horizontale des avatars"
              >
                {REGISTER_AVATARS.map(avatar => {
                  const selected = selectedAvatar.id === avatar.id;
                  return (
                    <button key={avatar.id} type="button" onClick={() => setSelectedAvatar(avatar)} aria-label={`Choisir l’avatar ${avatar.id}`} aria-pressed={selected}
                      className={`relative w-[104px] shrink-0 snap-start overflow-hidden rounded-2xl border-2 bg-white p-1.5 transition sm:w-[116px] ${selected ? 'border-emerald-500 shadow-md shadow-emerald-500/15 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'}`}>
                      <img src={avatar.url} alt={`Avatar ${avatar.id}`} loading="lazy" draggable={false} className="aspect-square w-full rounded-xl object-cover" />
                      <span className="mt-1.5 block text-center text-[10px] font-semibold text-slate-600">{avatar.id.replace('avatar-', '#')}</span>
                      {selected && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow"><Check className="h-3.5 w-3.5" /></span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400">28 avatars disponibles actuellement. La bibliothèque pourra être enrichie sans modifier les comptes existants.</p>
            </section>
          </>
        )}

        <label className="block">
          <span className="mb-1.5 block font-semibold text-neutral-500">Adresse e-mail *</span>
          <span className="relative block">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input type="email" autoComplete="email" placeholder="trader@iamtrader.com" value={email} onChange={e => setEmail(e.target.value)} className={`${fieldClass} pl-9`} required />
          </span>
        </label>

        {mode !== 'forgot' && (
          <div className={mode === 'register' ? 'grid gap-3 sm:grid-cols-2' : ''}>
            <label className="block">
              <span className="mb-1.5 block font-semibold text-neutral-500">Mot de passe *</span>
              <span className="relative block">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="6 caractères minimum" value={password} onChange={e => setPassword(e.target.value)} className={`${fieldClass} pl-9`} required minLength={6} />
              </span>
              {mode === 'login' && <button type="button" onClick={() => switchMode('forgot')} className="mt-1.5 text-[11px] text-emerald-600 hover:underline">Mot de passe oublié ?</button>}
            </label>
            {mode === 'register' && (
              <label className="block">
                <span className="mb-1.5 block font-semibold text-neutral-500">Confirmer le mot de passe *</span>
                <span className="relative block">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <input type="password" autoComplete="new-password" placeholder="Répétez votre mot de passe" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`${fieldClass} pl-9`} required minLength={6} />
                </span>
              </label>
            )}
          </div>
        )}

        <button type="submit" disabled={isLoading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-bold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-50">
          {isLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" /> : mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte Trader' : 'Envoyer les instructions'}
        </button>

        <div className="border-t border-neutral-800 pt-3 text-center text-neutral-400">
          {mode === 'login' && <p>Pas encore de compte ? <button type="button" onClick={() => switchMode('register')} className="ml-1 font-semibold text-emerald-400 hover:underline">Inscrivez-vous gratuitement</button></p>}
          {mode === 'register' && <p>Vous avez déjà un compte ? <button type="button" onClick={() => switchMode('login')} className="ml-1 font-semibold text-emerald-400 hover:underline">Connectez-vous</button></p>}
          {mode === 'forgot' && <p>Retour à la <button type="button" onClick={() => switchMode('login')} className="ml-1 font-semibold text-emerald-400 hover:underline">connexion</button></p>}
        </div>
      </form>
    </Modal>
  );
}
