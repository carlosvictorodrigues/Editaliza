/**
 * Express Application Configuration
 * 
 * Centralizes all Express.js app settings and middleware configuration.
 * This module replaces scattered app settings throughout server.js
 * 
 * PHASE 7: Configuration Modularization
 * Created: 2025-08-25
 */

const environment = require('./environment');
const path = require('path');
const express = require('express');

/**
 * Express Application Settings
 */
const appSettings = {
    // Trust proxy for proper IP handling behind nginx
    trustProxy: 1,
    
    // View engine settings (if using templates)
    viewEngine: null, // Currently not using templates
    
    // Static file serving
    staticPaths: {
        public: path.join(process.cwd(), 'public'),
        css: path.join(process.cwd(), 'css'),
        js: path.join(process.cwd(), 'js'),
        images: path.join(process.cwd(), 'images'),
        uploads: path.join(process.cwd(), 'uploads')
    },
    
    // Allowed HTML files for security
    allowedHtmlFiles: [
        'home.html', 'login.html', 'register.html', 'dashboard.html',
        'profile.html', 'cronograma.html', 'plan.html', 'notes.html',
        'metodologia.html', 'faq.html', 'plan_settings.html'
    ],
    
    // Body parsing limits
    bodyParser: {
        jsonLimit: '2mb',
        urlencodedLimit: '2mb',
        parameterLimit: 100
    },
    
    // Timezone configuration
    timezone: 'America/Sao_Paulo',
    
    // MIME type fixes
    mimeTypes: {
        '.js': 'application/javascript'
    }
};

/**
 * Cache Control Headers for Development
 * Prevents caching during development for immediate feedback
 */
const cacheControlHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
};

/**
 * Apply Express App Configuration
 * @param {express.Application} app - Express application instance
 */
function configureApp(app) {
    // Set timezone
    process.env.TZ = appSettings.timezone;
    
    // Configure trust proxy
    app.set('trust proxy', appSettings.trustProxy);
    console.log('✅ Trust proxy configured for Nginx compatibility');
    
    // MIME type middleware
    app.use((req, res, next) => {
        if (req.path.endsWith('.js')) {
            res.setHeader('Content-Type', appSettings.mimeTypes['.js']);
        }
        next();
    });
    
    // Static file serving with security
    app.use(express.static(appSettings.staticPaths.public));
    app.use('/css', express.static(appSettings.staticPaths.css));
    app.use('/js', express.static(appSettings.staticPaths.js));
    app.use('/images', express.static(appSettings.staticPaths.images));
    app.use('/uploads', express.static(appSettings.staticPaths.uploads));
    
    // HTML file serving with cache control
    appSettings.allowedHtmlFiles.forEach(file => {
        app.get(`/${file}`, (req, res) => {
            // Apply cache control for development
            if (environment.IS_DEVELOPMENT) {
                Object.entries(cacheControlHeaders).forEach(([key, value]) => {
                    res.setHeader(key, value);
                });
            }
            
            res.sendFile(path.join(process.cwd(), file));
        });
    });
    
    // Body parsing configuration
    app.use(express.json({ 
        limit: appSettings.bodyParser.jsonLimit,
        verify: (req, res, buf) => {
            // Log large payloads for security monitoring
            if (buf.length > 1024 * 1024) { // > 1MB
                console.warn('⚠️ Large payload detected:', {
                    size: buf.length,
                    ip: req.ip,
                    endpoint: req.path
                });
            }
        }
    }));
    
    app.use(express.urlencoded({ 
        extended: true, 
        limit: appSettings.bodyParser.urlencodedLimit,
        parameterLimit: appSettings.bodyParser.parameterLimit
    }));
    
    console.log('✅ Express app configuration applied');
}

/**
 * Get Brazilian Date String
 * Utility function for consistent date handling
 * @returns {string} Date in YYYY-MM-DD format in Brazilian timezone
 */
function getBrazilianDateString() {
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-CA', {timeZone: appSettings.timezone, year: 'numeric'}));
    const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: appSettings.timezone, month: 'numeric'}))).padStart(2, '0');
    const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: appSettings.timezone, day: 'numeric'}))).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

module.exports = {
    appSettings,
    cacheControlHeaders,
    configureApp,
    getBrazilianDateString
};