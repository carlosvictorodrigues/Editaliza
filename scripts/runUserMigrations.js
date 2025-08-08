/**
 * Run User Migrations Script
 * 
 * This script executes the user-related database migrations
 * to set up tables for user management features.
 */

const path = require('path');

// Set up environment - point to the root directory
process.chdir(path.join(__dirname, '..'));

// Load environment variables
require('dotenv').config();

// Import migration
const { runMigrations } = require('../src/migrations/createUserTables');

/**
 * Main migration runner
 */
const main = async () => {
    console.log('🔧 User Management Tables Migration');
    console.log('===================================');
    
    try {
        // Wait a bit for database connection to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await runMigrations();
        
        console.log('\n🎉 Migration completed successfully!');
        console.log('User management features are now ready to use.');
        
        // Exit gracefully
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Migration failed:');
        console.error(error);
        
        process.exit(1);
    }
};

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n⚠️ Migration interrupted');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\n⚠️ Migration terminated');
    process.exit(1);
});

// Run migration
main();