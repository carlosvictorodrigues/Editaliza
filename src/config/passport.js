/**
 * Passport Configuration - OAuth strategies and session handling
 * 
 * This module configures Passport.js with OAuth strategies and session serialization
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/authService');

// Configure Google OAuth Strategy (only if credentials are available)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Use auth service to process OAuth callback
            const user = await authService.processGoogleCallback(profile);
            return done(null, user);
        } catch (error) {
            console.error('Google OAuth Error:', error);
            return done(error, null);
        }
    }));
} else {
    console.warn('⚠️  Google OAuth credentials not configured - Google login will be disabled');
}

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const authRepository = require('../repositories/authRepository');
        const user = await authRepository.findUserById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
