#!/usr/bin/env node

/**
 * TJPE Study Plan Restoration Script
 * 
 * This script restores the original TJPE (Tribunal de Justiça de Pernambuco) 
 * study plan for user 3@3.com (ID: 1000) from the backup database.
 * 
 * The original plan "Tec Jud TJPE" was lost during deployment preparations
 * and replaced with a test plan "Concurso Público Federal - Teste".
 * 
 * This script extracts the complete plan data from backup_20250805_170207/db_backup.sqlite
 * and restores it to the current database for user 3@3.com.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class TJPERestorer {
    constructor() {
        this.currentDbPath = path.join(__dirname, '..', 'db.sqlite');
        this.backupDbPath = path.join(__dirname, '..', 'backup_20250805_170207', 'db_backup.sqlite');
        this.currentDb = null;
        this.backupDb = null;
        this.targetUserId = 1000; // User 3@3.com
        this.originalUserId = 2; // Original user in backup
        this.originalPlanId = 1; // Original TJPE plan ID in backup
    }

    async connect() {
        console.log('🔌 Connecting to databases...');
        
        return new Promise((resolve, reject) => {
            this.currentDb = new sqlite3.Database(this.currentDbPath, (err) => {
                if (err) {
                    reject(new Error(`Failed to connect to current database: ${err.message}`));
                    return;
                }
                
                this.backupDb = new sqlite3.Database(this.backupDbPath, (err) => {
                    if (err) {
                        reject(new Error(`Failed to connect to backup database: ${err.message}`));
                        return;
                    }
                    
                    console.log('✅ Connected to both databases');
                    resolve();
                });
            });
        });
    }

    async close() {
        const promises = [];
        
        if (this.currentDb) {
            promises.push(new Promise(resolve => {
                this.currentDb.close((err) => {
                    if (err) console.error('Error closing current database:', err);
                    resolve();
                });
            }));
        }
        
        if (this.backupDb) {
            promises.push(new Promise(resolve => {
                this.backupDb.close((err) => {
                    if (err) console.error('Error closing backup database:', err);
                    resolve();
                });
            }));
        }
        
        await Promise.all(promises);
        console.log('📴 Database connections closed');
    }

    async runQuery(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async getQuery(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getAllQuery(db, sql, params = []) {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async extractTJPEData() {
        console.log('📊 Extracting original TJPE plan data from backup...');
        
        try {
            // Extract the original TJPE plan
            const originalPlan = await this.getQuery(this.backupDb, 
                'SELECT * FROM study_plans WHERE id = ?', [this.originalPlanId]);
            
            if (!originalPlan) {
                throw new Error('Original TJPE plan not found in backup!');
            }
            
            console.log('✅ Found original TJPE plan:', originalPlan.plan_name);
            
            // Extract subjects
            const subjects = await this.getAllQuery(this.backupDb, 
                'SELECT * FROM subjects WHERE study_plan_id = ?', [this.originalPlanId]);
            
            console.log(`✅ Found ${subjects.length} subjects`);
            
            // Extract topics for all subjects
            const topics = await this.getAllQuery(this.backupDb, 
                'SELECT * FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)', 
                [this.originalPlanId]);
            
            console.log(`✅ Found ${topics.length} topics`);
            
            // Extract study sessions
            const sessions = await this.getAllQuery(this.backupDb, 
                'SELECT * FROM study_sessions WHERE study_plan_id = ?', [this.originalPlanId]);
            
            console.log(`✅ Found ${sessions.length} study sessions`);
            
            return {
                plan: originalPlan,
                subjects: subjects,
                topics: topics,
                sessions: sessions
            };
            
        } catch (error) {
            console.error('❌ Error extracting TJPE data:', error.message);
            throw error;
        }
    }

    async cleanCurrentData() {
        console.log('🧹 Cleaning current test data for user 3@3.com...');
        
        try {
            // Delete in correct order to respect foreign key constraints
            await this.runQuery(this.currentDb, 
                'DELETE FROM study_sessions WHERE study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)', 
                [this.targetUserId]);
            
            await this.runQuery(this.currentDb, 
                'DELETE FROM topics WHERE subject_id IN (SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_plan_id = sp.id WHERE sp.user_id = ?)', 
                [this.targetUserId]);
            
            await this.runQuery(this.currentDb, 
                'DELETE FROM subjects WHERE study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)', 
                [this.targetUserId]);
            
            await this.runQuery(this.currentDb, 
                'DELETE FROM study_plans WHERE user_id = ?', 
                [this.targetUserId]);
            
            console.log('✅ Current test data cleaned successfully');
            
        } catch (error) {
            console.error('❌ Error cleaning current data:', error.message);
            throw error;
        }
    }

    async restoreTJPEData(tjpeData) {
        console.log('🔄 Restoring original TJPE plan data...');
        
        try {
            // 1. Create the study plan
            const planResult = await this.runQuery(this.currentDb, `
                INSERT INTO study_plans (
                    user_id, plan_name, exam_date, study_hours_per_day,
                    daily_question_goal, weekly_question_goal, session_duration_minutes,
                    review_mode, postponement_count, has_essay
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                this.targetUserId,
                tjpeData.plan.plan_name,
                tjpeData.plan.exam_date,
                tjpeData.plan.study_hours_per_day,
                tjpeData.plan.daily_question_goal,
                tjpeData.plan.weekly_question_goal,
                tjpeData.plan.session_duration_minutes,
                tjpeData.plan.review_mode,
                tjpeData.plan.postponement_count,
                tjpeData.plan.has_essay
            ]);
            
            const newPlanId = planResult.lastID;
            console.log(`✅ Study plan restored with ID: ${newPlanId}`);
            
            // 2. Create subjects with ID mapping
            const subjectIdMapping = {};
            
            for (const subject of tjpeData.subjects) {
                const subjectResult = await this.runQuery(this.currentDb, `
                    INSERT INTO subjects (study_plan_id, subject_name, priority_weight)
                    VALUES (?, ?, ?)
                `, [newPlanId, subject.subject_name, subject.priority_weight]);
                
                subjectIdMapping[subject.id] = subjectResult.lastID;
            }
            
            console.log(`✅ ${tjpeData.subjects.length} subjects restored`);
            
            // 3. Create topics with ID mapping
            const topicIdMapping = {};
            
            for (const topic of tjpeData.topics) {
                const newSubjectId = subjectIdMapping[topic.subject_id];
                if (!newSubjectId) {
                    console.warn(`⚠️ Subject ID ${topic.subject_id} not found for topic ${topic.id}`);
                    continue;
                }
                
                const topicResult = await this.runQuery(this.currentDb, `
                    INSERT INTO topics (subject_id, description, status, completion_date)
                    VALUES (?, ?, ?, ?)
                `, [newSubjectId, topic.description, topic.status, topic.completion_date]);
                
                topicIdMapping[topic.id] = topicResult.lastID;
            }
            
            console.log(`✅ ${tjpeData.topics.length} topics restored`);
            
            // 4. Create study sessions
            let sessionsRestored = 0;
            
            for (const session of tjpeData.sessions) {
                const newTopicId = session.topic_id ? topicIdMapping[session.topic_id] : null;
                
                await this.runQuery(this.currentDb, `
                    INSERT INTO study_sessions (
                        study_plan_id, topic_id, subject_name, topic_description,
                        session_date, session_type, status, notes, questions_solved
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    newPlanId,
                    newTopicId,
                    session.subject_name,
                    session.topic_description,
                    session.session_date,
                    session.session_type,
                    session.status,
                    session.notes,
                    session.questions_solved
                ]);
                
                sessionsRestored++;
            }
            
            console.log(`✅ ${sessionsRestored} study sessions restored`);
            
            return {
                planId: newPlanId,
                subjectsCount: tjpeData.subjects.length,
                topicsCount: tjpeData.topics.length,
                sessionsCount: sessionsRestored
            };
            
        } catch (error) {
            console.error('❌ Error restoring TJPE data:', error.message);
            throw error;
        }
    }

    async verifyRestoration() {
        console.log('🔍 Verifying restoration...');
        
        try {
            // Check if user has the TJPE plan
            const plan = await this.getQuery(this.currentDb, 
                'SELECT * FROM study_plans WHERE user_id = ?', [this.targetUserId]);
            
            if (!plan) {
                throw new Error('No study plan found for user 3@3.com');
            }
            
            if (plan.plan_name !== 'Tec Jud TJPE') {
                throw new Error(`Expected plan name "Tec Jud TJPE", got "${plan.plan_name}"`);
            }
            
            // Count subjects
            const subjectCount = await this.getQuery(this.currentDb, 
                'SELECT COUNT(*) as count FROM subjects WHERE study_plan_id = ?', [plan.id]);
            
            // Count topics
            const topicCount = await this.getQuery(this.currentDb, 
                'SELECT COUNT(*) as count FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)', 
                [plan.id]);
            
            // Count sessions
            const sessionCount = await this.getQuery(this.currentDb, 
                'SELECT COUNT(*) as count FROM study_sessions WHERE study_plan_id = ?', [plan.id]);
            
            console.log('📊 RESTORATION VERIFICATION:');
            console.log(`   👤 User ID: ${this.targetUserId} (3@3.com)`);
            console.log(`   📚 Plan: "${plan.plan_name}"`);
            console.log(`   📅 Exam Date: ${plan.exam_date}`);
            console.log(`   📖 Subjects: ${subjectCount.count}`);
            console.log(`   📝 Topics: ${topicCount.count}`);
            console.log(`   ⏱️ Sessions: ${sessionCount.count}`);
            console.log(`   ✏️ Has Essay: ${plan.has_essay ? 'Yes' : 'No'}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
            throw error;
        }
    }

    async showOriginalData() {
        console.log('📋 ORIGINAL TJPE PLAN DETAILS FROM BACKUP:');
        
        try {
            const plan = await this.getQuery(this.backupDb, 
                'SELECT * FROM study_plans WHERE id = ?', [this.originalPlanId]);
            
            const subjects = await this.getAllQuery(this.backupDb, 
                'SELECT * FROM subjects WHERE study_plan_id = ? ORDER BY priority_weight DESC', 
                [this.originalPlanId]);
            
            console.log(`\n🎯 Plan: ${plan.plan_name}`);
            console.log(`📅 Exam Date: ${plan.exam_date}`);
            console.log(`⏰ Study Hours per Day: ${plan.study_hours_per_day}`);
            console.log(`🎯 Daily Questions Goal: ${plan.daily_question_goal}`);
            console.log(`⏱️ Session Duration: ${plan.session_duration_minutes} minutes`);
            console.log(`✏️ Has Essay: ${plan.has_essay ? 'Yes' : 'No'}\n`);
            
            console.log('📚 SUBJECTS BY PRIORITY:');
            for (const subject of subjects) {
                const topicCount = await this.getQuery(this.backupDb, 
                    'SELECT COUNT(*) as count FROM topics WHERE subject_id = ?', [subject.id]);
                
                console.log(`   ${subject.priority_weight}. ${subject.subject_name} (${topicCount.count} topics)`);
            }
            
        } catch (error) {
            console.error('❌ Error showing original data:', error.message);
        }
    }
}

/**
 * Main execution function
 */
