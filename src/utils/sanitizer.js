/**
 * Sanitizer Utilities - HTML sanitization and input validation
 * 
 * This module provides utilities for sanitizing user input and HTML content
 * to prevent XSS attacks and ensure data integrity.
 */

/**
 * Sanitize HTML content by escaping dangerous characters
 * @param {string} unsafe - The unsafe HTML string
 * @returns {string} - The sanitized HTML string
 */
const sanitizeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') {
        return '';
    }
    
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

/**
 * Sanitize text input by removing/escaping potentially dangerous content
 * @param {string} input - The input string to sanitize
 * @returns {string} - The sanitized string
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') {
        return '';
    }
    
    // Remove null bytes and control characters
    return input
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim();
};

/**
 * Validate and sanitize email addresses
 * @param {string} email - The email to validate
 * @returns {string|null} - The sanitized email or null if invalid
 */
const sanitizeEmail = (email) => {
    if (typeof email !== 'string') {
        return null;
    }
    
    const sanitized = sanitizeInput(email.toLowerCase());
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    return emailRegex.test(sanitized) ? sanitized : null;
};

/**
 * Sanitize numeric IDs
 * @param {*} id - The ID to sanitize
 * @returns {number|null} - The sanitized numeric ID or null if invalid
 */
const sanitizeNumericId = (id) => {
    const parsed = parseInt(id, 10);
    return (!isNaN(parsed) && parsed > 0) ? parsed : null;
};

/**
 * Sanitize and validate dates
 * @param {string} dateString - The date string to sanitize
 * @returns {string|null} - The sanitized date string (YYYY-MM-DD) or null if invalid
 */
const sanitizeDate = (dateString) => {
    if (typeof dateString !== 'string') {
        return null;
    }
    
    const sanitized = sanitizeInput(dateString);
    const date = new Date(sanitized);
    
    if (isNaN(date.getTime())) {
        return null;
    }
    
    // Return in YYYY-MM-DD format
    return date.toISOString().split('T')[0];
};

/**
 * Sanitize JSON strings safely
 * @param {string} jsonString - The JSON string to parse
 * @returns {*|null} - The parsed object or null if invalid
 */
const sanitizeJson = (jsonString) => {
    if (typeof jsonString !== 'string') {
        return null;
    }
    
    try {
        return JSON.parse(sanitizeInput(jsonString));
    } catch (error) {
        return null;
    }
};

module.exports = {
    sanitizeHtml,
    sanitizeInput,
    sanitizeEmail,
    sanitizeNumericId,
    sanitizeDate,
    sanitizeJson
};