/**
 * User Tables Migration - Creates user management related tables
 * 
 * This migration adds the necessary tables for user settings, preferences,
 * activities, and privacy settings.
 */

const { dbRun, dbGet } = require('../utils/database');

/**
 * Check if table exists
 */
const tableExists = async (tableName) => {
    try {
        const result = await dbGet(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", 
            [tableName]
        );
        return !!result;
    } catch (error) {
        console.error(`Error checking if table ${tableName} exists:`, error);
        return false;
    }
};

/**
 * Create user_settings table
 */
const createUserSettingsTable = async () => {
    const exists = await tableExists('user_settings');
    if (exists) {
        console.log('Table user_settings already exists');
        return;
    }

    console.log('Creating user_settings table...');
    await dbRun(`
        CREATE TABLE user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
            language TEXT DEFAULT 'pt-BR' CHECK (language IN ('pt-BR', 'en-US')),
            timezone TEXT DEFAULT 'America/Sao_Paulo',
            auto_save INTEGER DEFAULT 1 CHECK (auto_save IN (0, 1)),
            compact_mode INTEGER DEFAULT 0 CHECK (compact_mode IN (0, 1)),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE (user_id)
        )
    `);
    console.log('✅ user_settings table created');
};

/**
 * Create user_preferences table
 */
const createUserPreferencesTable = async () => {
    const exists = await tableExists('user_preferences');
    if (exists) {
        console.log('Table user_preferences already exists');
        return;
    }

    console.log('Creating user_preferences table...');
    await dbRun(`
        CREATE TABLE user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            email_notifications INTEGER DEFAULT 1 CHECK (email_notifications IN (0, 1)),
            push_notifications INTEGER DEFAULT 0 CHECK (push_notifications IN (0, 1)),
            study_reminders INTEGER DEFAULT 1 CHECK (study_reminders IN (0, 1)),
            progress_reports INTEGER DEFAULT 1 CHECK (progress_reports IN (0, 1)),
            marketing_emails INTEGER DEFAULT 0 CHECK (marketing_emails IN (0, 1)),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE (user_id)
        )
    `);
    console.log('✅ user_preferences table created');
};

/**
 * Create user_activities table
 */
const createUserActivitiesTable = async () => {
    const exists = await tableExists('user_activities');
    if (exists) {
        console.log('Table user_activities already exists');
        return;
    }

    console.log('Creating user_activities table...');
    await dbRun(`
        CREATE TABLE user_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            activity_type TEXT NOT NULL CHECK (activity_type IN ('study', 'plan_creation', 'plan_completion', 'login')),
            duration INTEGER, -- in minutes
            metadata TEXT, -- JSON string for additional data
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);
    
    // Create indexes for better performance
    await dbRun(`
        CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities (user_id)
    `);
    
    await dbRun(`
        CREATE INDEX IF NOT EXISTS idx_user_activities_type ON user_activities (activity_type)
    `);
    
    await dbRun(`
        CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities (created_at)
    `);
    
    console.log('✅ user_activities table created with indexes');
};

/**
 * Create privacy_settings table
 */
const createPrivacySettingsTable = async () => {
    const exists = await tableExists('privacy_settings');
    if (exists) {
        console.log('Table privacy_settings already exists');
        return;
    }

    console.log('Creating privacy_settings table...');
    await dbRun(`
        CREATE TABLE privacy_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            profile_visibility TEXT DEFAULT 'private' CHECK (profile_visibility IN ('public', 'private', 'friends')),
            show_email INTEGER DEFAULT 0 CHECK (show_email IN (0, 1)),
            show_progress INTEGER DEFAULT 0 CHECK (show_progress IN (0, 1)),
            allow_contact INTEGER DEFAULT 1 CHECK (allow_contact IN (0, 1)),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE (user_id)
        )
    `);
    console.log('✅ privacy_settings table created');
};

/**
 * Add new columns to users table if they don't exist
 */
const updateUsersTable = async () => {
    console.log('Updating users table with new columns...');
    
    const columnsToAdd = [
        ['is_active', 'INTEGER DEFAULT 1 CHECK (is_active IN (0, 1))'],
        ['deactivation_reason', 'TEXT'],
        ['deactivated_at', 'TEXT'],
        ['last_login_at', 'TEXT'],
        ['updated_at', 'TEXT']
    ];
    
    for (const [columnName, columnDef] of columnsToAdd) {
        try {
            // Check if column exists
            const tableInfo = await dbGet(`PRAGMA table_info(users)`);
            
            // Get all columns
            const columns = await new Promise((resolve, reject) => {
                const db = require('../../database');
                db.all(`PRAGMA table_info(users)`, (err, columns) => {
                    if (err) reject(err);
                    else resolve(columns);
                });
            });
            
            const columnExists = columns.some(col => col.name === columnName);
            
            if (!columnExists) {
                console.log(`Adding column '${columnName}' to users table...`);
                await dbRun(`ALTER TABLE users ADD COLUMN ${columnName} ${columnDef}`);
                console.log(`✅ Column '${columnName}' added to users table`);
            } else {
                console.log(`Column '${columnName}' already exists in users table`);
            }
        } catch (error) {
            console.error(`Error adding column '${columnName}':`, error.message);
        }
    }
};

/**
 * Run all migrations
 */
const runMigrations = async () => {
    try {
        console.log('🚀 Starting user tables migration...');
        
        await createUserSettingsTable();
        await createUserPreferencesTable();
        await createUserActivitiesTable();
        await createPrivacySettingsTable();
        await updateUsersTable();
        
        console.log('✅ User tables migration completed successfully!');
        
        // Log migration completion
        const { securityLog } = require('../utils/security');
        securityLog('database_migration_completed', { 
            migration: 'user_tables',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};

module.exports = {
    runMigrations,
    createUserSettingsTable,
    createUserPreferencesTable,
    createUserActivitiesTable,
    createPrivacySettingsTable,
    updateUsersTable
};