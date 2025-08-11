/**
 * Script to Create Realistic Test Data for Rescheduling Tests
 * 
 * This script populates the database with realistic test scenarios
 * for manual testing of the rescheduling system.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class TestDataCreator {
  constructor(databasePath = null) {
    this.databasePath = databasePath || path.join(__dirname, '..', 'db.sqlite');
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.databasePath, (err) => {
        if (err) {
          console.error('Failed to connect to database:', err.message);
          reject(err);
        } else {
          console.log(`Connected to database: ${this.databasePath}`);
          resolve();
        }
      });
    });
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
          }
          resolve();
        });
      });
    }
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Create user 3@3.com with 7 overdue tasks
   */
  async createUser3Scenario() {
    console.log('Creating User 3@3.com scenario...');

    // Create user
    const user = await this.run(`
      INSERT OR REPLACE INTO users (email, name, phone, profession, city, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['3@3.com', 'Usuário de Teste 3', '+5511999887766', 'Estudante', 'São Paulo', new Date().toISOString()]);

    // Create study plan
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 45); // 45 days from now

    const plan = await this.run(`
      INSERT INTO study_plans (
        user_id, plan_name, exam_date, study_hours_per_day, 
        session_duration_minutes, daily_question_goal, 
        weekly_question_goal, review_mode, postponement_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user.id,
      'Concurso Público Federal - Teste',
      examDate.toISOString().split('T')[0],
      JSON.stringify({
        monday: 4, tuesday: 4, wednesday: 4, thursday: 4,
        friday: 4, saturday: 6, sunday: 3
      }),
      75, // 75 minutes per session
      25, // 25 questions per day
      175, // 175 questions per week
      'spaced',
      2 // Already postponed twice
    ]);

    // Create subjects
    const subjects = [
      { name: 'Direito Constitucional', sessions: 2 },
      { name: 'Direito Administrativo', sessions: 2 },
      { name: 'Matemática e RLM', sessions: 2 },
      { name: 'Português', sessions: 1 }
    ];

    let topicId = 1;
    for (const subject of subjects) {
      // Create subject entry
      const subjectRecord = await this.run(`
        INSERT INTO subjects (study_plan_id, subject_name, priority_weight)
        VALUES (?, ?, ?)
      `, [plan.id, subject.name, 2]);

      // Create overdue sessions
      for (let i = 0; i < subject.sessions; i++) {
        // Create topic
        const topicName = this.getTopicName(subject.name, i);
        const topic = await this.run(`
          INSERT INTO topics (subject_id, description, status)
          VALUES (?, ?, ?)
        `, [subjectRecord.id, topicName, 'Pendente']);

        // Create overdue session (1-7 days ago)
        const daysOverdue = Math.floor(Math.random() * 7) + 1;
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - daysOverdue);

        await this.run(`
          INSERT INTO study_sessions (
            study_plan_id, topic_id, subject_name, topic_description,
            session_date, session_type, status, postpone_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          plan.id,
          topic.id,
          subject.name,
          topicName,
          overdueDate.toISOString().split('T')[0],
          i === 0 ? 'primeira_vez' : 'revisao',
          'Pendente',
          Math.floor(daysOverdue / 2) // Realistic postpone count based on days overdue
        ]);

        topicId++;
      }
    }

    // Create some future sessions for context
    await this.createFutureSessions(plan.id, [
      { subject: 'Direito Constitucional', count: 3 },
      { subject: 'Direito Administrativo', count: 2 },
      { subject: 'Economia', count: 2 }
    ]);

    console.log('✅ User 3@3.com scenario created successfully');
    return { userId: user.id, planId: plan.id };
  }

  /**
   * Create realistic test scenarios for different user types
   */
  async createTestScenarios() {
    console.log('Creating multiple test scenarios...');

    const scenarios = [
      {
        email: 'concurso-student@editaliza.test',
        name: 'Ana Silva',
        profession: 'Estudante',
        city: 'Rio de Janeiro',
        planName: 'Preparação TRF 2ª Região',
        examDays: 60,
        studyHours: { monday: 3, tuesday: 3, wednesday: 3, thursday: 3, friday: 2, saturday: 5, sunday: 4 },
        sessionMinutes: 60,
        subjects: [
          { name: 'Direito Constitucional', overdue: 4 },
          { name: 'Direito Processual Civil', overdue: 3 },
          { name: 'Matemática Financeira', overdue: 5 },
          { name: 'Português', overdue: 2 },
          { name: 'Noções de Informática', overdue: 1 }
        ]
      },
      {
        email: 'working-professional@editaliza.test',
        name: 'Carlos Mendes',
        profession: 'Analista de Sistemas',
        city: 'Brasília',
        planName: 'Concurso Analista - Horário Reduzido',
        examDays: 90,
        studyHours: { monday: 1.5, tuesday: 1.5, wednesday: 1.5, thursday: 1.5, friday: 1, saturday: 4, sunday: 3 },
        sessionMinutes: 45,
        subjects: [
          { name: 'Direito Administrativo', overdue: 8 },
          { name: 'Contabilidade Pública', overdue: 6 },
          { name: 'Administração Pública', overdue: 4 },
          { name: 'Português', overdue: 2 }
        ]
      },
      {
        email: 'enem-student@editaliza.test',
        name: 'Mariana Santos',
        profession: 'Estudante Ensino Médio',
        city: 'Belo Horizonte',
        planName: 'Preparação ENEM 2025',
        examDays: 240,
        studyHours: { monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 1, saturday: 4, sunday: 3 },
        sessionMinutes: 50,
        subjects: [
          { name: 'Matemática', overdue: 6 },
          { name: 'Português e Literatura', overdue: 4 },
          { name: 'História', overdue: 3 },
          { name: 'Geografia', overdue: 3 },
          { name: 'Física', overdue: 5 },
          { name: 'Química', overdue: 4 },
          { name: 'Biologia', overdue: 2 },
          { name: 'Redação', overdue: 1 }
        ]
      }
    ];

    for (const scenario of scenarios) {
      await this.createUserScenario(scenario);
    }

    console.log('✅ All test scenarios created successfully');
  }

  /**
   * Create individual user scenario
   */
  async createUserScenario(scenario) {
    console.log(`Creating scenario for ${scenario.email}...`);

    // Create user
    const user = await this.run(`
      INSERT OR REPLACE INTO users (email, name, profession, city, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [scenario.email, scenario.name, scenario.profession, scenario.city, new Date().toISOString()]);

    // Create study plan
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + scenario.examDays);

    const plan = await this.run(`
      INSERT INTO study_plans (
        user_id, plan_name, exam_date, study_hours_per_day,
        session_duration_minutes, review_mode, postponement_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      user.id,
      scenario.planName,
      examDate.toISOString().split('T')[0],
      JSON.stringify(scenario.studyHours),
      scenario.sessionMinutes,
      'adaptive',
      Math.floor(Math.random() * 3) // 0-2 previous postponements
    ]);

    // Create subjects and sessions
    for (const subject of scenario.subjects) {
      // Create subject
      const subjectRecord = await this.run(`
        INSERT INTO subjects (study_plan_id, subject_name, priority_weight)
        VALUES (?, ?, ?)
      `, [plan.id, subject.name, Math.floor(Math.random() * 3) + 1]);

      // Create overdue sessions
      for (let i = 0; i < subject.overdue; i++) {
        // Create topic
        const topicName = this.getTopicName(subject.name, i);
        const topic = await this.run(`
          INSERT INTO topics (subject_id, description, status)
          VALUES (?, ?, ?)
        `, [subjectRecord.id, topicName, 'Pendente']);

        // Create overdue session
        const daysOverdue = this.getRealisticOverdueDays();
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - daysOverdue);

        const sessionType = this.getSessionType(i, subject.overdue);

        await this.run(`
          INSERT INTO study_sessions (
            study_plan_id, topic_id, subject_name, topic_description,
            session_date, session_type, status, postpone_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          plan.id,
          topic.id,
          subject.name,
          topicName,
          overdueDate.toISOString().split('T')[0],
          sessionType,
          'Pendente',
          Math.min(Math.floor(daysOverdue / 3), 3) // Realistic postpone count
        ]);
      }
    }

    // Create future sessions for intelligent rescheduling context
    const futureSubjects = scenario.subjects.slice(0, 3).map(s => ({
      subject: s.name,
      count: Math.floor(Math.random() * 3) + 2 // 2-4 future sessions
    }));
    
    await this.createFutureSessions(plan.id, futureSubjects);
  }

  /**
   * Create future sessions for context
   */
  async createFutureSessions(planId, futureSubjects) {
    for (const config of futureSubjects) {
      // Get or create subject
      const subject = await this.run(`
        INSERT OR IGNORE INTO subjects (study_plan_id, subject_name, priority_weight)
        VALUES (?, ?, ?)
      `, [planId, config.subject, 2]);

      const subjectId = subject.id || (await this.get(
        'SELECT id FROM subjects WHERE study_plan_id = ? AND subject_name = ?',
        [planId, config.subject]
      )).id;

      for (let i = 0; i < config.count; i++) {
        // Create future date (3-15 days in future)
        const daysInFuture = Math.floor(Math.random() * 12) + 3;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysInFuture);

        // Create topic
        const topicName = this.getTopicName(config.subject, i + 100); // Offset to avoid conflicts
        const topic = await this.run(`
          INSERT INTO topics (subject_id, description, status)
          VALUES (?, ?, ?)
        `, [subjectId, topicName, 'Pendente']);

        // Create future session
        await this.run(`
          INSERT INTO study_sessions (
            study_plan_id, topic_id, subject_name, topic_description,
            session_date, session_type, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          planId,
          topic.id,
          config.subject,
          topicName,
          futureDate.toISOString().split('T')[0],
          'primeira_vez',
          'Pendente'
        ]);
      }
    }
  }

  /**
   * Get realistic topic name based on subject
   */
  getTopicName(subjectName, index) {
    const topics = {
      'Direito Constitucional': [
        'Princípios Fundamentais',
        'Direitos e Garantias Fundamentais',
        'Organização do Estado',
        'Organização dos Poderes',
        'Controle de Constitucionalidade'
      ],
      'Direito Administrativo': [
        'Atos Administrativos',
        'Processo Administrativo',
        'Licitações e Contratos',
        'Responsabilidade Civil do Estado',
        'Improbidade Administrativa'
      ],
      'Matemática e RLM': [
        'Análise Combinatória',
        'Probabilidade e Estatística',
        'Sequências Lógicas',
        'Porcentagem e Juros',
        'Geometria Básica'
      ],
      'Português': [
        'Interpretação de Textos',
        'Gramática Normativa',
        'Redação Oficial',
        'Ortografia e Acentuação',
        'Sintaxe'
      ],
      'Matemática': [
        'Funções e Gráficos',
        'Geometria Analítica',
        'Probabilidade',
        'Logaritmos e Exponenciais',
        'Trigonometria'
      ],
      'História': [
        'Brasil Colônia',
        'Primeira República',
        'Era Vargas',
        'Ditadura Militar',
        'Nova República'
      ],
      'Geografia': [
        'Geografia Física do Brasil',
        'Geografia Humana',
        'Geopolítica Mundial',
        'Questões Ambientais',
        'Economia Brasileira'
      ]
    };

    const subjectTopics = topics[subjectName] || [`Tópico ${index + 1}`];
    return subjectTopics[index % subjectTopics.length];
  }

  /**
   * Get realistic overdue days (weighted towards recent)
   */
  getRealisticOverdueDays() {
    const random = Math.random();
    if (random < 0.4) return Math.floor(Math.random() * 3) + 1; // 1-3 days (40%)
    if (random < 0.7) return Math.floor(Math.random() * 4) + 4; // 4-7 days (30%)
    if (random < 0.9) return Math.floor(Math.random() * 7) + 8; // 8-14 days (20%)
    return Math.floor(Math.random() * 16) + 15; // 15-30 days (10%)
  }

  /**
   * Get realistic session type
   */
  getSessionType(index, total) {
    if (index === 0) return 'primeira_vez';
    if (index / total < 0.6) return Math.random() > 0.3 ? 'primeira_vez' : 'revisao';
    if (index / total < 0.8) return Math.random() > 0.5 ? 'revisao' : 'primeira_vez';
    return Math.random() > 0.4 ? 'revisao' : 'aprofundamento';
  }

  /**
   * Clean existing test data
   */
  async cleanTestData() {
    console.log('Cleaning existing test data...');

    const testEmails = [
      '3@3.com',
      'concurso-student@editaliza.test',
      'working-professional@editaliza.test',
      'enem-student@editaliza.test'
    ];

    for (const email of testEmails) {
      // Get user ID
      const user = await this.get('SELECT id FROM users WHERE email = ?', [email]);
      if (user) {
        // Delete in correct order to respect foreign key constraints
        await this.run('DELETE FROM study_sessions WHERE study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)', [user.id]);
        await this.run('DELETE FROM topics WHERE subject_id IN (SELECT s.id FROM subjects s JOIN study_plans sp ON s.study_plan_id = sp.id WHERE sp.user_id = ?)', [user.id]);
        await this.run('DELETE FROM subjects WHERE study_plan_id IN (SELECT id FROM study_plans WHERE user_id = ?)', [user.id]);
        await this.run('DELETE FROM study_plans WHERE user_id = ?', [user.id]);
        await this.run('DELETE FROM users WHERE id = ?', [user.id]);
      }
    }

    console.log('✅ Test data cleaned');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Creating Rescheduling Test Data');
  console.log('=================================');

  const creator = new TestDataCreator();

  try {
    await creator.connect();

    const args = process.argv.slice(2);
    const command = args[0] || 'create';

    switch (command) {
      case 'clean':
        await creator.cleanTestData();
        break;
        
      case 'user3':
        await creator.createUser3Scenario();
        break;
        
      case 'scenarios':
        await creator.createTestScenarios();
        break;
        
      case 'create':
      default:
        await creator.cleanTestData();
        await creator.createUser3Scenario();
        await creator.createTestScenarios();
        break;
    }

    console.log('\n✅ Test data creation completed successfully!');
    console.log('\nYou can now run manual tests with:');
    console.log('  node tests/manual/rescheduling-manual-tests.js user3');
    console.log('  node tests/manual/rescheduling-manual-tests.js allusers');
    console.log('  node tests/manual/rescheduling-manual-tests.js performance');

  } catch (error) {
    console.error('❌ Error creating test data:', error.message);
  } finally {
    await creator.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { TestDataCreator };