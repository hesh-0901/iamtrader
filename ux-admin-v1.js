/* IAMTRADER ADMIN V1 — read-only control center */
import { getAdminData } from './admin-data-client.js';
import { adminAction } from './admin-actions-client.js';

function adminEsc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function adminMoney(v){return Number(v||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD'}
function adminFormatDate(v){if(!v)return '—';const d=v?.toDate?v.toDate():new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('fr-FR')}
function adminStat(label,value,sub){return `<div class="card admin-stat"><small>${label}</small><strong>${value}</strong><span>${sub}</span></div>`}

export async function renderAdminPage({icon,toast,mount=document.querySelector('#app')}) {
  const root=document.createElement('div');
  root.className='admin-console-shell';
  root.innerHTML=`
    <div class="admin-console-nav">
      <button class="admin-console-brand" data-admin-home><span>↗</span>IAM<span>TRADER</span></button>
      <div class="admin-console-nav-title"><small>IAMTRADER</small><b>ADMIN CONSOLE</b></div>
      <div class="admin-console-user"><i></i><span>ADMINISTRATEUR</span></div>
    </div>
    <div class="admin-page">
      <div class="admin-head">
        <div>
          <span class="eyebrow">CONTROL CENTER</span>
          <h2>Administration IAMTRADER</h2>
          <p>Vue centrale des utilisateurs, accès, comptes et activité de la plateforme.</p>
        </div>
        <div class="admin-actions">
          <button class="admin-back-link" data-admin-home>${icon('arrow-left',14)} <span>Retour</span></button>
          <span class="admin-badge"><i></i> ADMINISTRATEUR</span>
          <button class="btn ghost small admin-refresh-btn" data-admin-refresh>${icon('upload',15)} Actualiser</button>
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

      <section class="admin-modules">
        <div class="admin-module-head"><div><span class="admin-panel-kicker">OPERATIONS</span><h2>Centre de pilotage</h2><p>Les indicateurs essentiels de la plateforme, réunis dans un espace compact.</p></div></div>
        <div class="admin-module-grid">
          <article class="admin-module-card"><div class="admin-module-icon">↗</div><span>COMPTES TRADING</span><strong data-module-accounts>—</strong><small>comptes enregistrés</small></article>
          <article class="admin-module-card"><div class="admin-module-icon">◔</div><span>ACTIVITÉ</span><strong data-module-trades>—</strong><small>opérations enregistrées</small></article>
          <article class="admin-module-card"><div class="admin-module-icon">◆</div><span>COMMUNITY</span><strong data-module-pending>—</strong><small>demandes en attente</small></article>
          <article class="admin-module-card"><div class="admin-module-icon">✓</div><span>SÉCURITÉ</span><strong>ACTIVE</strong><small>protection administrateur</small></article>
        </div>
      </section>

      <div class="admin-note"><b>Sécurité :</b> ce panneau est protégé par le custom claim Firebase <code>admin: true</code>. Les opérations sensibles restent côté serveur.</div>
    </div>

    <div class="admin-modal-backdrop" data-admin-modal hidden>
      <div class="admin-modal" role="dialog" aria-modal="true">
        <div class="admin-modal-head">
          <div><span class="eyebrow">ADMINISTRATION</span><h3 data-admin-modal-title></h3></div>
          <button class="admin-modal-close" data-admin-modal-close aria-label="Fermer">×</button>
        </div>
        <div data-admin-modal-body></div>
      </div>
    </div>
  `;

  const mountRoot=()=>{
    const page=root.querySelector('.admin-page');
    if(page && !root.querySelector('.admin-premium-sidebar')){
      const sidebar=document.createElement('aside');
      sidebar.className='admin-premium-sidebar';
      sidebar.innerHTML=`
        <div class="admin-sidebar-label">WORKSPACE</div>
        <button class="admin-nav-item active" data-admin-section="overview"><span class="admin-nav-icon">⌂</span><span>Vue d’ensemble</span></button>
        <button class="admin-nav-item" data-admin-section="users"><span class="admin-nav-icon">◉</span><span>Utilisateurs</span><em data-side-users>—</em></button>
        <button class="admin-nav-item" data-admin-section="community"><span class="admin-nav-icon">◇</span><span>Community</span><em data-side-community>—</em></button>
        <button class="admin-nav-item" data-admin-section="accounts"><span class="admin-nav-icon">◈</span><span>Comptes trading</span><em data-side-accounts>—</em></button>
        <button class="admin-nav-item" data-admin-section="activity"><span class="admin-nav-icon">◌</span><span>Activité</span><em data-side-trades>—</em></button>
        <div class="admin-sidebar-spacer"></div>
        <div class="admin-sidebar-status"><span class="admin-system-dot"></span><div><b>Système opérationnel</b><small>IAMTRADER Cloud</small></div></div>
        <button class="admin-return-minimal" data-admin-home>← Retour à IAMTRADER</button>`;
      root.insertBefore(sidebar,page);
      const grid=page.querySelector('.admin-grid');
      if(grid){
        const progress=document.createElement('section');
        progress.className='admin-progress-card';
        progress.innerHTML=`
          <div class="admin-progress-head"><div><span class="admin-eyebrow">CROISSANCE</span><h3>Progression de la plateforme</h3><p>Nouvelles inscriptions au fil du temps</p></div><span class="admin-period-chip">30 JOURS</span></div>
          <div class="admin-growth-chart" data-growth-chart></div>`;
        grid.parentNode.insertBefore(progress,grid);
      }
    }
    (mount||document.querySelector('#app'))?.replaceChildren(root);
    bind();
    load();
  };

  const closeModal=()=>{
    const modal=root.querySelector('[data-admin-modal]');
    if(modal) modal.hidden=true;
  };

  const openModal=(title,body)=>{
    root.querySelector('[data-admin-modal-title]').textContent=title;
    root.querySelector('[data-admin-modal-body]').innerHTML=body;
    root.querySelector('[data-admin-modal]').hidden=false;
  };

  const confirmAction=async(message,action)=>{
    if(!window.confirm(message)) return;
    try{
      await action();
      toast('Opération effectuée.');
      closeModal();
      await load();
    }catch(error){
      console.error('IAMTRADER admin action',error);
      toast(error?.message||'Opération impossible.');
    }
  };

  function userActions(u){
    const uid=adminEsc(u.uid||'');
    return `
      <details class="admin-action-menu">
        <summary><span>Gérer</span><b>⋯</b></summary>
        <div class="admin-action-popover">
          <button data-action="profile" data-uid="${uid}"><span>Voir le profil</span></button>
          <button data-action="plan" data-uid="${uid}"><span>Modifier le plan</span></button>
          <button data-action="status" data-uid="${uid}"><span>${u.status==='active'?'Suspendre l’accès':'Réactiver l’accès'}</span></button>
          <button data-action="admin" data-uid="${uid}"><span>${u.role==='admin'?'Retirer les droits admin':'Attribuer les droits admin'}</span></button>
          <button data-action="reset" data-uid="${uid}"><span>Réinitialiser le mot de passe</span></button>
          <div class="admin-action-divider"></div>
          <button class="danger" data-action="delete" data-uid="${uid}"><span>Supprimer l’utilisateur</span></button>
        </div>
      </details>`;
  }

  async function handleUserAction(action,uid){
    const user=(root._adminData?.users||[]).find(u=>String(u.uid)===String(uid));
    if(!user) return;

    if(action==='profile'){
      const accounts=(root._adminData?.accounts||[]).filter(a=>String(a.uid)===String(uid));
      const trades=(root._adminData?.trades||[]).filter(t=>String(t.uid)===String(uid));
      openModal('Profil utilisateur',`
        <div class="admin-profile-grid">
          <div><small>Trader</small><strong>${adminEsc(user.firstName||user.username||'—')}</strong></div>
          <div><small>Username</small><strong>${adminEsc(user.username||'—')}</strong></div>
          <div><small>UID</small><code>${adminEsc(user.uid||'—')}</code></div>
          <div><small>Plan</small><strong>${adminEsc(user.plan||'free')}</strong></div>
          <div><small>Statut</small><strong>${adminEsc(user.status||'—')}</strong></div>
          <div><small>Inscription</small><strong>${adminFormatDate(user.createdAt)}</strong></div>
          <div><small>Comptes trading</small><strong>${accounts.length}</strong></div>
          <div><small>Trades</small><strong>${trades.length}</strong></div>
        </div>
        <div class="admin-modal-footer"><button class="btn ghost small" data-admin-modal-close>Fermer</button></div>
      `);
      return;
    }

    if(action==='plan'){
      openModal('Modifier le plan',`
        <div class="admin-form">
          <label>Nouveau plan<select data-action-value>
            <option value="free" ${user.plan==='free'?'selected':''}>Free</option>
            <option value="community" ${user.plan==='community'?'selected':''}>Community</option>
            <option value="pro" ${user.plan==='pro'?'selected':''}>Pro</option>
          </select></label>
          <button class="btn primary" data-submit-action>Enregistrer</button>
        </div>`);
      root.querySelector('[data-submit-action]').onclick=()=>confirmAction('Modifier le plan de cet utilisateur ?',()=>adminAction('update-plan',{uid,plan:root.querySelector('[data-action-value]').value}));
      return;
    }

    if(action==='status'){
      const enabled=user.status!=='active';
      await confirmAction(enabled?'Réactiver l’accès à cet utilisateur ?':'Suspendre l’accès à cet utilisateur ?',()=>adminAction('set-status',{uid,status:enabled?'active':'suspended'}));
      return;
    }

    if(action==='admin'){
      const enabled=user.role!=='admin';
      await confirmAction(enabled?'Attribuer les droits administrateur ?':'Retirer les droits administrateur ?',()=>adminAction('set-admin',{uid,enabled}));
      return;
    }

    if(action==='reset'){
      await confirmAction('Envoyer un lien de réinitialisation du mot de passe à cet utilisateur ?',()=>adminAction('reset-password',{uid}));
      return;
    }

    if(action==='delete'){
      await confirmAction('Cette suppression est définitive. Supprimer cet utilisateur et ses données associées ?',()=>adminAction('delete-user',{uid}));
    }
  }

  async function handleCommunityAction(action,uid){
    const label=action==='approve'?'Approuver cette demande Community ?':'Refuser cette demande Community ?';
    await confirmAction(label,()=>adminAction('community-request',{uid,status:action==='approve'?'approved':'rejected'}));
  }

  function bind(){
    root.querySelector('[data-admin-refresh]').onclick=load;
    root.querySelector('[data-admin-home]').onclick=()=>{location.hash='#home-settings'};
    root.querySelector('[data-admin-modal-close]').onclick=closeModal;
    root.querySelector('[data-admin-modal]').addEventListener('click',e=>{
      if(e.target.matches('[data-admin-modal]')||e.target.closest('[data-admin-modal-close]')) closeModal();
    });
    root.querySelectorAll('.admin-action-menu').forEach(menu=>{
      menu.addEventListener('toggle',()=>{
        if(!menu.open) return;
        root.querySelectorAll('.admin-action-menu[open]').forEach(other=>{if(other!==menu)other.open=false;});
        const summary=menu.querySelector('summary');
        const popover=menu.querySelector('.admin-action-popover');
        if(!summary||!popover)return;
        const r=summary.getBoundingClientRect();
        const width=205;
        const gap=7;
        const left=Math.min(Math.max(10,r.right-width),window.innerWidth-width-10);
        const top=r.bottom+gap;
        popover.style.left=left+'px';
        popover.style.top=Math.min(top,window.innerHeight-popover.offsetHeight-10)+'px';
      });
    });
    root.addEventListener('click',e=>{
      const menu=e.target.closest('.admin-action-menu');
      if(!menu){
        root.querySelectorAll('.admin-action-menu[open]').forEach(x=>x.open=false);
      }
      const userBtn=e.target.closest('[data-action]');
      if(userBtn){handleUserAction(userBtn.dataset.action,userBtn.dataset.uid);return;}
      const communityBtn=e.target.closest('[data-community-action]');
      if(communityBtn){handleCommunityAction(communityBtn.dataset.communityAction,communityBtn.dataset.uid);}
    });
    root.addEventListener('keydown',e=>{
      if(e.key==='Escape')root.querySelectorAll('.admin-action-menu[open]').forEach(x=>x.open=false);
    });
  }

  async function load(){
    const stats=root.querySelector('[data-admin-stats]');
    try{
      const data=await getAdminData();
      root._adminData=data;
      const users=data.users||[],accounts=data.accounts||[],trades=data.trades||[],requests=data.communityRequests||[];
      const active=users.filter(u=>u.status==='active').length;
      const pending=requests.filter(r=>r.status==='pending').length;
      const chart=root.querySelector('[data-growth-chart]');
      if(chart){
        const days=30,now=new Date(),items=[];
        for(let i=days-1;i>=0;i--){
          const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);
          const n=new Date(d);n.setDate(n.getDate()+1);
          const count=users.filter(u=>{const x=u.createdAt?.toDate?u.createdAt.toDate():new Date(u.createdAt);return !Number.isNaN(x.getTime())&&x>=d&&x<n}).length;
          items.push({d,count});
        }
        const max=Math.max(1,...items.map(x=>x.count));
        chart.innerHTML='<div class="admin-chart-bars">'+items.map(x=>'<div class="admin-bar-col" title="'+adminFormatDate(x.d)+' · '+x.count+' inscription(s)"><span style="height:'+Math.max(7,x.count/max*100)+'%"></span></div>').join('')+'</div><div class="admin-chart-axis"><span>'+adminFormatDate(items[0].d)+'</span><span>'+adminFormatDate(items[14].d)+'</span><span>'+adminFormatDate(items[29].d)+'</span></div>';
      }
      const moduleAccounts=root.querySelector('[data-module-accounts]');
      const moduleTrades=root.querySelector('[data-module-trades]');
      const modulePending=root.querySelector('[data-module-pending]');
      if(moduleAccounts)moduleAccounts.textContent=accounts.length;
      if(moduleTrades)moduleTrades.textContent=trades.length;
      if(modulePending)modulePending.textContent=pending;
      root.querySelector('[data-module-accounts]').textContent=accounts.length;
      root.querySelector('[data-module-trades]').textContent=trades.length;
      root.querySelector('[data-module-pending]').textContent=pending;

      stats.innerHTML=[
        adminStat('Utilisateurs',users.length,active+' actifs'),
        adminStat('Comptes trading',accounts.length,'Tous les comptes'),
        adminStat('Trades',trades.length,'Toutes les opérations'),
        adminStat('Demandes Community',pending,pending+' en attente')
      ].join('');

      root.querySelector('[data-admin-user-count]').textContent=users.length+' profil(s)';
      const sideUsers=root.querySelector('[data-side-users]'); if(sideUsers)sideUsers.textContent=users.length;
      const sideCommunity=root.querySelector('[data-side-community]'); if(sideCommunity)sideCommunity.textContent=pending;
      const sideAccounts=root.querySelector('[data-side-accounts]'); if(sideAccounts)sideAccounts.textContent=accounts.length;
      const sideTrades=root.querySelector('[data-side-trades]'); if(sideTrades)sideTrades.textContent=trades.length;

      root.querySelector('[data-admin-users]').innerHTML=users.length?`
        <div style="overflow:auto"><table class="admin-table">
          <thead><tr><th>Trader</th><th>Plan</th><th>Statut</th><th>Inscription</th><th>Actions</th></tr></thead>
          <tbody>${users.slice().sort((a,b)=>String(a.firstName||'').localeCompare(String(b.firstName||''))).map(u=>`
            <tr>
              <td><strong>${adminEsc(u.firstName||u.username||'—')}</strong><br><span class="mono">${adminEsc(u.username||'')}</span></td>
              <td><span class="admin-pill ${u.plan==='community'?'green':''}">${adminEsc(u.plan||'free')}</span></td>
              <td><span class="admin-pill ${u.status==='active'?'green':''}">${adminEsc(u.status||'—')}</span></td>
              <td class="mono">${adminFormatDate(u.createdAt)}</td>
              <td>${userActions(u)}</td>
            </tr>`).join('')}</tbody>
        </table></div>`:'<div class="admin-empty">Aucun utilisateur.</div>';

      root.querySelector('[data-admin-requests]').innerHTML=requests.length?requests.slice().sort((a,b)=>String(a.status).localeCompare(String(b.status))).map(r=>`
        <div class="admin-list-row">
          <div><b>${adminEsc(r.firstName||r.uid||'—')}</b><small>${adminEsc(r.status||'pending')} · ${adminFormatDate(r.createdAt)}</small></div>
          <div class="admin-request-actions">
            <span class="admin-pill ${r.status==='pending'?'green':''}">${adminEsc(r.requestedPlan||'community')}</span>
            ${r.status==='pending'?'<button class="admin-mini-btn" data-community-action="approve" data-uid="'+adminEsc(r.uid||'')+'">Approuver</button><button class="admin-mini-btn danger" data-community-action="reject" data-uid="'+adminEsc(r.uid||'')+'">Refuser</button>':''}
          </div>
        </div>`).join(''):'<div class="admin-empty">Aucune demande.</div>';

    }catch(error){
      root.querySelector('[data-admin-users]').innerHTML='<div class="admin-empty">Données administrateur indisponibles.</div>';
      root.querySelector('[data-admin-requests]').innerHTML='<div class="admin-empty">Données indisponibles.</div>';
      toast(error?.message||'Impossible de charger les données administrateur.');
    }
  }

  mountRoot();
}
