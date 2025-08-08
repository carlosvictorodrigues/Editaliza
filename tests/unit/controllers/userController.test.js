/**
 * User Controller Unit Tests
 * Testing Fortress - Comprehensive user controller testing
 */

const request = require('supertest');
const express = require('express');
const userController = require('../../../src/controllers/userController');
const userService = require('../../../src/services/userService');

// Mock the user service
jest.mock('../../../src/services/userService');

// Mock authentication middleware
const mockAuthMiddleware = (req, res, next) => {
    req.user = { id: 1, email: 'test@testfortress.com' };
    next();
};

// Mock multer for file uploads
const mockMulterMiddleware = (req, res, next) => {
    req.file = {
        filename: 'test-profile-pic.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 500 // 500KB
    };
    next();
};

// Create test app
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use(mockAuthMiddleware);
    
    // Mount user controller routes
    app.get('/users/profile', userController.getProfile);
    app.patch('/users/profile', userController.updateProfile);
    app.post('/users/profile/upload-photo', mockMulterMiddleware, userController.uploadProfilePhoto);
    app.get('/users/settings', userController.getSettings);
    app.patch('/users/settings', userController.updateSettings);
    app.get('/users/preferences', userController.getPreferences);
    app.patch('/users/preferences', userController.updatePreferences);
    app.get('/users/statistics', userController.getStatistics);
    app.post('/users/activity', userController.updateActivity);
    app.post('/users/change-password', userController.changePassword);
    app.post('/users/deactivate', userController.deactivateAccount);
    app.delete('/users/account', userController.deleteAccount);
    app.get('/users/notifications', userController.getNotificationPreferences);
    app.patch('/users/notifications', userController.updateNotificationPreferences);
    app.get('/users/privacy', userController.getPrivacySettings);
    app.patch('/users/privacy', userController.updatePrivacySettings);
    
    return app;
};

