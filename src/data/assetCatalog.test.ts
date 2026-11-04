import { describe, expect, test } from 'bun:test';
import { ASSET_CATALOG, searchAssetCatalog } from './assetCatalog';

describe('universal asset catalog', () => {
  test('contains representative instruments across all supported markets', () => {
    const categories = new Set(ASSET_CATALOG.map(asset => asset.category));
    for (const category of ['forex','metal','index','commodity','futures','crypto','stock','etf','bond','option','synthetic']) {
      expect(categories.has(category as never)).toBe(true);
    }
  });

  test('finds assets by symbol and name', () => {
    expect(searchAssetCatalog('XAUUSD')[0]?.name).toContain('Gold');
    expect(searchAssetCatalog('Apple').some(asset => asset.symbol === 'AAPL')).toBe(true);
    expect(searchAssetCatalog('Volatility 75').some(asset => asset.symbol === 'V75')).toBe(true);
  });

  test('limits results and returns the initial catalog for an empty query', () => {
    expect(searchAssetCatalog('', 5)).toHaveLength(5);
    expect(searchAssetCatalog('USD', 3)).toHaveLength(3);
  });

  test('does not invent broker-specific contract values', () => {
    const gold = searchAssetCatalog('XAUUSD')[0];
    expect(gold?.dataStatus).toBe('broker-dependent');
    expect(gold?.priceStep).toBeUndefined();
    expect(gold?.valuePerPriceUnit).toBeUndefined();
  });
});
