# IAMTRADER — Architecture du Backtest XAUUSD

**Statut :** plan d'architecture uniquement ; non implémenté et aucun build validé par ce document.

## 1. Audit du code existant

Le Backtest est accessible via l'onglet Community dans `src/pages/CommunityView.tsx` et rendu par `src/pages/BacktestModule.tsx`. Cette intégration doit être conservée.

Fonctions existantes à préserver : replay bougie par bougie, lecture/pause, vitesse et curseur/date ; timeframes M15/H1/D1 agrégés ; ordres virtuels Buy/Sell avec balance, risque %, SL/TP et ratio R/R ; clôture simulée ; métriques P&L, winrate, profit factor et R moyen ; sauvegarde Firestore dans `backtestSessions` ; insertion des trades clôturés au Journal via `addTrade` ; résumé envoyé à Chloé.

**Limite constatée :** `makeDemoCandles()` génère 900 bougies M15 synthétiques à partir d'une date codée en dur. Ce n'est pas un historique réel. Le graphique SVG maison ne fournit pas les interactions avancées d'un terminal charting. Ne pas présenter ces prix comme historiques ni les extrapoler en M1.

## 2. Principes

- Marché initial unique : XAUUSD.
- Priorité à la profondeur réellement disponible, notamment M1, sans annoncer une plage avant de l'avoir vérifiée auprès du fournisseur.
- Aucune donnée synthétique ne doit être mélangée silencieusement aux données réelles.
- Source, fuseau horaire, couverture et état des données visibles dans l'interface.
- Replay sans accès aux bougies futures pour les indicateurs, les ordres ou les statistiques affichées à l'instant rejoué.
- Sessions simulées séparées des trades réels ; l'ajout au Journal doit rester explicite.
- Interface inspirée des conventions de TradingView, sans prétendre copier les composants propriétaires ou les fonctionnalités sous licence.

## 3. Architecture cible

### Interface

- `BacktestModule.tsx` : conteneur et orchestration, en gardant l'onglet Community.
- `backtest/components/ChartWorkspace.tsx` : graphique, symbole, timeframe, état des données.
- `ChartToolbar.tsx` : outils de dessin et options visuelles.
- `ReplayBar.tsx` : date de départ, play/pause, pas-à-pas, vitesse et progression.
- `OrderPanel.tsx` : ordres simulés, taille, risque, SL/TP.
- `IndicatorsPanel.tsx` : catalogue, activation et paramètres.
- `TradeList.tsx` : ordres, positions et trades clôturés.
- `StatisticsPanel.tsx` : statistiques, courbe d'equity et drawdown.
- `SessionControls.tsx` : créer, reprendre, enregistrer et exporter une session.

### Moteur indépendant de l'interface

- `backtest/types.ts` : contrats typés Candle, MarketDataMetadata, Drawing, IndicatorConfig, SimOrder, SimTrade et BacktestSession.
- `backtest/data/marketDataProvider.ts` : fournisseur, pagination, couverture et trous de données.
- `backtest/data/normalizers.ts` : validation OHLC, timestamps et timezone.
- `backtest/engine/replayEngine.ts` : horloge et frontière des bougies visibles.
- `backtest/engine/orderEngine.ts` : exécution simulée, SL/TP et coûts configurables.
- `backtest/engine/indicators/` : calculs purs et testés des indicateurs.
- `backtest/engine/statistics.ts` : P&L, winrate, profit factor, expectancy, R moyen, equity et drawdown.
- `backtest/persistence/backtestRepository.ts` : sessions Firestore appartenant à l'utilisateur.
- `backtest/persistence/sessionMigrations.ts` : compatibilité avec les sessions existantes.
- `backtest/config.ts` : XAUUSD, timeframes autorisés et règles de simulation.

### Moteur de graphique

Évaluer TradingView Lightweight Charts comme option open source, après vérification de licence, attribution, compatibilité et lockfile. Il ne fournit pas à lui seul tout le catalogue d'outils de dessin et d'indicateurs attendu : une couche IAMTRADER restera nécessaire. Ne pas ajouter de dépendance avant d'avoir vérifié le build et les contraintes de déploiement. Ne pas utiliser Advanced Charts/Trading Platform sans vérifier l'éligibilité et les conditions de licence applicables.

## 4. Données historiques : prérequis bloquant

Le code inspecté ne configure aucun fournisseur de données historiques réelles. Il faut comparer les fournisseurs autorisés pour XAUUSD M1 : profondeur disponible, licence de stockage/affichage/replay, coûts, quotas, pagination, fuseau, sessions, trous, spread et qualité des OHLC. Le fournisseur exact reste à choisir ; son nom, sa couverture et ses prix ne doivent pas être inventés.

Architecture recommandée : adaptateur serveur avec clés secrètes dans l'environnement serveur, cache et pagination ; API IAMTRADER renvoyant des chandelles normalisées et des métadonnées de couverture. Si les données réelles ne sont pas configurées, afficher « historique indisponible » ou le mode de démonstration clairement étiqueté « synthétique ». Ne jamais fabriquer des bougies M1 pour combler des lacunes.

## 5. Phases d'implémentation

