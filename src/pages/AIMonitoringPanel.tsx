import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, Server, ShieldCheck, Zap, Save, SlidersHorizontal, X } from 'lucide-react';
import { adminGetAiMonitoring, adminGetAiModels, adminSaveAiConfig } from '../services/adminConsole';

type ProviderId = 'gemini' | 'openai' | 'deepseek';
type AssistantConfig = { id: string; label: string; enabled: boolean; providerOrder: ProviderId[]; model: string; models: Record<ProviderId,string>; temperature: number; maxTokens: number; timeoutMs: number };
type AIEvent = { assistant: string; provider: string; configSource?: string; model: string; keyAlias: string; status: number | null; latencyMs: number; attempts: number; failovers: number; outcome: 'success' | 'failure'; errorCategory: string; createdAt: string };
type ModelCatalogue = { provider: ProviderId; models: string[]; source: string; verifiedWithApiKey: boolean; warning: string };
type MonitoringData = { success: boolean; catalogues?: ModelCatalogue[]; keys: Array<{ alias: string; provider: ProviderId; configured: boolean }>; providers: Array<{ id: ProviderId; label: string; configured: boolean; models: string[] }>; assistants: AssistantConfig[]; configUpdatedAt?: string; events: AIEvent[] };

const assistantNames: Record<string, string> = { chloe: 'Chloé', vyra: 'VYRA', 'instrument-suggest': 'Suggestions instruments', 'economic-calendar-analysis': 'Analyse économique' };
const providerNames: Record<ProviderId, string> = { gemini: 'Google Gemini', openai: 'OpenAI', deepseek: 'DeepSeek' };
const dateLabel = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }); };
const fallbackConfigs: AssistantConfig[] = [
  { id: 'chloe', label: 'Chloé', enabled: true, providerOrder: ['gemini','openai','deepseek'], model: 'gemini-3.5-flash-lite', models: { gemini: 'gemini-3.5-flash-lite', openai: 'gpt-6-luna', deepseek: 'deepseek-flash' }, temperature: .2, maxTokens: 1000, timeoutMs: 20000 },
  { id: 'vyra', label: 'VYRA', enabled: true, providerOrder: ['gemini','openai','deepseek'], model: 'gemini-3.5-flash-lite', models: { gemini: 'gemini-3.5-flash-lite', openai: 'gpt-6-luna', deepseek: 'deepseek-flash' }, temperature: .3, maxTokens: 1200, timeoutMs: 15000 },
  { id: 'instrument-suggest', label: 'Suggestions instruments', enabled: true, providerOrder: ['gemini','openai','deepseek'], model: 'gemini-3.8-flash', models: { gemini: 'gemini-3.8-flash', openai: 'gpt-6-luna', deepseek: 'deepseek-flash' }, temperature: .1, maxTokens: 300, timeoutMs: 12000 },
  { id: 'economic-calendar-analysis', label: 'Analyse économique', enabled: true, providerOrder: ['gemini','openai','deepseek'], model: 'gemini-3.5-flash-lite', temperature: .2, maxTokens: 500, timeoutMs: 12000 }
];

