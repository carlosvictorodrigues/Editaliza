/**
 * Replan Service - SIMPLIFICADO E CORRIGIDO
 * Orquestrador de Replanejamento e Gestão de Disciplinas
 */

const logger = require('../utils/logger');
const { sanitizeHtml } = require('../utils/sanitizer');

class ReplanService {
    constructor(repositories, db) {
        this.repos = repositories;
        this.db = db;
        this.logger = logger;
    }

    /**
     * Função auxiliar para obter data brasileira
     */
    getBrazilianDateString() {
        const now = new Date();
        const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
        const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
        const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Executa replanejamento básico
     */
    async executeReplan(planId, userId) {
        this.logger.info('Iniciando replanejamento', { planId, userId });

        try {
            // Validar se o plano existe e pertence ao usuário
            const plan = await this.validatePlanOwnership(planId, userId);
            
            // Buscar sessões atrasadas
            const overdueSessions = await this.repos.session.findOverdueSessions(planId, this.getBrazilianDateString());
            
            let rescheduledCount = 0;
            const today = this.getBrazilianDateString();
            
            // Reagendar sessões para hoje e dias seguintes
            for (const session of overdueSessions) {
                try {
                    // Calcular nova data (hoje + índice da sessão para espalhar)
                    const newDate = new Date(today);
                    newDate.setDate(newDate.getDate() + rescheduledCount);
                    const newDateStr = newDate.toISOString().split('T')[0];
                    
                    // Atualizar data da sessão
                    await this.db.run(
                        'UPDATE study_sessions SET session_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [newDateStr, session.id]
                    );
                    
                    rescheduledCount++;
                } catch (error) {
                    this.logger.warn(`Erro ao reagendar sessão ${session.id}`, { error: error.message });
                }
            }

            const result = {
                success: true,
                message: `${rescheduledCount} sessões foram reagendadas com sucesso.`,
                details: {
                    rescheduled: rescheduledCount,
                    failed: overdueSessions.length - rescheduledCount,
                    successRate: overdueSessions.length > 0 ? (rescheduledCount / overdueSessions.length * 100).toFixed(2) : 100
                }
            };

            this.logger.info('Replanejamento concluído', result.details);
            return result;

        } catch (error) {
            this.logger.error('Erro durante replanejamento', { planId, userId, error: error.message });
            throw new Error(`Falha no replanejamento: ${error.message}`);
        }
    }

    /**
     * Gera preview do replanejamento
     */
    async getReplanPreview(planId, userId) {
        this.logger.info('Gerando preview de replanejamento', { planId, userId });

        try {
            // Validar se o plano existe e pertence ao usuário
            const plan = await this.validatePlanOwnership(planId, userId);
            
            // Contar sessões atrasadas
            const overdueCount = await this.repos.session.countOverdueSessions(planId, this.getBrazilianDateString());
            const hasOverdue = overdueCount > 0;

            const previewData = {
                hasOverdue,
                count: overdueCount,
                message: hasOverdue ? 
                    `Existem ${overdueCount} sessões atrasadas que podem ser reagendadas.` :
                    'Não existem sessões atrasadas no momento.',
                canReplan: hasOverdue,
                planName: plan.plan_name
            };

            this.logger.info('Preview de replanejamento gerado', { planId, hasOverdue, count: overdueCount });
            return previewData;

        } catch (error) {
            this.logger.error('Erro durante geração de preview', { planId, userId, error: error.message });
            throw new Error(`Falha no preview de replanejamento: ${error.message}`);
        }
    }

    /**
     * Cria disciplina com lista de tópicos
     */
    async createSubjectWithTopics(planId, userId, subjectData) {
        this.logger.info('Criando disciplina com tópicos', { planId, userId, subjectName: subjectData.subject_name });

        try {
            // Validar se o plano existe e pertence ao usuário
            await this.validatePlanOwnership(planId, userId);
            
            // Sanitizar dados de entrada
            const sanitizedData = this.sanitizeSubjectData(subjectData);
            
            // Validar dados da disciplina
            this.validateSubjectData(sanitizedData);
            
            // Parse da lista de tópicos
            const topicsList = this.parseTopicsList(sanitizedData.topics_list);
            
            if (topicsList.length === 0) {
                throw new Error('Lista de tópicos não pode estar vazia');
            }

            // 1. Criar disciplina usando repository
            const subjectCreateData = {
                study_plan_id: planId,
                subject_name: sanitizedData.subject_name,
                priority_weight: sanitizedData.priority_weight || 3
            };
            
            console.log('[REPLAN_SERVICE] Criando disciplina com dados:', subjectCreateData);
            console.log('[REPLAN_SERVICE] Repository:', typeof this.repos.subject, this.repos.subject.constructor?.name);
            
            const subjectResult = await this.repos.subject.createSubject(subjectCreateData);
            console.log('[REPLAN_SERVICE] Resultado do createSubject:', subjectResult, typeof subjectResult);
            
            // CORREÇÃO: Extrair ID corretamente
            const subjectId = subjectResult?.id || subjectResult;
            console.log('[REPLAN_SERVICE] SubjectId extraído:', subjectId, typeof subjectId);
            
            if (!subjectId) {
                throw new Error('Falha ao obter ID da disciplina criada');
            }
            
            // 2. Criar tópicos em batch
            const topicsCreated = [];
            for (const topic of topicsList) {
                const topicData = {
                    subject_id: subjectId,
                    topic_name: topic.trim(),
                    priority_weight: 3,
                    status: 'Pendente'
                };
                
                console.log('[REPLAN_SERVICE] Criando tópico:', topicData);
                const topicResult = await this.repos.topic.createTopic(topicData);
                console.log('[REPLAN_SERVICE] Resultado do createTopic:', topicResult, typeof topicResult);
                
                const topicId = topicResult?.id || topicResult;
                console.log('[REPLAN_SERVICE] TopicId extraído:', topicId, typeof topicId);
                
                if (!topicId) {
                    throw new Error(`Falha ao obter ID do tópico: ${topic.trim()}`);
                }
                
                topicsCreated.push({ id: topicId, name: topic.trim() });
            }
            
            const result = {
                success: true,
                message: `Disciplina "${sanitizedData.subject_name}" criada com ${topicsCreated.length} tópicos`,
                data: {
                    subjectId: subjectId,
                    subjectName: sanitizedData.subject_name,
                    topicsCount: topicsCreated.length,
                    topics: topicsCreated
                }
            };

            this.logger.info('Disciplina com tópicos criada', { planId, subjectId, topicsCount: topicsCreated.length });
            return result;

        } catch (error) {
            this.logger.error('Erro ao criar disciplina com tópicos', { planId, userId, error: error.message });
            throw new Error(`Falha ao criar disciplina: ${error.message}`);
        }
    }

    /**
     * Lista disciplinas com tópicos
     */
    async getSubjectsWithTopics(planId, userId) {
        this.logger.info('Listando disciplinas com tópicos', { planId, userId });

        try {
            // Validar se o plano existe e pertence ao usuário
            await this.validatePlanOwnership(planId, userId);
            
            // Obter disciplinas do plano
            const subjects = await this.repos.subject.findByPlanId(planId);
            
            // Para cada disciplina, obter seus tópicos
            const subjectsWithTopics = [];
            for (const subject of subjects) {
                const topics = await this.repos.topic.findBySubjectId(subject.id);
                
                subjectsWithTopics.push({
                    id: subject.id,
                    subject_name: subject.subject_name,
                    priority_weight: subject.priority_weight || 3,
                    created_at: subject.created_at,
                    topics: topics.map(topic => ({
                        id: topic.id,
                        topic_name: topic.topic_name,
                        priority_weight: topic.priority_weight || 3,
                        status: topic.status || 'Pendente',
                        completion_date: topic.completion_date
                    })),
                    topics_count: topics.length
                });
            }

            return {
                success: true,
                data: subjectsWithTopics,
                summary: {
                    subjects_count: subjectsWithTopics.length,
                    total_topics: subjectsWithTopics.reduce((sum, s) => sum + s.topics_count, 0)
                }
            };

        } catch (error) {
            this.logger.error('Erro ao listar disciplinas com tópicos', { planId, userId, error: error.message });
            throw new Error(`Falha ao listar disciplinas: ${error.message}`);
        }
    }

    // ======================== HELPER METHODS ========================

    async validatePlanOwnership(planId, userId) {
        if (!planId || !userId) {
            throw new Error('Plan ID e User ID são obrigatórios');
        }

        const plan = await this.repos.plan.findByIdAndUserId(planId, userId);
        if (!plan) {
            throw new Error('Plano não encontrado ou não autorizado');
        }

        return plan;
    }

    sanitizeSubjectData(data) {
        return {
            subject_name: (data.subject_name || '').trim(),
            priority_weight: parseInt(data.priority_weight, 10) || 3,
            topics_list: (data.topics_list || '').trim()
        };
    }

    validateSubjectData(data) {
        if (!data.subject_name || data.subject_name.length < 2) {
            throw new Error('Nome da disciplina deve ter pelo menos 2 caracteres');
        }
        if (!data.topics_list) {
            throw new Error('Lista de tópicos é obrigatória');
        }
    }

    parseTopicsList(topicsList) {
        if (!topicsList) return [];
        return topicsList
            .split('\n')
            .map(topic => topic.trim())
            .filter(topic => topic.length > 0)
            .filter((topic, index, array) => array.indexOf(topic) === index)
            .slice(0, 1000);
    }
}

module.exports = ReplanService;
