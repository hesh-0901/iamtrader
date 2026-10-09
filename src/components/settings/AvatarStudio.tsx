import React, { useMemo, useState } from 'react';
import { Check, Shuffle, Save, UserRound, Palette, Scissors, Glasses, Shirt, Smile, Sparkles } from 'lucide-react';
import { UserProfile } from '../../types';
import { updateUserAvatar } from '../../services/auth';
import { useToast } from '../common/Toast';

type AvatarConfig = {
  seed: string;
  skinColor: string;
  top: string;
  hairColor: string;
  accessories: string;
  clothing: string;
  clothesColor: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
  backgroundColor: string;
};

const defaults: AvatarConfig = {
  seed: 'IAMTRADER',
  skinColor: 'ae5d29',
  top: 'shortHairShortCurly',
  hairColor: '2c1b18',
  accessories: 'prescription02',
  clothing: 'hoodie',
  clothesColor: '262e33',
  eyes: 'happy',
  eyebrows: 'default',
  mouth: 'smile',
  backgroundColor: 'dbeafe'
};

const options: { key: keyof AvatarConfig; label: string; icon: React.ElementType; items: { label: string; value: string; color?: string }[] }[] = [
  { key: 'skinColor', label: 'Carnation', icon: Palette, items: [
    { label: 'Porcelaine', value: 'ffdbb4', color: '#ffdbb4' }, { label: 'Dorée', value: 'edb98a', color: '#edb98a' },
    { label: 'Miel', value: 'd08b5b', color: '#d08b5b' }, { label: 'Caramel', value: 'ae5d29', color: '#ae5d29' },
    { label: 'Brune', value: '614335', color: '#614335' }, { label: 'Ébène', value: '4a312c', color: '#4a312c' }
  ]},
  { key: 'top', label: 'Coiffure', icon: Scissors, items: [
    { label: 'Bouclée', value: 'shortHairShortCurly' }, { label: 'Dégradé', value: 'shortHairShortFlat' },
    { label: 'Classique', value: 'shortHairTheCaesar' }, { label: 'Longue', value: 'longHairBob' },
    { label: 'Ondulée', value: 'longHairCurly' }, { label: 'Tresses', value: 'longHairDreads' },
    { label: 'Chauve', value: 'noHair' }, { label: 'Mohawk', value: 'shortHairDreads01' }
  ]},
  { key: 'hairColor', label: 'Couleur des cheveux', icon: Palette, items: [
    { label: 'Noir', value: '2c1b18', color: '#2c1b18' }, { label: 'Brun', value: '4a312c', color: '#4a312c' },
    { label: 'Châtain', value: '724133', color: '#724133' }, { label: 'Blond', value: 'b58143', color: '#b58143' },
    { label: 'Gris', value: 'd6b370', color: '#d6b370' }, { label: 'Rose', value: 'ff488e', color: '#ff488e' }
  ]},
  { key: 'accessories', label: 'Lunettes', icon: Glasses, items: [
    { label: 'Sans lunettes', value: 'blank' }, { label: 'Classiques', value: 'prescription02' },
    { label: 'Monture fine', value: 'prescription01' }, { label: 'Wayfarer', value: 'wayfarers' },
    { label: 'Lunettes rondes', value: 'round' }, { label: 'Lunettes de soleil', value: 'sunglasses' }
  ]},
  { key: 'clothing', label: 'Tenue', icon: Shirt, items: [
    { label: 'Sweat à capuche', value: 'hoodie' }, { label: 'Veste pro', value: 'blazerAndShirt' },
    { label: 'Pull', value: 'collarAndSweater' }, { label: 'T-shirt', value: 'graphicShirt' },
    { label: 'Chemise', value: 'shirtCrewNeck' }
  ]},
  { key: 'clothesColor', label: 'Couleur de tenue', icon: Palette, items: [
    { label: 'Noir', value: '262e33', color: '#262e33' }, { label: 'Bleu', value: '3c4f76', color: '#3c4f76' },
    { label: 'Vert', value: '3c8c6e', color: '#3c8c6e' }, { label: 'Violet', value: '796aaf', color: '#796aaf' },
    { label: 'Rouge', value: 'c84b4b', color: '#c84b4b' }, { label: 'Blanc', value: 'f4f4f5', color: '#f4f4f5' }
  ]},
  { key: 'eyes', label: 'Expression des yeux', icon: Smile, items: [
    { label: 'Naturel', value: 'default' }, { label: 'Joyeux', value: 'happy' },
    { label: 'Clin d’œil', value: 'wink' }, { label: 'Calme', value: 'side' },
    { label: 'Surpris', value: 'surprised' }
  ]},
  { key: 'mouth', label: 'Sourire', icon: Smile, items: [
    { label: 'Sourire', value: 'smile' }, { label: 'Grand sourire', value: 'twinkle' },
    { label: 'Serein', value: 'default' }, { label: 'Ouvert', value: 'screamOpen' }
  ]},
  { key: 'backgroundColor', label: 'Arrière-plan', icon: Sparkles, items: [
    { label: 'Bleu glacier', value: 'dbeafe', color: '#dbeafe' }, { label: 'Lavande', value: 'ede9fe', color: '#ede9fe' },
    { label: 'Menthe', value: 'd1fae5', color: '#d1fae5' }, { label: 'Pêche', value: 'ffedd5', color: '#ffedd5' },
    { label: 'Rose', value: 'fce7f3', color: '#fce7f3' }, { label: 'Ardoise', value: 'e2e8f0', color: '#e2e8f0' }
  ]}
];

