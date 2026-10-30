import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { loginWithEmail, registerWithEmail, resetUserPassword } from '../../services/auth';
import { useToast } from '../common/Toast';
import { Lock, Mail, User, Globe2, Phone, Camera, Check, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

const REGISTER_AVATARS = Array.from({ length: 50 }, (_, index) => {
  const number = String(index + 1).padStart(3, '0');
  return { id: `avatar-${number}`, url: `/avatars/avatar-${number}.webp` };
});

const fieldClass = 'w-full rounded-xl border border-[#DCE5EC] bg-white px-3 py-2.5 !text-[#0B1F35] placeholder:!text-[#9AA9B8] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(defaultMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<(typeof REGISTER_AVATARS)[number] | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<(typeof REGISTER_AVATARS)[number] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setMode(defaultMode);
  }, [isOpen, defaultMode]);

  const switchMode = (nextMode: 'login' | 'register' | 'forgot') => {
    setMode(nextMode);
    if (nextMode === 'register') {
      setPassword('');
      setConfirmPassword('');
    }
  };

  const confirmAvatarChoice = () => {
    if (!pendingAvatar) return;
    setSelectedAvatar(pendingAvatar);
    setAvatarModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      if (!firstName.trim() || !lastName.trim() || !displayName.trim() || !country.trim() || !whatsapp.trim()) {
        showToast('Veuillez compléter tous les champs obligatoires.', 'error');
        return;
      }
      if (!selectedAvatar) {
        showToast('Veuillez choisir votre avatar avant de continuer.', 'error');
        return;
      }
      if (password !== confirmPassword) {
        showToast('Les deux mots de passe ne correspondent pas.', 'error');
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
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          country: country.trim(),
          whatsapp: whatsapp.trim(),
          avatarId: selectedAvatar!.id,
          avatarURL: selectedAvatar!.url
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
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') errorMsg = 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.';
      else if (err.code === 'auth/email-already-in-use') errorMsg = 'Cette adresse e-mail est déjà utilisée. Connectez-vous avec votre mot de passe.';
      else if (err.code === 'auth/weak-password') errorMsg = 'Le mot de passe doit comporter au moins 6 caractères.';
      else if (err.code === 'auth/user-not-found') errorMsg = 'Aucun compte associé à cette adresse e-mail.';
      else if (err.code === 'permission-denied' || err.message?.includes('permission')) errorMsg = 'Règles de sécurité Firestore : accès restreint.';
      else if (err.message) errorMsg = err.message;
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={mode === 'login' ? 'Connexion à IAMTRADER' : mode === 'register' ? 'Créer un compte IAMTRADER' : 'Réinitialiser le mot de passe'}
        subtitle="Espace sécurisé Firebase Authentication"
        maxWidth={mode === 'register' ? 'max-w-2xl' : 'max-w-md'}
        slideFromRight
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-neutral-300">
          <div className="flex justify-center pb-1">
            <img src="/brand/logo-iamtrader-symbol.png" alt="IAMTRADER" className="h-10 w-10 object-contain" />
          </div>

          {mode === 'register' && (
            <>
              <section className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => { setPendingAvatar(selectedAvatar); setAvatarModalOpen(true); }}
                    className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-200 bg-white text-emerald-600 shadow-sm transition hover:border-emerald-500"
                    aria-label="Ouvrir la galerie de photos de profil">
                    {selectedAvatar ? <img src={selectedAvatar.url} alt="Avatar sélectionné" className="h-full w-full object-cover" /> : <Camera className="h-7 w-7" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#0B1F35]">Photo de profil / Avatar *</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">{selectedAvatar ? `Avatar ${selectedAvatar.id.replace('avatar-', '#')} sélectionné` : 'Touchez l’icône photo pour ouvrir la galerie et choisir un avatar.'}</p>
                    <button type="button" onClick={() => { setPendingAvatar(selectedAvatar); setAvatarModalOpen(true); }} className="mt-2 text-[11px] font-bold text-emerald-700 hover:underline">
                      {selectedAvatar ? 'Modifier mon choix avant inscription' : 'Choisir un avatar'}
                    </button>
                  </div>
                  {selectedAvatar && <Check className="h-5 w-5 shrink-0 text-emerald-600" />}
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block font-semibold text-neutral-500">Prénom *</span>
                  <input type="text" autoComplete="given-name" placeholder="Votre prénom" value={firstName} onChange={e => setFirstName(e.target.value)} className={fieldClass} required />
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-semibold text-neutral-500">Nom *</span>
                  <input type="text" autoComplete="family-name" placeholder="Votre nom" value={lastName} onChange={e => setLastName(e.target.value)} className={fieldClass} required />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block font-semibold text-neutral-500">Pseudo Trader *</span>
                <span className="relative block">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <input type="text" autoComplete="nickname" placeholder="Ex. Alex Trader" value={displayName} onChange={e => setDisplayName(e.target.value)} className={`${fieldClass} pl-9`} required />
                </span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block font-semibold text-neutral-500">Pays de résidence *</span>
                  <span className="relative block">
                    <Globe2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <input type="text" autoComplete="country-name" placeholder="Votre pays" value={country} onChange={e => setCountry(e.target.value)} className={`${fieldClass} pl-9`} required />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-semibold text-neutral-500">Numéro WhatsApp *</span>
                  <span className="relative block">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <input type="tel" autoComplete="tel" placeholder="Ex. +243..." value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className={`${fieldClass} pl-9`} required />
                  </span>
                </label>
              </div>
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

      {avatarModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#030604]/85 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label="Choisir un avatar">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-300">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><h3 className="text-base font-black text-[#0B1F35]">Bibliothèque d’avatars</h3><p className="mt-1 text-xs text-slate-500">Sélectionnez un seul avatar pour votre compte.</p></div>
              <button type="button" onClick={() => setAvatarModalOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
            </header>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-5">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {REGISTER_AVATARS.map(avatar => {
                  const active = pendingAvatar?.id === avatar.id;
                  return <button key={avatar.id} type="button" onClick={() => setPendingAvatar(avatar)} aria-pressed={active} className={`relative overflow-hidden rounded-2xl border-2 bg-white p-1.5 transition ${active ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-lg' : 'border-slate-200 hover:border-emerald-300'}`}>
                    <img src={avatar.url} alt={avatar.id} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                    <span className="block py-1 text-center text-[10px] font-bold text-slate-600">{avatar.id.replace('avatar-', '#')}</span>
                    {active && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3.5 w-3.5" /></span>}
                  </button>;
                })}
              </div>
              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-bold text-slate-700">Aperçu de votre choix</p>
                {pendingAvatar ? <img src={pendingAvatar.url} alt="Aperçu avatar sélectionné" className="mx-auto aspect-square w-full max-w-[180px] rounded-2xl border border-white object-cover shadow" /> : <div className="flex aspect-square items-center justify-center rounded-2xl bg-white text-slate-300"><Camera className="h-10 w-10" /></div>}
                <p className="mt-2 text-center text-xs font-semibold text-slate-600">{pendingAvatar?.id || 'Aucun avatar sélectionné'}</p>
              </aside>
            </div>
            <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setAvatarModalOpen(false)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Annuler</button>
              <button type="button" disabled={!pendingAvatar} onClick={confirmAvatarChoice} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">Confirmer cet avatar</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
