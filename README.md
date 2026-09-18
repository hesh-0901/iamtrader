# IAMTRADER

Trader Performance Management System — **Minimum Input → Maximum Intelligence**.

## MVP
- Trading accounts and active-account isolation
- Central instrument specifications
- Risk engine and automatic position sizing
- P&L and R-multiple calculations
- Trading journal with search, edit, close and confirmed delete
- Dashboard, performance analytics, psychology and trader score
- Versioned localStorage repository
- No external CDN or mandatory internet dependency

## Local
Serve the repository through a local HTTP server (for example `python -m http.server`) and open `index.html`.

## Architecture
`index.html` → UI shell
`styles.css` → visual system
`app.js` → application state, persistence and rendering
`instruments.js` → single source of instrument specifications
`risk-engine.js` → pure risk and sizing calculations
`performance-engine.js` → pure performance calculations
`psychology-engine.js` → behavior scoring
`score-engine.js` → trader score
`tests/engine-tests.js` → browser-runnable engine tests


## Administration sécurisée

La Console Admin IAMTRADER est protégée par Firebase Authentication et le Custom Claim `admin: true`.
Le champ Firestore `users/{uid}.role = "admin"` sert à l'identité du profil ; il ne remplace pas le Custom Claim.

### Bootstrap du premier administrateur via GitHub

Le dépôt contient le workflow `.github/workflows/bootstrap-admin.yml`.

1. Créer un compte de service Google/Firebase autorisé à gérer Firebase Authentication et Firestore.
2. Dans GitHub : **Settings → Secrets and variables → Actions → New repository secret**.
3. Nom du secret :
   `FIREBASE_SERVICE_ACCOUNT_IAMTRADER`
4. Valeur : le JSON complet du compte de service. Ne jamais le committer dans le dépôt.
5. Dans GitHub : **Actions → IAMTRADER — Bootstrap Admin → Run workflow**.
6. Renseigner le Firebase UID de l'utilisateur à promouvoir.
7. Exécuter le workflow.

Le script ajoute `admin: true` aux Custom Claims Firebase et synchronise `role: "admin"` dans Firestore.

Après l'exécution, l'utilisateur doit se déconnecter puis se reconnecter à IAMTRADER pour obtenir un nouveau token Firebase contenant le claim.

