# IAMTRADER — Phase 1 Architecture

## Product vision
IAMTRADER is a Trader Performance Management System, not merely a trading journal. The first implementation milestone is a manual Quick Trade journal with automatic financial calculations.

## Core principle
Minimum Input → Maximum Intelligence.

The trader manually enters only the information required to record a trade. The system derives financial and contextual metrics whenever the source data permits it.

## Phase 1 scope
- Manual trade journal
- Quick Trade entry
- Trading account foundation
- Centralized PnL engine
- Centralized risk engine
- R multiple and R:R calculations
- Trade history
- Initial dashboard metrics
- Automated calculation tests

## Technical direction
- Next.js / React
- TypeScript
- Tailwind CSS
- Supabase / PostgreSQL
- Server-side validation and financial calculations
- Row Level Security for workspace/account isolation

## Domain boundaries
- Authentication
- Workspace
- Trading Accounts
- Trades
- Trade Executions
- Risk Engine
- PnL Engine
- Performance Engine
- Evaluation Engine
- Analytics Engine
- Score Engine

## Financial calculation rules
Risk Amount = |Entry - Stop Loss| × Position Size × Contract Multiplier

RR = |TP - Entry| / |Entry - SL|

R Multiple = Net PnL / Initial Risk

Drawdown = Peak Equity - Current Equity

Drawdown % = (Peak Equity - Current Equity) / Peak Equity × 100

All critical financial calculations must be centralized, precise, documented and tested.

## Quick Trade fields
Required:
- Symbol
- Direction
- Entry
- Stop Loss
- Take Profit
- Quantity / Lot
- Date / Time

Optional after save:
- Note
- Screenshot
- Emotion
- Entry reason
- Checklist

## Derived fields
- Risk amount
- Risk percentage
- Planned R:R
- Gross PnL
- Net PnL
- R multiple
- Result
- Trade duration
- Session / Kill Zone when timezone data permits
- Drawdown impact

## Database foundation
Core tables:
- users
- workspaces
- workspace_members
- accounts
- trades
- trade_executions
- strategies
- setups
- playbook_rules
- checklists
- checklist_items
- trade_checklist_results
- emotions
- attachments
- sessions
- kill_zones
- evaluations
- evaluation_templates
- evaluation_rules
- evaluation_events
- daily_snapshots
- performance_snapshots
- trader_scores
- reports
- notifications
- tags
- trade_tags

## UI direction
Dark institutional interface using the IAMTRADER design system. Primary colors: #080B0D, #0A192F, #00C796, #FFFFFF. Secondary colors include #243B53, #8B969E, #E7ECEE and #C7A86B. Inter is the main UI typeface; JetBrains Mono is reserved for prices, ratios and metrics.

## Development rule
Implement incrementally. Do not replace complete existing functionality with simplified versions. Every phase must preserve compatibility with previous phases and include appropriate tests.