function createAvatarUrl(config: AvatarConfig) {
  const params = new URLSearchParams({
    seed: config.seed,
    skinColor: config.skinColor,
    top: config.top,
    hairColor: config.hairColor,
    accessories: config.accessories,
    clothing: config.clothing,
    clothesColor: config.clothesColor,
    eyes: config.eyes,
    eyebrows: 'default',
    mouth: config.mouth,
    backgroundColor: config.backgroundColor
  });
  return `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
}

interface AvatarStudioProps { userProfile: UserProfile | null; }

export function AvatarStudio({ userProfile }: AvatarStudioProps) {
  const { showToast } = useToast();
  const [config, setConfig] = useState<AvatarConfig>(() => ({
    ...defaults,
    ...(userProfile?.avatarConfig || {}),
    seed: userProfile?.avatarConfig?.seed || userProfile?.displayName || userProfile?.email?.split('@')[0] || defaults.seed
  }));
  const [activeCategory, setActiveCategory] = useState<keyof AvatarConfig>('top');
  const [saving, setSaving] = useState(false);
  const avatarUrl = useMemo(() => createAvatarUrl(config), [config]);
  const savedUrl = userProfile?.avatarURL || userProfile?.photoURL || '';
  const hasChanges = avatarUrl !== savedUrl;

  const updateOption = (key: keyof AvatarConfig, value: string) => setConfig(current => ({ ...current, [key]: value }));
  const randomize = () => {
    setConfig(current => {
      const next = { ...current, seed: `trader-${Math.random().toString(36).slice(2, 9)}` };
      options.forEach(category => {
        const item = category.items[Math.floor(Math.random() * category.items.length)];
        (next as any)[category.key] = item.value;
      });
      return next;
    });
  };

  const save = async () => {
    if (!userProfile?.uid) {
      showToast('Connectez-vous pour enregistrer votre avatar.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateUserAvatar(userProfile.uid, avatarUrl, config);
      showToast('Votre avatar personnalisé est enregistré. Actualisation du profil…', 'success');
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error: any) {
      showToast(error?.message || 'Impossible d’enregistrer votre avatar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/70 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600"><Sparkles className="h-3.5 w-3.5" /> Avatar Studio</div>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">Créez votre identité visuelle</h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">Personnalisez votre personnage et retrouvez-le sur votre profil IAMTRADER et dans PipTalk.</p>
          </div>
          <button type="button" onClick={randomize} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700"><Shuffle className="h-4 w-4" /> Avatar aléatoire</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.6fr)]">
        <div className="border-b border-slate-100 bg-gradient-to-b from-blue-50/70 via-slate-50 to-white p-5 lg:border-b-0 lg:border-r sm:p-6">
          <div className="mx-auto max-w-[330px]">
            <div className="overflow-hidden rounded-[24px] border border-white bg-white shadow-[0_14px_40px_rgba(30,64,175,0.12)]">
              <img src={avatarUrl} alt="Aperçu de votre avatar personnalisé" className="aspect-square w-full object-cover" />
            </div>
            <div className="mt-4 text-center">
              <div className="text-sm font-black text-slate-900">{userProfile?.displayName || 'Trader IAMTRADER'}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Votre avatar personnel</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white p-2 text-center"><div className="text-[10px] font-bold text-slate-800">Unique</div><div className="mt-0.5 text-[9px] text-slate-400">Combinaison</div></div>
              <div className="rounded-xl border border-slate-200 bg-white p-2 text-center"><div className="text-[10px] font-bold text-slate-800">9 options</div><div className="mt-0.5 text-[9px] text-slate-400">Catégories</div></div>
              <div className="rounded-xl border border-slate-200 bg-white p-2 text-center"><div className="text-[10px] font-bold text-slate-800">PipTalk</div><div className="mt-0.5 text-[9px] text-slate-400">Compatible</div></div>
            </div>
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {options.map(category => {
              const Icon = category.icon;
              const active = activeCategory === category.key;
              return <button key={category.key} type="button" onClick={() => setActiveCategory(category.key)} className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[10px] font-bold transition ${active ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}><Icon className="h-4 w-4" /><span className="truncate">{category.label}</span></button>;
            })}
          </div>
          {options.filter(category => category.key === activeCategory).map(category => (
            <div key={category.key} className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-sm font-black text-slate-900">{category.label}</h4><span className="text-[10px] text-slate-400">{category.items.length} choix</span></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {category.items.map(item => {
                  const selected = config[category.key] === item.value;
                  return <button key={item.value} type="button" onClick={() => updateOption(category.key, item.value)} aria-pressed={selected} className={`flex items-center gap-3 rounded-xl border p-3 text-left text-xs font-semibold transition ${selected ? 'border-blue-400 bg-blue-50 text-blue-800 ring-1 ring-blue-100' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                    {item.color ? <span className="h-5 w-5 shrink-0 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: item.color }} /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500">{item.label.slice(0, 1)}</span>}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>{selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>;
                })}
              </div>
            </div>
          ))}
          <div className="mt-7 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] leading-4 text-slate-400">Les changements restent en aperçu jusqu’à l’enregistrement.</p>
            <button type="button" onClick={save} disabled={saving || !hasChanges} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Enregistrement…' : 'Enregistrer mon avatar'}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
