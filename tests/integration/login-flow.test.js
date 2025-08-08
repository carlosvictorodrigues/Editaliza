const request = require('supertest');
const express = require('express');
const session = require('express-session');
const authRoutes = require('../src/routes/authRoutes');
const authService = require('../src/services/authService');

// Mock the authService
jest.mock('../src/services/authService');

const app = express();
app.use(express.json());

// Add session middleware for testing
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: true,
}));

app.use('/auth', authRoutes);

describe('Login Flow', () => {
  it('should redirect to home.html if user has plans', async () => {
    // Mock the login and checkIfUserHasPlans functions
    authService.login.mockResolvedValue({ 
      message: 'Login bem-sucedido!', 
      token: 'fake-token',
      user: { id: 1, email: 'test@example.com' }
    });
    authService.checkIfUserHasPlans.mockResolvedValue(true);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.redirectUrl).toBe('home.html');
  });

  it('should redirect to dashboard.html if user has no plans', async () => {
    // Mock the login and checkIfUserHasPlans functions
    authService.login.mockResolvedValue({ 
      message: 'Login bem-sucedido!', 
      token: 'fake-token',
      user: { id: 1, email: 'test@example.com' }
    });
    authService.checkIfUserHasPlans.mockResolvedValue(false);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.redirectUrl).toBe('dashboard.html');
  });
});
