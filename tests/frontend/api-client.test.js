/**
 * Frontend Tests - API Client
 * Tests for API communication, error handling, and data fetching
 */

const fs = require('fs');
const path = require('path');

// Load app.js content
const appJsPath = path.join(__dirname, '../../public/js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

function loadAppJs() {
    const script = document.createElement('script');
    script.textContent = appJsContent;
    document.head.appendChild(script);
}

describe('Frontend API Client', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        loadAppJs();
        window.app.state.token = createMockJWT();
    });

    afterEach(() => {
        if (window.app) {
            delete window.app;
        }
    });

    describe('API Configuration', () => {
        test('should use correct API URL for localhost', () => {
            // Mock localhost environment
            Object.defineProperty(window.location, 'hostname', {
                value: 'localhost',
                writable: true
            });

            expect(window.app.config.apiUrl).toBe('http://localhost:3000');
        });

        test('should use origin for production environment', () => {
            // Mock production environment
            Object.defineProperty(window.location, 'hostname', {
                value: 'app.editaliza.com.br',
                writable: true
            });
            
            Object.defineProperty(window.location, 'origin', {
                value: 'https://app.editaliza.com.br',
                writable: true
            });

            // Recreate app with new location
            loadAppJs();

            expect(window.app.config.apiUrl).toBe('https://app.editaliza.com.br');
        });
    });

    describe('HTTP Methods', () => {
        test('should make GET requests correctly', async () => {
            const mockData = { data: 'test' };
            mockApiSuccess(mockData);

            const result = await window.app.apiFetch('/api/test');

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/test',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${window.app.state.token}`
                    })
                })
            );
            expect(result).toEqual(mockData);
        });

        test('should make POST requests with body', async () => {
            const mockData = { id: 1, created: true };
            const postData = { name: 'Test', value: 'test' };
            mockApiSuccess(mockData);

            const result = await window.app.apiFetch('/api/create', {
                method: 'POST',
                body: JSON.stringify(postData)
            });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/create',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(postData),
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.app.state.token}`
                    })
                })
            );
            expect(result).toEqual(mockData);
        });

        test('should make PUT requests for updates', async () => {
            const mockData = { id: 1, updated: true };
            const updateData = { name: 'Updated' };
            mockApiSuccess(mockData);

            const result = await window.app.apiFetch('/api/update/1', {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/update/1',
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                })
            );
            expect(result).toEqual(mockData);
        });

        test('should make DELETE requests', async () => {
            const mockData = { deleted: true };
            mockApiSuccess(mockData);

            const result = await window.app.apiFetch('/api/delete/1', {
                method: 'DELETE'
            });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/delete/1',
                expect.objectContaining({
                    method: 'DELETE'
                })
            );
            expect(result).toEqual(mockData);
        });
    });

    describe('Request Headers', () => {
        test('should include authorization header when token is present', async () => {
            mockApiSuccess({});
            
            await window.app.apiFetch('/api/test');

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${window.app.state.token}`
                    })
                })
            );
        });

        test('should include content-type header by default', async () => {
            mockApiSuccess({});
            
            await window.app.apiFetch('/api/test');

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
        });

        test('should merge custom headers with defaults', async () => {
            mockApiSuccess({});
            
            await window.app.apiFetch('/api/test', {
                headers: {
                    'X-Custom-Header': 'custom-value'
                }
            });

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.app.state.token}`,
                        'X-Custom-Header': 'custom-value'
                    })
                })
            );
        });
    });

    describe('Response Handling', () => {
        test('should parse JSON responses correctly', async () => {
            const mockData = { message: 'Success', data: [1, 2, 3] };
            mockApiSuccess(mockData);

            const result = await window.app.apiFetch('/api/test');
            expect(result).toEqual(mockData);
        });

        test('should handle empty responses', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => {
                    throw new Error('Unexpected end of JSON input');
                }
            });

            const result = await window.app.apiFetch('/api/test');
            expect(result).toEqual({});
        });

        test('should handle non-JSON responses', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'text/plain' }),
                json: async () => {
                    throw new Error('Not JSON');
                }
            });

            const result = await window.app.apiFetch('/api/test');
            expect(result).toEqual({});
        });

        test('should handle responses without content-type header', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers(),
                json: async () => ({ success: true })
            });

            const result = await window.app.apiFetch('/api/test');
            expect(result).toEqual({});
        });
    });

    describe('Error Handling', () => {
        test('should handle 401 Unauthorized by logging out', async () => {
            mockApiError(401, 'Unauthorized');
            
            const logoutSpy = jest.spyOn(window.app, 'logout');
            logoutSpy.mockImplementation(() => {});

            await expect(window.app.apiFetch('/api/test')).rejects.toThrow(
                'Sua sessão expirou. Por favor, faça o login novamente.'
            );
            expect(logoutSpy).toHaveBeenCalled();
        });

        test('should handle 403 Forbidden by logging out', async () => {
            mockApiError(403, 'Forbidden');
            
            const logoutSpy = jest.spyOn(window.app, 'logout');
            logoutSpy.mockImplementation(() => {});

            await expect(window.app.apiFetch('/api/test')).rejects.toThrow();
            expect(logoutSpy).toHaveBeenCalled();
        });

        test('should handle 400 Bad Request with custom message', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => ({ error: 'Invalid input data' })
            });

            await expect(window.app.apiFetch('/api/test')).rejects.toThrow(
                'Invalid input data'
            );
        });

        test('should handle 500 Internal Server Error', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => ({})
            });

            await expect(window.app.apiFetch('/api/test')).rejects.toThrow(
                'Erro na requisição: Internal Server Error'
            );
        });

        test('should handle network failures', async () => {
            fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

            await expect(window.app.apiFetch('/api/test')).rejects.toThrow(
                'Erro de conexão. Verifique sua internet e tente novamente.'
            );
        });

        test('should handle timeout errors', async () => {
            fetch.mockRejectedValueOnce(new Error('The user aborted a request'));

            await expect(window.app.apiFetch('/api/test')).rejects.toThrow(
                'The user aborted a request'
            );
        });
    });

    describe('Specific API Endpoints', () => {
        test('should fetch plans correctly', async () => {
            const mockPlans = [
                { id: 1, name: 'Plan 1', status: 'active' },
                { id: 2, name: 'Plan 2', status: 'inactive' }
            ];
            mockApiSuccess(mockPlans);

            const plans = await window.app.getPlans();
            
            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/plans',
                expect.any(Object)
            );
            expect(plans).toEqual(mockPlans);
            expect(window.app.state.plans).toEqual(mockPlans);
        });

        test('should fetch plan data with caching', async () => {
            const mockData = { sessions: [], progress: 75 };
            mockApiSuccess(mockData);

            const planId = '123';
            const dataType = 'sessions';

            const result = await window.app.getActivePlanData(planId, dataType);
            
            expect(fetch).toHaveBeenCalledWith(
                `http://localhost:3000/api/plans/${planId}/${dataType}`,
                expect.any(Object)
            );
            expect(result).toEqual(mockData);

            // Second call should use cache
            fetch.mockClear();
            const cachedResult = await window.app.getActivePlanData(planId, dataType);
            
            expect(fetch).not.toHaveBeenCalled();
            expect(cachedResult).toEqual(mockData);
        });

        test('should force refresh plan data when requested', async () => {
            const planId = '123';
            const dataType = 'sessions';
            
            // Initial call
            mockApiSuccess({ initial: true });
            await window.app.getActivePlanData(planId, dataType);

            // Force refresh
            mockApiSuccess({ refreshed: true });
            const result = await window.app.getActivePlanData(planId, dataType, true);
            
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ refreshed: true });
        });

        test('should fetch gamification data', async () => {
            const mockGamification = {
                studyStreak: 5,
                experiencePoints: 1250,
                concurseiroLevel: 'Estudante Dedicado 📚',
                achievements: ['first_week', 'consistent_study']
            };
            mockApiSuccess(mockGamification);

            const planId = '123';
            const result = await window.app.getGamificationData(planId);
            
            expect(fetch).toHaveBeenCalledWith(
                `http://localhost:3000/api/plans/${planId}/gamification`,
                expect.any(Object)
            );
            expect(result).toEqual(mockGamification);
        });

        test('should handle gamification data errors gracefully', async () => {
            mockApiError(500, 'Gamification service unavailable');

            const planId = '123';
            const result = await window.app.getGamificationData(planId);
            
            // Should return fallback data instead of throwing
            expect(result).toEqual(expect.objectContaining({
                studyStreak: 0,
                experiencePoints: 0,
                concurseiroLevel: 'Aspirante a Servidor(a) 🌱',
                achievements: []
            }));
        });
    });

    describe('Cache Management', () => {
        test('should invalidate specific data type cache', () => {
            const planId = '123';
            window.app.state.activePlanData[planId] = {
                sessions: { data: 'old' },
                progress: { value: 50 }
            };

            window.app.invalidatePlanCache(planId, 'sessions');

            expect(window.app.state.activePlanData[planId].sessions).toBeUndefined();
            expect(window.app.state.activePlanData[planId].progress).toBeDefined();
        });

        test('should invalidate entire plan cache', () => {
            const planId = '123';
            window.app.state.activePlanData[planId] = {
                sessions: { data: 'old' },
                progress: { value: 50 }
            };

            window.app.invalidatePlanCache(planId);

            expect(window.app.state.activePlanData[planId]).toBeUndefined();
        });

        test('should handle cache invalidation for non-existent plan', () => {
            expect(() => {
                window.app.invalidatePlanCache('non-existent');
            }).not.toThrow();
        });
    });

    describe('Request Retry Logic', () => {
        test('should not automatically retry failed requests', async () => {
            fetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ success: true })
                });

            await expect(window.app.apiFetch('/api/test')).rejects.toThrow();
            
            // Should only have made one attempt
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Concurrent Requests', () => {
        test('should handle multiple simultaneous requests', async () => {
            const mockData1 = { endpoint: 1 };
            const mockData2 = { endpoint: 2 };
            
            fetch
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: async () => mockData1
                })
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: async () => mockData2
                });

            const [result1, result2] = await Promise.all([
                window.app.apiFetch('/api/test1'),
                window.app.apiFetch('/api/test2')
            ]);

            expect(result1).toEqual(mockData1);
            expect(result2).toEqual(mockData2);
            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('Request Cancellation', () => {
        test('should handle aborted requests', async () => {
            const abortError = new Error('The user aborted a request');
            abortError.name = 'AbortError';
            fetch.mockRejectedValueOnce(abortError);

            await expect(window.app.apiFetch('/api/test')).rejects.toThrow(
                'The user aborted a request'
            );
        });
    });

    describe('Data Validation', () => {
        test('should validate required parameters for getActivePlanData', async () => {
            await expect(window.app.getActivePlanData()).rejects.toThrow(
                'ID do plano e tipo de dados são obrigatórios'
            );
            
            await expect(window.app.getActivePlanData('123')).rejects.toThrow(
                'ID do plano e tipo de dados são obrigatórios'
            );
        });

        test('should validate planId for gamification data', async () => {
            await expect(window.app.getGamificationData()).rejects.toThrow(
                'ID do plano é necessário para buscar dados de gamificação.'
            );
        });
    });
});