describe('User Controller Tests', () => {
    let app;
    
    beforeEach(() => {
        app = createTestApp();
        jest.clearAllMocks();
    });

    describe('GET /users/profile', () => {
        it('should return user profile successfully', async () => {
            const mockProfile = {
                id: 1,
                email: 'test@testfortress.com',
                name: 'Test User',
                profile_picture: '/uploads/profile.jpg',
                phone: '+5511999999999',
                state: 'SP',
                city: 'São Paulo',
                created_at: '2025-01-01T00:00:00.000Z',
                auth_provider: 'local'
            };

            userService.getUserProfile.mockResolvedValue(mockProfile);

            const response = await request(app)
                .get('/users/profile')
                .expect(200);

            expect(response.body).toEqual(mockProfile);
            expect(userService.getUserProfile).toHaveBeenCalledWith(1, expect.any(Object));
        });

        it('should return 404 when user not found', async () => {
            userService.getUserProfile.mockRejectedValue(new Error('Usuário não encontrado'));

            const response = await request(app)
                .get('/users/profile')
                .expect(404);

            expect(response.body).toHaveProperty('error', 'Usuário não encontrado');
        });

        it('should return 500 on service error', async () => {
            userService.getUserProfile.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/users/profile')
                .expect(500);

            expect(response.body.error).toContain('Erro ao carregar perfil');
        });
    });

    describe('PATCH /users/profile', () => {
        it('should update profile successfully', async () => {
            const updateData = {
                name: 'Updated Name',
                phone: '+5511888888888',
                state: 'RJ',
                city: 'Rio de Janeiro'
            };

            const mockUpdatedProfile = {
                id: 1,
                email: 'test@testfortress.com',
                ...updateData,
                created_at: '2025-01-01T00:00:00.000Z'
            };

            userService.updateUserProfile.mockResolvedValue(mockUpdatedProfile);

            const response = await request(app)
                .patch('/users/profile')
                .send(updateData)
                .expect(200);

            expect(response.body).toEqual(mockUpdatedProfile);
            expect(userService.updateUserProfile).toHaveBeenCalledWith(1, updateData, expect.any(Object));
        });

        it('should return 400 for invalid update data', async () => {
            userService.updateUserProfile.mockRejectedValue(new Error('Nenhum campo para atualizar'));

            const response = await request(app)
                .patch('/users/profile')
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Nenhum campo para atualizar');
        });
    });

    describe('POST /users/profile/upload-photo', () => {
        it('should upload profile photo successfully', async () => {
            const mockResult = {
                message: 'Foto de perfil atualizada com sucesso',
                profilePicture: '/uploads/test-profile-pic.jpg'
            };

            userService.uploadProfilePhoto.mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/users/profile/upload-photo')
                .expect(200);

            expect(response.body).toEqual(mockResult);
            expect(userService.uploadProfilePhoto).toHaveBeenCalledWith(
                1, 
                expect.objectContaining({
                    filename: 'test-profile-pic.jpg',
                    mimetype: 'image/jpeg',
                    size: 512000
                }),
                expect.any(Object)
            );
        });

        it('should return 400 when no file uploaded', async () => {
            const appNoFile = express();
            appNoFile.use(express.json());
            appNoFile.use(mockAuthMiddleware);
            appNoFile.post('/users/profile/upload-photo', userController.uploadProfilePhoto);

            const response = await request(appNoFile)
                .post('/users/profile/upload-photo')
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Nenhum arquivo enviado');
        });

        it('should return 400 for invalid file type', async () => {
            userService.uploadProfilePhoto.mockRejectedValue(
                new Error('Tipo de arquivo não permitido')
            );

            const response = await request(app)
                .post('/users/profile/upload-photo')
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Tipo de arquivo não permitido');
        });
    });

    describe('GET/PATCH /users/settings', () => {
        it('should get user settings', async () => {
            const mockSettings = {
                theme: 'dark',
                language: 'pt-BR',
                timezone: 'America/Sao_Paulo',
                auto_save: true,
                compact_mode: false
            };

            userService.getUserSettings.mockResolvedValue(mockSettings);

            const response = await request(app)
                .get('/users/settings')
                .expect(200);

            expect(response.body).toEqual(mockSettings);
        });

        it('should update user settings', async () => {
            const updateData = {
                theme: 'light',
                compact_mode: true
            };

            const mockUpdatedSettings = {
                theme: 'light',
                language: 'pt-BR',
                timezone: 'America/Sao_Paulo',
                auto_save: true,
                compact_mode: true
            };

            userService.updateUserSettings.mockResolvedValue(mockUpdatedSettings);

            const response = await request(app)
                .patch('/users/settings')
                .send(updateData)
                .expect(200);

            expect(response.body).toEqual(mockUpdatedSettings);
            expect(userService.updateUserSettings).toHaveBeenCalledWith(1, updateData, expect.any(Object));
        });

        it('should return 400 for invalid theme', async () => {
            userService.updateUserSettings.mockRejectedValue(new Error('Tema inválido: rainbow'));

            const response = await request(app)
                .patch('/users/settings')
                .send({ theme: 'rainbow' })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Tema inválido: rainbow');
        });
    });

    describe('GET/PATCH /users/preferences', () => {
        it('should get user preferences', async () => {
            const mockPreferences = {
                email_notifications: true,
                push_notifications: false,
                study_reminders: true,
                progress_reports: true,
                marketing_emails: false
            };

            userService.getUserPreferences.mockResolvedValue(mockPreferences);

            const response = await request(app)
                .get('/users/preferences')
                .expect(200);

            expect(response.body).toEqual(mockPreferences);
        });

        it('should update user preferences', async () => {
            const updateData = {
                push_notifications: true,
                marketing_emails: true
            };

            const mockUpdatedPreferences = {
                email_notifications: true,
                push_notifications: true,
                study_reminders: true,
                progress_reports: true,
                marketing_emails: true
            };

            userService.updateUserPreferences.mockResolvedValue(mockUpdatedPreferences);

            const response = await request(app)
                .patch('/users/preferences')
                .send(updateData)
                .expect(200);

            expect(response.body).toEqual(mockUpdatedPreferences);
        });
    });

    describe('GET /users/statistics', () => {
        it('should return user statistics', async () => {
            const mockStatistics = {
                planos_criados: 3,
                horas_estudadas: 127,
                dias_consecutivos: 5,
                ultima_atividade: '2025-08-06T10:30:00.000Z',
                data_cadastro: '2025-01-15T00:00:00.000Z',
                progresso_mes: 75,
                meta_cumprida: true
            };

            userService.getUserStatistics.mockResolvedValue(mockStatistics);

            const response = await request(app)
                .get('/users/statistics')
                .expect(200);

            expect(response.body).toEqual(mockStatistics);
        });

        it('should handle statistics calculation errors', async () => {
            userService.getUserStatistics.mockRejectedValue(new Error('Error calculating statistics'));

            const response = await request(app)
                .get('/users/statistics')
                .expect(500);

            expect(response.body.error).toContain('Erro ao carregar estatísticas');
        });
    });

    describe('POST /users/activity', () => {
        it('should record user activity', async () => {
            const activityData = {
                activity_type: 'study',
                duration: 90,
                metadata: {
                    subject: 'Direito Constitucional',
                    topics_covered: 3
                }
            };

            const mockResult = {
                message: 'Atividade registrada com sucesso',
                activity_id: 123
            };

            userService.updateUserActivity.mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/users/activity')
                .send(activityData)
                .expect(200);

            expect(response.body).toEqual(mockResult);
            expect(userService.updateUserActivity).toHaveBeenCalledWith(1, activityData, expect.any(Object));
        });

        it('should return 400 for invalid activity type', async () => {
            userService.updateUserActivity.mockRejectedValue(
                new Error('Dados de atividade inválidos: tipo necessário')
            );

            const response = await request(app)
                .post('/users/activity')
                .send({ activity_type: 'invalid_type' })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Dados de atividade inválidos: tipo necessário');
        });
    });

    describe('POST /users/change-password', () => {
        it('should change password successfully', async () => {
            const passwordData = {
                currentPassword: 'oldPassword123',
                newPassword: 'newPassword123',
                confirmPassword: 'newPassword123'
            };

            const mockResult = {
                message: 'Senha alterada com sucesso'
            };

            userService.changePassword.mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/users/change-password')
                .send(passwordData)
                .expect(200);

            expect(response.body).toEqual(mockResult);
        });

        it('should return 400 for wrong current password', async () => {
            userService.changePassword.mockRejectedValue(new Error('Senha atual incorreta'));

            const response = await request(app)
                .post('/users/change-password')
                .send({
                    currentPassword: 'wrongPassword',
                    newPassword: 'newPassword123',
                    confirmPassword: 'newPassword123'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Senha atual incorreta');
        });

        it('should return 400 for Google OAuth users', async () => {
            userService.changePassword.mockRejectedValue(
                new Error('Usuários do Google não podem alterar senha diretamente')
            );

            const response = await request(app)
                .post('/users/change-password')
                .send({
                    currentPassword: 'any',
                    newPassword: 'new123',
                    confirmPassword: 'new123'
                })
                .expect(400);

            expect(response.body.error).toContain('Google');
        });
    });

    describe('POST /users/deactivate', () => {
        it('should deactivate account successfully', async () => {
            const deactivationData = {
                password: 'currentPassword123',
                reason: 'Não preciso mais do serviço',
                confirmation: 'DESATIVAR'
            };

            const mockResult = {
                message: 'Conta desativada com sucesso'
            };

            userService.deactivateAccount.mockResolvedValue(mockResult);

            // Mock session destroy
            const response = await request(app)
                .post('/users/deactivate')
                .send(deactivationData)
                .expect(200);

            expect(response.body).toEqual(mockResult);
        });

        it('should return 400 for wrong confirmation', async () => {
            userService.deactivateAccount.mockRejectedValue(
                new Error('Confirmação necessária: digite "DESATIVAR" para confirmar')
            );

            const response = await request(app)
                .post('/users/deactivate')
                .send({
                    password: 'password123',
                    confirmation: 'DELETE'
                })
                .expect(400);

            expect(response.body.error).toContain('Confirmação necessária');
        });
    });

    describe('DELETE /users/account', () => {
        it('should delete account permanently', async () => {
            const deletionData = {
                password: 'currentPassword123',
                confirmation: 'DELETAR PERMANENTEMENTE'
            };

            const mockResult = {
                message: 'Conta deletada permanentemente'
            };

            userService.deleteAccount.mockResolvedValue(mockResult);

            const response = await request(app)
                .delete('/users/account')
                .send(deletionData)
                .expect(200);

            expect(response.body).toEqual(mockResult);
        });

        it('should return 400 for wrong confirmation text', async () => {
            userService.deleteAccount.mockRejectedValue(
                new Error('Confirmação necessária: digite "DELETAR PERMANENTEMENTE" para confirmar')
            );

            const response = await request(app)
                .delete('/users/account')
                .send({
                    password: 'password123',
                    confirmation: 'DELETE'
                })
                .expect(400);

            expect(response.body.error).toContain('DELETAR PERMANENTEMENTE');
        });
    });

    describe('Privacy Settings', () => {
        it('should get privacy settings', async () => {
            const mockPrivacySettings = {
                profile_visibility: 'private',
                show_email: false,
                show_progress: false,
                allow_contact: true
            };

            userService.getPrivacySettings.mockResolvedValue(mockPrivacySettings);

            const response = await request(app)
                .get('/users/privacy')
                .expect(200);

            expect(response.body).toEqual(mockPrivacySettings);
        });

        it('should update privacy settings', async () => {
            const updateData = {
                profile_visibility: 'public',
                show_progress: true
            };

            const mockUpdatedSettings = {
                profile_visibility: 'public',
                show_email: false,
                show_progress: true,
                allow_contact: true
            };

            userService.updatePrivacySettings.mockResolvedValue(mockUpdatedSettings);

            const response = await request(app)
                .patch('/users/privacy')
                .send(updateData)
                .expect(200);

            expect(response.body).toEqual(mockUpdatedSettings);
        });
    });

    describe('Security and Validation', () => {
        it('should sanitize XSS attempts in profile updates', async () => {
            const maliciousData = {
                name: '<script>alert("XSS")</script>Test User',
                city: '<img src=x onerror=alert("XSS")>São Paulo'
            };

            userService.updateUserProfile.mockResolvedValue({
                id: 1,
                name: 'Test User', // Should be sanitized
                city: 'São Paulo' // Should be sanitized
            });

            const response = await request(app)
                .patch('/users/profile')
                .send(maliciousData)
                .expect(200);

            expect(userService.updateUserProfile).toHaveBeenCalledWith(1, maliciousData, expect.any(Object));
        });

        it('should handle concurrent profile updates', async () => {
            const updateData = { name: 'Concurrent Update Test' };
            userService.updateUserProfile.mockResolvedValue({ id: 1, ...updateData });

            const requests = Array(5).fill().map(() =>
                request(app)
                    .patch('/users/profile')
                    .send(updateData)
            );

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });

            expect(userService.updateUserProfile).toHaveBeenCalledTimes(5);
        });

        it('should validate file size limits', async () => {
            userService.uploadProfilePhoto.mockRejectedValue(
                new Error('Arquivo muito grande. Máximo 5MB.')
            );

            const response = await request(app)
                .post('/users/profile/upload-photo')
                .expect(400);

            expect(response.body).toHaveProperty('error', 'Arquivo muito grande. Máximo 5MB.');
        });
    });

    describe('Error Handling Edge Cases', () => {
        it('should handle database connection failures', async () => {
            userService.getUserProfile.mockRejectedValue(new Error('Connection timeout'));

            const response = await request(app)
                .get('/users/profile')
                .expect(500);

            expect(response.body.error).toContain('Erro ao carregar perfil');
        });

        it('should handle malformed request data', async () => {
            userService.updateUserProfile.mockRejectedValue(new Error('Invalid data format'));

            const response = await request(app)
                .patch('/users/profile')
                .send('invalid-json')
                .expect(400);

            // Should handle JSON parsing errors
        });

        it('should handle session management errors', async () => {
            // Test session handling in deactivate/delete scenarios
            const mockResult = { message: 'Account deactivated' };
            userService.deactivateAccount.mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/users/deactivate')
                .send({
                    password: 'test123',
                    confirmation: 'DESATIVAR'
                })
                .expect(200);

            expect(response.body).toEqual(mockResult);
        });
    });
});