### Phase 0 — Socle et non-régression
- Isoler explicitement le mode synthétique.
- Conserver replay, ordres virtuels, statistiques, sauvegarde et analyse Chloé.
- Définir les types et tester le calcul du risque, les clôtures SL/TP et les statistiques.
- Corriger la persistance : utiliser les timestamps du replay pour les trades simulés plutôt que l'heure de sauvegarde ; éviter les doubles enregistrements de session.

### Phase 1 — Source réelle
- Sélectionner un fournisseur compatible avec les droits d'usage et le besoin M1.
- Implémenter l'adaptateur, pagination, validation et état de couverture.
- Afficher la plage réellement disponible et les trous détectés.
- Tester erreurs réseau, doublons, timestamps, OHLC invalides et quotas.

### Phase 2 — Graphique
- Remplacer le SVG par un moteur de graphique adapté.
- Thème sombre, chandeliers, volumes lorsqu'ils existent, échelle prix/temps, crosshair, zoom, déplacement, autoscale et navigation historique.
- Timeframes M1, M5, M15, M30, H1, H4 et D1 seulement lorsque l'agrégation ou les données sources les permettent.

### Phase 3 — Dessin
- Ligne horizontale/verticale, ligne de tendance, rayon, rectangle, mesure prix/temps et texte.
- Sélection, déplacement, suppression, verrouillage, annuler/rétablir.
- Sauvegarde des dessins par utilisateur, symbole et session.

### Phase 4 — Indicateurs
- Première série : SMA, EMA, RSI, MACD, Bollinger Bands, ATR et volume ; VWAP seulement avec définition et données nécessaires explicites.
- Paramètres, visibilité, couleurs, superposition ou panneau séparé.
- Calcul incrémental et tests sur valeurs de référence ; aucun accès aux bougies futures.

### Phase 5 — Replay et exécution simulée
- Départ à une date réellement couverte, bougies futures masquées, pas-à-pas, vitesse et reprise.
- Ordres virtuels et niveaux SL/TP affichés, dimensionnement selon le risque, historique des exécutions.
- Une bougie OHLC ne donne pas l'ordre exact des mouvements intrabougie. Si SL et TP sont touchés sur la même bougie sans données plus fines, appliquer une règle conservatrice documentée ; ne pas prétendre à une simulation tick par tick.
- Spread, commission et slippage uniquement comme paramètres explicites ou données fiables.

### Phase 6 — Statistiques et persistance
- Table des trades, equity curve, drawdown, expectancy, profit factor, winrate, gain/perte moyen, R moyen, durée et résultats par période.
- Filtres, comparaison de sessions, export CSV/JSON.
- Sessions séparées des trades réels, contrôle des règles Firestore et migration des sessions existantes. Envisager des sous-collections si les documents deviennent volumineux.
- Chloé reçoit le résumé et la provenance/qualité des données.

### Phase 7 — Validation et déploiement
- Tests unitaires moteur, tests d'intégration API/Firestore et parcours utilisateur.
- Mesurer les performances sur de grandes plages M1, mémoire, pagination, reprise et affichage mobile.
- Vérifier les règles Firestore et l'accès par propriétaire.
- Exécuter `npm run lint`, `npm run build` et les tests disponibles dans un environnement réel ; enregistrer les résultats exacts. Aucun succès ne doit être annoncé avant exécution et confirmation.
- Vérifier ensuite les journaux du déploiement Cloudflare.

## 6. Modèle de données indicatif

- `Candle`: timestamp normalisé, open, high, low, close, volume optionnel.
- `MarketDataMetadata`: fournisseur, symbole, timeframe, période couverte, timezone, date de récupération, indicateur synthétique, trous détectés et notes de licence.
- `BacktestSession`: userId, symbole, timeframe, source et période des données, index de replay, capital initial, paramètres, dessins, indicateurs, ordres/trades, statistiques, dates et schemaVersion.

Le schéma final doit respecter les règles Firestore et limites de taille ; les listes volumineuses pourront être stockées en sous-collections.

## 7. Critères d'acceptation

1. L'accès reste Community → Backtest.
2. Le mode historique n'affiche que des données réelles vérifiées et identifie leur source/couverture.
3. M1 est proposé uniquement si le fournisseur le permet pour la période demandée.
4. Le replay ne révèle pas les bougies futures au graphique, aux indicateurs ou au moteur d'ordres.
5. Les dessins sont créables, éditables, supprimables et persistés.
6. Les indicateurs sont configurables et leurs calculs testés.
7. Les statistiques sont recalculables depuis les trades de session.
8. Les simulations restent distinctes des trades réels.
9. Aucun build, aucune intégration de fournisseur et aucune couverture historique ne sont annoncés sans preuve.

## 8. Décisions requises avant d'implémenter la couche de données

1. Fournisseur XAUUSD et droits d'usage compatibles avec le replay.
2. Hébergement de l'API de données (fonctions Cloudflare ou service serveur déjà disponible).
3. Moteur graphique final après vérification de licence et de bundle.
4. Règles de spread, frais, slippage et exécution intrabougie.
5. Politique de rétention et stockage des sessions, trades et dessins.

## Fichiers inspectés

- `src/pages/BacktestModule.tsx`
- `src/pages/CommunityView.tsx`
- `src/services/firestore.ts`
- `src/firebase/config.ts`
- `package.json`
- `vite.config.ts`
