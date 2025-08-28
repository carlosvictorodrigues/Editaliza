/**
 * Add missing columns directly using the app's database connection
 */

const db = require('./database-postgres-direct');

async function addMissingColumns() {
    console.log('🔧 Adding missing columns to study_sessions table...\n');
    
    try {
        // Add time_studied_seconds column
        await db.run(`
            ALTER TABLE study_sessions 
            ADD COLUMN IF NOT EXISTS time_studied_seconds INTEGER DEFAULT 0
        `);
        console.log('✅ Added time_studied_seconds column');
        
        // Add questions_solved column  
        await db.run(`
            ALTER TABLE study_sessions 
            ADD COLUMN IF NOT EXISTS questions_solved INTEGER DEFAULT 0
        `);
        console.log('✅ Added questions_solved column');
        
        // Add indexes for performance
        await db.run(`
            CREATE INDEX IF NOT EXISTS idx_study_sessions_time_studied 
            ON study_sessions(study_plan_id, time_studied_seconds)
        `);
        console.log('✅ Added index on time_studied_seconds');
        
        await db.run(`
            CREATE INDEX IF NOT EXISTS idx_study_sessions_status_date 
            ON study_sessions(study_plan_id, status, session_date)
        `);
        console.log('✅ Added index on status and date');
        
        // Verify columns exist
        const result = await db.get(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'study_sessions' 
            AND column_name IN ('time_studied_seconds', 'questions_solved')
        `);
        
        if (result) {
            console.log('\n✅ Columns successfully added and verified!');
        }
        
    } catch (error) {
        console.error('❌ Error adding columns:', error.message);
        console.error('Full error:', error);
    } finally {
        await db.close();
        process.exit(0);
    }
}

addMissingColumns();