/**
 * Test Data Seeder for Testing Fortress
 * Creates realistic test data for comprehensive endpoint validation
 * 
 * This seeder creates:
 * - Test users with authentication credentials
 * - Study plans with realistic data
 * - Study sessions with proper relationships
 * - Activity records for statistics validation
 */

const bcrypt = require('bcryptjs');
const { dbRun, dbGet } = require('../../src/utils/database');
const { securityLog } = require('../../src/utils/security');

/**
 * Clean all test data
 */
const cleanTestData = async () => {
    console.log('🧹 Limpando dados de teste existentes...');
    
    try {
        // Order matters due to foreign key constraints
        await dbRun('DELETE FROM user_activities WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com")');
        await dbRun('DELETE FROM study_sessions WHERE plan_id IN (SELECT id FROM study_plans WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com"))');
        await dbRun('DELETE FROM study_plan_subjects WHERE plan_id IN (SELECT id FROM study_plans WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com"))');
        await dbRun('DELETE FROM study_plans WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com")');
        await dbRun('DELETE FROM user_settings WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com")');
        await dbRun('DELETE FROM user_preferences WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com")');
        await dbRun('DELETE FROM privacy_settings WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com")');
        await dbRun('DELETE FROM users WHERE email LIKE "%@testfortress.com"');
        
        console.log('✅ Dados de teste limpos com sucesso');
    } catch (error) {
        console.error('❌ Erro ao limpar dados de teste:', error.message);
        throw error;
    }
};

/**
 * Create test users with different profiles
 */
