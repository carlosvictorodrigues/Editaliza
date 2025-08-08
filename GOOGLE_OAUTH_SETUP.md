# Google OAuth Authentication Setup Guide

This guide will help you set up Google OAuth authentication for the Editaliza platform.

## Implementation Summary

✅ **Backend Implementation Complete**
- Google OAuth Passport strategy configured
- OAuth routes implemented (`/auth/google`, `/auth/google/callback`)
- User creation/login handling for Google users
- JWT token generation for authenticated users
- Database schema updated with Google OAuth fields

✅ **Frontend Implementation Complete**
- Google login/register buttons added to both `login.html` and `register.html`
- Proper Google branding and styling
- OAuth flow redirect handling
- Maintains existing email/password functionality

✅ **Security Features Implemented**
- CSRF protection for OAuth routes
- Secure handling of OAuth tokens
- User data validation and sanitization
- Content Security Policy updated for Google domains

✅ **User Experience Enhancements**
- Clear visual distinction between Google and email/password options
- Proper error handling for OAuth failures
- Seamless integration with existing user profile system
- Google avatar support in profile and navigation

## Required Setup Steps

### 1. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" 
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/auth/google/callback` (development)
     - `https://yourdomain.com/auth/google/callback` (production)

5. Copy your Client ID and Client Secret

### 2. Environment Configuration

Update your `.env` file with the Google OAuth credentials:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_actual_google_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

**Important:** Replace the placeholder values with your actual Google OAuth credentials.

### 3. Install Dependencies

The required packages have already been added to `package.json`:
- `passport`: ^0.7.0
- `passport-google-oauth20`: ^2.0.0

Run `npm install` to install the new dependencies.

### 4. Database Updates

The database schema has been automatically updated with the following new columns in the `users` table:
- `google_id`: Stores the user's Google ID
- `auth_provider`: Indicates authentication method ('local' or 'google')
- `google_avatar`: Stores the user's Google profile picture URL

These columns are added automatically when the server starts.

## How It Works

### Authentication Flow

1. **User clicks "Login with Google"** → Redirects to `/auth/google`
2. **Google authentication** → User authorizes the application
3. **Callback handling** → Google redirects to `/auth/google/callback`
4. **User creation/linking** → System creates new user or links to existing account
5. **JWT token generation** → User receives authentication token
6. **Redirect to dashboard** → User is logged in and redirected to `home.html`

### User Account Handling

- **New Google users**: Creates new account with Google profile information
- **Existing email match**: Links Google account to existing local account
- **Returning Google users**: Logs in with existing Google-linked account

### Security Features

- **Password reset protection**: Google users cannot use password reset (they must use Google login)
- **Login attempt protection**: Google users attempting email/password login are redirected to use Google
- **Token validation**: JWT tokens work identically for both authentication methods
- **CSRF protection**: OAuth routes are protected against cross-site request forgery

## Testing the Implementation

### 1. Start the Server
```bash
npm start
```

### 2. Test OAuth Flow
1. Visit `http://localhost:3000/login.html`
2. Click "Entrar com Google"
3. Complete Google authentication
4. Should redirect to dashboard with user logged in

### 3. Test User Profile
- Google users will see their Google avatar in the profile
- Can switch to local avatars if desired
- All profile features work normally

## Error Handling

The system handles various error scenarios:

- **OAuth failure**: User is redirected back to login page with error message
- **Callback errors**: System logs errors and shows user-friendly message
- **Google API issues**: Graceful fallback with error notifications

### Common Error Messages

- `"Esta conta foi criada com Google. Use o botão 'Entrar com Google' para fazer login."`
  - Shown when Google user tries to login with email/password
- `"Falha na autenticação com Google. Tente novamente."`
  - Shown when Google OAuth process fails

## Production Deployment

### Environment Variables
Update production environment with:
```env
GOOGLE_CLIENT_ID=your_production_google_client_id
GOOGLE_CLIENT_SECRET=your_production_google_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
```

### Google Cloud Console
Add your production domain to authorized redirect URIs:
- `https://yourdomain.com/auth/google/callback`

### Content Security Policy
The CSP has been updated to allow Google domains:
- `https://accounts.google.com` for OAuth redirects
- Google avatar images are automatically handled

## File Changes Summary

### Backend Files Modified:
- `package.json` - Added Google OAuth dependencies
- `.env` - Added Google OAuth configuration
- `server.js` - Added Passport configuration and OAuth routes
- `database.js` - Added Google OAuth database fields
- `js/components.js` - Updated avatar handling for Google users

### Frontend Files Modified:
- `login.html` - Added Google login button and OAuth handling
- `register.html` - Added Google register button and OAuth handling
- `profile.html` - Added Google avatar support and user notifications

## Support

The implementation maintains full backward compatibility with existing email/password authentication while adding seamless Google OAuth integration. Users can continue using either authentication method, and the system will handle account linking automatically when appropriate.

For issues or questions, check the server logs for detailed error information and ensure all Google Cloud Console settings are configured correctly.