// Script para configurar plano TJPE 2025
const { Pool } = require('pg');

const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'editaliza_db',
    user: 'editaliza_user',
    password: '1a2b3c4d',
});

async function setupPlan() {
    const client = await pool.connect();
    
    try {
        // Configurar search path
        await client.query('SET search_path TO app, public');
        
        // Atualizar configurações do plano
        console.log('📅 Atualizando data da prova e configurações...');
        await client.query(`
            UPDATE study_plans 
            SET 
                exam_date = '2025-09-21',
                study_hours_per_day = '{"0":4,"1":8,"2":8,"3":8,"4":8,"5":8,"6":4}',
                daily_question_goal = 100,
                weekly_question_goal = 600,
                session_duration_minutes = 50,
                review_mode = 'reta_final'
            WHERE id = 24
        `);
        
        // Adicionar matérias com pesos
        const subjects = [
            { name: 'Direito Civil', weight: 5, topics: 60 },
            { name: 'Processo Civil', weight: 5, topics: 50 },
            { name: 'Legislação Específica', weight: 3, topics: 30 },
            { name: 'Português', weight: 2, topics: 25 },
            { name: 'Raciocínio Lógico', weight: 1, topics: 15 }
        ];
        
        for (const subject of subjects) {
            console.log(`📚 Adicionando ${subject.name} (peso ${subject.weight})...`);
            
            // Inserir matéria
            const subjectResult = await client.query(
                `INSERT INTO subjects (study_plan_id, subject_name, priority_weight) 
                 VALUES (24, $1, $2) 
                 RETURNING id`,
                [subject.name, subject.weight]
            );
            
            const subjectId = subjectResult.rows[0].id;
            
            // Adicionar tópicos baseados no conteúdo programático
            console.log(`  ➡️ Adicionando ${subject.topics} tópicos...`);
            
            if (subject.name === 'Direito Civil') {
                const topics = [
                    'Lei de Introdução às Normas do Direito Brasileiro',
                    'Parte Geral - Pessoas Naturais',
                    'Parte Geral - Pessoas Jurídicas',
                    'Parte Geral - Bens',
                    'Parte Geral - Fatos Jurídicos',
                    'Parte Geral - Negócio Jurídico',
                    'Parte Geral - Atos Jurídicos Lícitos',
                    'Parte Geral - Atos Ilícitos',
                    'Parte Geral - Prescrição e Decadência',
                    'Obrigações - Modalidades',
                    'Obrigações - Transmissão',
                    'Obrigações - Adimplemento e Extinção',
                    'Obrigações - Inadimplemento',
                    'Contratos - Teoria Geral',
                    'Contratos - Espécies (Compra e Venda)',
                    'Contratos - Espécies (Doação)',
                    'Contratos - Espécies (Locação)',
                    'Contratos - Espécies (Empréstimo)',
                    'Contratos - Espécies (Prestação de Serviços)',
                    'Contratos - Espécies (Empreitada)',
                    'Contratos - Espécies (Depósito)',
                    'Contratos - Espécies (Mandato)',
                    'Contratos - Espécies (Comissão)',
                    'Contratos - Espécies (Agência e Distribuição)',
                    'Contratos - Espécies (Corretagem)',
                    'Contratos - Espécies (Transporte)',
                    'Contratos - Espécies (Seguro)',
                    'Contratos - Espécies (Fiança)',
                    'Responsabilidade Civil',
                    'Posse',
                    'Direitos Reais - Propriedade',
                    'Direitos Reais - Superfície',
                    'Direitos Reais - Servidões',
                    'Direitos Reais - Usufruto',
                    'Direitos Reais - Uso',
                    'Direitos Reais - Habitação',
                    'Direitos Reais - Direito do Promitente Comprador',
                    'Direitos Reais - Penhor',
                    'Direitos Reais - Hipoteca',
                    'Direitos Reais - Anticrese',
                    'Família - Casamento',
                    'Família - Relações de Parentesco',
                    'Família - Regime de Bens',
                    'Família - Usufruto e Administração dos Bens',
                    'Família - Alimentos',
                    'Família - Bem de Família',
                    'Família - União Estável',
                    'Família - Tutela e Curatela',
                    'Sucessões - Sucessão em Geral',
                    'Sucessões - Sucessão Legítima',
                    'Sucessões - Sucessão Testamentária',
                    'Sucessões - Inventário e Partilha',
                    'Lei 8.078/90 - Código de Defesa do Consumidor',
                    'Lei 10.741/03 - Estatuto do Idoso',
                    'Lei 8.069/90 - Estatuto da Criança e do Adolescente (parte civil)',
                    'Lei 13.146/15 - Estatuto da Pessoa com Deficiência',
                    'Lei 11.340/06 - Lei Maria da Penha (aspectos civis)',
                    'Lei 12.318/10 - Alienação Parental',
                    'Lei 6.015/73 - Registros Públicos',
                    'Lei 8.245/91 - Locação de Imóveis Urbanos'
                ];
                
                for (const topicName of topics) {
                    await client.query(
                        `INSERT INTO topics (subject_id, topic_name, priority_weight, status) 
                         VALUES ($1, $2, 3, 'Pendente')`,
                        [subjectId, topicName]
                    );
                }
            } else if (subject.name === 'Processo Civil') {
                const topics = [
                    'Princípios do Processo Civil',
                    'Normas Processuais',
                    'Jurisdição',
                    'Ação',
                    'Competência',
                    'Sujeitos do Processo - Juiz',
                    'Sujeitos do Processo - Partes e Procuradores',
                    'Sujeitos do Processo - Ministério Público',
                    'Sujeitos do Processo - Advocacia Pública',
                    'Sujeitos do Processo - Defensoria Pública',
                    'Litisconsórcio',
                    'Intervenção de Terceiros',
                    'Incidente de Desconsideração da Personalidade Jurídica',
                    'Amicus Curiae',
                    'Atos Processuais - Forma',
                    'Atos Processuais - Tempo e Lugar',
                    'Atos Processuais - Prazos',
                    'Atos Processuais - Comunicação',
                    'Atos Processuais - Nulidades',
                    'Atos Processuais - Distribuição e Registro',
                    'Atos Processuais - Valor da Causa',
                    'Tutela Provisória',
                    'Formação, Suspensão e Extinção do Processo',
                    'Processo de Conhecimento - Procedimento Comum',
                    'Petição Inicial',
                    'Improcedência Liminar do Pedido',
                    'Audiência de Conciliação ou Mediação',
                    'Contestação',
                    'Reconvenção',
                    'Revelia',
                    'Providências Preliminares e Saneamento',
                    'Julgamento Conforme o Estado do Processo',
                    'Audiência de Instrução e Julgamento',
                    'Provas',
                    'Sentença e Coisa Julgada',
                    'Liquidação de Sentença',
                    'Cumprimento de Sentença',
                    'Procedimentos Especiais',
                    'Processo de Execução',
                    'Processos nos Tribunais',
                    'Recursos - Teoria Geral',
                    'Recursos - Apelação',
                    'Recursos - Agravo de Instrumento',
                    'Recursos - Agravo Interno',
                    'Recursos - Embargos de Declaração',
                    'Recursos - Recursos para os Tribunais Superiores',
                    'Reclamação',
                    'Incidente de Resolução de Demandas Repetitivas',
                    'Incidente de Assunção de Competência',
                    'Juizados Especiais Cíveis'
                ];
                
                for (const topicName of topics) {
                    await client.query(
                        `INSERT INTO topics (subject_id, topic_name, priority_weight, status) 
                         VALUES ($1, $2, 3, 'Pendente')`,
                        [subjectId, topicName]
                    );
                }
            } else if (subject.name === 'Legislação Específica') {
                const topics = [
                    'Constituição Federal - Poder Judiciário',
                    'Constituição de Pernambuco - Poder Judiciário',
                    'Lei de Organização Judiciária de PE',
                    'Código de Organização Judiciária de PE',
                    'Regimento Interno do TJPE',
                    'Lei 8.112/90 - Regime Jurídico dos Servidores',
                    'Lei 9.784/99 - Processo Administrativo',
                    'Lei 8.429/92 - Improbidade Administrativa',
                    'Lei 12.846/13 - Anticorrupção',
                    'Resolução CNJ 102/2009',
                    'Resolução CNJ 115/2010',
                    'Resolução CNJ 230/2016',
                    'Resolução CNJ 270/2018',
                    'Resolução CNJ 331/2020',
                    'Resolução CNJ 400/2021',
                    'Provimentos da Corregedoria',
                    'Código de Ética dos Servidores do TJPE',
                    'Manual de Procedimentos do 1º Grau',
                    'PJe - Sistema de Processo Judicial Eletrônico',
                    'SEI - Sistema Eletrônico de Informações',
                    'Tabelas Processuais Unificadas do CNJ',
                    'Gestão de Processos e Metas do CNJ',
                    'Justiça em Números',
                    'Planejamento Estratégico do TJPE',
                    'Governança Judicial',
                    'Gestão de Pessoas no Judiciário',
                    'Acessibilidade e Inclusão',
                    'Sustentabilidade no Poder Judiciário',
                    'Ouvidoria Judicial',
                    'Conciliação e Mediação'
                ];
                
                for (const topicName of topics) {
                    await client.query(
                        `INSERT INTO topics (subject_id, topic_name, priority_weight, status) 
                         VALUES ($1, $2, 3, 'Pendente')`,
                        [subjectId, topicName]
                    );
                }
            } else if (subject.name === 'Português') {
                const topics = [
                    'Ortografia',
                    'Acentuação Gráfica',
                    'Uso do Hífen',
                    'Classes de Palavras - Substantivo',
                    'Classes de Palavras - Adjetivo',
                    'Classes de Palavras - Artigo',
                    'Classes de Palavras - Pronome',
                    'Classes de Palavras - Verbo',
                    'Classes de Palavras - Advérbio',
                    'Classes de Palavras - Preposição',
                    'Classes de Palavras - Conjunção',
                    'Sintaxe - Termos Essenciais',
                    'Sintaxe - Termos Integrantes',
                    'Sintaxe - Termos Acessórios',
                    'Período Composto por Coordenação',
                    'Período Composto por Subordinação',
                    'Concordância Nominal',
                    'Concordância Verbal',
                    'Regência Nominal',
                    'Regência Verbal',
                    'Crase',
                    'Pontuação',
                    'Interpretação de Textos',
                    'Coesão e Coerência',
                    'Redação Oficial'
                ];
                
                for (const topicName of topics) {
                    await client.query(
                        `INSERT INTO topics (subject_id, topic_name, priority_weight, status) 
                         VALUES ($1, $2, 3, 'Pendente')`,
                        [subjectId, topicName]
                    );
                }
            } else if (subject.name === 'Raciocínio Lógico') {
                const topics = [
                    'Proposições e Conectivos Lógicos',
                    'Tabelas-Verdade',
                    'Equivalências Lógicas',
                    'Negação de Proposições',
                    'Argumentação Lógica',
                    'Lógica de Primeira Ordem',
                    'Diagramas Lógicos',
                    'Sequências e Padrões',
                    'Análise Combinatória',
                    'Probabilidade',
                    'Conjuntos',
                    'Razão e Proporção',
                    'Regra de Três',
                    'Porcentagem',
                    'Problemas Lógicos'
                ];
                
                for (const topicName of topics) {
                    await client.query(
                        `INSERT INTO topics (subject_id, topic_name, priority_weight, status) 
                         VALUES ($1, $2, 3, 'Pendente')`,
                        [subjectId, topicName]
                    );
                }
            }
        }
        
        console.log('✅ Plano TJPE 2025 configurado com sucesso!');
        console.log('📊 Resumo:');
        console.log('   - Data da prova: 21/09/2025');
        console.log('   - Horas de estudo: 8h (seg-sex), 4h (sáb-dom)');
        console.log('   - Modo: Reta Final');
        console.log('   - Matérias: 5 com pesos diferenciados');
        console.log('   - Total de tópicos: ~180');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        client.release();
        pool.end();
    }
}

setupPlan();