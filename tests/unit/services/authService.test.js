/**
 * Auth Service Unit Tests
 * Tests all authentication business logic with 90%+ coverage target
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authService = require('../../../src/services/authService');
const authRepository = require('../../../src/repositories/authRepository');
const { securityLog, checkUserRateLimit } = require('../../../src/utils/security');
const { validUsers, invalidUsers, testTokens } = require('../../fixtures/userData');

// Mock all dependencies
jest.mock('../../../src/repositories/authRepository');
jest.mock('../../../src/utils/security');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService Unit Tests', () => {
  let mockReq, mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = global.testUtils.mockRequest();
    mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      password_hash: '$2b$12$hashedpassword',
      auth_provider: 'local'
    };

    // Setup default mocks
    checkUserRateLimit.mockReturnValue(true);
    securityLog.mockImplementation(() => {});
  });

  describe('register()', () => {
    beforeEach(() => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({ id: 1 });
      bcrypt.hash.mockResolvedValue('$2b$12$hashedpassword');
    });

    test('should successfully register a new user', async () => {
      const result = await authService.register(validUsers.basic, mockReq);

      expect(result).toHaveRequiredFields(['message', 'userId']);
      expect(result.message).toBe('Usuário criado com sucesso!');
      expect(result.userId).toBe(1);
      expect(authRepository.createUser).toHaveBeenCalledWith({
        email: validUsers.basic.email,
        passwordHash: '$2b$12$hashedpassword',
        name: validUsers.basic.name,
        currentDate: expect.any(String)
      });
      expect(securityLog).toHaveBeenCalledWith(
        'user_registered',
        { email: validUsers.basic.email, userId: 1 },
        1,
        mockReq
      );
    });

    test('should sanitize user inputs during registration', async () => {
      const userData = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'TestPassword123!',
        name: '  <script>Test</script>User  '
      };

      await authService.register(userData, mockReq);

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com', // Should be sanitized
          name: expect.not.stringContaining('<script>') // Should be sanitized
        })
      );
    });

    test('should reject registration with invalid email', async () => {
      await expect(authService.register(invalidUsers.invalidEmail, mockReq))
        .rejects.toThrow('E-mail inválido');
      
      expect(authRepository.createUser).not.toHaveBeenCalled();
    });

    test('should reject registration when user already exists', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(validUsers.basic, mockReq))
        .rejects.toThrow('Este e-mail já está em uso.');

      expect(securityLog).toHaveBeenCalledWith(
        'registration_attempt_existing_email',
        { email: validUsers.basic.email },
        null,
        mockReq
      );
    });

    test('should hash password with secure salt rounds', async () => {
      await authService.register(validUsers.basic, mockReq);

      expect(bcrypt.hash).toHaveBeenCalledWith(validUsers.basic.password, 12);
    });

    test('should handle registration without optional name', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      await authService.register(userData, mockReq);

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: null
        })
      );
    });
  });

  describe('login()', () => {
    beforeEach(() => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      authRepository.recordLoginAttempt.mockResolvedValue();
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock.jwt.token');
    });

    test('should successfully login with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const result = await authService.login(credentials, mockReq);

      expect(result).toHaveRequiredFields(['message', 'token', 'user']);
      expect(result.message).toBe('Login bem-sucedido!');
      expect(result.token).toBeValidJWT();
      expect(result.user).toHaveRequiredFields(['id', 'email', 'name', 'auth_provider']);
      expect(authRepository.recordLoginAttempt).toHaveBeenCalledWith(
        'test@example.com', true, mockReq.ip, mockReq.headers['user-agent']
      );
    });

    test('should sanitize email input', async () => {
      const credentials = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'TestPassword123!'
      };

      await authService.login(credentials, mockReq);

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith('test@example.com');
    });

    test('should reject invalid email format', async () => {
      const credentials = {
        email: 'invalid-email',
        password: 'TestPassword123!'
      };

      await expect(authService.login(credentials, mockReq))
        .rejects.toThrow('E-mail inválido');
    });

    test('should reject login when user not found', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await expect(authService.login(validUsers.basic, mockReq))
        .rejects.toThrow('E-mail ou senha inválidos.');

      expect(authRepository.recordLoginAttempt).toHaveBeenCalledWith(
        validUsers.basic.email, false, mockReq.ip, mockReq.headers['user-agent']
      );
      expect(securityLog).toHaveBeenCalledWith(
        'login_attempt_user_not_found',
        { email: validUsers.basic.email },
        null,
        mockReq
      );
    });

    test('should reject login for Google OAuth users', async () => {
      const googleUser = { ...mockUser, auth_provider: 'google' };
      authRepository.findUserByEmail.mockResolvedValue(googleUser);

      await expect(authService.login(validUsers.basic, mockReq))
        .rejects.toThrow('Esta conta foi criada com Google. Use o botão \'Entrar com Google\' para fazer login.');

      expect(securityLog).toHaveBeenCalledWith(
        'login_attempt_google_user',
        { email: validUsers.basic.email, userId: googleUser.id },
        googleUser.id,
        mockReq
      );
    });

    test('should reject login with wrong password', async () => {
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login(validUsers.basic, mockReq))
        .rejects.toThrow('E-mail ou senha inválidos.');

      expect(authRepository.recordLoginAttempt).toHaveBeenCalledWith(
        validUsers.basic.email, false, mockReq.ip, mockReq.headers['user-agent']
      );
      expect(securityLog).toHaveBeenCalledWith(
        'login_attempt_wrong_password',
        { email: validUsers.basic.email, userId: mockUser.id },
        mockUser.id,
        mockReq
      );
    });

    test('should enforce rate limiting', async () => {
      checkUserRateLimit.mockReturnValue(false);

      await expect(authService.login(validUsers.basic, mockReq))
        .rejects.toThrow('Muitas tentativas de login. Tente novamente em 15 minutos.');

      expect(securityLog).toHaveBeenCalledWith(
        'login_rate_limited',
        { email: validUsers.basic.email },
        null,
        mockReq
      );
    });
  });

  describe('processGoogleCallback()', () => {
    const mockProfile = {
      id: 'google123',
      emails: [{ value: 'google@example.com' }],
      displayName: 'Google User',
      photos: [{ value: 'https://example.com/photo.jpg' }]
    };

    test('should return existing Google user', async () => {
      authRepository.findUserByGoogleId.mockResolvedValue(mockUser);

      const result = await authService.processGoogleCallback(mockProfile, mockReq);

      expect(result).toEqual(mockUser);
      expect(securityLog).toHaveBeenCalledWith(
        'google_oauth_existing_user',
        { email: mockProfile.emails[0].value, userId: mockUser.id },
        mockUser.id,
        mockReq
      );
    });

    test('should link Google account to existing email user', async () => {
      authRepository.findUserByGoogleId.mockResolvedValue(null);
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      authRepository.linkGoogleAccount.mockResolvedValue(mockUser);

      const result = await authService.processGoogleCallback(mockProfile, mockReq);

      expect(result).toEqual(mockUser);
      expect(authRepository.linkGoogleAccount).toHaveBeenCalledWith(
        mockUser.id,
        mockProfile.id,
        mockProfile.photos[0].value,
        mockProfile.displayName
      );
      expect(securityLog).toHaveBeenCalledWith(
        'google_oauth_account_linked',
        { email: mockProfile.emails[0].value, userId: mockUser.id },
        mockUser.id,
        mockReq
      );
    });

    test('should create new Google user', async () => {
      authRepository.findUserByGoogleId.mockResolvedValue(null);
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.createGoogleUser.mockResolvedValue(mockUser);

      const result = await authService.processGoogleCallback(mockProfile, mockReq);

      expect(result).toEqual(mockUser);
      expect(authRepository.createGoogleUser).toHaveBeenCalledWith({
        email: mockProfile.emails[0].value,
        name: mockProfile.displayName,
        googleId: mockProfile.id,
        avatar: mockProfile.photos[0].value,
        currentDate: expect.any(String)
      });
      expect(securityLog).toHaveBeenCalledWith(
        'google_oauth_user_created',
        { email: mockProfile.emails[0].value, userId: mockUser.id },
        mockUser.id,
        mockReq
      );
    });

    test('should handle Google OAuth errors', async () => {
      authRepository.findUserByGoogleId.mockRejectedValue(new Error('Database error'));

      await expect(authService.processGoogleCallback(mockProfile, mockReq))
        .rejects.toThrow('Database error');

      expect(securityLog).toHaveBeenCalledWith(
        'google_oauth_error',
        { error: 'Database error', profileEmail: mockProfile.emails[0].value },
        null,
        mockReq
      );
    });
  });

  describe('requestPasswordReset()', () => {
    beforeEach(() => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      authRepository.setResetToken.mockResolvedValue();
    });

    test('should successfully request password reset', async () => {
      const result = await authService.requestPasswordReset('test@example.com', mockReq);

      expect(result).toHaveRequiredFields(['message']);
      expect(result.message).toContain('Se um usuário com este e-mail existir');
      expect(authRepository.setResetToken).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String), // token
        expect.any(Number)  // expires
      );
      expect(securityLog).toHaveBeenCalledWith(
        'password_reset_requested',
        { email: 'test@example.com', userId: mockUser.id },
        mockUser.id,
        mockReq
      );
    });

    test('should reject reset for Google OAuth users', async () => {
      const googleUser = { ...mockUser, auth_provider: 'google' };
      authRepository.findUserByEmail.mockResolvedValue(googleUser);

      await expect(authService.requestPasswordReset('test@example.com', mockReq))
        .rejects.toThrow('Esta conta foi criada com Google. Use o botão \'Entrar com Google\' para fazer login.');

      expect(securityLog).toHaveBeenCalledWith(
        'password_reset_google_user',
        { email: 'test@example.com', userId: googleUser.id },
        googleUser.id,
        mockReq
      );
    });

    test('should enforce rate limiting', async () => {
      checkUserRateLimit.mockReturnValue(false);

      await expect(authService.requestPasswordReset('test@example.com', mockReq))
        .rejects.toThrow('Muitas solicitações de redefinição de senha. Tente novamente em 1 hora.');

      expect(securityLog).toHaveBeenCalledWith(
        'password_reset_rate_limited',
        { email: 'test@example.com' },
        null,
        mockReq
      );
    });

    test('should always return success message for security', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      const result = await authService.requestPasswordReset('nonexistent@example.com', mockReq);

      expect(result.message).toContain('Se um usuário com este e-mail existir');
    });
  });

  describe('resetPassword()', () => {
    beforeEach(() => {
      authRepository.findUserByResetToken.mockResolvedValue(mockUser);
      authRepository.updatePassword.mockResolvedValue();
      authRepository.clearResetToken.mockResolvedValue();
      bcrypt.hash.mockResolvedValue('$2b$12$newhashedpassword');
    });

    test('should successfully reset password', async () => {
      const token = 'a'.repeat(32);
      const newPassword = 'NewPassword123!';

      const result = await authService.resetPassword(token, newPassword, mockReq);

      expect(result).toHaveRequiredFields(['message']);
      expect(result.message).toBe('Senha redefinida com sucesso!');
      expect(authRepository.updatePassword).toHaveBeenCalledWith(
        mockUser.id,
        '$2b$12$newhashedpassword'
      );
      expect(authRepository.clearResetToken).toHaveBeenCalledWith(mockUser.id);
      expect(securityLog).toHaveBeenCalledWith(
        'password_reset_completed',
        { email: mockUser.email, userId: mockUser.id },
        mockUser.id,
        mockReq
      );
    });

    test('should reject invalid token', async () => {
      const shortToken = 'short';

      await expect(authService.resetPassword(shortToken, 'NewPassword123!', mockReq))
        .rejects.toThrow('Token inválido');
    });

    test('should reject expired/invalid token', async () => {
      authRepository.findUserByResetToken.mockResolvedValue(null);

      const token = 'a'.repeat(32);
      
      await expect(authService.resetPassword(token, 'NewPassword123!', mockReq))
        .rejects.toThrow('Token inválido ou expirado.');

      expect(securityLog).toHaveBeenCalledWith(
        'password_reset_invalid_token',
        { token: 'aaaaaaaa...' },
        null,
        mockReq
      );
    });
  });

  describe('verifyToken()', () => {
    beforeEach(() => {
      authRepository.findUserById.mockResolvedValue(mockUser);
    });

    test('should successfully verify valid token', async () => {
      const mockDecoded = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User'
      };
      jwt.verify.mockReturnValue(mockDecoded);

      const result = await authService.verifyToken('valid.jwt.token');

      expect(result).toEqual(mockDecoded);
      expect(jwt.verify).toHaveBeenCalledWith(
        'valid.jwt.token',
        process.env.JWT_SECRET
      );
    });

    test('should reject malformed token', async () => {
      jwt.verify.mockReturnValue({ id: 1 }); // Missing email

      await expect(authService.verifyToken('malformed.token'))
        .rejects.toThrow('Token malformado');
    });

    test('should reject token for non-existent user', async () => {
      jwt.verify.mockReturnValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User'
      });
      authRepository.findUserById.mockResolvedValue(null);

      await expect(authService.verifyToken('valid.jwt.token'))
        .rejects.toThrow('Usuário não encontrado');
    });

    test('should handle expired token', async () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => { throw expiredError; });

      await expect(authService.verifyToken('expired.token'))
        .rejects.toThrow('Token expirado. Por favor, faça login novamente.');
    });

    test('should handle invalid token', async () => {
      jwt.verify.mockImplementation(() => { 
        throw new Error('Invalid token'); 
      });

      await expect(authService.verifyToken('invalid.token'))
        .rejects.toThrow('Token inválido');
    });
  });

  describe('generateJWT()', () => {
    test('should generate valid JWT token', () => {
      jwt.sign.mockReturnValue('generated.jwt.token');

      const token = authService.generateJWT(mockUser);

      expect(token).toBe('generated.jwt.token');
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '24h',
          issuer: 'editaliza'
        }
      );
    });
  });

  describe('refreshToken()', () => {
    beforeEach(() => {
      authRepository.findUserById.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('new.jwt.token');
    });

    test('should successfully refresh valid token', async () => {
      const mockDecoded = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800  // expired 30 minutes ago
      };
      jwt.verify.mockReturnValue(mockDecoded);

      const result = await authService.refreshToken('old.jwt.token', mockReq);

      expect(result).toHaveRequiredFields(['token', 'user']);
      expect(result.token).toBe('new.jwt.token');
      expect(result.user).toHaveRequiredFields(['id', 'email', 'name', 'auth_provider']);
      expect(securityLog).toHaveBeenCalledWith(
        'token_refreshed',
        { userId: mockUser.id },
        mockUser.id,
        mockReq
      );
    });

    test('should reject token too old for refresh', async () => {
      const mockDecoded = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60), // 8 days ago
        exp: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)  // expired 7 days ago
      };
      jwt.verify.mockReturnValue(mockDecoded);

      await expect(authService.refreshToken('old.token', mockReq))
        .rejects.toThrow('Token muito antigo para renovação');
    });

    test('should reject malformed token for refresh', async () => {
      jwt.verify.mockReturnValue({ id: 1 }); // Missing email

      await expect(authService.refreshToken('malformed.token', mockReq))
        .rejects.toThrow('Token malformado');
    });
  });

  describe('getUserProfile() & updateUserProfile()', () => {
    test('should get user profile with parsed difficulties', async () => {
      const userWithDifficulties = {
        ...mockUser,
        difficulties: '["Direito", "Matemática"]'
      };
      authRepository.getUserProfile.mockResolvedValue(userWithDifficulties);

      const result = await authService.getUserProfile(1, mockReq);

      expect(result.difficulties).toEqual(['Direito', 'Matemática']);
    });

    test('should handle profile with invalid difficulties JSON', async () => {
      const userWithBadJson = {
        ...mockUser,
        difficulties: 'invalid json'
      };
      authRepository.getUserProfile.mockResolvedValue(userWithBadJson);

      const result = await authService.getUserProfile(1, mockReq);

      expect(result.difficulties).toEqual([]);
      expect(securityLog).toHaveBeenCalledWith(
        'profile_difficulties_parse_error',
        { userId: 1, error: expect.any(String) },
        1,
        mockReq
      );
    });

    test('should update user profile with sanitized data', async () => {
      const profileData = {
        name: '  Updated Name  ',
        phone: '11999999999',
        difficulties: ['Subject 1', 'Subject 2']
      };
      authRepository.updateUserProfile.mockResolvedValue(mockUser);

      const result = await authService.updateUserProfile(1, profileData, mockReq);

      expect(authRepository.updateUserProfile).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          name: 'Updated Name', // Sanitized
          phone: '11999999999',
          difficulties: '["Subject 1","Subject 2"]' // Stringified
        })
      );
      expect(securityLog).toHaveBeenCalledWith(
        'profile_updated',
        { userId: 1, updatedFields: ['name', 'phone', 'difficulties'] },
        1,
        mockReq
      );
    });
  });
});