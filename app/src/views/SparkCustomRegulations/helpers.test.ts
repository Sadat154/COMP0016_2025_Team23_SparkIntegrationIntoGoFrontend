import {
    expect,
    test,
} from 'vitest';

import {
    buildNormalizedNameToIso3FromCountriesJson,
    coerceCountriesJsonArray,
    getCountryNameKeysForRegionMapping,
    getAnswerForQuestion,
    normalizeName,
    normalizeYesNo,
    parseCsvLine,
    pickIso3,
    pickNameCandidates,
    toTitleCase,
    uniqOptions,
} from './helpers';

// -----------------------------------------------------------------------------
// parseCsvLine
// -----------------------------------------------------------------------------

test('parseCsvLine: simple comma-separated line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseCsvLine('one')).toEqual(['one']);
});

test('parseCsvLine: quoted field with comma', () => {
    expect(parseCsvLine('"a,b",c')).toEqual(['a,b', 'c']);
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
});

test('parseCsvLine: escaped quote inside quotes', () => {
    expect(parseCsvLine('"a""b",c')).toEqual(['a"b', 'c']);
});

test('parseCsvLine: empty and trimmed', () => {
    expect(parseCsvLine('  a  ,  b  ')).toEqual(['a', 'b']);
});

// -----------------------------------------------------------------------------
// normalizeYesNo
// -----------------------------------------------------------------------------

test('normalizeYesNo: yes/no variants', () => {
    expect(normalizeYesNo('yes')).toBe('Yes');
    expect(normalizeYesNo('YES')).toBe('Yes');
    expect(normalizeYesNo('  yes  ')).toBe('Yes');
    expect(normalizeYesNo('no')).toBe('No');
    expect(normalizeYesNo('NO')).toBe('No');
});

test('normalizeYesNo: non yes/no returns N/A', () => {
    expect(normalizeYesNo('')).toBe('N/A');
    expect(normalizeYesNo('n/a')).toBe('N/A');
    expect(normalizeYesNo('unknown')).toBe('N/A');
    expect(normalizeYesNo('  ')).toBe('N/A');
});

// -----------------------------------------------------------------------------
// normalizeName
// -----------------------------------------------------------------------------

test('normalizeName: lowercases and takes first part before comma', () => {
    expect(normalizeName('United Kingdom')).toBe('united kingdom');
    expect(normalizeName('Congo, Dem. Rep.')).toBe('congo');
});

test('normalizeName: strips parentheses and takes first segment before comma', () => {
    // Parenthetical content is removed, so "Congo (DRC)" -> "congo"
    expect(normalizeName('Congo (DRC)')).toBe('congo');
    // Only content before first comma is used
    expect(normalizeName('Korea, Rep.')).toBe('korea');
});

test('normalizeName: null/undefined/empty', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
});

test('getCountryNameKeysForRegionMapping: adds Ivory Coast aliases', () => {
    const keys = getCountryNameKeysForRegionMapping("Côte d'Ivoire");

    expect(keys).toContain('cote d ivoire');
    expect(keys).toContain('ivory coast');
});

test('getCountryNameKeysForRegionMapping: adds Centrafique alias', () => {
    const keys = getCountryNameKeysForRegionMapping('Central African Republic');

    expect(keys).toContain('central african republic');
    expect(keys).toContain('centrafique');
    expect(keys).toContain('centrafrique');
});

// -----------------------------------------------------------------------------
// getAnswerForQuestion
// -----------------------------------------------------------------------------

test('getAnswerForQuestion: finds matching answer', () => {
    const items = [
        { question: 'Is there an agreement?', answer: 'Yes' },
        { question: 'Exemptions?', answer: 'No' },
    ];
    expect(getAnswerForQuestion('Is there an agreement?', items)).toBe('Yes');
    expect(getAnswerForQuestion('EXEMPTIONS?', items)).toBe('No');
});

test('getAnswerForQuestion: no match returns empty string', () => {
    const items = [{ question: 'Q1', answer: 'A1' }];
    expect(getAnswerForQuestion('Other question', items)).toBe('');
    expect(getAnswerForQuestion('Q1', [])).toBe('');
});

// -----------------------------------------------------------------------------
// toTitleCase
// -----------------------------------------------------------------------------

test('toTitleCase: capitalizes each word', () => {
    expect(toTitleCase('hello world')).toBe('Hello World');
    expect(toTitleCase('YES')).toBe('Yes');
});

test('toTitleCase: empty and single word', () => {
    expect(toTitleCase('')).toBe('');
    expect(toTitleCase('hello')).toBe('Hello');
});

// -----------------------------------------------------------------------------
// uniqOptions
// -----------------------------------------------------------------------------

test('uniqOptions: with includeAll adds All option', () => {
    const opts = uniqOptions(['B', 'A', 'B']);
    expect(opts).toEqual([
        { key: '', label: 'All' },
        { key: 'A', label: 'A' },
        { key: 'B', label: 'B' },
    ]);
});

test('uniqOptions: includeAll false omits All', () => {
    const opts = uniqOptions(['B', 'A'], false);
    expect(opts).toEqual([
        { key: 'A', label: 'A' },
        { key: 'B', label: 'B' },
    ]);
});

// -----------------------------------------------------------------------------
// coerceCountriesJsonArray / pickIso3 / pickNameCandidates / buildNormalizedNameToIso3
// -----------------------------------------------------------------------------

test('coerceCountriesJsonArray: array input', () => {
    const arr = [{ iso3: 'GBR' }];
    expect(coerceCountriesJsonArray(arr)).toEqual(arr);
});

test('coerceCountriesJsonArray: object with countries key', () => {
    const data = { countries: [{ iso3: 'USA' }] };
    expect(coerceCountriesJsonArray(data)).toEqual([{ iso3: 'USA' }]);
});

test('coerceCountriesJsonArray: invalid input returns empty array', () => {
    expect(coerceCountriesJsonArray(null)).toEqual([]);
    expect(coerceCountriesJsonArray(42)).toEqual([]);
});

test('pickIso3: reads iso3 and normalizes to 3-char uppercase', () => {
    expect(pickIso3({ iso3: 'gbr' })).toBe('GBR');
    expect(pickIso3({ iso3_code: 'usa' })).toBe('USA');
    expect(pickIso3({ iso3: 'XY' })).toBeUndefined();
});

test('pickNameCandidates: collects name-like fields', () => {
    expect(pickNameCandidates({ name: 'United Kingdom' })).toEqual(['United Kingdom']);
    expect(pickNameCandidates({ country: 'France' })).toEqual(['France']);
});

test('buildNormalizedNameToIso3FromCountriesJson: builds map from array', () => {
    const input = [
        { iso3: 'GBR', name: 'United Kingdom' },
        { iso3: 'USA', name: 'United States' },
    ];
    const map = buildNormalizedNameToIso3FromCountriesJson(input);
    expect(map.get('united kingdom')).toBe('GBR');
    expect(map.get('united states')).toBe('USA');
});

test('buildNormalizedNameToIso3FromCountriesJson: supports object wrapper', () => {
    const input = { countries: [{ iso3: 'FRA', name: 'France' }] };
    const map = buildNormalizedNameToIso3FromCountriesJson(input);
    expect(map.get('france')).toBe('FRA');
});
