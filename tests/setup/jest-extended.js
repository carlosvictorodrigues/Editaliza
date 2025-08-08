/**
 * Jest Extended Matchers Setup
 */

require('jest-extended');

// Custom matchers for the testing fortress
expect.extend({
  /**
   * Check if object has required fields
   */
  toHaveRequiredFields(received, requiredFields) {
    const missingFields = requiredFields.filter(field => !(field in received));
    
    if (missingFields.length === 0) {
      return {
        message: () => `Expected object not to have all required fields`,
        pass: true
      };
    }

    return {
      message: () => `Expected object to have required fields: ${missingFields.join(', ')}`,
      pass: false
    };
  },

  /**
   * Check if response follows API standard
   */
  toBeValidAPIResponse(received) {
    const isValid = received && 
                   typeof received === 'object' && 
                   ('message' in received || 'data' in received || 'error' in received);

    if (isValid) {
      return {
        message: () => `Expected not to be valid API response`,
        pass: true
      };
    }

    return {
      message: () => `Expected valid API response with message, data, or error field`,
      pass: false
    };
  },

  /**
   * Check if string is valid email format
   */
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = typeof received === 'string' && emailRegex.test(received);

    if (isValid) {
      return {
        message: () => `Expected ${received} not to be valid email`,
        pass: true
      };
    }

    return {
      message: () => `Expected ${received} to be valid email format`,
      pass: false
    };
  },

  /**
   * Check if password meets security requirements
   */
  toBeSecurePassword(received) {
    const hasMinLength = received && received.length >= 8;
    const hasUpperCase = /[A-Z]/.test(received);
    const hasLowerCase = /[a-z]/.test(received);
    const hasNumber = /\d/.test(received);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(received);

    const isSecure = hasMinLength && hasUpperCase && hasLowerCase && hasNumber;

    if (isSecure) {
      return {
        message: () => `Expected password not to be secure`,
        pass: true
      };
    }

    const issues = [];
    if (!hasMinLength) issues.push('minimum 8 characters');
    if (!hasUpperCase) issues.push('uppercase letter');
    if (!hasLowerCase) issues.push('lowercase letter');
    if (!hasNumber) issues.push('number');

    return {
      message: () => `Expected secure password with: ${issues.join(', ')}`,
      pass: false
    };
  },

  /**
   * Check if JWT token is valid format
   */
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/;
    const isValid = typeof received === 'string' && jwtRegex.test(received);

    if (isValid) {
      return {
        message: () => `Expected ${received} not to be valid JWT format`,
        pass: true
      };
    }

    return {
      message: () => `Expected valid JWT format (header.payload.signature)`,
      pass: false
    };
  }
});

module.exports = {};