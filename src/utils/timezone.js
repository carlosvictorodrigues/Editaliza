/**
 * Timezone Utility - Handle timezone-aware date operations
 * 
 * This utility provides functions to handle timezone-aware date operations,
 * specifically for Brazilian timezone (GMT-3/GMT-2) but flexible for other timezones.
 */

/**
 * Get current date in Brazil timezone (Brasília Time - BRT/BRST)
 * BRT: UTC-3 (Standard Time) - March to October
 * BRST: UTC-2 (Summer Time) - October to March (Daylight saving discontinued in 2019)
 */
const getBrazilianDate = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
};

/**
 * Get date string in YYYY-MM-DD format using Brazil timezone
 */
const getBrazilianDateString = () => {
    const brazilDate = getBrazilianDate();
    return brazilDate.toISOString().split('T')[0];
};

/**
 * Get date string in YYYY-MM-DD format using user's local timezone
 * This is more flexible and will work correctly regardless of where the server is hosted
 */
const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Compare two dates considering only the date part (ignoring time)
 * Both dates should be in YYYY-MM-DD format
 */
const compareDateStrings = (date1, date2) => {
    return new Date(date1).getTime() - new Date(date2).getTime();
};

/**
 * Check if a session is overdue based on Brazilian timezone
 * @param {string} sessionDate - Session date in YYYY-MM-DD format
 * @param {string} status - Session status
 * @returns {boolean} - True if session is overdue
 */
const isSessionOverdue = (sessionDate, status) => {
    if (status !== 'Pendente') return false;
    
    const today = getBrazilianDateString();
    return sessionDate < today;
};

/**
 * Check if a session is overdue using local timezone (more flexible approach)
 * @param {string} sessionDate - Session date in YYYY-MM-DD format
 * @param {string} status - Session status
 * @returns {boolean} - True if session is overdue
 */
const isSessionOverdueLocal = (sessionDate, status) => {
    if (status !== 'Pendente') return false;
    
    const today = getLocalDateString();
    return sessionDate < today;
};

/**
 * Get a date offset by a number of days from today (in local timezone)
 * @param {number} dayOffset - Number of days to offset (negative for past dates)
 * @returns {string} - Date string in YYYY-MM-DD format
 */
const getDateOffsetLocal = (dayOffset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get a date offset by a number of days from today (in Brazilian timezone)
 * @param {number} dayOffset - Number of days to offset (negative for past dates)
 * @returns {string} - Date string in YYYY-MM-DD format
 */
const getDateOffsetBrazilian = (dayOffset = 0) => {
    const brazilDate = getBrazilianDate();
    brazilDate.setDate(brazilDate.getDate() + dayOffset);
    
    const year = brazilDate.getFullYear();
    const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
    const day = String(brazilDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Convert a UTC date to Brazilian timezone and return date string
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} - Date string in YYYY-MM-DD format in Brazilian timezone
 */
const utcToBrazilianDateString = (date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const brazilDate = new Date(dateObj.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    
    const year = brazilDate.getFullYear();
    const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
    const day = String(brazilDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get start of week date in local timezone
 * @param {Date} date - Reference date (defaults to today)
 * @returns {string} - Date string in YYYY-MM-DD format
 */
const getWeekStartLocal = (date = new Date()) => {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Sunday as start of week
    
    const year = weekStart.getFullYear();
    const month = String(weekStart.getMonth() + 1).padStart(2, '0');
    const day = String(weekStart.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

module.exports = {
    getBrazilianDate,
    getBrazilianDateString,
    getLocalDateString,
    compareDateStrings,
    isSessionOverdue,
    isSessionOverdueLocal,
    getDateOffsetLocal,
    getDateOffsetBrazilian,
    utcToBrazilianDateString,
    getWeekStartLocal
};