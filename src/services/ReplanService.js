/**
 * Replan Service - Orquestrador de Replanejamento e Gestão de Disciplinas
 * FASE 6 - WAVE 1 - REPLAN SERVICES INTEGRATION
 * 
 * Este serviço encapsula toda a lógica relacionada ao replanejamento inteligente:
 * - Replanejamento inteligente de sessões atrasadas
 * - Preview de replanejamento com análise preditiva
 * - Criação e gerenciamento de disciplinas com tópicos
 * - Integração com ScheduleGenerationService para algoritmos avançados
 * 
 * PADRÃO ENHANCEMENT-FIRST:
 * - Usa ScheduleGenerationService para algoritmos complexos
 * - Integra com repositories para acesso a dados
 * - Mantém 100% compatibilidade com código existente
 * - Adiciona logging e tratamento de erros avançado
 * 
 * MIGRAÇÃO DAS 3 ROTAS DO server.js:
 * - POST /api/plans/:planId/replan (linhas 1873-2172) -> executeReplan()
 * - GET /api/plans/:planId/replan-preview (linhas 2174-2334) -> getReplanPreview()
 * - POST /api/plans/:planId/subjects_with_topics (linhas 2336-2394) -> createSubjectWithTopics()
 */

const logger = require('../../src/utils/logger');
const { sanitizeHtml } = require('../../src/utils/sanitizer');
const ScheduleGenerationService = require('./schedule/ScheduleGenerationService');

class ReplanService {
    constructor(repositories, db) {
        this.repos = repositories;
        this.db = db;
        this.logger = logger;
    }

