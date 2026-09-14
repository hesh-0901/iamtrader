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