const createTestUsers = async () => {
    console.log('👤 Criando usuários de teste...');
    
    const testUsers = [
        {
            email: 'ativo@testfortress.com',
            name: 'Usuário Ativo',
            password: 'TestFortress123!',
            profile: 'active_user',
            state: 'SP',
            city: 'São Paulo',
            education: 'Superior Completo',
            work_status: 'Empregado',
            area_interest: 'Concursos Públicos'
        },
        {
            email: 'iniciante@testfortress.com',
            name: 'Estudante Iniciante',
            password: 'TestFortress123!',
            profile: 'beginner',
            state: 'RJ',
            city: 'Rio de Janeiro',
            education: 'Superior Incompleto',
            work_status: 'Estudante',
            area_interest: 'Concursos Federais'
        },
        {
            email: 'experiente@testfortress.com',
            name: 'Concurseiro Experiente',
            password: 'TestFortress123!',
            profile: 'experienced',
            state: 'MG',
            city: 'Belo Horizonte',
            education: 'Pós-Graduação',
            work_status: 'Servidor Público',
            area_interest: 'Tribunais'
        }
    ];
    
    const createdUsers = [];
    
    for (const userData of testUsers) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 12);
            
            const result = await dbRun(`
                INSERT INTO users (
                    email, name, password_hash, state, city, education, work_status,
                    area_interest, auth_provider, is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userData.email,
                userData.name,
                hashedPassword,
                userData.state,
                userData.city,
                userData.education,
                userData.work_status,
                userData.area_interest,
                'local',
                1,
                new Date().toISOString()
            ]);
            
            const user = await dbGet('SELECT * FROM users WHERE id = ?', [result.lastID]);
            createdUsers.push({ ...user, profile: userData.profile });
            
            console.log(`   ✅ Usuário criado: ${userData.name} (ID: ${result.lastID})`);
        } catch (error) {
            console.error(`   ❌ Erro ao criar usuário ${userData.email}:`, error.message);
            throw error;
        }
    }
    
    return createdUsers;
};

/**
 * Create study plans for test users
 */
const createStudyPlans = async (users) => {
    console.log('📚 Criando planos de estudo...');
    
    const planTemplates = [
        {
            name: 'Concurso INSS - Técnico',
            exam_date: '2025-12-15',
            study_hours_per_day: '{"1": 3, "2": 3, "3": 3, "4": 3, "5": 3, "6": 2, "0": 0}',
            daily_question_goal: 50,
            subjects: ['Direito Previdenciário', 'Direito Constitucional', 'Português', 'Informática'],
            difficulty: 'intermediario'
        },
        {
            name: 'TRT - Analista Judiciário',
            exam_date: '2025-10-20',
            study_hours_per_day: '{"1": 4, "2": 4, "3": 4, "4": 4, "5": 4, "6": 3, "0": 1}',
            daily_question_goal: 80,
            subjects: ['Direito do Trabalho', 'Direito Processual', 'Português', 'Raciocínio Lógico'],
            difficulty: 'avancado'
        },
        {
            name: 'Concurso Municipal - Nível Médio',
            exam_date: '2026-03-10',
            study_hours_per_day: '{"1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 1, "0": 0}',
            daily_question_goal: 30,
            subjects: ['Português', 'Matemática', 'Conhecimentos Gerais', 'Informática'],
            difficulty: 'basico'
        }
    ];
    
    const createdPlans = [];
    
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const planTemplate = planTemplates[i % planTemplates.length];
        
        try {
            const result = await dbRun(`
                INSERT INTO study_plans (
                    user_id, plan_name, exam_date, study_hours_per_day,
                    daily_question_goal, weekly_question_goal,
                    session_duration_minutes, review_mode, postponement_count,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                user.id,
                planTemplate.name,
                planTemplate.exam_date,
                planTemplate.study_hours_per_day,
                planTemplate.daily_question_goal,
                planTemplate.daily_question_goal * 7,
                50,
                'completo',
                0,
                new Date().toISOString(),
                new Date().toISOString()
            ]);
            
            const plan = await dbGet('SELECT * FROM study_plans WHERE id = ?', [result.lastID]);
            createdPlans.push({ ...plan, subjects: planTemplate.subjects });
            
            console.log(`   ✅ Plano criado: ${planTemplate.name} para ${user.name} (ID: ${result.lastID})`);
            
            // Create additional plan for experienced user
            if (user.profile === 'experienced') {
                const additionalResult = await dbRun(`
                    INSERT INTO study_plans (
                        user_id, plan_name, exam_date, study_hours_per_day,
                        daily_question_goal, weekly_question_goal,
                        session_duration_minutes, review_mode, postponement_count,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    user.id,
                    'Revisão Geral - Múltiplos Concursos',
                    '2025-08-30',
                    '{"1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 4, "0": 0}',
                    100,
                    700,
                    25,
                    'rapido',
                    0,
                    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
                    new Date().toISOString()
                ]);
                
                const additionalPlan = await dbGet('SELECT * FROM study_plans WHERE id = ?', [additionalResult.lastID]);
                createdPlans.push({ ...additionalPlan, subjects: ['Revisão Geral'] });
                
                console.log(`   ✅ Plano adicional criado para usuário experiente (ID: ${additionalResult.lastID})`);
            }
            
        } catch (error) {
            console.error(`   ❌ Erro ao criar plano para ${user.name}:`, error.message);
            throw error;
        }
    }
    
    return createdPlans;
};

/**
 * Create study sessions for plans
 */
const createStudySessions = async (plans) => {
    console.log('⏱️ Criando sessões de estudo...');
    
    const createdSessions = [];
    
    for (const plan of plans) {
        const sessionsCount = Math.floor(Math.random() * 20) + 10; // 10-30 sessions per plan
        
        for (let i = 0; i < sessionsCount; i++) {
            try {
                // Create sessions for the last 60 days
                const sessionDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);
                const isCompleted = Math.random() > 0.3; // 70% completed
                const studyTime = isCompleted ? Math.floor(Math.random() * 7200) + 1800 : 0; // 30min to 2h
                
                const subjects = plan.subjects || ['Matéria Geral'];
                const subject = subjects[Math.floor(Math.random() * subjects.length)];
                
                const result = await dbRun(`
                    INSERT INTO study_sessions (
                        plan_id, user_id, session_date, subject_name,
                        planned_duration_minutes, time_studied_seconds,
                        questions_planned, questions_completed,
                        status, session_type, notes, created_at, updated_at,
                        completed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    plan.id,
                    plan.user_id,
                    sessionDate.toISOString().split('T')[0], // YYYY-MM-DD
                    subject,
                    50,
                    studyTime,
                    plan.daily_question_goal || 30,
                    isCompleted ? Math.floor(Math.random() * (plan.daily_question_goal || 30)) : 0,
                    isCompleted ? 'Concluído' : 'Pendente',
                    Math.random() > 0.5 ? 'Novo Tópico' : 'Revisão',
                    isCompleted ? 'Sessão concluída com sucesso' : '',
                    sessionDate.toISOString(),
                    sessionDate.toISOString(),
                    isCompleted ? sessionDate.toISOString() : null
                ]);
                
                createdSessions.push({ id: result.lastID, plan_id: plan.id, user_id: plan.user_id });
                
            } catch (error) {
                console.error(`   ❌ Erro ao criar sessão para plano ${plan.id}:`, error.message);
                // Continue with other sessions
            }
        }
        
        console.log(`   ✅ Sessões criadas para plano: ${plan.plan_name} (${sessionsCount} sessões)`);
    }
    
    return createdSessions;
};

