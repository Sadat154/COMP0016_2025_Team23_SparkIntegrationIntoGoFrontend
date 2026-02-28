import {
    expect,
    test,
} from 'vitest';

import {
    buildISO3ToCentroidMapFromData,
    type CountryDataFromJSON,
} from './countryDataLoader';

test('buildISO3ToCentroidMapFromData: empty array returns empty map', () => {
    const result = buildISO3ToCentroidMapFromData([]);
    expect(result.size).toBe(0);
});

test('buildISO3ToCentroidMapFromData: adds entry for country with valid iso3 and centroid', () => {
    const countries: CountryDataFromJSON[] = [
        {
            iso3: 'GBR',
            centroid: { type: 'Point', coordinates: [-2.5, 54] },
        },
    ];
    const result = buildISO3ToCentroidMapFromData(countries);
    expect(result.size).toBe(1);
    expect(result.get('GBR')).toEqual([-2.5, 54]);
});

test('buildISO3ToCentroidMapFromData: normalizes iso3 to uppercase', () => {
    const countries: CountryDataFromJSON[] = [
        {
            iso3: 'gbr',
            centroid: { type: 'Point', coordinates: [0, 52] },
        },
    ];
    const result = buildISO3ToCentroidMapFromData(countries);
    expect(result.get('GBR')).toEqual([0, 52]);
});

test('buildISO3ToCentroidMapFromData: skips country with null iso3', () => {
    const countries: CountryDataFromJSON[] = [
        {
            iso3: null,
            centroid: { type: 'Point', coordinates: [0, 0] },
        },
    ];
    const result = buildISO3ToCentroidMapFromData(countries);
    expect(result.size).toBe(0);
});

test('buildISO3ToCentroidMapFromData: skips country with empty iso3', () => {
    const countries: CountryDataFromJSON[] = [
        {
            iso3: '',
            centroid: { type: 'Point', coordinates: [0, 0] },
        },
    ];
    const result = buildISO3ToCentroidMapFromData(countries);
    expect(result.size).toBe(0);
});

test('buildISO3ToCentroidMapFromData: skips country with missing centroid', () => {
    const countries: CountryDataFromJSON[] = [
        { iso3: 'USA', centroid: null },
        { iso3: 'FRA' },
    ];
    const result = buildISO3ToCentroidMapFromData(countries);
    expect(result.size).toBe(0);
});

test('buildISO3ToCentroidMapFromData: skips country with invalid coordinates', () => {
    const countries: CountryDataFromJSON[] = [
        {
            iso3: 'X',
            centroid: { type: 'Point', coordinates: [NaN, 0] },
        },
        {
            iso3: 'Y',
            centroid: { type: 'Point', coordinates: [0, Infinity] },
        },
        {
            iso3: 'Z',
            centroid: { type: 'Point', coordinates: [1] as [number, number] },
        },
    ];
    const result = buildISO3ToCentroidMapFromData(countries);
    expect(result.size).toBe(0);
});

test('buildISO3ToCentroidMapFromData: multiple valid countries', () => {
    const countries: CountryDataFromJSON[] = [
        { iso3: 'GBR', centroid: { type: 'Point', coordinates: [-2, 54] } },
        { iso3: 'FRA', centroid: { type: 'Point', coordinates: [2, 46] } },
        { iso3: 'usa', centroid: { type: 'Point', coordinates: [-98, 39] } },
    ];
    const result = buildISO3ToCentroidMapFromData(countries);
    expect(result.size).toBe(3);
    expect(result.get('GBR')).toEqual([-2, 54]);
    expect(result.get('FRA')).toEqual([2, 46]);
    expect(result.get('USA')).toEqual([-98, 39]);
});
