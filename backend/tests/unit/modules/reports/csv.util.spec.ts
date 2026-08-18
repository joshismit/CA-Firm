import { toCsv } from '@modules/reports/utils/csv.util';

describe('toCsv', () => {
  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('uses the first row\'s keys as the header line', () => {
    const csv = toCsv([{ id: '1', name: 'Alpha' }]);
    expect(csv).toBe('id,name\n1,Alpha');
  });

  it('serializes multiple rows', () => {
    const csv = toCsv([
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ]);
    expect(csv).toBe('id,name\n1,Alpha\n2,Beta');
  });

  it('renders null/undefined values as empty strings', () => {
    const csv = toCsv([{ id: '1', notes: null }]);
    expect(csv).toBe('id,notes\n1,');
  });

  it('quotes and escapes values containing commas', () => {
    const csv = toCsv([{ id: '1', label: 'Acme, Inc.' }]);
    expect(csv).toBe('id,label\n1,"Acme, Inc."');
  });

  it('quotes and escapes values containing double quotes', () => {
    const csv = toCsv([{ id: '1', label: 'Say "hello"' }]);
    expect(csv).toBe('id,label\n1,"Say ""hello"""');
  });

  it('quotes values containing newlines', () => {
    const csv = toCsv([{ id: '1', label: 'line one\nline two' }]);
    expect(csv).toBe('id,label\n1,"line one\nline two"');
  });
});
