/**
 * Database Compatibility Layer
 * Handles differences between SQLite (development) and PostgreSQL (production)
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get the correct password column name based on environment
 * Both environments now use 'password_hash' as standardized
 */
const getPasswordColumn = () => {
    return 'password_hash';
};

/**
 * Build SQL query with correct password column name
 */
const buildPasswordQuery = (baseQuery) => {
    const passwordColumn = getPasswordColumn();
    return baseQuery.replace(/\{password_column\}/g, passwordColumn);
};

module.exports = {
    getPasswordColumn,
    buildPasswordQuery,
    isProduction
};