/**
 * Test Data Fixtures
 * Provides consistent test data for all test suites
 */

const validUsers = {
  basic: {
    email: 'test@example.com',
    password: 'TestPassword123!',
    name: 'Test User'
  },
  
  complete: {
    email: 'complete@example.com',
    password: 'CompletePassword123!',
    name: 'Complete User',
    phone: '11999999999',
    occupation: 'Software Developer',
    institution: 'Tech Company',
    city: 'São Paulo',
    study_hours_per_day: 4,
    target_score: 85,
    difficulties: ['Direito Constitucional', 'Matemática']
  },

  google: {
    email: 'google@example.com',
    name: 'Google User',
    googleId: 'google123456',
    avatar: 'https://example.com/avatar.jpg',
    auth_provider: 'google'
  },

  admin: {
    email: 'admin@editaliza.com',
    password: 'AdminPassword123!',
    name: 'Admin User',
    role: 'admin'
  }
};

const invalidUsers = {
  noEmail: {
    password: 'TestPassword123!',
    name: 'No Email User'
  },

  invalidEmail: {
    email: 'invalid-email',
    password: 'TestPassword123!',
    name: 'Invalid Email User'
  },

  weakPassword: {
    email: 'weak@example.com',
    password: '123',
    name: 'Weak Password User'
  },

  noPassword: {
    email: 'nopass@example.com',
    name: 'No Password User'
  },

  xssAttempt: {
    email: 'xss@example.com',
    password: 'TestPassword123!',
    name: '<script>alert("xss")</script>'
  },

  sqlInjection: {
    email: 'sql@example.com',
    password: 'TestPassword123!',
    name: '\'; DROP TABLE users; --'
  }
};

const studyPlans = {
  basic: {
    name: 'Plano Básico de Estudos',
    description: 'Plano simples para iniciantes',
    target_exam: 'Concurso Público',
    duration_weeks: 12,
    weekly_hours: 20,
    subjects: ['Português', 'Matemática', 'Direito'],
    difficulty_level: 'beginner'
  },

  advanced: {
    name: 'Plano Avançado de Estudos',
    description: 'Plano intensivo para concursos específicos',
    target_exam: 'Tribunal de Justiça',
    duration_weeks: 24,
    weekly_hours: 40,
    subjects: ['Direito Civil', 'Direito Penal', 'Direito Processual'],
    difficulty_level: 'advanced',
    custom_subjects: ['Jurisprudência Específica']
  }
};

const scheduleData = {
  weeklySchedule: {
    monday: [
      { time: '08:00', subject: 'Português', duration: 120 },
      { time: '14:00', subject: 'Matemática', duration: 90 }
    ],
    tuesday: [
      { time: '09:00', subject: 'Direito', duration: 150 }
    ],
    wednesday: [
      { time: '08:00', subject: 'Português', duration: 120 }
    ]
  },

  dailyGoals: {
    target_hours: 4,
    completed_hours: 2,
    subjects_studied: ['Português', 'Matemática'],
    efficiency_score: 85
  }
};

const testTokens = {
  valid: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwi',
  expired: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid',
  malformed: 'invalid.token.format',
  empty: ''
};

const apiResponses = {
  success: {
    message: 'Operação realizada com sucesso!',
    data: {}
  },

  error: {
    error: 'Erro na operação',
    details: 'Detalhes do erro'
  },

  validation: {
    error: 'Dados inválidos',
    fields: ['email', 'password']
  }
};

const securityTestData = {
  xssPayloads: [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(\'xss\')">',
    '<svg onload="alert(\'xss\')">',
    '"><script>alert("xss")</script>'
  ],

  sqlInjectionPayloads: [
    '\' OR \'1\'=\'1',
    '\'; DROP TABLE users; --',
    '\' UNION SELECT * FROM users --',
    'admin\'--',
    '\' OR 1=1#'
  ],

  oversizedData: {
    longString: 'x'.repeat(10000),
    longEmail: 'a'.repeat(1000) + '@example.com',
    longName: 'Name '.repeat(1000)
  }
};

module.exports = {
  validUsers,
  invalidUsers,
  studyPlans,
  scheduleData,
  testTokens,
  apiResponses,
  securityTestData
};