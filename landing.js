/* IAMTRADER LANDING — public SaaS entry point */
const app=document.querySelector('#app');
const escapeHtml=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
function landing(){
app.innerHTML=`<div class="lp-page">
<header class="lp-nav lp-container">
<a class="lp-brand" href="#"><span class="lp-mark">↗</span>IAM<span>TRADER</span></a>
<nav class="lp-navlinks"><a href="#features">Fonctionnalités</a><a href="#method">Méthode</a><a href="#propfirm">Prop Firm</a></nav>
<div class="lp-nav-actions"><button class="lp-btn ghost" data-app>Se connecter</button><button class="lp-btn primary" data-app>Commencer gratuitement</button></div>
</header>
<main>
<section class="lp-hero"><div class="lp-container lp-hero-grid"><div>
<span class="lp-eyebrow">TRADING PERFORMANCE SYSTEM</span>
<h1>Ne vous contentez plus de <em>trader.</em><br>Progressez.</h1>
<p>IAMTRADER accompagne votre trading de la préparation à l’analyse : plan, risque, performance et progression réunis dans un seul espace.</p>
<div class="lp-hero-actions"><button class="lp-btn primary large" data-app>Commencer gratuitement →</button><a class="lp-btn ghost large" href="#features">Découvrir la plateforme</a></div>
<div class="lp-proof"><div><b>PLAN</b><span>Préparez vos sessions</span></div><div><b>RISK</b><span>Contrôlez votre exposition</span></div><div><b>GROW</b><span>Mesurez votre progression</span></div></div>
</div>
<div class="lp-mock" aria-label="Aperçu du tableau de bord IAMTRADER"><div class="lp-window"><div class="lp-window-top"><i class="lp-dot"></i><i class="lp-dot"></i><i class="lp-dot"></i><span class="lp-window-title">iamtrader · performance</span></div><div class="lp-dash"><div class="lp-dash-head"><b>Vue d'ensemble</b><span>Compte actif · Prop Firm</span></div><div class="lp-kpis"><div class="lp-kpi"><span>EQUITY</span><b>$10,842</b></div><div class="lp-kpi"><span>P&L TOTAL</span><b class="green">+$842</b></div><div class="lp-kpi"><span>TRADER SCORE</span><b>82 / 100</b></div></div><div class="lp-chart-card"><div class="lp-chart-head"><span>COURBE D'EQUITY</span><b>+8.42%</b></div><div class="lp-chart"><svg viewBox="0 0 600 160" preserveAspectRatio="none"><path d="M0 125 C45 120 62 133 105 111 S170 115 205 90 S268 104 304 77 S360 82 397 55 S460 72 500 39 S548 48 600 21"/><circle cx="600" cy="21" r="5"/></svg></div></div><div class="lp-mini-grid"><div class="lp-mini"><span>RISQUE MOYEN</span><b>0.48%</b></div><div class="lp-mini"><span>WIN RATE</span><b>61.4%</b></div></div></div></div></div>
</div></section>
<section class="lp-strip"><div class="lp-container lp-strip-grid"><div class="lp-strip-item"><b>Risk-first</b><span>Le risque avant le résultat</span></div><div class="lp-strip-item"><b>Multi-comptes</b><span>Un seul cockpit pour votre capital</span></div><div class="lp-strip-item"><b>Performance</b><span>Comprenez vos vrais chiffres</span></div><div class="lp-strip-item"><b>Progression</b><span>Transformez vos données en actions</span></div></div></section>
<section class="lp-section" id="features"><div class="lp-container"><div class="lp-section-head"><span class="lp-eyebrow">UN SYSTÈME, PAS UN SIMPLE JOURNAL</span><h2>Tout ce qu'il faut pour piloter votre trading.</h2><p>Chaque module répond à une étape concrète du parcours du trader, sans multiplier les écrans inutiles.</p></div><div class="lp-features">
<article class="lp-feature"><div class="lp-icon">◉</div><h3>Risk Manager</h3><p>Calculez votre taille de position, votre risque réel et surveillez vos limites avant qu'elles ne deviennent un problème.</p></article>
<article class="lp-feature"><div class="lp-icon">↗</div><h3>Performance Analytics</h3><p>Identifiez ce qui fonctionne réellement dans votre trading et les situations qui dégradent vos résultats.</p></article>
<article class="lp-feature"><div class="lp-icon">★</div><h3>Trader Score</h3><p>Suivez la qualité de votre exécution, votre discipline et votre régularité au fil du temps.</p></article>
<article class="lp-feature"><div class="lp-icon">◎</div><h3>Trading Plan</h3><p>Définissez votre cadre et préparez chaque session avec des règles simples et mesurables.</p></article>
<article class="lp-feature"><div class="lp-icon">▣</div><h3>Prop Firm Center</h3><p>Gardez sous contrôle objectif, drawdown, perte journalière et progression de vos challenges.</p></article>
<article class="lp-feature"><div class="lp-icon">↻</div><h3>Weekly Review</h3><p>Terminez la semaine avec une lecture claire de vos résultats et des points à travailler ensuite.</p></article>
</div></div></section>
<section class="lp-section soft" id="method"><div class="lp-container"><div class="lp-section-head"><span class="lp-eyebrow">VOTRE BOUCLE DE PROGRESSION</span><h2>Préparer. Trader. Comprendre. Progresser.</h2><p>IAMTRADER accompagne le trader dans le temps, au lieu de simplement stocker ses opérations.</p></div><div class="lp-flow">
<div class="lp-step"><span class="lp-step-num">01</span><h3>Préparer</h3><p>Définissez votre scénario, vos limites et votre risque avant la session.</p></div>
<div class="lp-step"><span class="lp-step-num">02</span><h3>Exécuter</h3><p>Tradez dans votre cadre et gardez une vision claire de votre exposition.</p></div>
<div class="lp-step"><span class="lp-step-num">03</span><h3>Comprendre</h3><p>Analysez vos résultats, vos habitudes et vos conditions de performance.</p></div>
<div class="lp-step"><span class="lp-step-num">04</span><h3>Progresser</h3><p>Transformez les constats de la semaine en objectifs concrets pour la suivante.</p></div>
</div></div></section>
<section class="lp-section" id="propfirm"><div class="lp-container"><div class="lp-prop"><div><span class="lp-eyebrow">PROP FIRM READY</span><h2>Votre challenge. Vos règles. Votre contrôle.</h2><p>Suivez votre capital, vos limites de perte et votre progression depuis un espace conçu pour prendre de meilleures décisions de risque.</p></div><div class="lp-prop-card"><div class="lp-prop-card-head"><b>Challenge · 10K</b><span class="lp-status">SOUS CONTRÔLE</span></div><div class="lp-progress"><i></i></div><div class="lp-prop-meta"><span>+6.8% / +8.0%</span><span>Drawdown 2.1%</span></div></div></div></div></section>
<section class="lp-final"><div class="lp-container"><div class="lp-final-box"><span class="lp-eyebrow">IAMTRADER</span><h2>Construisez un trading plus maîtrisé.</h2><p>Commencez avec les outils essentiels. Laissez vos données construire votre progression au fil du temps.</p><button class="lp-btn primary large" data-app>Entrer dans IAMTRADER →</button></div></div></section>
</main>
<footer class="lp-footer"><div class="lp-container lp-footer-inner"><span>© 2026 <b>IAMTRADER</b></span><span>PLAN • TRADE • ANALYSE • PROGRÈS</span></div></footer>
</div>`;
document.querySelectorAll('[data-app]').forEach(b=>b.addEventListener('click',()=>{location.hash='app';location.reload()}));
}
if(location.hash!=='#app') landing();
