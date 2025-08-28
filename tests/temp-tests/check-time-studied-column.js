const db = require('./database-postgres-direct');

async function checkColumn() {
    try {
        // Check if column exists
        const result = await db.get(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'study_sessions' 
            AND column_name = 'time_studied_seconds'
        `);
        
        if (result) {
            console.log('✅ Column exists:', result);
        } else {
            console.log('❌ Column does NOT exist');
            
            // Try to add it
            console.log('\n🔧 Adding column...');
            await db.run(`
                ALTER TABLE study_sessions 
                ADD COLUMN IF NOT EXISTS time_studied_seconds INTEGER DEFAULT 0
            `);
            console.log('✅ Column added successfully');
        }
        
        // Test a simple query
        const test = await db.get(`
            SELECT COUNT(*) as count 
            FROM study_sessions 
            WHERE time_studied_seconds >= 0
        `);
        console.log('\n✅ Test query successful:', test);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await db.close();
    }
}

checkColumn();