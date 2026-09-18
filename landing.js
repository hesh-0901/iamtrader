/* IAMTRADER PUBLIC EXPERIENCE — landing + account creation */
const app=document.querySelector('#app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plans={
 free:{name:'Free',price:'0 $',period:'sans limite',desc:'Pour commencer à structurer votre journal de trading.'},
 pro:{name:'Pro',price:'5 $',period:'par mois',desc:'Pour les traders qui veulent exploiter leur Journal au quotidien.'},
 community:{name:'Community',price:'20 $',period:'6 mois',desc:'Accès complet à l’écosystème IAMTRADER pour les membres approuvés.'}
};
function brand(){return '<a class="lp-brand" href="#"><span class="lp-mark">↗</span>IAM<span>TRADER</span></a>'}
function landing(){
app.innerHTML=`<div class="lp-page">
<header class="lp-nav lp-container"><div>${brand()}</div>
<nav class="lp-navlinks"><a href="#features">Plateforme</a><a href="#method">Méthode</a><a href="#plans">Plans</a></nav>
<div class="lp-nav-actions"><button class="lp-btn ghost" data-login>Se connecter</button><button class="lp-btn primary" data-register="free">Créer un compte</button></div></header>
<main>
<section class="lp-hero"><div class="lp-container lp-hero-grid"><div class="lp-hero-copy">
<span class="lp-eyebrow">TRADING PERFORMANCE SYSTEM</span>
<h1>Transformez vos trades en <em>progression.</em></h1>
<p>IAMTRADER centralise votre Journal, votre discipline et les outils d’analyse dont vous avez besoin pour mieux comprendre votre trading.</p>
<div class="lp-hero-actions"><button class="lp-btn primary large" data-register="free">Commencer gratuitement</button><a class="lp-btn ghost large" href="#features">Voir la plateforme</a></div>
<div class="lp-proof"><div><b>01</b><span>Journal structuré</span></div><div><b>02</b><span>Analyse intelligente</span></div><div><b>03</b><span>Progression mesurable</span></div></div>
</div>
<div class="lp-hero-panel"><div class="lp-panel-top"><span>IAMTRADER</span><b>ESPACE TRADER</b></div><div class="lp-panel-title"><div><small>VUE D’ENSEMBLE</small><h3>Votre trading, en un seul espace.</h3></div><span class="lp-live">● ACTIF</span></div>
<div class="lp-panel-grid"><div><small>JOURNAL</small><b>128</b><span>trades enregistrés</span></div><div><small>WIN RATE</small><b>62.4%</b><span>performance observée</span></div><div><small>TRADER SCORE</small><b>84<span>/100</span></b><span>discipline & exécution</span></div></div>
<div class="lp-module-list"><div><i>01</i><span>Journal</span><b>Personnel</b></div><div><i>02</i><span>Analyses des membres</span><b>Community</b></div><div><i>03</i><span>Biais Daily</span><b>Community</b></div><div><i>04</i><span>Actu & Analyse Fonda</span><b>Community</b></div></div>
</div></div></section>
<section class="lp-strip"><div class="lp-container lp-strip-grid"><div class="lp-strip-item"><b>Journal</b><span>Chaque décision, chaque résultat.</span></div><div class="lp-strip-item"><b>Analyse</b><span>Comprendre ce que vos données disent.</span></div><div class="lp-strip-item"><b>Intelligence</b><span>Un environnement pensé pour trader.</span></div><div class="lp-strip-item"><b>Progression</b><span>Mesurer pour mieux évoluer.</span></div></div></section>
<section class="lp-section" id="features"><div class="lp-container"><div class="lp-section-head"><span class="lp-eyebrow">LA PLATEFORME</span><h2>Un accès. Plusieurs niveaux d’intelligence.</h2><p>Le Journal constitue le socle. Les membres Community débloquent l’ensemble des modules IAMTRADER.</p></div>
<div class="lp-features lp-feature-grid-new">
<article class="lp-feature lp-feature-main"><div class="lp-icon">01</div><h3>Journal</h3><p>Trades, Track Record, psychologie, performance et calendrier réunis dans un même espace.</p><span class="lp-feature-tag">FREE · PRO · COMMUNITY</span></article>
<article class="lp-feature"><div class="lp-icon">02</div><h3>Analyses des membres</h3><p>Une lecture approfondie des données et comportements des traders.</p><span class="lp-feature-tag">COMMUNITY</span></article>
<article class="lp-feature"><div class="lp-icon">03</div><h3>Analyse IAMTRADER</h3><p>Une vision agrégée des tendances et données de la communauté.</p><span class="lp-feature-tag">COMMUNITY</span></article>
<article class="lp-feature"><div class="lp-icon">04</div><h3>Biais Daily</h3><p>Préparation quotidienne du marché, contexte HTF et scénarios.</p><span class="lp-feature-tag">COMMUNITY</span></article>
<article class="lp-feature"><div class="lp-icon">05</div><h3>Actu & Analyse Fonda</h3><p>Actualités économiques et lecture macro pour préparer les sessions.</p><span class="lp-feature-tag">COMMUNITY</span></article>
<article class="lp-feature"><div class="lp-icon">06</div><h3>Indicateurs TradingView</h3><p>Les outils TradingView IAMTRADER réunis dans votre espace.</p><span class="lp-feature-tag">COMMUNITY</span></article>
</div></div></section>
<section class="lp-section soft" id="method"><div class="lp-container"><div class="lp-section-head"><span class="lp-eyebrow">LA LOGIQUE IAMTRADER</span><h2>Un parcours simple.</h2><p>Le produit est organisé autour de votre pratique réelle du trading.</p></div><div class="lp-flow">
<div class="lp-step"><span class="lp-step-num">01</span><h3>Enregistrer</h3><p>Documentez vos décisions dans le Journal sans alourdir votre routine.</p></div>
<div class="lp-step"><span class="lp-step-num">02</span><h3>Observer</h3><p>Retrouvez vos résultats, votre comportement et vos habitudes.</p></div>
<div class="lp-step"><span class="lp-step-num">03</span><h3>Analyser</h3><p>Utilisez les outils IAMTRADER pour donner du contexte à vos données.</p></div>
<div class="lp-step"><span class="lp-step-num">04</span><h3>Progresser</h3><p>Transformez les observations en décisions de trading plus structurées.</p></div>
</div></div></section>
<section class="lp-plans" id="plans"><div class="lp-container"><div class="lp-section-head"><span class="lp-eyebrow">PLANS IAMTRADER</span><h2>Choisissez votre niveau d’accès.</h2><p>Le niveau Community est réservé aux membres approuvés par l’administration.</p></div><div class="lp-plan-grid">
<article class="lp-plan"><span class="lp-plan-kicker">POUR COMMENCER</span><h3>Free</h3><div class="lp-plan-price"><b>0 $</b><span>/ ${plans.free.period}</span></div><p class="lp-plan-description">${plans.free.desc}</p><ul class="lp-plan-list"><li>Remplir le Journal</li><li>Enregistrer vos trades</li><li>Conserver vos données de trading</li></ul><button class="lp-btn ghost" data-register="free">Créer mon compte</button></article>
<article class="lp-plan featured"><span class="lp-plan-badge">PRO</span><span class="lp-plan-kicker">POUR TRADER AU QUOTIDIEN</span><h3>Pro</h3><div class="lp-plan-price"><b>5 $</b><span>/ mois</span></div><p class="lp-plan-description">${plans.pro.desc}</p><ul class="lp-plan-list"><li>Tout le Journal</li><li>Gestion des comptes</li><li>Accès aux Paramètres</li></ul><button class="lp-btn primary" data-register="pro">Choisir Pro</button></article>
<article class="lp-plan"><span class="lp-plan-kicker">POUR LES MEMBRES</span><h3>Community</h3><div class="lp-plan-price"><b>20 $</b><span>/ 6 mois</span></div><p class="lp-plan-description">${plans.community.desc}</p><ul class="lp-plan-list"><li>Tout le Journal</li><li>Tous les modules IAMTRADER</li><li>Accès aux analyses et outils</li><li>Code membre délivré par l’Admin</li></ul><button class="lp-btn dark" data-register="community">Demander l’accès</button></article>
</div><p class="lp-community-note">Le code membre est délivré par l’administration lors de l’approbation du parcours Community.</p></div></section>
<section class="lp-final"><div class="lp-container"><div class="lp-final-box"><span class="lp-eyebrow">IAMTRADER</span><h2>Commencez par votre Journal.</h2><p>Créez votre espace gratuitement. Votre niveau d’accès pourra évoluer ensuite.</p><button class="lp-btn primary large" data-register="free">Créer mon espace →</button></div></div></section>
</main><footer class="lp-footer"><div class="lp-container lp-footer-inner"><span>© 2026 <b>IAMTRADER</b></span><span>PLAN · TRADE · ANALYSE · PROGRÈS</span></div></footer></div>`;
bindLanding();
}
function authScreen(plan='free'){
const p=plans[plan]||plans.free;
app.innerHTML=`<div class="lp-auth-page"><div class="lp-auth-layout"><div class="lp-auth-brand">${brand()}<span>ESPACE MEMBRE</span></div><div class="lp-auth-card">
<div class="lp-auth-head"><span class="lp-eyebrow">CRÉER VOTRE COMPTE</span><h1>Commencez simplement.</h1><p>Votre compte vous donne accès à votre espace IAMTRADER. Les fonctionnalités disponibles dépendent de votre plan.</p></div>
<div class="lp-auth-plan"><div><small>PLAN SÉLECTIONNÉ</small><b>${p.name}</b></div><strong>${p.price}<small> · ${p.period}</small></strong></div>
<div class="lp-auth-message" id="authMessage"></div>
<form class="lp-form" id="registerForm">
<div class="lp-field"><label>Prénom</label><input name="firstName" autocomplete="given-name" placeholder="Votre prénom" required></div>
<div class="lp-field"><label>Mot de passe</label><input name="password" type="password" autocomplete="new-password" minlength="6" placeholder="Minimum 6 caractères" required></div>
<div class="lp-field"><label>Confirmation</label><input name="confirmPassword" type="password" autocomplete="new-password" placeholder="Retapez votre mot de passe" required></div>
${plan==='community'?'<div class="lp-code-box"><b>Parcours Community</b><p>Votre demande peut être enregistrée avant l’activation. Le code membre est délivré uniquement par l’administration après approbation.</p></div><div class="lp-field"><label>Code membre <span>(si déjà reçu)</span></label><input name="memberCode" placeholder="Code fourni par l’Admin"></div>':''}
<div class="lp-auth-actions"><button type="button" class="lp-btn ghost" data-back>Retour</button><button class="lp-btn primary" type="submit">${plan==='community'?'Envoyer ma demande':'Créer mon compte'}</button></div>
</form><div class="lp-auth-footer"><span>Déjà un compte ?</span><button data-login>Se connecter</button></div></div>
<div class="lp-auth-side"><span class="lp-eyebrow">VOTRE ESPACE</span><h2>${plan==='community'?'Un environnement complet pour les membres.':plan==='pro'?'Un Journal plus structuré pour votre routine.':'Commencez par documenter vos décisions.'}</h2><div class="lp-auth-side-list"><span>✓ Compte personnel</span><span>✓ Données organisées par trader</span><span>✓ Accès contrôlé selon votre plan</span><span>✓ Évolution possible vers un niveau supérieur</span></div></div></div></div>`;
const form=document.querySelector('#registerForm');
form.onsubmit=e=>{e.preventDefault();const f=new FormData(form),first=String(f.get('firstName')).trim(),pw=String(f.get('password')),cp=String(f.get('confirmPassword'));const msg=document.querySelector('#authMessage');if(pw!==cp){msg.textContent='Les mots de passe ne correspondent pas.';msg.className='lp-auth-message show error';return}if(first.length<2){msg.textContent='Veuillez renseigner un prénom valide.';msg.className='lp-auth-message show error';return}msg.textContent=plan==='community'?'Demande préparée. La validation Community sera effectuée par l’administration.':'Votre compte est prêt à être connecté à IAMTRADER.';msg.className='lp-auth-message show success';};
document.querySelector('[data-back]').onclick=()=>{location.hash='';landing()};
document.querySelectorAll('[data-login]').forEach(b=>b.onclick=()=>authScreen('free'));
}
function bindLanding(){
document.querySelectorAll('[data-register]').forEach(b=>b.onclick=()=>authScreen(b.dataset.register));
document.querySelectorAll('[data-login]').forEach(b=>b.onclick=()=>authScreen('free'));
}
if(location.hash.startsWith('#register-'))authScreen(location.hash.replace('#register-',''));else if(location.hash!=='#app')landing();