/**
 * Create user activities for statistics
 */
const createUserActivities = async (users, plans) => {
    console.log('📊 Criando atividades de usuário...');
    
    for (const user of users) {
        const userPlans = plans.filter(p => p.user_id === user.id);
        
        try {
            // Login activities
            for (let i = 0; i < 30; i++) {
                const activityDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
                
                await dbRun(`
                    INSERT INTO user_activities (
                        user_id, activity_type, duration, metadata, created_at
                    ) VALUES (?, ?, ?, ?, ?)
                `, [
                    user.id,
                    'login',
                    null,
                    JSON.stringify({ ip: '127.0.0.1', user_agent: 'Test Browser' }),
                    activityDate.toISOString()
                ]);
            }
            
            // Study activities
            for (const plan of userPlans) {
                const studyActivities = Math.floor(Math.random() * 50) + 20;
                
                for (let i = 0; i < studyActivities; i++) {
                    const activityDate = new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000);
                    const duration = Math.floor(Math.random() * 120) + 30; // 30-150 minutes
                    
                    await dbRun(`
                        INSERT INTO user_activities (
                            user_id, activity_type, duration, metadata, created_at
                        ) VALUES (?, ?, ?, ?, ?)
                    `, [
                        user.id,
                        'study',
                        duration,
                        JSON.stringify({ plan_id: plan.id, subject: 'General' }),
                        activityDate.toISOString()
                    ]);
                }
            }
            
            // Plan creation activity
            await dbRun(`
                INSERT INTO user_activities (
                    user_id, activity_type, duration, metadata, created_at
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                user.id,
                'plan_creation',
                null,
                JSON.stringify({ plans_count: userPlans.length }),
                new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() // 20 days ago
            ]);
            
            console.log(`   ✅ Atividades criadas para: ${user.name}`);
            
        } catch (error) {
            console.error(`   ❌ Erro ao criar atividades para ${user.name}:`, error.message);
        }
    }
};

/**
 * Create user settings and preferences
 */
const createUserSettings = async (users) => {
    console.log('⚙️ Criando configurações de usuário...');
    
    for (const user of users) {
        try {
            // User settings
            await dbRun(`
                INSERT OR REPLACE INTO user_settings (
                    user_id, theme, language, timezone, auto_save, compact_mode, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                user.id,
                user.profile === 'experienced' ? 'dark' : 'light',
                'pt-BR',
                'America/Sao_Paulo',
                1,
                user.profile === 'experienced' ? 1 : 0,
                new Date().toISOString()
            ]);
            
            // User preferences
            await dbRun(`
                INSERT OR REPLACE INTO user_preferences (
                    user_id, email_notifications, push_notifications,
                    study_reminders, progress_reports, marketing_emails, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                user.id,
                1,
                user.profile !== 'beginner' ? 1 : 0,
                1,
                1,
                user.profile === 'active_user' ? 1 : 0,
                new Date().toISOString()
            ]);
            
            // Privacy settings
            await dbRun(`
                INSERT OR REPLACE INTO privacy_settings (
                    user_id, profile_visibility, show_email, show_progress, allow_contact, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                user.id,
                user.profile === 'experienced' ? 'public' : 'private',
                0,
                user.profile === 'experienced' ? 1 : 0,
                1,
                new Date().toISOString()
            ]);
            
            console.log(`   ✅ Configurações criadas para: ${user.name}`);
            
        } catch (error) {
            console.error(`   ❌ Erro ao criar configurações para ${user.name}:`, error.message);
        }
    }
};

