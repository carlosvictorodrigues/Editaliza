const db = require('./database-postgresql');

(async () => {
  try {
    console.log('🎲 Criando sessões de exemplo para o usuário u@u.com...');
    
    // Buscar o ID do plano do usuário u@u.com
    const planResult = await db.pool.query(`
      SELECT p.id FROM study_plans p
      JOIN users u ON p.user_id = u.id
      WHERE u.email = 'u@u.com'
      LIMIT 1
    `);
    
    if (planResult.rows.length === 0) {
      console.log('❌ Usuário u@u.com não encontrado!');
      process.exit(1);
    }
    
    const planId = planResult.rows[0].id;
    console.log(`📋 Plano encontrado: ID ${planId}`);
    
    // Criar 15 sessões concluídas com diferentes tempos e disciplinas
    const sampleSessions = [
      { subject: 'Português', minutes: 45, seconds: 2700, questions: 20, date: '2025-08-25' },
      { subject: 'Português', minutes: 30, seconds: 1800, questions: 15, date: '2025-08-26' },
      { subject: 'Português', minutes: 60, seconds: 3600, questions: 25, date: '2025-08-27' },
      { subject: 'Matemática', minutes: 90, seconds: 5400, questions: 30, date: '2025-08-25' },
      { subject: 'Matemática', minutes: 75, seconds: 4500, questions: 28, date: '2025-08-28' },
      { subject: 'Matemática', minutes: 50, seconds: 3000, questions: 18, date: '2025-08-29' },
      { subject: 'Direito Constitucional', minutes: 120, seconds: 7200, questions: 35, date: '2025-08-26' },
      { subject: 'Direito Constitucional', minutes: 60, seconds: 3600, questions: 22, date: '2025-08-30' },
      { subject: 'Direito Constitucional', minutes: 80, seconds: 4800, questions: 26, date: '2025-08-31' },
      { subject: 'Informática', minutes: 40, seconds: 2400, questions: 12, date: '2025-08-27' },
      { subject: 'Informática', minutes: 55, seconds: 3300, questions: 16, date: '2025-08-29' },
      { subject: 'Informática', minutes: 35, seconds: 2100, questions: 10, date: '2025-08-31' },
      { subject: 'História', minutes: 65, seconds: 3900, questions: 18, date: '2025-08-28' },
      { subject: 'História', minutes: 45, seconds: 2700, questions: 14, date: '2025-08-30' },
      { subject: 'Geografia', minutes: 50, seconds: 3000, questions: 16, date: '2025-08-31' }
    ];
    
    console.log(`📚 Inserindo ${sampleSessions.length} sessões concluídas...`);
    
    for (const session of sampleSessions) {
      await db.pool.query(`
        INSERT INTO study_sessions (
          study_plan_id, 
          session_date, 
          subject_name, 
          topic_description, 
          session_type, 
          status,
          duration_minutes, 
          time_studied_seconds, 
          questions_solved,
          created_at, 
          updated_at,
          completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
      `, [
        planId,
        session.date,
        session.subject,
        `Estudo de ${session.subject}`,
        'Estudo',
        'Concluído',
        session.minutes,
        session.seconds,
        session.questions
      ]);
      
      console.log(`  ✅ ${session.subject}: ${session.minutes}min, ${session.questions} questões`);
    }
    
    // Verificar o resultado
    console.log('\n📊 VERIFICANDO DADOS CRIADOS...');
    const checkResult = await db.pool.query(`
      SELECT 
        subject_name,
        COUNT(*) as sessions,
        SUM(duration_minutes) as total_minutes,
        SUM(time_studied_seconds) as total_seconds,
        SUM(questions_solved) as total_questions
      FROM study_sessions s
      JOIN study_plans p ON s.study_plan_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE u.email = 'u@u.com' AND s.status = 'Concluído'
      GROUP BY subject_name
      ORDER BY total_seconds DESC
    `);
    
    console.log('\nResumo por disciplina:');
    checkResult.rows.forEach(row => {
      const hours = Math.floor(row.total_seconds / 3600);
      const minutes = Math.floor((row.total_seconds % 3600) / 60);
      console.log(`  ${row.subject_name}: ${row.sessions} sessões, ${hours}h${minutes}min, ${row.total_questions} questões`);
    });
    
    const totalTime = checkResult.rows.reduce((acc, row) => acc + parseInt(row.total_seconds), 0);
    const totalHours = Math.floor(totalTime / 3600);
    const totalMinutes = Math.floor((totalTime % 3600) / 60);
    
    console.log(`\n⭐ TOTAL: ${totalHours}h${totalMinutes}min de estudo registrado`);
    console.log('✅ Sessões de exemplo criadas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
  process.exit(0);
})();