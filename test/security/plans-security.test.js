/**
 * TESTE DE SEGURANÇA CRÍTICO - ISOLAMENTO DE PLANOS POR USUÁRIO
 * 
 * Este teste garante que usuários NUNCA possam acessar planos de outros usuários
 * Previne o bug crítico onde planos de outros usuários eram retornados
 */

const request = require('supertest');
const app = require('../../server');
const db = require('../../database-postgresql');

describe('SEGURANÇA: Isolamento de Planos por Usuário', () => {
    let user1Token, user2Token;
    let user1Id, user2Id;
    let plan1Id, plan2Id;
    
    beforeAll(async () => {
        // Criar dois usuários de teste
        const user1Result = await db.pool.query(
            `INSERT INTO users (name, email, password_hash, created_at) 
             VALUES ('User Test 1', 'test1@test.com', 'hash1', CURRENT_TIMESTAMP) 
             RETURNING id`
        );
        user1Id = user1Result.rows[0].id;
        
        const user2Result = await db.pool.query(
            `INSERT INTO users (name, email, password_hash, created_at) 
             VALUES ('User Test 2', 'test2@test.com', 'hash2', CURRENT_TIMESTAMP) 
             RETURNING id`
        );
        user2Id = user2Result.rows[0].id;
        
        // Criar planos para cada usuário
        const plan1Result = await db.pool.query(
            `INSERT INTO study_plans (user_id, plan_name, exam_date, created_at) 
             VALUES ($1, 'Plano User 1', '2025-12-31', CURRENT_TIMESTAMP) 
             RETURNING id`,
            [user1Id]
        );
        plan1Id = plan1Result.rows[0].id;
        
        const plan2Result = await db.pool.query(
            `INSERT INTO study_plans (user_id, plan_name, exam_date, created_at) 
             VALUES ($1, 'Plano User 2', '2025-12-31', CURRENT_TIMESTAMP) 
             RETURNING id`,
            [user2Id]
        );
        plan2Id = plan2Result.rows[0].id;
        
        // Simular tokens de autenticação
        // Nota: Em produção, use o processo real de autenticação
        user1Token = `mock_token_user_${user1Id}`;
        user2Token = `mock_token_user_${user2Id}`;
    });
    
    afterAll(async () => {
        // Limpar dados de teste
        await db.pool.query('DELETE FROM study_plans WHERE user_id IN ($1, $2)', [user1Id, user2Id]);
        await db.pool.query('DELETE FROM users WHERE id IN ($1, $2)', [user1Id, user2Id]);
    });
    
    describe('GET /api/plans', () => {
        test('User 1 deve ver APENAS seus próprios planos', async () => {
            const mockReq = {
                user: { id: user1Id },
                headers: { authorization: `Bearer ${user1Token}` }
            };
            
            // Simular chamada direta ao controller
            const plansController = require('../../src/controllers/plans.controller');
            const mockRes = {
                json: jest.fn(),
                status: jest.fn(() => mockRes)
            };
            
            await plansController.getPlans(mockReq, mockRes);
            
            expect(mockRes.json).toHaveBeenCalled();
            const plans = mockRes.json.mock.calls[0][0];
            
            // VALIDAÇÕES CRÍTICAS
            expect(plans).toBeInstanceOf(Array);
            expect(plans.length).toBe(1);
            expect(plans[0].id).toBe(plan1Id);
            expect(plans[0].user_id).toBe(user1Id);
            
            // GARANTIR que plano do User 2 NÃO está na lista
            const hasUser2Plan = plans.some(p => p.id === plan2Id);
            expect(hasUser2Plan).toBe(false);
        });
        
        test('User 2 deve ver APENAS seus próprios planos', async () => {
            const mockReq = {
                user: { id: user2Id },
                headers: { authorization: `Bearer ${user2Token}` }
            };
            
            const plansController = require('../../src/controllers/plans.controller');
            const mockRes = {
                json: jest.fn(),
                status: jest.fn(() => mockRes)
            };
            
            await plansController.getPlans(mockReq, mockRes);
            
            expect(mockRes.json).toHaveBeenCalled();
            const plans = mockRes.json.mock.calls[0][0];
            
            // VALIDAÇÕES CRÍTICAS
            expect(plans).toBeInstanceOf(Array);
            expect(plans.length).toBe(1);
            expect(plans[0].id).toBe(plan2Id);
            expect(plans[0].user_id).toBe(user2Id);
            
            // GARANTIR que plano do User 1 NÃO está na lista
            const hasUser1Plan = plans.some(p => p.id === plan1Id);
            expect(hasUser1Plan).toBe(false);
        });
    });
    
    describe('GET /api/plans/:planId', () => {
        test('User 1 NÃO deve conseguir acessar plano do User 2', async () => {
            const mockReq = {
                user: { id: user1Id },
                params: { planId: plan2Id },
                headers: { authorization: `Bearer ${user1Token}` }
            };
            
            const plansController = require('../../src/controllers/plans.controller');
            const mockRes = {
                json: jest.fn(),
                status: jest.fn(() => mockRes)
            };
            
            await plansController.getPlan(mockReq, mockRes);
            
            // Deve retornar 404
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('não encontrado')
                })
            );
        });
        
        test('User 2 NÃO deve conseguir acessar plano do User 1', async () => {
            const mockReq = {
                user: { id: user2Id },
                params: { planId: plan1Id },
                headers: { authorization: `Bearer ${user2Token}` }
            };
            
            const plansController = require('../../src/controllers/plans.controller');
            const mockRes = {
                json: jest.fn(),
                status: jest.fn(() => mockRes)
            };
            
            await plansController.getPlan(mockReq, mockRes);
            
            // Deve retornar 404
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.stringContaining('não encontrado')
                })
            );
        });
    });
    
    describe('Validações de Segurança', () => {
        test('Deve rejeitar requisições sem usuário autenticado', async () => {
            const mockReq = {
                user: null,
                headers: {}
            };
            
            const plansController = require('../../src/controllers/plans.controller');
            const mockRes = {
                json: jest.fn(),
                status: jest.fn(() => mockRes)
            };
            
            await plansController.getPlans(mockReq, mockRes);
            
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Usuário não autenticado'
                })
            );
        });
        
        test('Deve rejeitar user_id inválido', async () => {
            const mockReq = {
                user: { id: 'invalid' },
                headers: { authorization: 'Bearer token' }
            };
            
            const plansController = require('../../src/controllers/plans.controller');
            const mockRes = {
                json: jest.fn(),
                status: jest.fn(() => mockRes)
            };
            
            await plansController.getPlans(mockReq, mockRes);
            
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'ID de usuário inválido'
                })
            );
        });
    });
});

// Executar teste imediatamente se chamado diretamente
if (require.main === module) {
    const { execSync } = require('child_process');
    console.log('Executando teste de segurança de planos...');
    execSync('npx jest test/security/plans-security.test.js --verbose', { stdio: 'inherit' });
}