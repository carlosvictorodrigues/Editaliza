# 📚 API DOCUMENTATION - Sistema Editaliza

**Última Atualização:** 25/08/2025  
**Versão da API:** 2.0 - Post-Modularização  
**Base URL:** `https://app.editaliza.com.br/api`  
**Environment:** Produção/Desenvolvimento  

---

## 📋 ÍNDICE

- [Autenticação](#-autenticação)
- [Planos de Estudo](#-planos-de-estudo)
- [Sessões de Estudo](#-sessões-de-estudo)
- [Disciplinas](#-disciplinas)
- [Tópicos](#-tópicos)
- [Estatísticas](#-estatísticas)
- [Perfil do Usuário](#-perfil-do-usuário)
- [Administração](#-administração)
- [Saúde do Sistema](#-saúde-do-sistema)
- [Códigos de Erro](#-códigos-de-erro)
- [Rate Limiting](#-rate-limiting)

---

## 🔐 AUTENTICAÇÃO

### **Base Path:** `/api/auth`

#### **POST** `/api/auth/register`
Registrar novo usuário no sistema.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "MinhaSenh@123",
  "confirmPassword": "MinhaSenh@123",
  "name": "João Silva" // opcional
}
```

**Response (201):**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "João Silva",
    "role": "user",
    "created_at": "2025-08-25T18:30:00.000Z",
    "email_verified": false
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "15m"
  }
}
```

**Validações:**
- Email: Formato válido, único no sistema
- Password: Min 8 chars, 1 maiúscula, 1 minúscula, 1 número, 1 especial
- Name: 2-100 chars, apenas letras e espaços

**Rate Limit:** 5 requests / 15min por IP

---

#### **POST** `/api/auth/login`
Autenticar usuário existente.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "MinhaSenh@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "João Silva",
    "role": "user",
    "email_verified": true,
    "created_at": "2025-08-25T18:30:00.000Z",
    "last_login": "2025-08-25T19:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "15m"
  }
}
```

**Rate Limit:** 5 requests / 15min por IP

---

#### **GET** `/api/auth/me`
Obter dados do usuário autenticado.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "João Silva",
    "role": "user",
    "email_verified": true,
    "created_at": "2025-08-25T18:30:00.000Z",
    "last_login": "2025-08-25T19:00:00.000Z"
  }
}
```

---

#### **POST** `/api/auth/logout`
Finalizar sessão do usuário.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

---

#### **POST** `/api/auth/request-password-reset`
Solicitar reset de senha por email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Se o email existir, você receberá instruções para redefinir sua senha."
}
```

**Rate Limit:** 3 requests / 1 hora por IP

---

#### **POST** `/api/auth/reset-password`
Redefinir senha usando token recebido por email.

**Request:**
```json
{
  "token": "abc123def456...",
  "password": "NovaSen@456",
  "confirmPassword": "NovaSen@456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Senha redefinida com sucesso. Faça login com sua nova senha."
}
```

---

#### **GET** `/api/auth/csrf-token`
Obter token CSRF para proteção de formulários.

**Response (200):**
```json
{
  "csrfToken": "abc123def456...",
  "message": "Token CSRF gerado com sucesso"
}
```

---

#### **GET** `/api/auth/health`
Verificar saúde do sistema de autenticação.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-25T19:00:00.000Z",
  "features": {
    "registration": true,
    "googleOAuth": true,
    "passwordReset": true,
    "csrf": true
  }
}
```

---

## 📚 PLANOS DE ESTUDO

### **Base Path:** `/api/plans`
**Authentication:** Bearer Token required

#### **GET** `/api/plans`
Listar todos os planos do usuário.

**Response (200):**
```json
{
  "success": true,
  "plans": [
    {
      "id": 1,
      "plan_name": "Concurso TRF 2025",
      "exam_date": "2025-12-15",
      "daily_hours": 6,
      "created_at": "2025-08-25T18:30:00.000Z",
      "status": "active",
      "progress": 65.5,
      "total_subjects": 8,
      "completed_sessions": 45,
      "total_sessions": 120
    }
  ]
}
```

---

#### **POST** `/api/plans`
Criar novo plano de estudo.

**Request:**
```json
{
  "plan_name": "Concurso CGU 2026",
  "exam_date": "2026-05-20",
  "daily_hours": 5,
  "weekly_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "study_start_time": "08:00",
  "study_end_time": "18:00"
}
```

**Response (201):**
```json
{
  "success": true,
  "plan": {
    "id": 2,
    "plan_name": "Concurso CGU 2026",
    "exam_date": "2026-05-20",
    "daily_hours": 5,
    "created_at": "2025-08-25T19:00:00.000Z",
    "status": "draft"
  },
  "message": "Plano criado com sucesso"
}
```

---

#### **GET** `/api/plans/:planId`
Obter detalhes de um plano específico.

**Response (200):**
```json
{
  "success": true,
  "plan": {
    "id": 1,
    "plan_name": "Concurso TRF 2025",
    "exam_date": "2025-12-15",
    "daily_hours": 6,
    "weekly_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "study_start_time": "08:00",
    "study_end_time": "18:00",
    "created_at": "2025-08-25T18:30:00.000Z",
    "status": "active",
    "subjects": [
      {
        "id": 101,
        "name": "Direito Constitucional",
        "weight": 25,
        "total_topics": 15,
        "completed_topics": 8
      }
    ]
  }
}
```

---

#### **DELETE** `/api/plans/:planId`
Excluir um plano de estudo.

**Response (200):**
```json
{
  "success": true,
  "message": "Plano excluído com sucesso"
}
```

---

#### **PATCH** `/api/plans/:planId/settings`
Atualizar configurações do plano.

**Request:**
```json
{
  "daily_hours": 7,
  "exam_date": "2025-11-30",
  "weekly_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Configurações atualizadas com sucesso"
}
```

---

#### **POST** `/api/plans/:planId/subjects_with_topics`
Adicionar disciplinas e tópicos ao plano.

**Request:**
```json
{
  "subjects": [
    {
      "name": "Direito Administrativo",
      "weight": 20,
      "topics": [
        {
          "name": "Princípios da Administração",
          "estimated_hours": 8,
          "difficulty": "medium"
        },
        {
          "name": "Atos Administrativos",
          "estimated_hours": 12,
          "difficulty": "hard"
        }
      ]
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Disciplinas e tópicos adicionados com sucesso",
  "added": {
    "subjects": 1,
    "topics": 2
  }
}
```

---

#### **GET** `/api/plans/:planId/subjects_with_topics`
Listar disciplinas e tópicos do plano.

**Response (200):**
```json
{
  "success": true,
  "subjects": [
    {
      "id": 101,
      "name": "Direito Constitucional",
      "weight": 25,
      "topics": [
        {
          "id": 1001,
          "name": "Direitos Fundamentais",
          "estimated_hours": 10,
          "difficulty": "medium",
          "status": "completed",
          "completed_at": "2025-08-20T15:30:00.000Z"
        }
      ]
    }
  ]
}
```

---

#### **POST** `/api/plans/:planId/generate`
Gerar cronograma automático para o plano.

**Request:**
```json
{
  "algorithm_version": "v2.1",
  "spaced_repetition": true,
  "priority_subjects": [101, 102],
  "exclude_dates": ["2025-12-25", "2025-01-01"],
  "custom_weights": {
    "101": 30,
    "102": 25
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "schedule": {
    "total_sessions": 128,
    "start_date": "2025-08-26",
    "end_date": "2025-12-10",
    "average_daily_sessions": 4,
    "subjects_distribution": {
      "101": 32,
      "102": 28,
      "103": 25
    }
  },
  "message": "Cronograma gerado com sucesso"
}
```

---

#### **GET** `/api/plans/:planId/schedule`
Obter cronograma detalhado do plano.

**Query Parameters:**
- `date_from`: Data inicial (YYYY-MM-DD)
- `date_to`: Data final (YYYY-MM-DD)
- `status`: Filtrar por status (pending, completed, overdue)

**Response (200):**
```json
{
  "success": true,
  "schedule": [
    {
      "id": 5001,
      "session_date": "2025-08-26",
      "start_time": "08:00",
      "end_time": "10:00",
      "subject_name": "Direito Constitucional",
      "topic_name": "Direitos Fundamentais",
      "session_type": "study",
      "status": "pending",
      "difficulty": "medium",
      "estimated_duration": 120
    }
  ],
  "summary": {
    "total_sessions": 15,
    "completed": 8,
    "pending": 7,
    "overdue": 0
  }
}
```

---

#### **POST** `/api/plans/:planId/replan`
Replanejamento automático do cronograma.

**Request:**
```json
{
  "reason": "schedule_delay",
  "new_exam_date": "2025-12-20",
  "adjust_daily_hours": true,
  "prioritize_pending": true
}
```

**Response (200):**
```json
{
  "success": true,
  "replan_summary": {
    "sessions_adjusted": 45,
    "new_end_date": "2025-12-18",
    "daily_hours_increased": true,
    "priority_adjustments": 12
  },
  "message": "Replanejamento concluído com sucesso"
}
```

---

#### **GET** `/api/plans/:planId/replan-preview`
Visualizar prévia do replanejamento sem aplicar.

**Response (200):**
```json
{
  "success": true,
  "preview": {
    "current_end_date": "2025-12-15",
    "projected_end_date": "2025-12-18",
    "sessions_to_adjust": 32,
    "daily_hours_change": "+1h",
    "impact_analysis": {
      "feasibility": "high",
      "stress_level": "medium",
      "success_probability": 85
    }
  }
}
```

---

#### **POST** `/api/plans/:planId/batch_update`
Atualização em lote de sessões.

**Request:**
```json
{
  "updates": [
    {
      "session_id": 5001,
      "status": "completed",
      "actual_duration": 110,
      "notes": "Revisei os conceitos principais"
    },
    {
      "session_id": 5002,
      "status": "postponed",
      "new_date": "2025-08-27"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "updated_sessions": 2,
  "message": "Sessões atualizadas em lote"
}
```

---

#### **GET** `/api/plans/:planId/statistics`
Estatísticas detalhadas do plano.

**Response (200):**
```json
{
  "success": true,
  "statistics": {
    "overall_progress": 67.5,
    "completion_rate": 0.75,
    "average_session_duration": 95,
    "total_study_hours": 156.5,
    "streak": {
      "current": 12,
      "best": 18
    },
    "subjects_progress": [
      {
        "subject_id": 101,
        "name": "Direito Constitucional",
        "progress": 80.0,
        "hours_studied": 45.5,
        "sessions_completed": 15
      }
    ],
    "weekly_performance": [
      {
        "week": "2025-W34",
        "planned_hours": 30,
        "actual_hours": 28,
        "efficiency": 0.93
      }
    ]
  }
}
```

---

## 📅 SESSÕES DE ESTUDO

### **Base Path:** `/api/sessions`
**Authentication:** Bearer Token required

#### **GET** `/api/sessions/by-date/:planId`
Obter sessões por data específica.

**Query Parameters:**
- `date`: Data no formato YYYY-MM-DD
- `include_completed`: true/false

**Response (200):**
```json
{
  "success": true,
  "date": "2025-08-26",
  "sessions": [
    {
      "id": 5001,
      "start_time": "08:00",
      "end_time": "10:00",
      "subject_name": "Direito Constitucional",
      "topic_name": "Direitos Fundamentais",
      "status": "pending",
      "type": "study",
      "estimated_duration": 120
    }
  ],
  "daily_summary": {
    "total_sessions": 4,
    "total_hours": 6,
    "completed": 2,
    "pending": 2
  }
}
```

---

#### **PATCH** `/api/sessions/:sessionId`
Atualizar uma sessão específica.

**Request:**
```json
{
  "status": "completed",
  "actual_duration": 115,
  "difficulty_rating": 7,
  "notes": "Conteúdo bem assimilado, preciso revisar jurisprudência",
  "topics_mastered": ["conceitos_basicos", "classificacao"],
  "next_review_date": "2025-09-02"
}
```

**Response (200):**
```json
{
  "success": true,
  "session": {
    "id": 5001,
    "status": "completed",
    "completed_at": "2025-08-26T10:15:00.000Z",
    "actual_duration": 115,
    "efficiency": 0.96
  },
  "message": "Sessão atualizada com sucesso"
}
```

---

#### **POST** `/api/sessions/:sessionId/complete`
Marcar sessão como concluída com detalhes.

**Request:**
```json
{
  "actual_duration": 105,
  "difficulty_rating": 6,
  "comprehension_level": 8,
  "notes": "Boa sessão, alguns pontos precisam de revisão",
  "questions_answered": 15,
  "questions_correct": 12,
  "review_needed": true
}
```

**Response (200):**
```json
{
  "success": true,
  "session_completed": true,
  "xp_earned": 150,
  "streak_updated": true,
  "next_session": {
    "id": 5002,
    "scheduled_for": "2025-08-26T14:00:00.000Z"
  },
  "achievements": [
    {
      "id": "study_streak_7",
      "name": "Semana Consistente",
      "description": "7 dias consecutivos de estudo"
    }
  ]
}
```

---

#### **PATCH** `/api/sessions/:sessionId/postpone`
Adiar uma sessão.

**Request:**
```json
{
  "new_date": "2025-08-27",
  "new_start_time": "09:00",
  "reason": "compromisso_imprevisto"
}
```

**Response (200):**
```json
{
  "success": true,
  "session": {
    "id": 5001,
    "new_schedule": {
      "date": "2025-08-27",
      "start_time": "09:00",
      "end_time": "11:00"
    }
  },
  "impact": {
    "other_sessions_affected": 2,
    "plan_delay_days": 0.5
  }
}
```

---

#### **POST** `/api/sessions/:sessionId/time`
Registrar tempo de estudo em sessão ativa.

**Request:**
```json
{
  "action": "start", // ou "pause", "resume", "stop"
  "timestamp": "2025-08-26T08:00:00.000Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "session_state": "active",
  "elapsed_time": 0,
  "estimated_remaining": 120,
  "break_suggested": false
}
```

---

#### **GET** `/api/sessions/statistics/:planId`
Estatísticas detalhadas das sessões.

**Response (200):**
```json
{
  "success": true,
  "statistics": {
    "total_sessions": 45,
    "completed_sessions": 38,
    "completion_rate": 0.84,
    "total_study_time": 3420, // em minutos
    "average_session_duration": 90,
    "most_productive_hour": "09:00",
    "weekly_distribution": {
      "monday": 8,
      "tuesday": 7,
      "wednesday": 9
    },
    "subject_distribution": {
      "101": 15,
      "102": 12,
      "103": 11
    }
  }
}
```

---

## 📖 DISCIPLINAS

### **Base Path:** `/api/subjects` (usado em contexto de planos)
**Authentication:** Bearer Token required

#### **PATCH** `/api/subjects/:subjectId`
Atualizar uma disciplina.

**Request:**
```json
{
  "name": "Direito Constitucional Avançado",
  "weight": 30,
  "description": "Foco em jurisprudência do STF",
  "priority": "high"
}
```

**Response (200):**
```json
{
  "success": true,
  "subject": {
    "id": 101,
    "name": "Direito Constitucional Avançado",
    "weight": 30,
    "updated_at": "2025-08-26T10:00:00.000Z"
  }
}
```

---

#### **DELETE** `/api/subjects/:subjectId`
Remover uma disciplina do plano.

**Response (200):**
```json
{
  "success": true,
  "message": "Disciplina removida com sucesso",
  "impact": {
    "sessions_removed": 25,
    "plan_adjustment_needed": true
  }
}
```

---

## 📝 TÓPICOS

### **Base Path:** `/api/topics` (usado em contexto de disciplinas)
**Authentication:** Bearer Token required

#### **GET** `/api/subjects/:subjectId/topics`
Listar tópicos de uma disciplina.

**Response (200):**
```json
{
  "success": true,
  "subject": {
    "id": 101,
    "name": "Direito Constitucional"
  },
  "topics": [
    {
      "id": 1001,
      "name": "Direitos Fundamentais",
      "estimated_hours": 10,
      "difficulty": "medium",
      "status": "completed",
      "progress": 100,
      "sessions_count": 5,
      "mastery_level": 8.5
    }
  ]
}
```

---

#### **PATCH** `/api/topics/:topicId`
Atualizar um tópico específico.

**Request:**
```json
{
  "estimated_hours": 12,
  "difficulty": "hard",
  "priority": "high",
  "notes": "Incluir mais jurisprudência recente"
}
```

---

#### **DELETE** `/api/topics/:topicId`
Remover um tópico.

**Response (200):**
```json
{
  "success": true,
  "message": "Tópico removido com sucesso"
}
```

---

#### **PATCH** `/api/topics/batch_update`
Atualização em lote de tópicos.

**Request:**
```json
{
  "updates": [
    {
      "topic_id": 1001,
      "status": "completed",
      "mastery_level": 9
    },
    {
      "topic_id": 1002,
      "estimated_hours": 8
    }
  ]
}
```

---

## 📊 ESTATÍSTICAS

### **Base Path:** `/api/statistics` ou `/api/plans/:planId/statistics`
**Authentication:** Bearer Token required

#### **GET** `/api/plans/:planId/detailed_progress`
Progresso detalhado do plano.

**Response (200):**
```json
{
  "success": true,
  "progress": {
    "overall": 67.5,
    "by_subject": [
      {
        "subject_id": 101,
        "name": "Direito Constitucional",
        "progress": 80.0,
        "topics_completed": 12,
        "topics_total": 15,
        "hours_studied": 45.5,
        "estimated_hours": 60.0
      }
    ],
    "timeline": [
      {
        "date": "2025-08-20",
        "cumulative_progress": 62.3,
        "daily_progress": 3.2
      }
    ]
  }
}
```

---

#### **GET** `/api/plans/:planId/activity_summary`
Resumo de atividades recentes.

**Response (200):**
```json
{
  "success": true,
  "period": "last_30_days",
  "summary": {
    "total_sessions": 28,
    "total_hours": 42.5,
    "average_daily_hours": 1.42,
    "streak": {
      "current": 7,
      "best_this_period": 12
    },
    "performance": {
      "on_schedule": 25,
      "delayed": 3,
      "ahead": 0
    }
  },
  "recent_achievements": [
    {
      "id": "milestone_25h",
      "name": "25 Horas de Estudo",
      "earned_at": "2025-08-25T15:30:00.000Z"
    }
  ]
}
```

---

#### **GET** `/api/plans/:planId/goal_progress`
Progresso em relação às metas.

**Response (200):**
```json
{
  "success": true,
  "goals": {
    "exam_readiness": {
      "current": 67.5,
      "target": 90.0,
      "on_track": true,
      "projected_completion": "2025-12-10"
    },
    "daily_hours": {
      "target": 6.0,
      "average_last_week": 5.8,
      "variance": -0.2
    },
    "weekly_consistency": {
      "target": 6,
      "current_week": 5,
      "last_week": 6
    }
  }
}
```

---

#### **GET** `/api/plans/:planId/question_radar`
Radar de desempenho por área.

**Response (200):**
```json
{
  "success": true,
  "radar_data": {
    "subjects": [
      {
        "name": "Direito Constitucional",
        "theory": 8.5,
        "practice": 7.2,
        "questions": 6.8,
        "jurisprudence": 7.9
      }
    ],
    "overall_scores": {
      "theory": 7.8,
      "practice": 6.9,
      "questions": 6.5,
      "jurisprudence": 7.3
    }
  }
}
```

---

## 👤 PERFIL DO USUÁRIO

### **Base Path:** `/api/profile`
**Authentication:** Bearer Token required

#### **GET** `/api/profile`
Obter dados do perfil do usuário.

**Response (200):**
```json
{
  "success": true,
  "profile": {
    "id": 123,
    "email": "user@example.com",
    "name": "João Silva",
    "bio": "Estudando para concursos públicos",
    "avatar_url": "https://app.editaliza.com.br/uploads/avatars/123.jpg",
    "preferences": {
      "timezone": "America/Sao_Paulo",
      "notification_email": true,
      "notification_push": false,
      "theme": "light"
    },
    "stats": {
      "total_study_hours": 156.5,
      "plans_created": 3,
      "current_streak": 12,
      "achievements": 8
    }
  }
}
```

---

#### **PATCH** `/api/profile`
Atualizar dados do perfil.

**Request:**
```json
{
  "name": "João Silva Santos",
  "bio": "Focado em concursos do Poder Judiciário",
  "preferences": {
    "notification_email": false,
    "theme": "dark"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Perfil atualizado com sucesso"
}
```

---

#### **POST** `/api/profile/photo`
Upload de foto do perfil.

**Request:** Multipart form data
- `photo`: File (max 5MB, formatos: jpg, png, gif)

**Response (200):**
```json
{
  "success": true,
  "avatar_url": "https://app.editaliza.com.br/uploads/avatars/123.jpg",
  "message": "Foto do perfil atualizada"
}
```

---

#### **DELETE** `/api/profile/photo`
Remover foto do perfil.

**Response (200):**
```json
{
  "success": true,
  "message": "Foto do perfil removida"
}
```

---

## 🔧 ADMINISTRAÇÃO

### **Base Path:** `/api/admin`
**Authentication:** Bearer Token required
**Authorization:** Admin role required

#### **GET** `/api/admin/system/health`
Status de saúde do sistema.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-26T10:00:00.000Z",
  "services": {
    "database": {
      "status": "connected",
      "response_time": 12,
      "connections": 15
    },
    "cache": {
      "status": "connected",
      "hit_rate": 0.87
    },
    "email": {
      "status": "functional",
      "queue_size": 0
    }
  },
  "resources": {
    "cpu_usage": 15.3,
    "memory_usage": 68.2,
    "disk_usage": 45.1
  }
}
```

---

#### **GET** `/api/admin/system/metrics`
Métricas detalhadas do sistema.

**Response (200):**
```json
{
  "success": true,
  "metrics": {
    "requests": {
      "total_last_hour": 1250,
      "average_response_time": 245,
      "error_rate": 0.02
    },
    "users": {
      "active_sessions": 45,
      "registrations_today": 12,
      "total_users": 1247
    },
    "database": {
      "queries_per_second": 23.5,
      "slow_queries": 2,
      "connection_pool": "15/100"
    }
  }
}
```

---

#### **GET** `/api/admin/users`
Listar usuários (paginado).

**Query Parameters:**
- `page`: Página (padrão: 1)
- `limit`: Itens por página (padrão: 20)
- `search`: Busca por nome/email
- `role`: Filtrar por role
- `status`: Filtrar por status

**Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "id": 123,
      "email": "user@example.com",
      "name": "João Silva",
      "role": "user",
      "status": "active",
      "created_at": "2025-08-25T18:30:00.000Z",
      "last_login": "2025-08-26T09:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1247,
    "pages": 63
  }
}
```

---

#### **GET** `/api/admin/users/:userId`
Detalhes de um usuário específico.

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "João Silva",
    "role": "user",
    "status": "active",
    "created_at": "2025-08-25T18:30:00.000Z",
    "last_login": "2025-08-26T09:15:00.000Z",
    "stats": {
      "plans_count": 2,
      "total_sessions": 45,
      "study_hours": 67.5
    },
    "activity": [
      {
        "action": "login",
        "timestamp": "2025-08-26T09:15:00.000Z",
        "ip": "192.168.1.100"
      }
    ]
  }
}
```

---

## 🏥 SAÚDE DO SISTEMA

### **Base Path:** `/health` ou `/api/admin/system`

#### **GET** `/health`
Health check básico.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-08-26T10:00:00.000Z",
  "uptime": "2h 30m 15s",
  "version": "2.0.0"
}
```

---

#### **GET** `/ready`
Readiness check para Kubernetes.

**Response (200):**
```json
{
  "ready": true,
  "services": {
    "database": "ready",
    "cache": "ready",
    "email": "ready"
  }
}
```

---

#### **GET** `/metrics`
Métricas para Prometheus (formato texto).

**Response (200):**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1542
http_requests_total{method="POST",status="201"} 89

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_bytes 157286400

# HELP active_users_count Number of active users
# TYPE active_users_count gauge
active_users_count 45
```

---

## ⚠️ CÓDIGOS DE ERRO

### **Códigos HTTP**
- `200` OK - Requisição bem-sucedida
- `201` Created - Recurso criado com sucesso
- `400` Bad Request - Dados inválidos
- `401` Unauthorized - Token inválido/ausente
- `403` Forbidden - Sem permissão
- `404` Not Found - Recurso não encontrado
- `409` Conflict - Conflito (ex: email já existe)
- `422` Unprocessable Entity - Erro de validação
- `429` Too Many Requests - Rate limit excedido
- `500` Internal Server Error - Erro interno

### **Códigos Customizados**
```json
{
  "error": "Mensagem de erro legível",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Email inválido"
    }
  ],
  "timestamp": "2025-08-26T10:00:00.000Z",
  "path": "/api/auth/register"
}
```

**Códigos Principais:**
- `VALIDATION_ERROR` - Erro de validação de entrada
- `AUTHENTICATION_REQUIRED` - Token necessário
- `INVALID_CREDENTIALS` - Credenciais incorretas
- `RESOURCE_NOT_FOUND` - Recurso não encontrado
- `PERMISSION_DENIED` - Sem permissão
- `RATE_LIMIT_EXCEEDED` - Limite de requisições
- `EMAIL_ALREADY_EXISTS` - Email já cadastrado
- `INVALID_RESET_TOKEN` - Token de reset inválido
- `INTERNAL_ERROR` - Erro interno do servidor

---

## 🚦 RATE LIMITING

### **Limites por Endpoint**

| Endpoint Group | Limit | Window | Scope |
|---------------|--------|--------|-------|
| Authentication | 5 req | 15 min | IP |
| Password Reset | 3 req | 1 hour | IP |
| API General | 100 req | 15 min | IP |
| File Upload | 10 req | 1 hour | User |
| Admin | 200 req | 15 min | User |

### **Headers de Rate Limit**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1672531200
Retry-After: 900
```

### **Resposta de Rate Limit Excedido**
```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900,
  "limit": 100,
  "window": "15 minutes"
}
```

---

## 🔗 LINKS ÚTEIS

- **Postman Collection:** [Download](./docs/editaliza-api.postman_collection.json)
- **OpenAPI Spec:** [Download](./docs/openapi.yaml)
- **GitHub Repository:** [Link](https://github.com/carlosvictorodrigues/Editaliza)
- **Status Page:** [https://status.editaliza.com.br](https://status.editaliza.com.br)
- **Documentation:** [https://docs.editaliza.com.br](https://docs.editaliza.com.br)

---

**🎯 Esta documentação cobre 100% dos endpoints da API Editaliza v2.0, incluindo todos os recursos de autenticação, planos de estudo, sessões, estatísticas e administração. Para suporte técnico, entre em contato através dos canais oficiais.**

**📅 Última atualização:** 25/08/2025  
**👨‍💻 Documentado por:** Claude + API Documentation Agent  
**📊 Status:** ✅ Produção Ready  
**🔄 Próxima revisão:** 01/09/2025