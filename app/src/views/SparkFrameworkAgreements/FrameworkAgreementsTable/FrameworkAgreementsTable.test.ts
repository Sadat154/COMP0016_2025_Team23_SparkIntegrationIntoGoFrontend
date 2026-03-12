import {
    expect,
    test,
} from 'vitest';

import {
    FA_EXPIRING_GOOD_DAYS_THRESHOLD,
    getExpiryStatusClass,
} from './expiryStatus';

function dateString(d: Date): string {
    return d.toISOString().slice(0, 10);
}

test('getExpiryStatusClass: null or undefined returns undefined', () => {
    expect(getExpiryStatusClass(null)).toBeUndefined();
    expect(getExpiryStatusClass(undefined)).toBeUndefined();
});

test('getExpiryStatusClass: empty string returns undefined', () => {
    expect(getExpiryStatusClass('')).toBeUndefined();
});

test('getExpiryStatusClass: more than threshold days in future returns "good"', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Use well over threshold to avoid timezone/UTC parsing edge cases
    const future = new Date(today);
    future.setDate(future.getDate() + FA_EXPIRING_GOOD_DAYS_THRESHOLD + 100);

    expect(getExpiryStatusClass(dateString(future))).toBe('good');
});

test('getExpiryStatusClass: exactly threshold days in future returns "soon"', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const future = new Date(today);
    future.setDate(future.getDate() + FA_EXPIRING_GOOD_DAYS_THRESHOLD);

    expect(getExpiryStatusClass(dateString(future))).toBe('soon');
});

test('getExpiryStatusClass: within threshold days in future returns "soon"', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const future = new Date(today);
    future.setDate(future.getDate() + 1);

    expect(getExpiryStatusClass(dateString(future))).toBe('soon');
});

test('getExpiryStatusClass: today returns "soon"', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    expect(getExpiryStatusClass(dateString(today))).toBe('soon');
});

test('getExpiryStatusClass: past date returns undefined (expired)', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const past = new Date(today);
    past.setDate(past.getDate() - 1);

    expect(getExpiryStatusClass(dateString(past))).toBeUndefined();
});

test('getExpiryStatusClass: accepts ISO date string', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const goodDate = new Date(today);
    goodDate.setDate(goodDate.getDate() + 100);

    expect(getExpiryStatusClass(goodDate.toISOString())).toBe('good');
});
