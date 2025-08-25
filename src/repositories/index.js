/**
 * Repository Index
 * Centraliza a criação e exportação de todos os repositories
 * FASE 3 - Facilita a importação e inicialização dos repositories
 */

const BaseRepository = require('./base.repository');
const UserRepository = require('./user.repository');
const PlanRepository = require('./plan.repository');
const SessionRepository = require('./session.repository');
const SubjectRepository = require('./subject.repository');
const TopicRepository = require('./topic.repository');
const StatisticsRepository = require('./statistics.repository');
const AdminRepository = require('./admin.repository');

/**
 * Cria e retorna instâncias de todos os repositories
 * @param {Object} db - Instância do banco de dados
 * @returns {Object} Objeto com todos os repositories instanciados
 */
function createRepositories(db) {
    if (!db) {
        throw new Error('Database instance is required to create repositories');
    }

    return {
        user: new UserRepository(db),
        plan: new PlanRepository(db),
        session: new SessionRepository(db),
        subject: new SubjectRepository(db),
        topic: new TopicRepository(db),
        statistics: new StatisticsRepository(db),
        admin: new AdminRepository(db)
    };
}

/**
 * Exporta classes individuais para uso direto se necessário
 */
module.exports = {
    // Função principal para criar todos os repositories
    createRepositories,
    
    // Classes individuais
    BaseRepository,
    UserRepository,
    PlanRepository,
    SessionRepository,
    SubjectRepository,
    TopicRepository,
    StatisticsRepository,
    AdminRepository
};