/**
 * Main seeder function
 */
const seedTestData = async () => {
    console.log('🌱 INICIANDO SEEDING DE DADOS DE TESTE PARA TESTING FORTRESS');
    console.log('================================================================');
    
    try {
        // Step 1: Clean existing test data
        await cleanTestData();
        
        // Step 2: Create test users
        const users = await createTestUsers();
        
        // Step 3: Create study plans
        const plans = await createStudyPlans(users);
        
        // Step 4: Create study sessions
        const sessions = await createStudySessions(plans);
        
        // Step 5: Create user activities
        await createUserActivities(users, plans);
        
        // Step 6: Create user settings
        await createUserSettings(users);
        
        console.log('================================================================');
        console.log('🎉 SEEDING CONCLUÍDO COM SUCESSO!');
        console.log('');
        console.log('📊 RESUMO DOS DADOS CRIADOS:');
        console.log(`   👤 Usuários: ${users.length}`);
        console.log(`   📚 Planos: ${plans.length}`);
        console.log(`   ⏱️ Sessões: ${sessions.length}`);
        console.log('');
        console.log('🔐 CREDENCIAIS DE TESTE:');
        users.forEach(user => {
            console.log(`   📧 ${user.email} | 🔑 TestFortress123! | 🏷️ ${user.profile}`);
        });
        console.log('');
        console.log('✅ Dados prontos para testes de endpoints de Plans!');
        
        securityLog('test_data_seeded', { users: users.length, plans: plans.length, sessions: sessions.length });
        
        return {
            success: true,
            summary: {
                users: users.length,
                plans: plans.length,
                sessions: sessions.length
            },
            testCredentials: users.map(u => ({
                email: u.email,
                password: 'TestFortress123!',
                profile: u.profile
            }))
        };
        
    } catch (error) {
        console.error('❌ ERRO NO SEEDING:', error.message);
        securityLog('test_data_seeding_error', { error: error.message });
        throw error;
    }
};

/**
 * Quick validation of seeded data
 */
const validateSeededData = async () => {
    console.log('🔍 Validando dados criados...');
    
    try {
        const userCount = await dbGet('SELECT COUNT(*) as count FROM users WHERE email LIKE "%@testfortress.com"');
        const planCount = await dbGet('SELECT COUNT(*) as count FROM study_plans WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com")');
        const sessionCount = await dbGet('SELECT COUNT(*) as count FROM study_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com")');
        const activityCount = await dbGet('SELECT COUNT(*) as count FROM user_activities WHERE user_id IN (SELECT id FROM users WHERE email LIKE "%@testfortress.com")');
        
        console.log('📊 VALIDAÇÃO DOS DADOS:');
        console.log(`   ✅ Usuários encontrados: ${userCount.count}`);
        console.log(`   ✅ Planos encontrados: ${planCount.count}`);
        console.log(`   ✅ Sessões encontradas: ${sessionCount.count}`);
        console.log(`   ✅ Atividades encontradas: ${activityCount.count}`);
        
        if (userCount.count === 0 || planCount.count === 0) {
            throw new Error('Dados de teste não foram criados corretamente');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro na validação:', error.message);
        throw error;
    }
};

module.exports = {
    seedTestData,
    cleanTestData,
    validateSeededData,
    createTestUsers,
    createStudyPlans,
    createStudySessions
};