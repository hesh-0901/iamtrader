export const IAMTRADER_KNOWLEDGE = `
IDENTITE ET POSITIONNEMENT
IAMTRADER est une plateforme SaaS de gestion et d’analyse de performance pour traders. Elle transforme l’historique de trading en données lisibles sur le risque, l’exécution, les résultats, la psychologie et la progression.

FONCTIONNALITES
- Journal de trading : enregistrement des opérations et de leurs données.
- Dashboard : vue synthétique des performances, du P&L, du win rate, du drawdown et du Trader Score.
- Performance & Edge Statistique : analyse du P&L, profit factor, gain moyen, perte moyenne, expectancy, drawdown, meilleur/pire trade, longs vs shorts, setups et timeframes.
- Trader Score : score algorithmique basé sur six dimensions : gestion du risque, discipline opérationnelle, consistance/régularité, qualité d’exécution, maîtrise psychologique et rentabilité nette.
- Analyse psychologique : suivi des états émotionnels associés aux trades.
- Gestion multi-comptes : séparation des statistiques entre plusieurs comptes.
- Calendrier : fonctionnalité présente dans l’application.
- Paramètres : préférences utilisateur, devise, thème, langue, instruments et setups personnalisés.
- Contact/support : formulaire de contact disponible depuis la plateforme.

DONNEES D’UN TRADE
Un trade peut contenir notamment : instrument/symbole, direction BUY ou SELL, date d’entrée et de sortie, prix d’entrée et de sortie, stop loss, take profit, taille de position, montant risqué, résultat, P&L, multiple R, setup, session, timeframe, notes, état émotionnel et captures avant/après.

DIRECTIONS ET RESULTATS
Directions : BUY et SELL.
Résultats : WIN, LOSS, BREAKEVEN, OPEN.
Sessions : Asia, London, New York, Overlap.
Timeframes disponibles : 1m, 5m, 15m, 1h, 4h, 1D.
Catégories d’instruments : forex, metal, index, futures, crypto, stock, other.

GESTION DES COMPTES
Types de comptes : Prop Firm Challenge, Prop Firm Funded, Personal Live, Demo / Simulation.
Un compte peut contenir : nom, broker, type, capital initial, solde actuel, devise, objectif de profit, limite de drawdown, risque par trade et statut.
Devises prises en charge dans le modèle : USD, EUR, GBP.
Statuts de compte : Active, Passed, Failed, Archived.

METRIQUES DE PERFORMANCE
Les métriques calculées comprennent :
- nombre total de trades clôturés ;
- trades gagnants, perdants et breakeven ;
- win rate ;
- P&L total ;
- gain moyen ;
- perte moyenne ;
- profit factor ;
- R moyen ;
- drawdown maximal en montant et en pourcentage ;
- expectancy ;
- série actuelle de gains/pertes ;
- meilleur trade ;
- pire trade ;
- courbe d’equity.

Le calcul de performance exclut les trades OPEN. Le win rate est le nombre de trades gagnants divisé par le nombre de trades clôturés. Le profit factor compare le total des gains au total des pertes. L’expectancy est calculée à partir de la probabilité de gain, du gain moyen, de la probabilité de perte et de la perte moyenne.

TRADER SCORE
Le Trader Score n’est pas calculé tant qu’il n’y a pas au moins 5 trades clôturés. Avec moins de 5 trades, le profil est indiqué comme insuffisamment documenté.
Les six piliers et leurs poids sont :
- Gestion du risque : 25 %
- Discipline opérationnelle : 20 %
- Consistance / régularité : 15 %
- Qualité d’exécution : 15 %
- Maîtrise psychologique : 15 %
- Rentabilité nette : 10 %

Le score de gestion du risque tient notamment compte de l’utilisation du stop loss et du drawdown maximal.
La discipline tient notamment compte des trades marqués FOMO ou Revenge.
La consistance tient notamment compte du win rate et du profit factor.
L’exécution tient notamment compte du R moyen.
La psychologie tient notamment compte des états Calm, Disciplined et Focused.
La rentabilité tient notamment compte du P&L cumulé et du profit factor.

IMPORTANT : ne présente pas le Trader Score comme une certification, une garantie de rentabilité ou une garantie d’éligibilité à une prop firm. Il s’agit d’un indicateur interne calculé à partir des données journalisées.

PLANS ACTUELLEMENT AFFICHES SUR LE SITE
Starter — 0 $ :
- journal de trading ;
- analyse des performances ;
- P&L, R, drawdown et win rate ;
- Trader Score ;
- analyse psychologique ;
- dashboard et statistiques ;
- toutes les fonctionnalités de la plateforme ;
- limite de trades enregistrés.

Plus — 9,99 $ / mois :
- tout Starter ;
- trades illimités ;
- historique complet ;
- analyses avancées ;
- analyse par instrument, session et setup ;
- statistiques avancées ;
- suivi multi-comptes ;
- fonctionnalités premium.

Community — 89,99 $ / 6 mois :
- tout Plus ;
- formations vidéo ;
- cours PDF ;
- communauté d’analystes ;
- contenus pédagogiques exclusifs ;
- échanges et partage d’analyses ;
- accompagnement pendant 6 mois ;
- accès aux outils IAMTRADER.

Ces informations de plans et tarifs correspondent à ce qui est actuellement affiché dans le code de la landing page. Si une information commerciale change ailleurs, ne l’invente pas : indique qu’elle doit être vérifiée sur la page officielle ou auprès du support.

REGLES DE REPONSE SUR IAMTRADER
- Si la question concerne une fonctionnalité non documentée ici, ne l’invente pas.
- Si l’utilisateur demande un détail de prix, de paiement, d’éligibilité, de disponibilité ou de procédure qui n’est pas documenté ici, indique que l’information n’est pas disponible dans la base actuelle.
- Ne prétends pas connaître les données privées d’un utilisateur.
- Pour un problème de compte ou de paiement, orienter vers le support IAMTRADER lorsque les étapes précises ne sont pas documentées.
`;