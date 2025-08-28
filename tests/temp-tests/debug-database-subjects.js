/**
 * DEBUG: Verificar conexão direta com o banco para subjects
 */

require('dotenv').config();
const db = require('./database-simple-postgres.js');
const jwt = require('jsonwebtoken');

console.log('🔧 DEBUG: Diagnóstico completo do sistema de subjects');
console.log('=' .repeat(60));

async function debugCompleto() {
    try {
        // 1. Testar conexão do banco
        console.log('\n1. 🗄️ Testando conexão PostgreSQL...');
        const healthResult = await db.healthCheck();
        console.log('   Status:', healthResult.status);
        if (healthResult.status === 'healthy') {
            console.log('   ✅ PostgreSQL conectado com sucesso');
            console.log('   Database:', healthResult.database);
            console.log('   Pool stats:', healthResult.pool);
        } else {
            console.log('   ❌ Problema na conexão:', healthResult.error);
        }
        
        // 2. Verificar schema/tabelas
        console.log('\n2. 📋 Verificando tabelas necessárias...');
        try {
            // Verificar study_plans
            const plans = await db.all('SELECT COUNT(*) as count FROM study_plans LIMIT 1');
            console.log('   ✅ Tabela study_plans:', plans[0]?.count || 0, 'registros');
            
            // Verificar subjects
            const subjects = await db.all('SELECT COUNT(*) as count FROM subjects LIMIT 1');
            console.log('   ✅ Tabela subjects:', subjects[0]?.count || 0, 'registros');
            
            // Verificar topics
            const topics = await db.all('SELECT COUNT(*) as count FROM topics LIMIT 1');
            console.log('   ✅ Tabela topics:', topics[0]?.count || 0, 'registros');
            
            // Verificar users
            const users = await db.all('SELECT COUNT(*) as count FROM users LIMIT 1');
            console.log('   ✅ Tabela users:', users[0]?.count || 0, 'registros');
            
        } catch (error) {
            console.log('   ❌ Erro verificando tabelas:', error.message);
        }
        
        // 3. Testar busca de subjects por plano
        console.log('\n3. 🔍 Testando busca de subjects...');
        try {
            // Primeiro, ver se existem planos
            const allPlans = await db.all('SELECT id, plan_name, user_id FROM study_plans ORDER BY id LIMIT 5');
            console.log('   📋 Planos existentes:', allPlans.length);
            allPlans.forEach(plan => {
                console.log(`      - ID: ${plan.id}, Nome: ${plan.plan_name}, User: ${plan.user_id}`);
            });
            
            if (allPlans.length > 0) {
                const testPlanId = allPlans[0].id;
                const testUserId = allPlans[0].user_id;
                console.log(`   🧪 Testando com Plan ID: ${testPlanId}, User ID: ${testUserId}`);
                
                // Testar query do subjects controller
                const planSubjects = await db.all(`
                    SELECT 
                        id, 
                        subject_name, 
                        priority_weight
                    FROM subjects
                    WHERE study_plan_id = ?
                    ORDER BY subject_name ASC
                `, [testPlanId]);
                
                console.log('   📚 Subjects encontrados:', planSubjects.length);
                planSubjects.forEach(subject => {
                    console.log(`      - ID: ${subject.id}, Nome: ${subject.subject_name}`);
                });
                
                // Testar query com topics
                const subjectsWithTopics = await db.all(`
                    SELECT 
                        s.id as subject_id, 
                        s.subject_name, 
                        s.priority_weight as subject_priority_weight,
                        t.id as topic_id,
                        t.topic_name,
                        t.status,
                        t.completion_date,
                        t.priority_weight as topic_priority_weight,
                        t.description
                    FROM subjects s
                    LEFT JOIN topics t ON s.id = t.subject_id
                    WHERE s.study_plan_id = ?
                    ORDER BY s.subject_name ASC, t.topic_name ASC
                `, [testPlanId]);
                
                console.log('   🔗 Subjects + Topics:', subjectsWithTopics.length, 'registros');
                
            }
        } catch (error) {
            console.log('   ❌ Erro testando subjects:', error.message);
            console.log('   Stack:', error.stack);
        }
        
        // 4. Testar geração de token JWT
        console.log('\n4. 🔐 Testando JWT...');
        const JWT_SECRET = process.env.JWT_SECRET;
        console.log('   JWT_SECRET carregado:', !!JWT_SECRET, JWT_SECRET?.substring(0, 10) + '...');
        
        if (JWT_SECRET) {
            const testPayload = {
                id: 1,
                email: 'test@example.com',
                role: 'user',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (60 * 60)
            };
            
            const testToken = jwt.sign(testPayload, JWT_SECRET);
            console.log('   ✅ Token gerado:', testToken.substring(0, 50) + '...');
            
            // Verificar se consegue decodificar
            try {
                const decoded = jwt.verify(testToken, JWT_SECRET);
                console.log('   ✅ Token válido - User ID:', decoded.id, 'Email:', decoded.email);
            } catch (error) {
                console.log('   ❌ Token inválido:', error.message);
            }
        }
        
        // 5. Testar autenticação manual
        console.log('\n5. 🧪 Simulando fluxo de autenticação...');
        try {
            const testUser = {
                id: 1,
                email: 'test@example.com',
                role: 'user'
            };
            
            // Verificar se user existe (ou criar um teste)
            const existingUser = await db.get('SELECT id, email FROM users WHERE id = ?', [testUser.id]);
            if (!existingUser) {
                console.log('   ℹ️ User ID 1 não existe, verificando qualquer usuário...');
                const anyUser = await db.get('SELECT id, email FROM users LIMIT 1');
                if (anyUser) {
                    testUser.id = anyUser.id;
                    testUser.email = anyUser.email;
                    console.log('   ✅ Usando usuário existente:', testUser.email, 'ID:', testUser.id);
                } else {
                    console.log('   ⚠️ Nenhum usuário encontrado no banco');
                }
            } else {
                console.log('   ✅ Usuário teste encontrado:', existingUser.email);
            }
            
            // Verificar se user tem planos
            if (testUser.id) {
                const userPlans = await db.all('SELECT id, plan_name FROM study_plans WHERE user_id = ?', [testUser.id]);
                console.log('   📋 Planos do usuário:', userPlans.length);
                userPlans.forEach(plan => {
                    console.log(`      - ID: ${plan.id}, Nome: ${plan.plan_name}`);
                });
            }
            
        } catch (error) {
            console.log('   ❌ Erro simulando autenticação:', error.message);
        }
        
        console.log('\n' + '=' .repeat(60));
        console.log('🏁 Diagnóstico concluído!');
        
    } catch (error) {
        console.error('❌ Erro geral no diagnóstico:', error);
    }
}

// Executar diagnóstico
if (require.main === module) {
    debugCompleto().then(() => {
        console.log('✅ Debug finalizado');
        process.exit(0);
    }).catch(console.error);
}

module.exports = { debugCompleto };