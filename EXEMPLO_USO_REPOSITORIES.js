/**
 * EXEMPLO DE COMO USAR OS REPOSITORIES NO SERVER.JS
 * 
 * Esta é apenas uma demonstração de como refatorar as rotas para usar repositories.
 * NÃO é um arquivo para ser executado, apenas referência.
 */

// ============================================================================
// 1. CONFIGURAÇÃO INICIAL NO SERVER.JS
// ============================================================================

const db = require('./database-simple-postgres'); // ou o database que estiver sendo usado
const UserRepository = require('./src/repositories/user.repository');
const PlanRepository = require('./src/repositories/plan.repository');

// Instanciar repositories
const userRepo = new UserRepository(db);
const planRepo = new PlanRepository(db);

// ============================================================================
// 2. EXEMPLO DE REFATORAÇÃO DE ROTAS
// ============================================================================

// ANTES (código original com queries inline)
app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await db.get(`
            SELECT 
                id, email, name, profile_picture, phone, whatsapp, created_at,
                state, city, birth_date, education, work_status, first_time, concursos_count,
                difficulties, area_interest, level_desired, timeline_goal, study_hours, motivation_text,
                google_id, auth_provider, google_avatar
                FROM users WHERE id = ?`, [userId]);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DEPOIS (usando repository)
app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await userRepo.findProfileById(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ============================================================================
// 3. EXEMPLO COM PLANOS DE ESTUDO
// ============================================================================

// ANTES (múltiplas queries inline)
app.get('/api/plans/:planId', authMiddleware, async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const plan = await db.get(`SELECT * FROM study_plans WHERE id = ? AND user_id = ?`, [planId, userId]);
        if (!plan) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }
        
        // Buscar estatísticas
        const stats = await db.get(`
            SELECT 
                COUNT(DISTINCT s.id) as total_subjects,
                COUNT(DISTINCT t.id) as total_topics
            FROM subjects s
            LEFT JOIN topics t ON t.subject_id = s.id
            WHERE s.study_plan_id = ?`, [planId]);
            
        res.json({ plan, stats });
    } catch (error) {
        console.error('Erro ao buscar plano:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DEPOIS (usando repository com lógica encapsulada)
app.get('/api/plans/:planId', authMiddleware, async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const [plan, stats] = await Promise.all([
            planRepo.findByIdAndUser(planId, userId),
            planRepo.getPlanStatistics(planId, userId)
        ]);
        
        if (!plan) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }
        
        res.json({ plan, stats });
    } catch (error) {
        console.error('Erro ao buscar plano:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ============================================================================
// 4. EXEMPLO COM TRANSAÇÕES COMPLEXAS
// ============================================================================

// ANTES (transação manual com múltiplas queries)
app.delete('/api/plans/:planId', authMiddleware, async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        // Verificar ownership
        const plan = await db.get(`SELECT id FROM study_plans WHERE id = ? AND user_id = ?`, [planId, userId]);
        if (!plan) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }
        
        // Iniciar transação
        await db.run('BEGIN TRANSACTION');
        
        try {
            // Deletar dados relacionados
            await db.run('DELETE FROM study_sessions WHERE study_plan_id = ?', [planId]);
            await db.run('DELETE FROM tasks WHERE study_plan_id = ?', [planId]);
            await db.run('DELETE FROM topics WHERE subject_id IN (SELECT id FROM subjects WHERE study_plan_id = ?)', [planId]);
            await db.run('DELETE FROM subjects WHERE study_plan_id = ?', [planId]);
            await db.run('DELETE FROM study_plans WHERE id = ?', [planId]);
            
            await db.run('COMMIT');
            res.json({ message: 'Plano deletado com sucesso' });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Erro ao deletar plano:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DEPOIS (usando repository com transação encapsulada)
app.delete('/api/plans/:planId', authMiddleware, async (req, res) => {
    try {
        const planId = req.params.planId;
        const userId = req.user.id;
        
        const success = await planRepo.deletePlanWithRelatedData(planId, userId);
        
        if (!success) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }
        
        res.json({ message: 'Plano deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar plano:', error);
        res.status(500).json({ 
            error: error.message === 'Plano não encontrado ou não pertence ao usuário' 
                ? error.message 
                : 'Erro interno do servidor' 
        });
    }
});

// ============================================================================
// 5. VANTAGENS DOS REPOSITORIES
// ============================================================================

/*
✅ BENEFÍCIOS OBTIDOS:

1. **Código Limpo**
   - Rotas mais curtas e focadas
   - Lógica de negócio separada da apresentação
   - Queries centralizadas e reutilizáveis

2. **Manutenibilidade**
   - Mudanças de schema apenas no repository
   - Métodos testáveis isoladamente
   - Nomes descritivos (findByEmail vs SELECT * FROM users WHERE email = ?)

3. **Reutilização**
   - Métodos comuns (findById, exists, count)
   - Validações consistentes
   - Tratamento de erros padronizado

4. **Testabilidade**
   - Mock do repository é simples
   - Testes unitários de lógica de negócio
   - Testes de integração focados

5. **Performance**
   - Queries otimizadas centralizadas
   - Transaction helper para operações complexas
   - Preparação de statements reutilizável

6. **Segurança**
   - Validação de ownership encapsulada
   - Sanitização de inputs consistente
   - Prevenção de SQL injection padronizada
*/

// ============================================================================
// 6. ESTRATÉGIA DE MIGRAÇÃO INCREMENTAL
// ============================================================================

/*
COMO MIGRAR GRADUALMENTE:

1. Criar repository por repository (User → Plan → Session → etc)
2. Refatorar rota por rota, testando individualmente
3. Manter compatibilidade com código antigo durante transição
4. Usar feature flags para alternar entre versões se necessário
5. Executar testes após cada refatoração

CRONOGRAMA SUGERIDO:
- Semana 1: UserRepository (rotas de auth)
- Semana 2: PlanRepository (CRUD de planos)
- Semana 3: SessionRepository (gerenciamento de sessões)
- Semana 4: SubjectRepository e TopicRepository
- Semana 5: Cleanup e otimizações finais
*/