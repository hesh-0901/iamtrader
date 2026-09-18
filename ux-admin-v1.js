/* IAMTRADER ADMIN V1 — read-only control center */
import { getAdminData } from './firebase-client.js';

function adminEsc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function adminMoney(v){return Number(v||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD'}
function adminFormatDate(v){if(!v)return '—';const d=v?.toDate?v.toDate():new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('fr-FR')}
function adminStat(label,value,sub){return `<div class="card admin-stat"><small>${label}</small><strong>${value}</strong><span>${sub}</span></div>`}

export async function renderAdminPage({icon,toast,mount=document.querySelector('#app')}){
  const root=document.createElement('div');
  root.className='admin-console-shell';
  root.innerHTML=`
    <div class="admin-console-nav"><button class="admin-console-brand" data-admin-home><span>↗</span>IAM<span>TRADER</span></button><div class="admin-console-nav-title"><small>IAMTRADER</small><b>ADMIN CONSOLE</b></div><div class="admin-console-user"><i></i><span>ADMINISTRATEUR</span></div></div>
    <div class="admin-page">
    <div class="admin-head">
      <div>
        <span class="eyebrow">CONTROL CENTER</span>
        <h2>Administration IAMTRADER</h2>
        <p>Vue centrale des utilisateurs, accès, comptes et activité de la plateforme.</p>
      </div>
      <div class="admin-actions">
        <span class="admin-badge"><i></i> ADMINISTRATEUR</span>
        <button class="btn ghost small" data-admin-refresh>${icon('upload',15)} Actualiser</button>
      </div>
    </div>
    <div class="admin-stats" data-admin-stats>
      ${adminStat('Utilisateurs','—','Chargement')}
      ${adminStat('Comptes trading','—','Chargement')}
      ${adminStat('Trades','—','Chargement')}
      ${adminStat('Demandes Community','—','Chargement')}
    </div>
    <div class="admin-grid">
      <section class="card admin-card">
        <div class="admin-card-head"><h3>Utilisateurs</h3><span data-admin-user-count></span></div>
        <div data-admin-users class="admin-empty">Chargement des données…</div>
      </section>
      <section class="card admin-card">
        <div class="admin-card-head"><h3>Demandes Community</h3><span>Accès contrôlé</span></div>
        <div data-admin-requests class="admin-list"></div>
      </section>
    </div>
    <div class="admin-note"><b>Sécurité :</b> ce panneau est protégé par le custom claim Firebase <code>admin: true</code>. Les opérations sensibles comme l'attribution d'un rôle admin ou la gestion des comptes Auth restent côté serveur.</div>
    </div>
  `;
  const mountRoot=()=>{
    (mount||document.querySelector('#app'))?.replaceChildren(root);
    load();
  };
  async function load(){
    const stats=root.querySelector('[data-admin-stats]');
    try{
      const data=await getAdminData();
      const users=data.users||[],accounts=data.accounts||[],trades=data.trades||[],requests=data.communityRequests||[];
      const active=users.filter(u=>u.status==='active').length;
      const pending=requests.filter(r=>r.status==='pending').length;
      stats.innerHTML=[
        adminStat('Utilisateurs',users.length,active+' actifs'),
        adminStat('Comptes trading',accounts.length,'Tous les comptes'),
        adminStat('Trades',trades.length,'Toutes les opérations'),
        adminStat('Demandes Community',pending,pending+' en attente')
      ].join('');
      root.querySelector('[data-admin-user-count]').textContent=users.length+' profil(s)';
      root.querySelector('[data-admin-users]').innerHTML=users.length?`
        <div style="overflow:auto"><table class="admin-table">
          <thead><tr><th>Trader</th><th>Plan</th><th>Statut</th><th>Inscription</th></tr></thead>
          <tbody>${users.slice().sort((a,b)=>String(a.firstName||'').localeCompare(String(b.firstName||''))).map(u=>`
            <tr>
              <td><strong>${adminEsc(u.firstName||u.username||'—')}</strong><br><span class="mono">${adminEsc(u.username||'')}</span></td>
              <td><span class="admin-pill ${u.plan==='community'?'green':''}">${adminEsc(u.plan||'free')}</span></td>
              <td><span class="admin-pill">${adminEsc(u.status||'—')}</span></td>
              <td class="mono">${adminFormatDate(u.createdAt)}</td>
            </tr>`).join('')}</tbody>
        </table></div>`:'<div class="admin-empty">Aucun utilisateur.</div>';
      root.querySelector('[data-admin-requests]').innerHTML=requests.length?requests.slice().sort((a,b)=>String(a.status).localeCompare(String(b.status))).map(r=>`
        <div class="admin-list-row">
          <div><b>${adminEsc(r.firstName||r.uid||'—')}</b><small>${adminEsc(r.status||'pending')} · ${adminFormatDate(r.createdAt)}</small></div>
          <span class="admin-pill ${r.status==='pending'?'green':''}">${adminEsc(r.requestedPlan||'community')}</span>
        </div>`).join(''):'<div class="admin-empty">Aucune demande.</div>';
    }catch(error){
      root.querySelector('[data-admin-users]').innerHTML='<div class="admin-empty">Accès administrateur requis ou données indisponibles.</div>';
      toast(error?.message||'Impossible de charger les données administrateur.');
    }
  }
  root.querySelector('[data-admin-refresh]').onclick=load;
  root.querySelector('[data-admin-home]').onclick=()=>{location.hash='#home-settings'};
  mountRoot();
}
