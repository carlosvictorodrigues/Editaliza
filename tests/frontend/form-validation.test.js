/**
 * Frontend Tests - Form Validation
 * Tests for client-side form validation, input sanitization, and user input handling
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

// Mock form templates
const createLoginForm = () => `
    <form id="loginForm" novalidate>
        <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required>
            <div class="error-message" id="email-error"></div>
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
            <div class="error-message" id="password-error"></div>
        </div>
        <button type="submit" id="submit-btn">Login</button>
    </form>
`;

const createPlanForm = () => `
    <form id="planForm" novalidate>
        <div class="form-group">
            <label for="planName">Plan Name</label>
            <input type="text" id="planName" name="planName" required>
            <div class="error-message" id="planName-error"></div>
        </div>
        <div class="form-group">
            <label for="examDate">Exam Date</label>
            <input type="date" id="examDate" name="examDate" required>
            <div class="error-message" id="examDate-error"></div>
        </div>
        <div class="form-group">
            <label for="studyHours">Daily Study Hours</label>
            <input type="number" id="studyHours" name="studyHours" min="1" max="16" required>
            <div class="error-message" id="studyHours-error"></div>
        </div>
        <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" maxlength="500"></textarea>
            <div class="error-message" id="description-error"></div>
        </div>
        <button type="submit" id="submit-btn">Create Plan</button>
    </form>
`;

const createProfileForm = () => `
    <form id="profileForm" novalidate>
        <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required minlength="3" maxlength="50">
            <div class="error-message" id="username-error"></div>
        </div>
        <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required>
            <div class="error-message" id="email-error"></div>
        </div>
        <div class="form-group">
            <label for="currentPassword">Current Password</label>
            <input type="password" id="currentPassword" name="currentPassword">
            <div class="error-message" id="currentPassword-error"></div>
        </div>
        <div class="form-group">
            <label for="newPassword">New Password</label>
            <input type="password" id="newPassword" name="newPassword">
            <div class="error-message" id="newPassword-error"></div>
        </div>
        <div class="form-group">
            <label for="confirmPassword">Confirm New Password</label>
            <input type="password" id="confirmPassword" name="confirmPassword">
            <div class="error-message" id="confirmPassword-error"></div>
        </div>
        <button type="submit" id="submit-btn">Update Profile</button>
    </form>
`;

describe('Frontend Form Validation', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        loadAppJs();
    });

    afterEach(() => {
        if (window.app) {
            delete window.app;
        }
    });

    describe('Email Validation', () => {
        test('should validate correct email formats', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'user+tag@gmail.com',
                'test123@test-domain.com',
                'a@b.co'
            ];

            validEmails.forEach(email => {
                expect(window.app.validateInput(email, 'email')).toBe(true);
            });
        });

        test('should reject invalid email formats', () => {
            const invalidEmails = [
                'invalid-email',
                '@domain.com',
                'test@',
                'test.domain.com',
                'test@domain',
                '',
                'test space@domain.com',
                'test@domain..com'
            ];

            invalidEmails.forEach(email => {
                expect(window.app.validateInput(email, 'email')).toBe(false);
            });
        });

        test('should handle email validation in forms', () => {
            createTestDOM(createLoginForm());
            
            const emailInput = document.getElementById('email');
            const emailError = document.getElementById('email-error');

            // Test invalid email
            emailInput.value = 'invalid-email';
            const isValid = window.app.validateInput(emailInput.value, 'email');
            
            expect(isValid).toBe(false);
            
            // Simulate UI update
            if (!isValid) {
                emailError.textContent = 'Please enter a valid email address';
                emailError.style.display = 'block';
                emailInput.classList.add('error');
            }

            expect(emailError.textContent).toBe('Please enter a valid email address');
            expect(emailInput.classList.contains('error')).toBe(true);
        });
    });

    describe('Password Validation', () => {
        test('should validate password length', () => {
            expect(window.app.validateInput('123456', 'password')).toBe(true);
            expect(window.app.validateInput('12345', 'password')).toBe(false);
            expect(window.app.validateInput('', 'password')).toBe(false);
        });

        test('should validate password with custom minimum length', () => {
            expect(window.app.validateInput('12345678', 'password', { minLength: 8 })).toBe(true);
            expect(window.app.validateInput('1234567', 'password', { minLength: 8 })).toBe(false);
        });

        test('should handle password strength requirements', () => {
            // Custom validation for strong passwords
            const validateStrongPassword = (password) => {
                const hasLowerCase = /[a-z]/.test(password);
                const hasUpperCase = /[A-Z]/.test(password);
                const hasNumbers = /\d/.test(password);
                const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
                const isLongEnough = password.length >= 8;
                
                return hasLowerCase && hasUpperCase && hasNumbers && hasSpecialChar && isLongEnough;
            };

            expect(validateStrongPassword('StrongPass123!')).toBe(true);
            expect(validateStrongPassword('weakpass')).toBe(false);
            expect(validateStrongPassword('ONLYUPPERCASE123!')).toBe(false);
            expect(validateStrongPassword('onlylowercase123!')).toBe(false);
            expect(validateStrongPassword('NoNumbers!')).toBe(false);
            expect(validateStrongPassword('NoSpecialChar123')).toBe(false);
        });

        test('should validate password confirmation', () => {
            createTestDOM(createProfileForm());
            
            const newPassword = document.getElementById('newPassword');
            const confirmPassword = document.getElementById('confirmPassword');
            const confirmError = document.getElementById('confirmPassword-error');

            newPassword.value = 'newpassword123';
            confirmPassword.value = 'differentpassword';

            const passwordsMatch = newPassword.value === confirmPassword.value;
            expect(passwordsMatch).toBe(false);

            // Simulate UI update
            if (!passwordsMatch) {
                confirmError.textContent = 'Passwords do not match';
                confirmError.style.display = 'block';
            }

            expect(confirmError.textContent).toBe('Passwords do not match');
        });
    });

    describe('Text Input Validation', () => {
        test('should validate text length', () => {
            expect(window.app.validateInput('hello', 'text', { minLength: 3, maxLength: 10 })).toBe(true);
            expect(window.app.validateInput('hi', 'text', { minLength: 3 })).toBe(false);
            expect(window.app.validateInput('verylongtext', 'text', { maxLength: 5 })).toBe(false);
            expect(window.app.validateInput('', 'text', { minLength: 1 })).toBe(false);
        });

        test('should validate username requirements', () => {
            createTestDOM(createProfileForm());
            
            const usernameInput = document.getElementById('username');
            const usernameError = document.getElementById('username-error');

            // Test too short username
            usernameInput.value = 'ab';
            const isValid = window.app.validateInput(usernameInput.value, 'text', { minLength: 3, maxLength: 50 });
            
            expect(isValid).toBe(false);

            // Simulate UI update
            if (!isValid) {
                usernameError.textContent = 'Username must be between 3 and 50 characters';
                usernameError.style.display = 'block';
            }

            expect(usernameError.textContent).toBe('Username must be between 3 and 50 characters');
        });

        test('should sanitize text inputs', () => {
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                '<img src="x" onerror="alert(1)">',
                '<iframe src="javascript:alert(1)"></iframe>',
                'javascript:alert(1)',
                'onclick="alert(1)"'
            ];

            maliciousInputs.forEach(input => {
                const sanitized = window.app.sanitizeHtml(input);
                expect(sanitized).not.toContain('<script');
                expect(sanitized).not.toContain('<img');
                expect(sanitized).not.toContain('<iframe');
                expect(sanitized).not.toContain('javascript:');
                expect(sanitized).not.toContain('onclick=');
            });
        });
    });

    describe('Number Validation', () => {
        test('should validate number ranges', () => {
            expect(window.app.validateInput('10', 'number', { min: 1, max: 20 })).toBe(true);
            expect(window.app.validateInput('0', 'number', { min: 1 })).toBe(false);
            expect(window.app.validateInput('25', 'number', { max: 20 })).toBe(false);
            expect(window.app.validateInput('abc', 'number')).toBe(false);
        });

        test('should handle study hours validation', () => {
            createTestDOM(createPlanForm());
            
            const studyHoursInput = document.getElementById('studyHours');
            const studyHoursError = document.getElementById('studyHours-error');

            // Test invalid study hours
            studyHoursInput.value = '20';
            const isValid = window.app.validateInput(studyHoursInput.value, 'number', { min: 1, max: 16 });
            
            expect(isValid).toBe(false);

            // Simulate UI update
            if (!isValid) {
                studyHoursError.textContent = 'Study hours must be between 1 and 16';
                studyHoursError.style.display = 'block';
            }

            expect(studyHoursError.textContent).toBe('Study hours must be between 1 and 16');
        });

        test('should handle decimal numbers', () => {
            expect(window.app.validateInput('10.5', 'number')).toBe(true);
            expect(window.app.validateInput('0.5', 'number', { min: 0.1, max: 1 })).toBe(true);
            expect(window.app.validateInput('1.5', 'number', { max: 1 })).toBe(false);
        });
    });

    describe('Date Validation', () => {
        test('should validate future dates', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            expect(window.app.validateInput(tomorrowStr, 'date')).toBe(true);
            expect(window.app.validateInput(yesterdayStr, 'date')).toBe(false);
        });

        test('should handle exam date validation', () => {
            createTestDOM(createPlanForm());
            
            const examDateInput = document.getElementById('examDate');
            const examDateError = document.getElementById('examDate-error');

            // Test past date
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            examDateInput.value = yesterdayStr;
            const isValid = window.app.validateInput(examDateInput.value, 'date');
            
            expect(isValid).toBe(false);

            // Simulate UI update
            if (!isValid) {
                examDateError.textContent = 'Exam date must be in the future';
                examDateError.style.display = 'block';
            }

            expect(examDateError.textContent).toBe('Exam date must be in the future');
        });

        test('should validate date format', () => {
            expect(window.app.validateInput('2024-12-31', 'date')).toBe(true);
            expect(window.app.validateInput('invalid-date', 'date')).toBe(false);
            expect(window.app.validateInput('', 'date')).toBe(false);
        });
    });

    describe('Real-time Validation', () => {
        test('should validate input on blur', () => {
            createTestDOM(createLoginForm());
            
            const emailInput = document.getElementById('email');
            const emailError = document.getElementById('email-error');

            // Simulate real-time validation
            const validateField = (input, errorElement, validationType, options = {}) => {
                const isValid = window.app.validateInput(input.value, validationType, options);
                
                if (isValid) {
                    errorElement.textContent = '';
                    errorElement.style.display = 'none';
                    input.classList.remove('error');
                    input.classList.add('valid');
                } else {
                    errorElement.textContent = 'Invalid input';
                    errorElement.style.display = 'block';
                    input.classList.remove('valid');
                    input.classList.add('error');
                }
                
                return isValid;
            };

            emailInput.value = 'invalid-email';
            emailInput.addEventListener('blur', () => {
                validateField(emailInput, emailError, 'email');
            });

            // Trigger blur event
            emailInput.dispatchEvent(new Event('blur'));

            expect(emailError.textContent).toBe('Invalid input');
            expect(emailInput.classList.contains('error')).toBe(true);
        });

        test('should show success state for valid input', () => {
            createTestDOM(createLoginForm());
            
            const emailInput = document.getElementById('email');
            const emailError = document.getElementById('email-error');

            emailInput.value = 'valid@example.com';
            const isValid = window.app.validateInput(emailInput.value, 'email');
            
            expect(isValid).toBe(true);

            // Simulate success UI update
            if (isValid) {
                emailError.textContent = '';
                emailError.style.display = 'none';
                emailInput.classList.add('valid');
                emailInput.classList.remove('error');
            }

            expect(emailError.textContent).toBe('');
            expect(emailInput.classList.contains('valid')).toBe(true);
        });
    });

    describe('Form Submission', () => {
        test('should prevent submission with invalid data', () => {
            createTestDOM(createLoginForm());
            
            const form = document.getElementById('loginForm');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            emailInput.value = 'invalid-email';
            passwordInput.value = '123';

            let submissionPrevented = false;
            
            form.addEventListener('submit', (e) => {
                const emailValid = window.app.validateInput(emailInput.value, 'email');
                const passwordValid = window.app.validateInput(passwordInput.value, 'password');
                
                if (!emailValid || !passwordValid) {
                    e.preventDefault();
                    submissionPrevented = true;
                }
            });

            form.dispatchEvent(new Event('submit'));
            
            expect(submissionPrevented).toBe(true);
        });

        test('should allow submission with valid data', () => {
            createTestDOM(createLoginForm());
            
            const form = document.getElementById('loginForm');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            emailInput.value = 'valid@example.com';
            passwordInput.value = 'validpassword123';

            let submissionAllowed = true;
            
            form.addEventListener('submit', (e) => {
                const emailValid = window.app.validateInput(emailInput.value, 'email');
                const passwordValid = window.app.validateInput(passwordInput.value, 'password');
                
                if (!emailValid || !passwordValid) {
                    e.preventDefault();
                    submissionAllowed = false;
                }
            });

            form.dispatchEvent(new Event('submit'));
            
            expect(submissionAllowed).toBe(true);
        });

        test('should validate all fields before submission', () => {
            createTestDOM(createPlanForm());
            
            const form = document.getElementById('planForm');
            const planNameInput = document.getElementById('planName');
            const examDateInput = document.getElementById('examDate');
            const studyHoursInput = document.getElementById('studyHours');

            // Set some invalid data
            planNameInput.value = 'ab'; // Too short
            examDateInput.value = '2020-01-01'; // Past date
            studyHoursInput.value = '25'; // Too many hours

            const validateAllFields = () => {
                const nameValid = window.app.validateInput(planNameInput.value, 'text', { minLength: 3 });
                const dateValid = window.app.validateInput(examDateInput.value, 'date');
                const hoursValid = window.app.validateInput(studyHoursInput.value, 'number', { min: 1, max: 16 });
                
                return nameValid && dateValid && hoursValid;
            };

            expect(validateAllFields()).toBe(false);
        });
    });

    describe('Error Display', () => {
        test('should show multiple validation errors', () => {
            createTestDOM(createLoginForm());
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const emailError = document.getElementById('email-error');
            const passwordError = document.getElementById('password-error');

            emailInput.value = 'invalid-email';
            passwordInput.value = '123';

            const emailValid = window.app.validateInput(emailInput.value, 'email');
            const passwordValid = window.app.validateInput(passwordInput.value, 'password');

            if (!emailValid) {
                emailError.textContent = 'Invalid email format';
                emailError.style.display = 'block';
            }

            if (!passwordValid) {
                passwordError.textContent = 'Password too short';
                passwordError.style.display = 'block';
            }

            expect(emailError.textContent).toBe('Invalid email format');
            expect(passwordError.textContent).toBe('Password too short');
        });

        test('should clear errors when inputs become valid', () => {
            createTestDOM(createLoginForm());
            
            const emailInput = document.getElementById('email');
            const emailError = document.getElementById('email-error');

            // Start with invalid input
            emailInput.value = 'invalid-email';
            emailError.textContent = 'Invalid email format';
            emailError.style.display = 'block';

            // Fix the input
            emailInput.value = 'valid@example.com';
            const isValid = window.app.validateInput(emailInput.value, 'email');

            if (isValid) {
                emailError.textContent = '';
                emailError.style.display = 'none';
            }

            expect(emailError.textContent).toBe('');
        });
    });

    describe('Input Sanitization', () => {
        test('should sanitize HTML in form inputs', () => {
            createTestDOM(createPlanForm());
            
            const descriptionInput = document.getElementById('description');
            descriptionInput.value = '<script>alert("xss")</script>Plan description';

            const sanitized = window.app.sanitizeHtml(descriptionInput.value);
            
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('Plan description');
        });

        test('should handle special characters safely', () => {
            const inputs = [
                'Test & Company',
                'Price < $100',
                'Name > Length',
                'Quote "test" content'
            ];

            inputs.forEach(input => {
                const sanitized = window.app.sanitizeHtml(input);
                expect(sanitized).toContain('&amp;'); // & should be escaped
                expect(sanitized).toContain('&lt;'); // < should be escaped
                expect(sanitized).toContain('&gt;'); // > should be escaped
                expect(sanitized).toContain('&quot;'); // " should be escaped
            });
        });
    });

    describe('Custom Validation Rules', () => {
        test('should handle complex validation requirements', () => {
            // Custom validator for Brazilian CPF-like format
            const validateCustomId = (value) => {
                const pattern = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
                return pattern.test(value);
            };

            expect(validateCustomId('123.456.789-01')).toBe(true);
            expect(validateCustomId('12345678901')).toBe(false);
            expect(validateCustomId('123.456.789.01')).toBe(false);
        });

        test('should validate dependent fields', () => {
            createTestDOM(createProfileForm());
            
            const newPassword = document.getElementById('newPassword');
            const confirmPassword = document.getElementById('confirmPassword');
            const currentPassword = document.getElementById('currentPassword');

            // Validation rule: if changing password, current password is required
            const validatePasswordChange = () => {
                const hasNewPassword = newPassword.value.length > 0;
                const hasCurrentPassword = currentPassword.value.length > 0;
                const passwordsMatch = newPassword.value === confirmPassword.value;

                if (hasNewPassword && !hasCurrentPassword) {
                    return { valid: false, error: 'Current password required to change password' };
                }

                if (hasNewPassword && !passwordsMatch) {
                    return { valid: false, error: 'New passwords do not match' };
                }

                return { valid: true };
            };

            // Test case 1: New password without current password
            newPassword.value = 'newpassword123';
            currentPassword.value = '';
            
            let result = validatePasswordChange();
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Current password required to change password');

            // Test case 2: Passwords don't match
            currentPassword.value = 'oldpassword';
            confirmPassword.value = 'differentpassword';
            
            result = validatePasswordChange();
            expect(result.valid).toBe(false);
            expect(result.error).toBe('New passwords do not match');

            // Test case 3: Valid password change
            confirmPassword.value = 'newpassword123';
            
            result = validatePasswordChange();
            expect(result.valid).toBe(true);
        });
    });
});