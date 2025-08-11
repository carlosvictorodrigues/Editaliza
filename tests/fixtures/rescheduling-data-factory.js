/**
 * Test Data Factory for Rescheduling Tests
 * 
 * Creates realistic scenarios with overdue sessions that match
 * real-world usage patterns and edge cases for thorough testing
 * of the intelligent rescheduling system.
 */

const { DatabaseTestHelper } = require('../helpers/database-helper');

/**
 * Realistic Test Data Factory for Rescheduling Scenarios
 */
class ReschedulingDataFactory {
  constructor(testDB) {
    this.testDB = testDB;
  }

  /**
   * Create User 3@3.com scenario - the specific test user mentioned in requirements
   */
  async createUser3Scenario() {
    const user = await this.testDB.createTestUser({
      email: '3@3.com',
      name: 'Test User 3',
      phone: '+5511999887766',
      profession: 'Estudante',
      city: 'São Paulo'
    });

    // Create study plan with realistic exam timeline
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 45); // 45 days from now

    const plan = await this.testDB.createTestPlan({
      user_id: user.id,
      plan_name: 'Concurso Público Federal',
      exam_date: examDate.toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({
        monday: 4,    // 4 hours weekday
        tuesday: 4,
        wednesday: 4, 
        thursday: 4,
        friday: 4,
        saturday: 6,  // 6 hours weekend
        sunday: 3     // 3 hours Sunday
      }),
      session_duration_minutes: 75, // 75-minute sessions
      daily_question_goal: 25,
      weekly_question_goal: 175,
      review_mode: 'spaced',
      postponement_count: 2 // Already postponed twice
    });

    // Create 7 overdue tasks as specified in requirements
    const overdueSubjects = [
      { name: 'Direito Constitucional', overdueCount: 2, priority: 'high' },
      { name: 'Direito Administrativo', overdueCount: 2, priority: 'high' },
      { name: 'Matemática e RLM', overdueCount: 2, priority: 'medium' },
      { name: 'Português', overdueCount: 1, priority: 'medium' }
    ];

    const overdueSessions = [];
    for (const subjectConfig of overdueSubjects) {
      const subject = await this.testDB.createTestSubject({
        study_plan_id: plan.id,
        subject_name: subjectConfig.name,
        priority_weight: subjectConfig.priority === 'high' ? 3 : subjectConfig.priority === 'medium' ? 2 : 1
      });

      for (let i = 0; i < subjectConfig.overdueCount; i++) {
        // Vary overdue dates (1-7 days ago)
        const overdueDate = new Date();
        const daysOverdue = Math.floor(Math.random() * 7) + 1;
        overdueDate.setDate(overdueDate.getDate() - daysOverdue);

        const topic = await this.testDB.createTestTopic({
          subject_id: subject.id,
          description: this.generateRealisticTopicName(subjectConfig.name, i)
        });

        const sessionType = i === 0 ? 'primeira_vez' : 
                           Math.random() > 0.6 ? 'revisao' : 'aprofundamento';

        const session = await this.testDB.createTestSession({
          study_plan_id: plan.id,
          topic_id: topic.id,
          subject_name: subjectConfig.name,
          topic_description: topic.description,
          session_date: overdueDate.toISOString().split('T')[0],
          session_type: sessionType,
          status: 'Pendente',
          postpone_count: Math.floor(Math.random() * 3), // 0-2 previous postponements
          questions_solved: 0,
          time_studied_seconds: 0
        });

        overdueSessions.push(session);
      }
    }

    // Create some future sessions to test intelligent placement
    await this.createFutureSessionsForPlan(plan.id, [
      { subject: 'Direito Constitucional', count: 3 },
      { subject: 'Direito Administrativo', count: 2 },
      { subject: 'Economia', count: 2 },
      { subject: 'Informática', count: 1 }
    ]);