export function AIMonitoringPanel() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [assistants, setAssistants] = useState<AssistantConfig[]>(fallbackConfigs);
  const [catalogues, setCatalogues] = useState<ModelCatalogue[]>([]);
  const [eventPage, setEventPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'routing' | 'history'>('overview');
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);
  const pageSize = 5;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [result, modelResult] = await Promise.all([adminGetAiMonitoring<MonitoringData>(), adminGetAiModels<{ catalogues?: ModelCatalogue[] }>()]);
      setData(result);
      setCatalogues(modelResult.catalogues || result.catalogues || []);
      if (Array.isArray(result.assistants) && result.assistants.length) setAssistants(result.assistants);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible de charger le moteur IA.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const selectedAssistant = assistants.find(item => item.id === selectedAssistantId) || null;
  const events = data?.events || [];
  const eventPages = Math.max(1, Math.ceil(events.length / pageSize));
  const visibleEvents = events.slice((eventPage - 1) * pageSize, eventPage * pageSize);
  const summary = useMemo(() => {
    const successful = events.filter(event => event.outcome === 'success').length;
    const latencies = events.map(event => event.latencyMs).filter(value => value > 0);
    return { total: events.length, successful, rate: events.length ? Math.round(successful / events.length * 100) : null, latency: latencies.length ? Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length) : null, failovers: events.reduce((sum,event)=>sum+event.failovers,0) };
  }, [events]);

  function patchAssistant(id: string, patch: Partial<AssistantConfig>) {
    setAssistants(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  }
  function moveProvider(id: string, index: number, provider: ProviderId) {
    setAssistants(current => current.map(item => {
      if (item.id !== id) return item;
      const order = [...item.providerOrder.filter(value => value !== provider)];
      order.splice(index, 0, provider);
      return { ...item, providerOrder: order };
    }));
  }
  async function save() {
    setSaving(true); setError(''); setNotice('');
    try {
      await adminSaveAiConfig(assistants.map(item => ({ ...item, models: { gemini: item.models?.gemini || item.model, openai: item.models?.openai || 'gpt-6-luna', deepseek: item.models?.deepseek || 'deepseek-flash' } })));
      setNotice('Configuration du moteur IA enregistrée.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  }

  return <section className="mx-auto w-full max-w-6xl space-y-4 px-2 sm:px-4">
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-emerald-700"><ShieldCheck className="h-3.5 w-3.5"/>Supervision IA</div><h2 className="mt-0.5 truncate text-lg font-black text-slate-900">Moteur IA central</h2></div>
      <button onClick={()=>void refresh()} disabled={loading} aria-label="Actualiser" title="Actualiser" className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={'h-3.5 w-3.5 '+(loading?'animate-spin':'')}/><span className="hidden sm:inline">Actualiser</span></button>
    </div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
    <nav aria-label="Sections du moteur IA" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
      {([{id:'overview',label:'Vue générale',Icon:Activity},{id:'providers',label:'Fournisseurs',Icon:Server},{id:'routing',label:'Routage IA',Icon:SlidersHorizontal},{id:'history',label:'Historique',Icon:Clock3}] as const).map(tab=><button key={tab.id} type="button" onClick={()=>setActiveTab(tab.id)} aria-current={activeTab===tab.id?'page':undefined} className={'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors '+(activeTab===tab.id?'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200':'text-slate-500 hover:bg-white/70 hover:text-slate-800')}><tab.Icon className="h-3.5 w-3.5"/>{tab.label}</button>)}
    </nav>
    {activeTab === 'overview' && <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">{[
      {label:'Appels enregistrés',value:summary.total.toLocaleString('fr-FR'),Icon:Activity},
      {label:'Taux de réussite',value:summary.rate===null?'—':summary.rate+'%',Icon:CheckCircle2},
      {label:'Latence moyenne',value:summary.latency===null?'—':summary.latency+' ms',Icon:Clock3},
      {label:'Basculements',value:summary.failovers.toLocaleString('fr-FR'),Icon:Zap}
    ].map(item=><div key={item.label} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">{item.label}<item.Icon className="h-4 w-4 text-slate-400"/></div><div className="mt-2 text-xl font-black text-slate-900">{item.value}</div></div>)}</div>}

    {activeTab === 'providers' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><Server className="h-4 w-4 text-slate-500"/><h3 className="font-extrabold text-[#10243b]">Fournisseurs IA et clés API</h3></div>
      <p className="mt-1 text-xs text-slate-500">Les secrets ne sont jamais transmis au navigateur. Pour modifier une clé, utilisez les secrets Cloudflare.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{(data?.providers||[]).map(provider=><div key={provider.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><b className="text-sm text-slate-800">{provider.label}</b><span className={'rounded-full px-2.5 py-1 text-[11px] font-bold '+(provider.configured?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700')}>{provider.configured?'Configuré':'Clé absente'}</span></div><p className="mt-2 text-xs text-slate-500">Modèles connus : {provider.models.join(', ')}</p><div className="mt-3 flex flex-wrap gap-1.5">{(data?.keys||[]).filter(key=>key.provider===provider.id).map(key=><span key={key.alias} className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">{key.alias} · {key.configured?'OK':'Absent'}</span>)}</div></div>)}</div>
    </section>}

    {activeTab === 'routing' && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-slate-500"/><h3 className="font-extrabold text-[#10243b]">Routage et paramètres par assistant</h3></div><p className="mt-1 text-xs text-slate-500">Définissez l'ordre des fournisseurs et les paramètres d'exécution.</p></div><button onClick={()=>void save()} disabled={saving||loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10243b] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#173b57] disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Enregistrement…':'Enregistrer'}</button></div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{assistants.map(assistant=><button key={assistant.id} type="button" onClick={()=>setSelectedAssistantId(assistant.id)} className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-slate-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"><span className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{(assistant.label||assistantNames[assistant.id]||assistant.id).slice(0,2).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{assistant.label||assistantNames[assistant.id]||assistant.id}</span><span className={'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold '+(assistant.enabled?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>{assistant.enabled?'Actif':'Désactivé'}</span></span></span><span className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 group-hover:bg-slate-100">Configurer <span aria-hidden="true">↗</span></span></button>)}</div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">Dernière configuration : {data?.configUpdatedAt?dateLabel(data.configUpdatedAt):'configuration par défaut'}. Les modifications sont enregistrées côté serveur après validation.</p>
      {selectedAssistant && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedAssistantId(null);}}>
        <section role="dialog" aria-modal="true" aria-labelledby="assistant-modal-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Configuration de l’assistant</p><h3 id="assistant-modal-title" className="mt-0.5 truncate text-lg font-black text-slate-900">{selectedAssistant.label||assistantNames[selectedAssistant.id]||selectedAssistant.id}</h3></div><button type="button" onClick={()=>setSelectedAssistantId(null)} aria-label="Fermer" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4"/></button></header>
          <div className="overflow-y-auto p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"><span className="text-xs text-slate-500">Identifiant : {selectedAssistant.id}</span><label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={selectedAssistant.enabled} onChange={e=>patchAssistant(selectedAssistant.id,{enabled:e.target.checked})}/>Assistant activé</label></div>
            <div className="mt-5"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Modèles par fournisseur</h4><div className="mt-3 grid gap-4 sm:grid-cols-2">
              {(['gemini','openai','deepseek'] as ProviderId[]).map(provider=>{const catalogue=catalogues.find(item=>item.provider===provider);const available=catalogue?.models||[];const selected=selectedAssistant.models?.[provider]||(provider==='gemini'?selectedAssistant.model:provider==='openai'?'gpt-6-luna':'deepseek-flash');const options=available.includes(selected)||!selected?available:[selected,...available];return <label key={provider} className="text-xs font-semibold text-slate-600">{providerNames[provider]}<select value={selected} onChange={e=>patchAssistant(selectedAssistant.id,{...(provider==='gemini'?{model:e.target.value}:{}),models:{...selectedAssistant.models,[provider]:e.target.value}})} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800">{!options.length&&<option value={selected}>{selected||'Catalogue indisponible'}</option>}{options.map(model=><option key={model} value={model}>{model}</option>)}</select><span className="mt-1.5 block text-[10px] font-normal text-slate-400">{catalogue?.verifiedWithApiKey?'Catalogue récupéré auprès de l’API':'Catalogue officiel indicatif · clé API non vérifiée'}{catalogue?.warning?' · '+catalogue.warning:''}</span></label>;})}
            </div></div>
            <div className="mt-6"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Paramètres d’exécution</h4><div className="mt-3 grid gap-4 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-600">Température <span className="float-right font-bold text-slate-900">{selectedAssistant.temperature}</span><input type="range" min="0" max="2" step=".1" value={selectedAssistant.temperature} onChange={e=>patchAssistant(selectedAssistant.id,{temperature:Number(e.target.value)})} className="mt-4 w-full"/></label>
              <label className="text-xs font-semibold text-slate-600">Tokens maximum<input type="number" min="1" max="8192" value={selectedAssistant.maxTokens} onChange={e=>patchAssistant(selectedAssistant.id,{maxTokens:Number(e.target.value)})} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label>
              <label className="text-xs font-semibold text-slate-600">Délai maximum (ms)<input type="number" min="1000" max="60000" step="1000" value={selectedAssistant.timeoutMs} onChange={e=>patchAssistant(selectedAssistant.id,{timeoutMs:Number(e.target.value)})} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800"/></label>
            </div></div>
            <div className="mt-6"><h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Priorité des fournisseurs</h4><p className="mt-1 text-xs text-slate-500">Définissez le fournisseur principal et les solutions de secours.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{(['gemini','openai','deepseek'] as ProviderId[]).map(provider=><label key={provider} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700"><span>{providerNames[provider]}</span><select value={selectedAssistant.providerOrder.indexOf(provider)+1} onChange={e=>moveProvider(selectedAssistant.id,Number(e.target.value)-1,provider)} className="ml-auto rounded-md border border-slate-200 bg-white px-2 py-1.5"><option value="1">1er</option><option value="2">2e</option><option value="3">3e</option></select></label>)}</div></div>
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><span className="text-[11px] text-slate-500">Les changements seront pris en compte après enregistrement.</span><div className="flex justify-end gap-2"><button type="button" onClick={()=>setSelectedAssistantId(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Fermer</button><button type="button" onClick={()=>void save()} disabled={saving||loading} className="inline-flex items-center gap-2 rounded-lg bg-[#10243b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#173b57] disabled:opacity-50"><Save className="h-4 w-4"/>{saving?'Enregistrement…':'Enregistrer'}</button></div></footer>
        </section>
      </div>}
    </section>}

    {activeTab === 'history' && <section className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h3 className="font-extrabold text-[#10243b]">Derniers appels IA</h3><p className="mt-1 text-xs text-slate-500">Aucun prompt, fichier joint ou contenu privé n'est affiché.</p></div><span className="text-xs text-slate-400">{events.length} événement(s)</span></div>{loading&&!data?<div className="p-8 text-center text-sm text-slate-500">Chargement…</div>:!events.length?<div className="p-8 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-slate-300"/><p className="mt-2 text-sm text-slate-500">Aucune télémétrie disponible.</p></div>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{['Date','Assistant','Fournisseur','Modèle','Source','Clé','Résultat','Latence','Basculements'].map(label=><th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleEvents.map((event,index)=><tr key={event.createdAt+event.assistant+index} className="text-slate-600"><td className="whitespace-nowrap px-3 py-3">{dateLabel(event.createdAt)}</td><td className="px-3 py-3 font-semibold">{assistantNames[event.assistant]||event.assistant}</td><td className="px-3 py-3">{providerNames[event.provider as ProviderId]||event.provider}</td><td className="px-3 py-3">{event.model||'—'}</td><td className="px-3 py-3">{event.configSource==='firestore'?'Firestore':event.configSource==='defaults'?'Défaut':'Ancien log'}</td><td className="px-3 py-3">{event.keyAlias||'—'}</td><td className="px-3 py-3">{event.outcome==='success'?'Succès':'Échec · '+(event.errorCategory||event.status||'erreur')}</td><td className="px-3 py-3">{event.latencyMs?event.latencyMs+' ms':'—'}</td><td className="px-3 py-3">{event.failovers}</td></tr>)}</tbody></table></div>}<div className="flex items-center justify-between border-t border-slate-100 p-4"><span className="text-xs text-slate-500">Page {eventPage} / {eventPages}</span><div className="flex gap-2"><button type="button" onClick={()=>setEventPage(p=>Math.max(1,p-1))} disabled={eventPage===1} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Précédent</button><button type="button" onClick={()=>setEventPage(p=>Math.min(eventPages,p+1))} disabled={eventPage===eventPages} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">Suivant</button></div></div></section>}
  </section>;
}
