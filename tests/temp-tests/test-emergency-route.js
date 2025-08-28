#!/usr/bin/env node

/**
 * 🚨 TESTE DE ROTA DE EMERGÊNCIA
 * 
 * Testa a rota de emergência que bypassa TODOS os middlewares
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testeEmergencia() {
    console.log('\n🚨 TESTE DE EMERGÊNCIA - BYPASS TOTAL\n');

    try {
        console.log('1. Testando rota de emergência...');
        
        const testData = {
            subject_name: 'Disciplina Emergência',
            priority_weight: 5,
            topics_list: 'Tópico Emergency 1\nTópico Emergency 2\nTópico Emergency 3'
        };
        
        console.log('📤 Dados de teste:', testData);
        console.log('📤 URL:', `${BASE_URL}/api/plans/TEST_EMERGENCY/99/subjects`);

        const response = await axios({
            method: 'POST',
            url: `${BASE_URL}/api/plans/TEST_EMERGENCY/99/subjects`,
            data: testData,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log('\n✅ RESPOSTA DE EMERGÊNCIA:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        if (response.data.success) {
            console.log('\n🎉 TESTE DE EMERGÊNCIA PASSOU!');
            console.log('✅ PostgreSQL funcionando');
            console.log('✅ Criação de disciplinas funcionando');
            console.log('✅ Criação de tópicos funcionando');
            console.log('\n📊 Resultados:');
            console.log('- Subject ID:', response.data.subjectId);
            console.log('- Tópicos criados:', response.data.topicsCount);
            
            console.log('\n🔍 DIAGNÓSTICO:');
            console.log('O problema NÃO está no PostgreSQL ou nas tabelas.');
            console.log('O problema está nos middlewares, services ou controllers.');
            console.log('Recomendação: Corrigir os middlewares de autenticação e validação.');
        } else {
            console.log('\n❌ TESTE DE EMERGÊNCIA FALHOU');
        }

    } catch (error) {
        console.error('\n💥 ERRO NO TESTE DE EMERGÊNCIA:', {
            status: error.response?.status,
            message: error.response?.data?.error || error.message,
            details: error.response?.data?.details,
            stack: error.response?.data?.stack
        });
        
        if (error.response?.data?.stack) {
            console.error('\n📍 STACK TRACE:');
            console.error(error.response.data.stack);
        }
    }
}

testeEmergencia();