    return {
      user,
      plan,
      overdueSessions,
      totalOverdue: 7,
      subjects: overdueSubjects.map(s => s.name)
    };
  }

  /**
   * Create typical concurso student scenario
   */
  async createConcursoStudentScenario(userId) {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 60); // 2 months to prepare

    const plan = await this.testDB.createTestPlan({
      user_id: userId,
      plan_name: 'Preparação Concurso TRF',
      exam_date: examDate.toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({
        monday: 3, tuesday: 3, wednesday: 3, thursday: 3, 
        friday: 2, saturday: 5, sunday: 4
      }),
      session_duration_minutes: 60,
      review_mode: 'progressive'
    });

    // Realistic concurso subjects with varied overdue patterns
    const subjects = [
      { name: 'Direito Constitucional', overdueCount: 4, difficulty: 'hard' },
      { name: 'Direito Processual Civil', overdueCount: 3, difficulty: 'hard' },
      { name: 'Matemática Financeira', overdueCount: 5, difficulty: 'medium' },
      { name: 'Português', overdueCount: 2, difficulty: 'easy' },
      { name: 'Noções de Informática', overdueCount: 1, difficulty: 'easy' }
    ];

    return await this.createOverdueScenario(plan.id, subjects);
  }

  /**
   * Create ENEM student scenario
   */
  async createEnemStudentScenario(userId) {
    const examDate = new Date();
    examDate.setMonth(examDate.getMonth() + 8); // 8 months preparation

    const plan = await this.testDB.createTestPlan({
      user_id: userId,
      plan_name: 'Preparação ENEM 2025',
      exam_date: examDate.toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({
        monday: 2, tuesday: 2, wednesday: 2, thursday: 2, 
        friday: 1, saturday: 4, sunday: 3
      }),
      session_duration_minutes: 50,
      review_mode: 'spaced'
    });

    const subjects = [
      { name: 'Matemática', overdueCount: 6, difficulty: 'hard' },
      { name: 'Português e Literatura', overdueCount: 4, difficulty: 'medium' },
      { name: 'História', overdueCount: 3, difficulty: 'medium' },
      { name: 'Geografia', overdueCount: 3, difficulty: 'medium' },
      { name: 'Física', overdueCount: 5, difficulty: 'hard' },
      { name: 'Química', overdueCount: 4, difficulty: 'hard' },
      { name: 'Biologia', overdueCount: 2, difficulty: 'easy' },
      { name: 'Redação', overdueCount: 1, difficulty: 'medium' }
    ];

    return await this.createOverdueScenario(plan.id, subjects);
  }

  /**
   * Create working professional scenario (limited time)
   */
  async createWorkingProfessionalScenario(userId) {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 90); // 3 months

    const plan = await this.testDB.createTestPlan({
      user_id: userId,
      plan_name: 'Concurso Analista - Horário Reduzido',
      exam_date: examDate.toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({
        monday: 1.5, tuesday: 1.5, wednesday: 1.5, thursday: 1.5, 
        friday: 1, saturday: 4, sunday: 3
      }),
      session_duration_minutes: 45, // Shorter sessions due to time constraints
      review_mode: 'intensive'
    });

    const subjects = [
      { name: 'Direito Administrativo', overdueCount: 8, difficulty: 'hard' },
      { name: 'Contabilidade Pública', overdueCount: 6, difficulty: 'hard' },
      { name: 'Administração Pública', overdueCount: 4, difficulty: 'medium' },
      { name: 'Português', overdueCount: 2, difficulty: 'easy' }
    ];

    return await this.createOverdueScenario(plan.id, subjects);
  }

  /**
   * Create procrastinator scenario (many overdue tasks)
   */
  async createProcrastinatorScenario(userId) {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 30); // Only 1 month left!

    const plan = await this.testDB.createTestPlan({
      user_id: userId,
      plan_name: 'Recuperação Intensiva - OAB',
      exam_date: examDate.toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({
        monday: 6, tuesday: 6, wednesday: 6, thursday: 6, 
        friday: 6, saturday: 8, sunday: 6
      }),
      session_duration_minutes: 90, // Longer sessions for intensive study
      postponement_count: 5 // Already postponed many times
    });

    const subjects = [
      { name: 'Direito Civil', overdueCount: 12, difficulty: 'hard' },
      { name: 'Direito Penal', overdueCount: 10, difficulty: 'hard' },
      { name: 'Direito Processual Civil', overdueCount: 8, difficulty: 'hard' },
      { name: 'Direito Constitucional', overdueCount: 6, difficulty: 'medium' },
      { name: 'Ética Profissional', overdueCount: 4, difficulty: 'easy' },
      { name: 'Direito Tributário', overdueCount: 5, difficulty: 'medium' }
    ];

    return await this.createOverdueScenario(plan.id, subjects);
  }

  /**
   * Create perfectionist scenario (detailed study plan)
   */
  async createPerfectionistScenario(userId) {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 180); // 6 months preparation

    const plan = await this.testDB.createTestPlan({
      user_id: userId,
      plan_name: 'Magistratura Federal - Estudo Detalhado',
      exam_date: examDate.toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({
        monday: 5, tuesday: 5, wednesday: 5, thursday: 5, 
        friday: 4, saturday: 7, sunday: 5
      }),
      session_duration_minutes: 120, // 2-hour deep study sessions
      review_mode: 'comprehensive'
    });

    const subjects = [
      { name: 'Direito Civil Avançado', overdueCount: 3, difficulty: 'expert' },
      { name: 'Direito Processual Civil', overdueCount: 2, difficulty: 'expert' },
      { name: 'Direito Penal Especial', overdueCount: 2, difficulty: 'expert' },
      { name: 'Direito Constitucional', overdueCount: 1, difficulty: 'hard' },
      { name: 'Direito Empresarial', overdueCount: 1, difficulty: 'hard' }
    ];

    return await this.createOverdueScenario(plan.id, subjects);
  }

  /**
   * Create stress test scenario (massive overdue backlog)
   */
  async createStressTestScenario(userId) {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 365); // 1 year

    const plan = await this.testDB.createTestPlan({
      user_id: userId,
      plan_name: 'Stress Test - Maximum Overdue',
      exam_date: examDate.toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({
        monday: 8, tuesday: 8, wednesday: 8, thursday: 8, 
        friday: 8, saturday: 10, sunday: 6
      }),
      session_duration_minutes: 60
    });

    // Create many subjects with large overdue counts
    const subjects = [];
    const subjectNames = [
      'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History',
      'Geography', 'Literature', 'Philosophy', 'Sociology', 'Economics',
      'Computer Science', 'Statistics', 'Logic', 'Ethics', 'Psychology'
    ];

    subjectNames.forEach((name, index) => {
      subjects.push({
        name,
        overdueCount: 10 + (index * 2), // 10, 12, 14, 16, ... up to 38
        difficulty: ['easy', 'medium', 'hard', 'expert'][index % 4]
      });
    });

    return await this.createOverdueScenario(plan.id, subjects);
  }

  /**
   * Generic helper to create overdue scenario
   */
  async createOverdueScenario(planId, subjects) {
    const allOverdueSessions = [];
    
    for (const subjectConfig of subjects) {
      const subject = await this.testDB.createTestSubject({
        study_plan_id: planId,
        subject_name: subjectConfig.name,
        priority_weight: this.getDifficultyWeight(subjectConfig.difficulty)
      });

      for (let i = 0; i < subjectConfig.overdueCount; i++) {
        const overdueDate = new Date();
        // Vary overdue dates realistically (1-14 days ago, weighted towards recent)
        const daysOverdue = this.getRealisticOverdueDays();
        overdueDate.setDate(overdueDate.getDate() - daysOverdue);

        const topic = await this.testDB.createTestTopic({
          subject_id: subject.id,
          description: this.generateRealisticTopicName(subjectConfig.name, i)
        });

        const sessionType = this.getRealisticSessionType(i, subjectConfig.overdueCount);
        const postponeCount = Math.min(Math.floor(daysOverdue / 3), 5); // Realistic postpone pattern

        const session = await this.testDB.createTestSession({
          study_plan_id: planId,
          topic_id: topic.id,
          subject_name: subjectConfig.name,
          topic_description: topic.description,
          session_date: overdueDate.toISOString().split('T')[0],
          session_type: sessionType,
          status: 'Pendente',
          postpone_count: postponeCount,
          questions_solved: 0,
          time_studied_seconds: 0
        });

        allOverdueSessions.push(session);
      }
    }

    return {
      planId,
      subjects: subjects.map(s => s.name),
      overdueSessions: allOverdueSessions,
      totalOverdue: allOverdueSessions.length
    };
  }

  /**
   * Create future sessions to test intelligent placement
   */
  async createFutureSessionsForPlan(planId, futureSubjects) {
    for (const futureConfig of futureSubjects) {
      const subject = await this.testDB.createTestSubject({
        study_plan_id: planId,
        subject_name: futureConfig.subject,
        priority_weight: 2
      });

      for (let i = 0; i < futureConfig.count; i++) {
        const futureDate = new Date();
        // Space future sessions 3-10 days apart
        const daysInFuture = 3 + (i * Math.floor(Math.random() * 3 + 2));
        futureDate.setDate(futureDate.getDate() + daysInFuture);

        const topic = await this.testDB.createTestTopic({
          subject_id: subject.id,
          description: `Future ${futureConfig.subject} Topic ${i + 1}`
        });

        await this.testDB.createTestSession({
          study_plan_id: planId,
          topic_id: topic.id,
          subject_name: futureConfig.subject,
          topic_description: topic.description,
          session_date: futureDate.toISOString().split('T')[0],
          session_type: 'primeira_vez',
          status: 'Pendente'
        });
      }
    }
  }

  /**
   * Generate realistic topic names based on subject
   */
  generateRealisticTopicName(subjectName, index) {
    const topicMap = {
      'Direito Constitucional': ['Princípios Fundamentais', 'Direitos Fundamentais', 'Organização do Estado', 'Controle de Constitucionalidade'],
      'Direito Administrativo': ['Atos Administrativos', 'Licitações', 'Contratos Administrativos', 'Responsabilidade Civil'],
      'Matemática e RLM': ['Análise Combinatória', 'Probabilidade', 'Sequências Lógicas', 'Porcentagem'],
      'Português': ['Interpretação de Texto', 'Gramática', 'Redação Oficial', 'Ortografia'],
      'Matemática': ['Funções', 'Geometria Analítica', 'Probabilidade', 'Estatística', 'Logaritmos'],
      'História': ['Brasil Colônia', 'Primeira República', 'Era Vargas', 'Ditadura Militar', 'Nova República'],
      'Geografia': ['Geografia Física', 'Geografia Humana', 'Geopolítica', 'Geografia do Brasil'],
      'Física': ['Mecânica', 'Termodinâmica', 'Óptica', 'Eletromagnetismo', 'Física Moderna'],
      'Química': ['Química Orgânica', 'Físico-Química', 'Química Inorgânica', 'Análise Química']
    };

    const topics = topicMap[subjectName] || [`Tópico ${index + 1}`, `Conceito ${index + 1}`, `Capítulo ${index + 1}`];
    return topics[index % topics.length] || `${subjectName} - Tópico ${index + 1}`;
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
   * Get realistic session type based on position
   */
  getRealisticSessionType(index, total) {
    if (index === 0) return 'primeira_vez';
    if (index / total < 0.6) return Math.random() > 0.3 ? 'primeira_vez' : 'revisao';
    if (index / total < 0.8) return Math.random() > 0.5 ? 'revisao' : 'primeira_vez';
    return Math.random() > 0.4 ? 'revisao' : 'aprofundamento';
  }

  /**
   * Convert difficulty to numeric weight
   */
  getDifficultyWeight(difficulty) {
    const weights = { easy: 1, medium: 2, hard: 3, expert: 4 };
    return weights[difficulty] || 2;
  }

  /**
   * Create realistic mixed scenario for comprehensive testing
   */
  async createMixedRealisticScenario(userId) {
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 75); // 2.5 months

    const plan = await this.testDB.createTestPlan({
      user_id: userId,
      plan_name: 'Cenário Misto Realístico',
      exam_date: examDate.toISOString().split('T')[0],
      study_hours_per_day: JSON.stringify({
        monday: 3.5, tuesday: 3.5, wednesday: 3.5, thursday: 3.5, 
        friday: 2.5, saturday: 5.5, sunday: 4
      }),
      session_duration_minutes: 70,
      review_mode: 'adaptive'
    });

    // Mixed subjects with realistic distribution
    const subjects = [
      { name: 'Direito Constitucional', overdueCount: 5, difficulty: 'hard' },
      { name: 'Matemática Financeira', overdueCount: 7, difficulty: 'medium' },
      { name: 'Português', overdueCount: 3, difficulty: 'easy' },
      { name: 'Informática', overdueCount: 2, difficulty: 'easy' },
      { name: 'Direito Administrativo', overdueCount: 4, difficulty: 'hard' },
      { name: 'Economia', overdueCount: 2, difficulty: 'medium' }
    ];

    const result = await this.createOverdueScenario(plan.id, subjects);

    // Add future sessions for intelligent rescheduling tests
    await this.createFutureSessionsForPlan(plan.id, [
      { subject: 'Direito Constitucional', count: 4 },
      { subject: 'Matemática Financeira', count: 3 },
      { subject: 'Ética Profissional', count: 2 }
    ]);

    return result;
  }
}

module.exports = { ReschedulingDataFactory };