async function main() {
    console.log('🏛️ TJPE STUDY PLAN RESTORATION');
    console.log('===============================');
    console.log('Restoring original TJPE study plan for user 3@3.com');
    console.log('from backup_20250805_170207/db_backup.sqlite\n');
    
    const restorer = new TJPERestorer();
    
    try {
        // Connect to databases
        await restorer.connect();
        
        // Show what we're restoring
        await restorer.showOriginalData();
        
        console.log('\n🔄 STARTING RESTORATION PROCESS...\n');
        
        // Extract original data
        const tjpeData = await restorer.extractTJPEData();
        
        // Clean current test data
        await restorer.cleanCurrentData();
        
        // Restore TJPE data
        const result = await restorer.restoreTJPEData(tjpeData);
        
        // Verify restoration
        await restorer.verifyRestoration();
        
        console.log('\n🎉 RESTORATION COMPLETED SUCCESSFULLY!');
        console.log('\n📊 SUMMARY:');
        console.log(`   ✅ Plan restored: "Tec Jud TJPE"`);
        console.log(`   ✅ Subjects: ${result.subjectsCount}`);
        console.log(`   ✅ Topics: ${result.topicsCount}`);
        console.log(`   ✅ Sessions: ${result.sessionsCount}`);
        console.log(`   ✅ Target user: 3@3.com (ID: ${restorer.targetUserId})`);
        
        console.log('\n🚀 READY FOR DEPLOYMENT!');
        console.log('The original TJPE study plan has been fully restored.');
        console.log('User 3@3.com can now access their original study plan.');
        
    } catch (error) {
        console.error('\n💥 RESTORATION FAILED:', error.message);
        console.error('\n🔧 Possible solutions:');
        console.error('   1. Ensure backup database exists and is readable');
        console.error('   2. Check database permissions');
        console.error('   3. Verify database schema compatibility');
        
        process.exit(1);
    } finally {
        await restorer.close();
    }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
    console.log('\n⏹️ Restoration interrupted by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️ Restoration terminated');
    process.exit(0);
});

// Run the restoration
if (require.main === module) {
    main();
}

module.exports = { TJPERestorer };