export const FA_EXPIRING_GOOD_DAYS_THRESHOLD = 90;

export function getExpiryStatusClass(dateStr: string | undefined | null): 'good' | 'soon' | undefined {
    if (!dateStr) return undefined;
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const daysFromNow = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysFromNow > FA_EXPIRING_GOOD_DAYS_THRESHOLD) return 'good';
    if (daysFromNow >= 0) return 'soon';
    return undefined;
}
