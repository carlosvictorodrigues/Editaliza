// Script para configurar plano TJPE 2025 COMPLETO
// Baseado no conteúdo programático oficial (primeira parte do arquivo)
// Com pesos definidos conforme análise de prioridades

const { Pool } = require('pg');

const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'editaliza_db',
    user: 'editaliza_user',
    password: '1a2b3c4d',
});

async function setupCompletePlan() {
    const client = await pool.connect();
    
    try {
        // Configurar search path
        await client.query('SET search_path TO app, public');
        
        console.log('🎯 CRIANDO PLANO TJPE 2025 COMPLETO');
        console.log('=' .repeat(60));
        
        // 1. Criar o plano de estudos
        console.log('\n📋 Criando plano de estudos...');
        const planResult = await client.query(
            `INSERT INTO study_plans 
            (user_id, plan_name, exam_date, study_hours_per_day, 
             daily_question_goal, weekly_question_goal, session_duration_minutes, 
             review_mode, reta_final_mode, has_essay) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING id`,
            [
                5, // user_id para p@p.com
                'TJPE 2025 - Plano Completo',
                '2025-09-21', // Data da prova
                '{"0":4,"1":8,"2":8,"3":8,"4":8,"5":8,"6":4}', // 8h seg-sex, 4h sab-dom
                100, // daily_question_goal
                600, // weekly_question_goal
                70, // session_duration_minutes (70 minutos por sessão)
                'reta_final', // review_mode
                true, // reta_final_mode ativado
                false // has_essay
            ]
        );
        
        const planId = planResult.rows[0].id;
        console.log('✅ Plano criado com ID:', planId);
        
        // 2. Adicionar matérias com pesos específicos
        console.log('\n📚 Adicionando matérias com pesos:');
        
        const subjects = [
            // Português - Peso 2
            { 
                name: 'Língua Portuguesa', 
                weight: 2, 
                topics: [
                    'Modalidade culta usada contemporaneamente no Brasil',
                    'Ortografia, acentuação e pontuação',
                    'Vocabulário',
                    'Pronomes: emprego, formas de tratamento e colocação',
                    'Concordância nominal e concordância verbal',
                    'Flexão nominal e flexão verbal',
                    'Regência nominal e regência verbal',
                    'Vozes do verbo',
                    'Correlação de tempos e modos verbais',
                    'Coordenação e subordinação',
                    'Morfossintaxe',
                    'Semântica',
                    'Elementos estruturais e processos de formação de palavras',
                    'Compreensão e interpretação de textos de gêneros variados',
                    'Conhecimentos de linguística, literatura e estilística',
                    'Redação: confronto e reconhecimento de frases corretas',
                    'Redação oficial: aspectos gerais e características'
                ]
            },
            
            // Raciocínio Lógico - Peso 1
            { 
                name: 'Raciocínio Lógico', 
                weight: 1, 
                topics: [
                    'Lógica proposicional',
                    'Argumentação lógica',
                    'Raciocínio sequencial',
                    'Raciocínio lógico quantitativo',
                    'Raciocínio lógico analítico',
                    'Diagramas lógicos',
                    'Análise combinatória',
                    'Probabilidade'
                ]
            },
            
            // Direito Administrativo - Peso 4
            { 
                name: 'Direito Administrativo', 
                weight: 4, 
                topics: [
                    'Princípios do Direito Administrativo',
                    'Administração Pública: conceito, princípios, finalidade',
                    'Administração Pública direta e indireta',
                    'Poderes Administrativos',
                    'Atos administrativos: conceitos, requisitos, atributos',
                    'Contratos administrativos: conceito, espécies, execução',
                    'Inexecução, revisão e rescisão de contratos',
                    'Gestão contratual',
                    'Licitação: conceito, princípios, modalidades',
                    'Recursos administrativos',
                    'Sistema de Registro de Preços',
                    'Serviços Públicos: conceito, classificação, delegação',
                    'Servidores Públicos e Regime jurídico',
                    'Organização do serviço público',
                    'Direitos, deveres e proibições do servidor público',
                    'Responsabilidade Administrativa, civil e criminal do servidor',
                    'Bens Públicos: conceito, classificação, uso, alienação',
                    'Controle da Administração',
                    'Responsabilidade civil do Estado',
                    'Limitações do direito de propriedade',
                    'Intervenção do Estado na propriedade',
                    'Desapropriação por necessidade e utilidade pública',
                    'Desapropriação por interesse social',
                    'Desapropriação indireta e Retrocessão',
                    'Servidão e requisição administrativa',
                    'Processo Administrativo: processo e procedimento',
                    'Lei 8.429/1992 - Improbidade Administrativa'
                ]
            },
            
            // Direito Constitucional - Peso 4
            { 
                name: 'Direito Constitucional', 
                weight: 4, 
                topics: [
                    'Dos Princípios Fundamentais',
                    'Dos Direitos e Garantias Fundamentais',
                    'Da Organização do Estado',
                    'Da Organização dos Poderes',
                    'Das Funções Essenciais à Justiça',
                    'Da Defesa do Estado e das Instituições Democráticas',
                    'Do Sistema Tributário Nacional',
                    'Da Ordem Econômica e Financeira',
                    'Da Ordem Social',
                    'Das Disposições Constitucionais Gerais',
                    'Das Disposições Constitucionais Transitórias',
                    'Da Constituição do Estado de Pernambuco',
                    'Da Administração Pública: disposições gerais',
                    'Dos servidores públicos',
                    'Lei 7.347/1985 - Ação Civil Pública',
                    'Lei 12.016/2009 - Mandado de Segurança'
                ]
            },
            
            // Direito Civil - Peso 5
            { 
                name: 'Direito Civil', 
                weight: 5, 
                topics: [
                    'Fontes do direito civil, princípios aplicáveis e normas gerais',
                    'Pessoas naturais e pessoas jurídicas',
                    'Domicílio',
                    'Bens',
                    'Atos jurídicos',
                    'Negócio jurídico',
                    'Prescrição e decadência',
                    'Prova',
                    'Obrigações',
                    'Responsabilidade Civil'
                ]
            },
            
            // Direito Processual Civil - Peso 5
            { 
                name: 'Direito Processual Civil', 
                weight: 5, 
                topics: [
                    'Jurisdição e ação',
                    'Partes e procuradores',
                    'Litisconsórcio e assistência',
                    'Intervenção de terceiros',
                    'Ministério Público',
                    'Competência',
                    'O juiz',
                    'Atos processuais',
                    'Formação, suspensão e extinção do processo',
                    'Procedimentos ordinário e sumário',
                    'Resposta do réu',
                    'Revelia',
                    'Julgamento conforme o estado do processo',
                    'Provas',
                    'Audiência',
                    'Sentença e coisa julgada',
                    'Liquidação e cumprimento da sentença',
                    'Recursos',
                    'Processo de execução',
                    'Processo cautelar e medidas cautelares',
                    'Procedimentos especiais: MS, ação popular, ACP'
                ]
            },
            
            // Direito Penal - Peso 4
            { 
                name: 'Direito Penal', 
                weight: 4, 
                topics: [
                    'Sujeito ativo e sujeito passivo da infração penal',
                    'Tipicidade, ilicitude, culpabilidade, punibilidade',
                    'Excludentes de ilicitude e de culpabilidade',
                    'Erro de tipo e erro de proibição',
                    'Imputabilidade penal',
                    'Concurso de pessoas',
                    'Crimes contra a fé pública',
                    'Crimes contra a Administração Pública',
                    'Dos crimes contra a inviolabilidade dos segredos',
                    'Crimes contra o patrimônio',
                    'Crimes contra a pessoa: vida, lesões corporais',
                    'Atos de improbidade praticados por agentes públicos'
                ]
            },
            
            // Direito Processual Penal - Peso 4
            { 
                name: 'Direito Processual Penal', 
                weight: 4, 
                topics: [
                    'Ação Penal: Ação Penal Pública e Privada',
                    'A Denúncia',
                    'A Representação, a Queixa, a Renúncia, o Perdão',
                    'Sujeitos do processo: Juiz, Acusador, Ofendido, Defensor',
                    'Atos Processuais: Forma, Lugar, Tempo',
                    'Comunicações Processuais: citação, notificação, intimação',
                    'Prisão: temporária, em flagrante, preventiva',
                    'Liberdade Provisória e Fiança',
                    'Atos Jurisdicionais: despachos, decisões, sentença',
                    'Dos Recursos em geral',
                    'Da Apelação e do Recurso em Sentido Estrito',
                    'Do Habeas Corpus',
                    'Do Mandado de Segurança'
                ]
            },
            
            // Legislação Específica - Peso 3
            { 
                name: 'Legislação Específica', 
                weight: 3, 
                topics: [
                    'Resolução nº 395/2017 - Regimento Interno do TJPE',
                    'Lei Complementar nº 100/2007 - Código de Organização Judiciária',
                    'Lei Estadual nº 6.123/1968 - Regime Jurídico dos Servidores',
                    'Resolução CNJ nº 185/2013 - Sistema PJe',
                    'Lei nº 11.419/2006 - Informatização do Processo Judicial',
                    'Lei nº 14.133/2021 - Licitações e Contratos Administrativos'
                ]
            }
        ];
        
        // Inserir matérias e tópicos
        for (const subject of subjects) {
            console.log(`\n📖 ${subject.name} (peso ${subject.weight})`);
            
            // Inserir matéria
            const subjectResult = await client.query(
                `INSERT INTO subjects (study_plan_id, subject_name, priority_weight) 
                 VALUES ($1, $2, $3) 
                 RETURNING id`,
                [planId, subject.name, subject.weight]
            );
            
            const subjectId = subjectResult.rows[0].id;
            console.log(`   ✅ Matéria criada com ID: ${subjectId}`);
            
            // Inserir tópicos com peso baseado na análise
            console.log(`   📝 Adicionando ${subject.topics.length} tópicos...`);
            
            for (const topicName of subject.topics) {
                // Determinar peso do tópico baseado em palavras-chave
                let topicWeight = 3; // peso padrão
                
                // Ajustar peso baseado na análise de prioridades
                if (subject.name === 'Língua Portuguesa') {
                    if (topicName.includes('interpretação') || topicName.includes('compreensão')) {
                        topicWeight = 5;
                    } else if (topicName.includes('Ortografia') || topicName.includes('Concordância') || 
                               topicName.includes('Regência') || topicName.includes('Pontuação')) {
                        topicWeight = 4;
                    }
                } else if (subject.name === 'Raciocínio Lógico') {
                    if (topicName.includes('proposicional')) {
                        topicWeight = 5;
                    } else if (topicName.includes('Argumentação') || topicName.includes('combinatória') || 
                               topicName.includes('Probabilidade')) {
                        topicWeight = 4;
                    }
                } else if (subject.name === 'Direito Administrativo') {
                    if (topicName.includes('Licitação') || topicName.includes('Princípios')) {
                        topicWeight = 5;
                    } else if (topicName.includes('Poderes') || topicName.includes('Atos administrativos') || 
                               topicName.includes('Servidores')) {
                        topicWeight = 4;
                    }
                } else if (subject.name === 'Direito Constitucional') {
                    if (topicName.includes('Direitos e Garantias') || topicName.includes('Administração Pública')) {
                        topicWeight = 5;
                    } else if (topicName.includes('Princípios Fundamentais') || topicName.includes('Organização')) {
                        topicWeight = 4;
                    }
                } else if (subject.name === 'Direito Civil') {
                    if (topicName.includes('Negócio jurídico')) {
                        topicWeight = 5;
                    } else if (topicName.includes('Obrigações') || topicName.includes('Responsabilidade')) {
                        topicWeight = 4;
                    }
                } else if (subject.name === 'Direito Processual Civil') {
                    if (topicName.includes('Resposta do réu') || topicName.includes('Partes')) {
                        topicWeight = 5;
                    } else if (topicName.includes('Competência') || topicName.includes('Recursos')) {
                        topicWeight = 4;
                    }
                } else if (subject.name === 'Direito Penal') {
                    if (topicName.includes('Tipicidade') || topicName.includes('Administração Pública')) {
                        topicWeight = 5;
                    } else if (topicName.includes('patrimônio') || topicName.includes('pessoa')) {
                        topicWeight = 4;
                    }
                } else if (subject.name === 'Direito Processual Penal') {
                    if (topicName.includes('Prisão') || topicName.includes('Liberdade')) {
                        topicWeight = 5;
                    } else if (topicName.includes('Ação Penal') || topicName.includes('Habeas')) {
                        topicWeight = 4;
                    }
                } else if (subject.name === 'Legislação Específica') {
                    if (topicName.includes('14.133')) {
                        topicWeight = 5;
                    } else if (topicName.includes('Regimento') || topicName.includes('100/2007')) {
                        topicWeight = 4;
                    }
                }
                
                await client.query(
                    `INSERT INTO topics (subject_id, topic_name, priority_weight, status) 
                     VALUES ($1, $2, $3, 'Pendente')`,
                    [subjectId, topicName, topicWeight]
                );
            }
            
            console.log(`   ✅ ${subject.topics.length} tópicos adicionados`);
        }
        
        // Estatísticas finais
        const stats = await client.query(
            `SELECT 
                COUNT(DISTINCT s.id) as total_subjects,
                COUNT(t.id) as total_topics,
                SUM(s.priority_weight) as total_subject_weight
             FROM subjects s
             LEFT JOIN topics t ON t.subject_id = s.id
             WHERE s.study_plan_id = $1`,
            [planId]
        );
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ PLANO TJPE 2025 COMPLETO CONFIGURADO COM SUCESSO!');
        console.log('\n📊 RESUMO:');
        console.log('   - Data da prova: 21/09/2025');
        console.log('   - Horas de estudo: 8h (seg-sex), 4h (sáb-dom)');
        console.log('   - Duração das sessões: 70 minutos');
        console.log('   - Modo: Reta Final ATIVADO');
        console.log('   - Matérias: ' + stats.rows[0].total_subjects);
        console.log('   - Total de tópicos: ' + stats.rows[0].total_topics);
        console.log('\n📈 DISTRIBUIÇÃO DE PESOS:');
        console.log('   - Direito Civil e Processual Civil: peso 5');
        console.log('   - Direito Administrativo, Constitucional, Penal e Proc. Penal: peso 4');
        console.log('   - Legislação Específica: peso 3');
        console.log('   - Língua Portuguesa: peso 2');
        console.log('   - Raciocínio Lógico: peso 1');
        console.log('\n🎯 Próximo passo: Gerar o cronograma!');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        client.release();
        pool.end();
    }
}

setupCompletePlan();