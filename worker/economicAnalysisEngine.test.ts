import { describe, expect, it } from 'bun:test';
import { analyzeEconomicEvent } from './economicAnalysisEngine';

describe('analyzeEconomicEvent', () => {
  it('compares numeric Actual and Forecast without inventing values', () => {
    const result = analyzeEconomicEvent({
      event: 'US CPI y/y',
      currency: 'USD',
      actual: '3.4%',
      forecast: '3.2%',
      previous: '3.1%',
    });
    expect(result.status).toBe('analyzed');
    expect(result.category).toBe('inflation');
    expect(result.surprise?.direction).toBe('above');
    expect(result.surprise?.text).toContain('0,2 %');
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('does not compare values when units differ', () => {
    const result = analyzeEconomicEvent({
      event: 'GDP q/q',
      actual: '2.1%',
      forecast: '2.1',
    });
    expect(result.status).toBe('partial');
    expect(result.surprise).toBeNull();
    expect(result.notes.some(note => note.includes('formats/unités'))).toBe(true);
  });

  it('marks missing values as insufficient data', () => {
    const result = analyzeEconomicEvent({
      event: 'Nonfarm Payrolls',
      actual: '',
      forecast: '180K',
    });
    expect(result.status).toBe('insufficient_data');
    expect(result.surprise).toBeNull();
    expect(result.notes.some(note => note.includes('manque'))).toBe(true);
  });

  it('does not claim a known macro interpretation for unclassified events', () => {
    const result = analyzeEconomicEvent({
      event: 'Unclassified regional survey',
      actual: '101',
      forecast: '99',
      currency: 'EUR',
    });
    expect(result.category).toBe('other');
    expect(result.interpretation).toContain('n’est pas classée automatiquement');
  });
});
