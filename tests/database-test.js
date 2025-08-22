// tests/database-test.js - Configuração de banco de dados para testes
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Banco de dados em memória para testes
let testDb = null;

const createTestDatabase = () => {
    return new Promise((resolve, reject) => {
        // Usar banco em memória para testes rápidos
        testDb = new sqlite3.Database(':memory:', (err) => {
            if (err) {
                reject(err);
                return;
            }

            // Criar as tabelas necessárias
            const createTablesSQL = `
                -- Tabela de usuários
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT,
                    name TEXT,
                    google_id TEXT,
                    auth_provider TEXT DEFAULT 'local',
                    profile_picture TEXT,
                    preferences TEXT,
                    reset_token TEXT,
                    reset_token_expires INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- Tabela de planos de estudo
                CREATE TABLE IF NOT EXISTS study_plans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    plan_name TEXT NOT NULL,
                    exam_date DATE NOT NULL,
                    study_hours_per_day TEXT DEFAULT '{"0": 0, "1": 4, "2": 4, "3": 4, "4": 4, "5": 4, "6": 4}',
                    daily_question_goal INTEGER DEFAULT 50,
                    weekly_question_goal INTEGER DEFAULT 300,
                    session_duration_minutes INTEGER DEFAULT 50,
                    review_mode TEXT DEFAULT 'completo',
                    postponement_count INTEGER DEFAULT 0,
                    has_essay BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                -- Tabela de disciplinas
                CREATE TABLE IF NOT EXISTS subjects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    study_plan_id INTEGER NOT NULL,
                    subject_name TEXT NOT NULL,
                    priority_weight INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (study_plan_id) REFERENCES study_plans(id)
                );

                -- Tabela de tópicos
                CREATE TABLE IF NOT EXISTS topics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_id INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    status TEXT DEFAULT 'Pendente',
                    completion_date DATE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (subject_id) REFERENCES subjects(id)
                );

                -- Tabela de sessões de estudo
                CREATE TABLE IF NOT EXISTS study_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    study_plan_id INTEGER NOT NULL,
                    topic_id INTEGER,
                    subject_name TEXT NOT NULL,
                    topic_description TEXT NOT NULL,
                    session_date DATE NOT NULL,
                    session_type TEXT NOT NULL,
                    status TEXT DEFAULT 'Pendente',
                    notes TEXT,
                    questions_solved INTEGER DEFAULT 0,
                    time_studied_seconds INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (study_plan_id) REFERENCES study_plans(id),
                    FOREIGN KEY (topic_id) REFERENCES topics(id)
                );
            `;

            testDb.exec(createTablesSQL, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(testDb);
            });
        });
    });
};

const closeTestDatabase = () => {
    return new Promise((resolve) => {
        if (testDb) {
            testDb.close(() => {
                testDb = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
};

const clearTestDatabase = () => {
    return new Promise((resolve, reject) => {
        if (!testDb) {
            resolve();
            return;
        }

        const clearSQL = `
            DELETE FROM study_sessions;
            DELETE FROM topics;
            DELETE FROM subjects;
            DELETE FROM study_plans;
            DELETE FROM users;
        `;

        testDb.exec(clearSQL, (err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
};

// Funções utilitárias para testes (similar ao server.js)
const dbGet = (sql, params) => new Promise((resolve, reject) => {
    if (!testDb) {
        reject(new Error('Database not initialized'));
        return;
    }
    testDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const dbAll = (sql, params) => new Promise((resolve, reject) => {
    if (!testDb) {
        reject(new Error('Database not initialized'));
        return;
    }
    testDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const dbRun = (sql, params) => new Promise((resolve, reject) => {
    if (!testDb) {
        reject(new Error('Database not initialized'));
        return;
    }
    testDb.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

module.exports = {
    createTestDatabase,
    closeTestDatabase,
    clearTestDatabase,
    getTestDb: () => testDb,
    dbGet,
    dbAll,
    dbRun
};