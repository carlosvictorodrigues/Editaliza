/**
 * TESTE DIRETO DO CONTROLLER DE PLANS
 * Para identificar onde exatamente está falhando
 */

async function testControllerDirect() {
    try {
        // Simular autenticação
        const user = { id: 14 }; // Usuário criado no teste anterior
        
        console.log('🧪 TESTANDO CONTROLLER DIRETAMENTE\n');
        
        // 1. Importar o controller
        const plansController = require('./src/controllers/plans.controller');
        console.log('✅ Controller importado');
        
        // 2. Simular req e res
        const mockReq = {
            user: user,
            body: {
                plan_name: 'Teste Controller Direto',
                exam_date: '2025-11-25',
                description: 'Teste direto do controller'
            }
        };
        
        let responseData = null;
        let responseStatus = null;
        
        const mockRes = {
            status: (code) => {
                responseStatus = code;
                return {
                    json: (data) => {
                        responseData = data;
                        console.log(`\n📤 Controller respondeu com status ${code}:`);
                        console.log(JSON.stringify(data, null, 2));
                        return data;
                    }
                };
            }
        };
        
        console.log('\n📝 Dados da requisição:');
        console.log(JSON.stringify(mockReq.body, null, 2));
        console.log('👤 Usuário ID:', user.id);
        
        console.log('\n🚀 Chamando plansController.createPlan...');
        
        // 3. Chamar o controller
        await plansController.createPlan(mockReq, mockRes);
        
        // 4. Verificar resultado
        if (responseStatus === 201 && responseData && responseData.newPlanId) {
            console.log('\n✅ SUCESSO! Plano criado com ID:', responseData.newPlanId);
        } else if (responseStatus >= 400) {
            console.log('\n❌ ERRO no controller');
            console.log('Status:', responseStatus);
            console.log('Data:', responseData);
        } else {
            console.log('\n⚠️ Resposta inesperada');
            console.log('Status:', responseStatus);
            console.log('Data:', responseData);
        }
        
    } catch (error) {
        console.error('\n💥 ERRO CAPTURADO:');
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        if (error.code) {
            console.error('Código PostgreSQL:', error.code);
        }
    }
    
    process.exit(0);
}

testControllerDirect();