# 🔗 MAPA DE DEPENDÊNCIAS DO SISTEMA

**Data:** 25/08/2025
**Hora:** 08:31:06

## 📊 ESTATÍSTICAS

- **Total de módulos analisados:** 116
- **Total de dependências:** 495
- **Dependências externas (npm):** 158
- **Dependências circulares:** 0

## 🏗️ ARQUITETURA DE MÓDULOS

### Módulos Principais


#### 📁 root/

| Módulo | Dependências Locais | Dependências Externas |
|--------|--------------------|-----------------------|
| src\cackto-integration\config\cackto.config.js | 0 | 0 |
| src\cackto-integration\index.js | 10 | 0 |
| src\cackto-integration\middleware\checkCacktoSubscription.js | 3 | 0 |
| src\cackto-integration\models\subscription-adapter.js | 3 | 1 |
| src\cackto-integration\routes\webhooks.js | 11 | 1 |
| src\cackto-integration\scripts\migrate-to-cackto.js | 0 | 3 |
| src\cackto-integration\scripts\update-server.js | 2 | 2 |
| src\cackto-integration\services\cacheService.js | 1 | 1 |
| src\cackto-integration\services\cacktoService.js | 4 | 2 |
| src\cackto-integration\services\subscriptionManager.js | 7 | 0 |
| src\cackto-integration\webhooks\processor.js | 10 | 1 |
| src\cackto-integration\webhooks\validator.js | 5 | 1 |
| src\config\app.config.js | 0 | 2 |
| src\config\database.js | 2 | 0 |
| src\config\database.wrapper.js | 1 | 0 |
| src\config\environment.js | 0 | 1 |
| src\config\logger-config.js | 0 | 0 |
| src\config\passport-complete.js | 2 | 2 |
| src\config\passport-debug.js | 2 | 2 |
| src\config\passport-fixed.js | 2 | 2 |
| src\config\passport.js | 2 | 2 |
| src\config\redisSession.js | 0 | 5 |
| src\controllers\admin.controller.js | 8 | 0 |
| src\controllers\auth.controller.consolidated.js | 7 | 4 |
| src\controllers\auth.controller.js | 5 | 3 |
| src\controllers\authController.js | 3 | 0 |
| src\controllers\gamification.controller.js | 1 | 0 |
| src\controllers\oauthController.js | 2 | 3 |
| src\controllers\planController.js | 3 | 0 |
| src\controllers\plans.controller.js | 3 | 1 |
| src\controllers\profile.controller.js | 3 | 4 |
| src\controllers\scheduleController.js | 3 | 0 |
| src\controllers\sessions.controller.js | 1 | 1 |
| src\controllers\statistics.controller.js | 2 | 0 |
| src\controllers\subjects.controller.js | 1 | 0 |
| src\controllers\topics.controller.js | 1 | 0 |
| src\controllers\userController.js | 3 | 0 |
| src\middleware\admin-cache.middleware.js | 1 | 0 |
| src\middleware\admin.middleware.js | 2 | 0 |
| src\middleware\auth.middleware.js | 2 | 2 |
| src\middleware\compatibility.middleware.js | 1 | 0 |
| src\middleware\csrf.middleware.js | 0 | 1 |
| src\middleware\email-rate-limit.js | 1 | 1 |
| src\middleware\metrics.js | 1 | 0 |
| src\middleware\validation.middleware.js | 1 | 1 |
| src\migrations\createUserTables.js | 3 | 0 |
| src\repositories\authRepository.js | 3 | 0 |
| src\repositories\planRepository.js | 2 | 0 |
| src\repositories\scheduleRepository.js | 2 | 0 |
| src\repositories\userRepository.js | 3 | 0 |
| src\routes\admin.routes.js | 23 | 12 |
| src\routes\auth.routes.consolidated.js | 4 | 5 |
| src\routes\auth.routes.js | 3 | 6 |
| src\routes\authRoutes-complete.js | 0 | 0 |
| src\routes\authRoutes-fixed.js | 0 | 0 |
| src\routes\authRoutes-simple.js | 0 | 0 |
| src\routes\authRoutes.js | 3 | 7 |
| src\routes\gamification.routes.js | 2 | 1 |
| src\routes\planRoutes.js | 2 | 1 |
| src\routes\plans.routes.js | 2 | 2 |
| src\routes\profile.routes.js | 2 | 1 |
| src\routes\schedule.routes.js | 5 | 2 |
| src\routes\scheduleRoutes.js | 2 | 1 |
| src\routes\sessions.routes.js | 4 | 2 |
| src\routes\statistics.routes.js | 3 | 1 |
| src\routes\subjects.routes.js | 3 | 2 |
| src\routes\topics.routes.js | 3 | 2 |
| src\routes\userRoutes.js | 2 | 5 |
| src\services\authService.js | 4 | 3 |
| src\services\emailProviders.js | 0 | 1 |
| src\services\emailRateLimitService.js | 0 | 1 |
| src\services\emailService.js | 3 | 2 |
| src\services\googleOAuthService.js | 1 | 1 |
| src\services\planService.js | 3 | 0 |
| src\services\schedule\algorithms\RetaFinalProcessor.js | 2 | 0 |
| src\services\schedule\algorithms\SessionDistributor.js | 2 | 0 |
| src\services\schedule\algorithms\SpacedRepetitionCalculator.js | 2 | 0 |
| src\services\schedule\algorithms\TopicPriorizer.js | 1 | 0 |
| src\services\schedule\ScheduleGenerationService.js | 11 | 0 |
| src\services\schedule\utils\DateCalculator.js | 1 | 0 |
| src\services\schedule\utils\index.js | 2 | 0 |
| src\services\schedule\utils\SessionBatcher.js | 1 | 0 |
| src\services\schedule\validators\index.js | 3 | 0 |
| src\services\schedule\validators\PlanConfigValidator.js | 1 | 0 |
| src\services\schedule\validators\TimeSlotValidator.js | 1 | 0 |
| src\services\schedule\validators\TopicIntegrityValidator.js | 1 | 0 |
| src\services\scheduleService.js | 2 | 0 |
| src\services\sendGridService.js | 0 | 0 |
| src\services\userService.js | 3 | 3 |
| src\subscription\config\subscription.js | 0 | 1 |
| src\subscription\index.js | 12 | 1 |
| src\subscription\middleware\subscription.js | 4 | 0 |
| src\subscription\models\audit.js | 2 | 1 |
| src\subscription\models\subscription.js | 2 | 1 |
| src\subscription\routes\subscriptions.js | 6 | 2 |
| src\subscription\routes\webhooks.js | 11 | 1 |
| src\subscription\scripts\setup-database.js | 3 | 4 |
| src\subscription\services\cache.js | 1 | 2 |
| src\subscription\services\kiwify.js | 3 | 2 |
| src\subscription\tests\security\webhook-validation.test.js | 2 | 1 |
| src\subscription\utils\database.js | 1 | 0 |
| src\subscription\webhooks\processor.js | 6 | 1 |
| src\subscription\webhooks\queue.js | 7 | 1 |
| src\subscription\webhooks\validator.js | 3 | 1 |
| src\utils\cookieSecurity.js | 0 | 1 |
| src\utils\database-optimization.js | 1 | 0 |
| src\utils\database.js | 1 | 0 |
| src\utils\database_fixed.js | 1 | 0 |
| src\utils\dbCompat.js | 0 | 0 |
| src\utils\error-handler.js | 1 | 0 |
| src\utils\logger.js | 1 | 5 |
| src\utils\logger_fixed.js | 0 | 2 |
| src\utils\queryMapper.js | 1 | 0 |
| src\utils\sanitizer.js | 0 | 0 |
| src\utils\security.js | 0 | 5 |
| server.js | 25 | 16 |

## 📈 MÓDULOS MAIS ACOPLADOS

Módulos com maior número de dependências (candidatos a refatoração):

| Módulo | Total de Dependências | Tipo |
|--------|-----------------------|------|
| server.js | 41 | ⚠️ Monolítico |
| src\routes\admin.routes.js | 35 | ✅ Modular |
| src\subscription\index.js | 13 | ✅ Modular |
| src\cackto-integration\routes\webhooks.js | 12 | ✅ Modular |
| src\subscription\routes\webhooks.js | 12 | ✅ Modular |
| src\cackto-integration\webhooks\processor.js | 11 | ✅ Modular |
| src\controllers\auth.controller.consolidated.js | 11 | ✅ Modular |
| src\services\schedule\ScheduleGenerationService.js | 11 | ✅ Modular |
| src\cackto-integration\index.js | 10 | ✅ Modular |
| src\routes\authRoutes.js | 10 | ✅ Modular |

## 💡 RECOMENDAÇÕES

1. **Resolver dependências circulares** antes de prosseguir
2. **Refatorar módulos altamente acoplados** (server.js em primeiro)
3. **Criar camada de abstração** para dependências externas
4. **Implementar injeção de dependências** para facilitar testes
5. **Documentar interfaces públicas** de cada módulo
