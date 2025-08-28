#!/usr/bin/env node

/**
 * 🔍 DEBUG ESPECÍFICO PARA ERRO DE DISCIPLINAS
 * 
 * Vamos debugar exatamente onde está o erro na criação de disciplinas
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function debugDisciplinas() {
    console.log('\n🔍 DEBUGGING ERRO DE DISCIPLINAS\n');

    // Primeiro, fazer login e criar plano
    console.log('1. Criando usuário de teste...');
    
    const testUser = {
        name: 'Debug Disciplinas',
        email: `debug${Date.now()}@test.com`,
        password: 'TestPassword123!'
    };

    let authToken = null;
    let planId = null;

    try {
        // Registrar usuário
        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
        authToken = registerResponse.data.token;
        console.log('✅ Usuário criado, token obtido');

        // Criar plano
        const planData = {
            plan_name: 'Debug Plan',
            exam_date: '2025-12-31'
        };
        
        const createPlanResponse = await axios.post(
            `${BASE_URL}/api/plans`, 
            planData,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        
        planId = createPlanResponse.data.newPlanId;
        console.log('✅ Plano criado, ID:', planId);

    } catch (error) {
        console.error('❌ Erro na preparação:', error.response?.data || error.message);
        return;
    }

    // Agora testar criação de disciplina com logs detalhados
    console.log('\n2. Testando criação de disciplina...');
    
    const subjectData = {
        subject_name: 'Teste Debug',
        priority_weight: 3,
        topics_list: 'Tópico 1\nTópico 2\nTópico 3'
    };

    try {
        console.log('📤 Enviando request para:', `${BASE_URL}/api/plans/${planId}/subjects_with_topics`);
        console.log('📤 Dados:', JSON.stringify(subjectData, null, 2));
        console.log('📤 Headers:', { 'Authorization': `Bearer ${authToken}` });

        const createSubjectResponse = await axios({
            method: 'POST',
            url: `${BASE_URL}/api/plans/${planId}/subjects_with_topics`,
            data: subjectData,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('✅ Disciplina criada com sucesso!');
        console.log('📥 Resposta:', JSON.stringify(createSubjectResponse.data, null, 2));

    } catch (error) {
        console.error('\n❌ ERRO DETALHADO:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Headers:', error.response?.headers);
        console.error('Data:', error.response?.data);
        console.error('Message:', error.message);
        console.error('Full Error:', error);
    }

    // Verificar se há logs no console do servidor
    console.log('\n3. Aguardando para verificar logs do servidor...');
    await new Promise(resolve => setTimeout(resolve, 2000));
}

debugDisciplinas();