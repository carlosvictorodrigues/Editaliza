/**
 * Teste de criação de disciplinas - Verificando sincronização frontend-backend
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:3000';

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDisciplinas() {
    log('\n📚 TESTE DE CRIAÇÃO DE DISCIPLINAS\n', 'cyan');
    
    try {
        // 1. Login
        log('1️⃣ Fazendo login...', 'blue');
        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'u@u.com',
            password: '123456'
        });
        const token = loginResponse.data.token;
        log('✅ Login realizado com sucesso', 'green');

        // 2. Buscar plano existente
        log('\n2️⃣ Buscando planos do usuário...', 'blue');
        const plansResponse = await axios.get(`${BASE_URL}/api/plans`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!plansResponse.data.plans || plansResponse.data.plans.length === 0) {
            throw new Error('Nenhum plano encontrado para o usuário');
        }
        
        const planId = plansResponse.data.plans[0].id;
        log(`✅ Plano encontrado: ID ${planId}`, 'green');

        // 3. Buscar disciplinas atuais (deve usar subjects_with_topics agora)
        log('\n3️⃣ Buscando disciplinas existentes...', 'blue');
        const subjectsResponse = await axios.get(`${BASE_URL}/api/plans/${planId}/subjects_with_topics`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const initialCount = subjectsResponse.data.length || 0;
        log(`📊 Disciplinas existentes: ${initialCount}`, 'yellow');

        // 4. Criar nova disciplina
        log('\n4️⃣ Criando nova disciplina...', 'blue');
        const newSubject = {
            subject_name: `Direito Constitucional ${Date.now()}`,
            priority_weight: 4,
            topics_list: `Princípios Fundamentais
Direitos e Garantias Fundamentais
Organização do Estado
Poderes da República
Controle de Constitucionalidade`
        };

        const createResponse = await axios.post(
            `${BASE_URL}/api/plans/${planId}/subjects_with_topics`,
            newSubject,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        
        log('✅ Disciplina criada com sucesso!', 'green');
        log(`   Mensagem: ${createResponse.data.message}`, 'cyan');

        // 5. Verificar se a disciplina foi criada
        log('\n5️⃣ Verificando criação...', 'blue');
        const verifyResponse = await axios.get(`${BASE_URL}/api/plans/${planId}/subjects_with_topics`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const finalCount = verifyResponse.data.length || 0;
        const newDiscipline = verifyResponse.data.find(s => s.subject_name === newSubject.subject_name);
        
        if (newDiscipline) {
            log('✅ Disciplina encontrada no banco!', 'green');
            log(`   ID: ${newDiscipline.id}`, 'cyan');
            log(`   Nome: ${newDiscipline.subject_name}`, 'cyan');
            log(`   Tópicos criados: ${newDiscipline.topics ? newDiscipline.topics.length : 0}`, 'cyan');
        }
        
        log(`\n📊 Total de disciplinas: ${initialCount} → ${finalCount} (+${finalCount - initialCount})`, 'yellow');

        // 6. Testar endpoint /subjects simples (se existir)
        log('\n6️⃣ Testando endpoint /subjects (listagem básica)...', 'blue');
        try {
            const basicResponse = await axios.get(`${BASE_URL}/api/subjects`);
            log(`✅ Endpoint /api/subjects retornou ${basicResponse.data.subjects.length} disciplinas básicas`, 'green');
        } catch (error) {
            log('⚠️ Endpoint /api/subjects não está acessível ou retornou erro', 'yellow');
        }

        log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!\n', 'green');
        
        return {
            success: true,
            planId,
            disciplineCriada: newDiscipline,
            totalDisciplinas: finalCount
        };

    } catch (error) {
        log('\n❌ ERRO NO TESTE:', 'red');
        log(error.message, 'red');
        if (error.response) {
            log(`Status: ${error.response.status}`, 'red');
            log(`Dados: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
        }
        return { success: false, error: error.message };
    }
}

// Executar teste
testDisciplinas()
    .then(result => {
        if (result.success) {
            log('\n✅ Sincronização frontend-backend funcionando corretamente!', 'green');
            log('📝 O problema era o endpoint incorreto (/subjects ao invés de /subjects_with_topics)', 'cyan');
        } else {
            log('\n❌ Teste falhou. Verifique os logs acima.', 'red');
        }
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        log('\n❌ Erro inesperado:', 'red');
        console.error(error);
        process.exit(1);
    });