    /**
     * Função auxiliar para obter data brasileira
     * Mantida para compatibilidade com código existente
     */
    getBrazilianDateString() {
        const now = new Date();
        const year = parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', year: 'numeric'}));
        const month = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', month: 'numeric'}))).padStart(2, '0');
        const day = String(parseInt(now.toLocaleString('en-CA', {timeZone: 'America/Sao_Paulo', day: 'numeric'}))).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // ======================== REPLAN OPERATIONS ========================

    /**
     * Executa replanejamento inteligente de tarefas atrasadas
     * 
     * MIGRADO DO server.js POST /api/plans/:planId/replan (linhas 1873-2172)
     * Usa ScheduleGenerationService.replanSchedule() para algoritmo avançado
     * 
     * @param {number} planId - ID do plano de estudos
     * @param {number} userId - ID do usuário autenticado
     * @returns {Object} Resultado do replanejamento com estatísticas detalhadas
     */
    async executeReplan(planId, userId) {
        const startTime = Date.now();
        
        this.logger.info('Iniciando replanejamento inteligente', {
            planId,
            userId,
            timestamp: new Date().toISOString()
        });

        try {
            // Validar se o plano existe e pertence ao usuário
            const plan = await this.validatePlanOwnership(planId, userId);
            
            // Usar ScheduleGenerationService para algoritmo avançado de replanejamento
            const replanResult = await ScheduleGenerationService.replanSchedule(planId, userId);
            
            const duration = Date.now() - startTime;
            
            this.logger.info('Replanejamento concluído com sucesso', {
                planId,
                userId,
                rescheduled: replanResult.details?.rescheduled || 0,
                failed: replanResult.details?.failed || 0,
                duration,
                successRate: replanResult.details?.successRate || 0
            });

            // Enhancing response com metadados adicionais
            return {
                ...replanResult,
                metadata: {
                    executionTime: duration,
                    algorithm: 'ScheduleGenerationService.replanSchedule',
                    planName: plan.plan_name,
                    examDate: plan.exam_date,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.logger.error('Erro durante replanejamento', {
                planId,
                userId,
                error: error.message,
                duration,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
            
            // Re-throw with enhanced error context
            throw new Error(`Falha no replanejamento: ${error.message}`);
        }
    }

    /**
     * Gera preview do replanejamento sem executar
     * 
     * MIGRADO DO server.js GET /api/plans/:planId/replan-preview (linhas 2174-2334)
     * Usa ScheduleGenerationService.replanPreview() para análise preditiva
     * 
     * @param {number} planId - ID do plano de estudos
     * @param {number} userId - ID do usuário autenticado
     * @returns {Object} Preview detalhado do replanejamento
     */
    async getReplanPreview(planId, userId) {
        const startTime = Date.now();
        
        this.logger.info('Gerando preview de replanejamento', {
            planId,
            userId,
            timestamp: new Date().toISOString()
        });

        try {
            // Validar se o plano existe e pertence ao usuário
            const plan = await this.validatePlanOwnership(planId, userId);
            
            // Usar ScheduleGenerationService para análise preditiva avançada
            const previewData = await ScheduleGenerationService.replanPreview(planId, userId);
            
            const duration = Date.now() - startTime;
            
            this.logger.info('Preview de replanejamento gerado', {
                planId,
                userId,
                hasOverdue: previewData.hasOverdue,
                overdueCount: previewData.count || 0,
                duration
            });

            // Enhanced preview com contexto adicional
            return {
                ...previewData,
                metadata: {
                    generationTime: duration,
                    algorithm: 'ScheduleGenerationService.replanPreview',
                    planName: plan.plan_name,
                    examDate: plan.exam_date,
                    timestamp: new Date().toISOString()
                },
                planContext: {
                    planName: plan.plan_name,
                    examDate: plan.exam_date,
                    daysUntilExam: this.calculateDaysUntilExam(plan.exam_date),
                    studyHoursPerDay: plan.study_hours_per_day || '{}'
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.logger.error('Erro durante geração de preview', {
                planId,
                userId,
                error: error.message,
                duration,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
            
            throw new Error(`Falha no preview de replanejamento: ${error.message}`);
        }
    }

    // ======================== SUBJECTS WITH TOPICS ========================

    /**
     * Cria disciplina com lista de tópicos
     * 
     * MIGRADO DO server.js POST /api/plans/:planId/subjects_with_topics (linhas 2336-2394)
     * Mantém 100% da funcionalidade original com melhorias de logging
     * 
     * @param {number} planId - ID do plano de estudos
     * @param {number} userId - ID do usuário autenticado
     * @param {Object} subjectData - Dados da disciplina e tópicos
     * @returns {Object} Resultado da criação com estatísticas
     */
    async createSubjectWithTopics(planId, userId, subjectData) {
        const startTime = Date.now();
        
        this.logger.info('Criando disciplina com tópicos', {
            planId,
            userId,
            subjectName: subjectData.subject_name,
            timestamp: new Date().toISOString()
        });

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

            // Por enquanto, simular a criação usando os repositories
            // TODO: Implementar transações adequadas
            
            // 1. Criar disciplina usando repository
            const subjectCreateData = {
                study_plan_id: planId,
                subject_name: sanitizedData.subject_name,
                priority_weight: sanitizedData.priority_weight || 3
            };
            
            const subjectId = await this.repos.subject.create(subjectCreateData);
            
            this.logger.debug('Disciplina criada', {
                planId,
                subjectId,
                subjectName: sanitizedData.subject_name
            });
            
            // 2. Criar tópicos em batch
            const topicsCreated = [];
            for (let i = 0; i < topicsList.length; i++) {
                const topic = topicsList[i];
                const topicData = {
                    subject_id: subjectId,
                    topic_name: topic.trim(),
                    priority_weight: 3, // Prioridade padrão
                    status: 'pending'
                };
                
                const topicId = await this.repos.topic.create(topicData);
                
                topicsCreated.push({
                    id: topicId,
                    name: topic.trim()
                });
            }
            
            const result = {
                subjectId,
                topicsCreated,
                subjectName: sanitizedData.subject_name
            };

            const duration = Date.now() - startTime;
            
            this.logger.info('Disciplina com tópicos criada com sucesso', {
                planId,
                userId,
                subjectId: result.subjectId,
                topicsCount: result.topicsCreated.length,
                duration
            });

            return {
                success: true,
                message: `Disciplina "${result.subjectName}" criada com ${result.topicsCreated.length} tópicos`,
                data: {
                    subjectId: result.subjectId,
                    subjectName: result.subjectName,
                    topicsCount: result.topicsCreated.length,
                    topics: result.topicsCreated
                },
                metadata: {
                    executionTime: duration,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.logger.error('Erro ao criar disciplina com tópicos', {
                planId,
                userId,
                subjectName: subjectData?.subject_name || 'Unknown',
                error: error.message,
                duration,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
            
            throw new Error(`Falha ao criar disciplina: ${error.message}`);
        }
    }

    // ======================== HELPER METHODS ========================

    /**
     * Valida se o plano existe e pertence ao usuário
     * @param {number} planId - ID do plano
     * @param {number} userId - ID do usuário
     * @returns {Object} Dados do plano
     */
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

    /**
     * Sanitiza dados da disciplina
     * @param {Object} data - Dados não sanitizados
     * @returns {Object} Dados sanitizados
     */
    sanitizeSubjectData(data) {
        return {
            subject_name: sanitizeHtml(data.subject_name || '').trim(),
            priority_weight: parseInt(data.priority_weight, 10) || 3,
            topics_list: sanitizeHtml(data.topics_list || '').trim()
        };
    }

    /**
     * Valida dados da disciplina
     * @param {Object} data - Dados a serem validados
     */
    validateSubjectData(data) {
        if (!data.subject_name || data.subject_name.length < 2) {
            throw new Error('Nome da disciplina deve ter pelo menos 2 caracteres');
        }

        if (data.subject_name.length > 200) {
            throw new Error('Nome da disciplina muito longo (máximo 200 caracteres)');
        }

        if (data.priority_weight < 1 || data.priority_weight > 5) {
            throw new Error('Peso de prioridade deve estar entre 1 e 5');
        }

        if (!data.topics_list) {
            throw new Error('Lista de tópicos é obrigatória');
        }

        if (data.topics_list.length > 10000) {
            throw new Error('Lista de tópicos muito longa (máximo 10000 caracteres)');
        }
    }

    /**
     * Parse da lista de tópicos em formato texto
     * @param {string} topicsList - Lista de tópicos separados por linha
     * @returns {Array} Array de tópicos limpos
     */
    parseTopicsList(topicsList) {
        if (!topicsList) return [];

        return topicsList
            .split('\n')
            .map(topic => topic.trim())
            .filter(topic => topic.length > 0)
            .filter((topic, index, array) => array.indexOf(topic) === index) // Remove duplicatas
            .slice(0, 1000); // Limita a 1000 tópicos por segurança
    }

    /**
     * Calcula dias até o exame
     * @param {string} examDate - Data do exame (YYYY-MM-DD)
     * @returns {number} Número de dias até o exame
     */
    calculateDaysUntilExam(examDate) {
        if (!examDate) return null;
        
        const exam = new Date(examDate + 'T23:59:59');
        const today = new Date();
        const diffTime = exam - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    /**
     * Executa operação dentro de transação
     * @param {Function} operation - Função a ser executada na transação
     * @returns {*} Resultado da operação
     */
    async executeInTransaction(operation) {
        // TODO: Implementar suporte a transações quando repositories suportarem
        // Por enquanto, executa diretamente
        return await operation(null);
    }

    // ======================== ADDITIONAL UTILITIES ========================

    /**
     * Get current statistics for logging and monitoring
     * @param {number} planId - ID do plano
     * @returns {Object} Estatísticas atuais
     */
    async getCurrentStats(planId) {
        try {
            // Usar repositories para obter estatísticas básicas
            const plan = await this.repos.plan.findById(planId);
            const sessions = await this.repos.session.findByPlanId(planId) || [];
            const subjects = await this.repos.subject.findByPlanId(planId) || [];
            
            const overdueCount = sessions.filter(s => 
                s.status === 'Pendente' && 
                s.session_date < this.getBrazilianDateString()
            ).length;

            return {
                planName: plan?.plan_name || 'Unknown',
                totalSessions: sessions.length,
                overdueCount,
                subjectsCount: subjects.length,
                examDate: plan?.exam_date,
                daysUntilExam: this.calculateDaysUntilExam(plan?.exam_date)
            };
        } catch (error) {
            this.logger.warn('Erro ao obter estatísticas', {
                planId,
                error: error.message
            });
            return {};
        }
    }

    // ======================== SUBJECTS WITH TOPICS LIST ========================

    /**
     * Lista disciplinas com tópicos para um plano
     * 
     * IMPLEMENTAÇÃO ADICIONAL para completar funcionalidade que pode estar no server.js
     * 
     * @param {number} planId - ID do plano de estudos
     * @param {number} userId - ID do usuário autenticado
     * @returns {Object} Lista de disciplinas com seus tópicos
     */
    async getSubjectsWithTopics(planId, userId) {
        const startTime = Date.now();
        
        this.logger.info('Listando disciplinas com tópicos', {
            planId,
            userId,
            timestamp: new Date().toISOString()
        });

        try {
            // Validar se o plano existe e pertence ao usuário
            await this.validatePlanOwnership(planId, userId);
            
            // Obter disciplinas do plano usando repository
            const subjects = await this.repos.subject.findByPlanId(planId);
            
            // Para cada disciplina, obter seus tópicos
            const subjectsWithTopics = [];
            for (const subject of subjects) {
                const topics = await this.repos.topic.findBySubjectId(subject.id);
                
                subjectsWithTopics.push({
                    id: subject.id,
                    subject_name: sanitizeHtml(subject.subject_name || ''),
                    priority_weight: subject.priority_weight || 3,
                    created_at: subject.created_at,
                    topics: topics.map(topic => ({
                        id: topic.id,
                        topic_name: sanitizeHtml(topic.topic_name || ''),
                        priority_weight: topic.priority_weight || 3,
                        status: topic.status || 'pending',
                        completion_date: topic.completion_date
                    })),
                    topics_count: topics.length
                });
            }

            const duration = Date.now() - startTime;
            
            this.logger.info('Disciplinas com tópicos listadas', {
                planId,
                userId,
                subjectsCount: subjectsWithTopics.length,
                totalTopics: subjectsWithTopics.reduce((sum, s) => sum + s.topics_count, 0),
                duration
            });

            return {
                success: true,
                data: subjectsWithTopics,
                summary: {
                    subjects_count: subjectsWithTopics.length,
                    total_topics: subjectsWithTopics.reduce((sum, s) => sum + s.topics_count, 0)
                },
                metadata: {
                    executionTime: duration,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.logger.error('Erro ao listar disciplinas com tópicos', {
                planId,
                userId,
                error: error.message,
                duration,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
            
            throw new Error(`Falha ao listar disciplinas: ${error.message}`);
        }
    }
}

module.exports = ReplanService;