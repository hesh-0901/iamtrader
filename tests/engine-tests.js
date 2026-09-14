import {calculateRisk,targetLot} from '../risk-engine.js';
import {pnl,performance} from '../performance-engine.js';
import {behaviorScore} from '../psychology-engine.js';
import {traderScore} from '../score-engine.js';

const tests=[]; const test=(name,fn)=>tests.push({name,fn}); const eq=(a,b)=>{if(Math.abs(a-b)>1e-9)throw new Error(`${a} !== ${b}`)};
test('XAUUSD risk 1 lot / 2000 to 1999.30 = 70 USD',()=>eq(calculateRisk({direction:'BUY',entry:2000,stopLoss:1999.30,takeProfit:2002,lot:1,contractSize:100,capital:10000,conversionRate:1,fees:0}).riskMoney,70));
test('US30 risk 1 lot / 40000 to 39995 = 50 USD',()=>eq(calculateRisk({direction:'BUY',entry:40000,stopLoss:39995,takeProfit:40010,lot:1,contractSize:10,capital:10000,conversionRate:1,fees:0}).riskMoney,50));
test('XAUUSD sizing 10000 at 1% and 2000/1999 = 1 lot',()=>eq(targetLot({capital:10000,riskPercent:1,entry:2000,stopLoss:1999,contractSize:100,conversionRate:1,lotStep:.01,minLot:.01}).lot,1));
test('BUY invalid ordering is blocked',()=>{if(calculateRisk({direction:'BUY',entry:2000,stopLoss:2001,takeProfit:2002,lot:1,contractSize:100,capital:10000}).ok)throw new Error('invalid BUY accepted')});
test('SELL P&L is correct',()=>eq(pnl({direction:'SELL',entry:2000,exit:1999,lot:1,contractSize:100,conversionRate:1,fees:0}),100));
test('Psychology score penalizes bad behavior',()=>{if(behaviorScore({respectPlan:5,confidence:5,stress:0,fomo:0,revenge:0,impulsivity:0})<=behaviorScore({respectPlan:1,confidence:1,stress:5,fomo:5,revenge:5,impulsivity:5}))throw new Error('score ordering wrong')});
test('Performance counts wins/losses',()=>{const p=performance([{date:'2026-01-01',pnl:100,rMultiple:1,riskPercent:1,exit:1},{date:'2026-01-02',pnl:-50,rMultiple:-.5,riskPercent:1,exit:1}],10000);if(p.wins!==1||p.losses!==1)throw new Error('counts wrong')});
test('Trader score is withheld for tiny sample',()=>{if(traderScore({realized:4},{score:90}).global!==null)throw new Error('score should be withheld')});
let passed=0;for(const t of tests){try{t.fn();console.log(`PASS ${t.name}`);passed++}catch(e){console.error(`FAIL ${t.name}:`,e)}}console.log(`${passed}/${tests.length} tests passed`);
