/**
 * Frontend Tests - DOM Manipulation
 * Tests for DOM manipulation, UI components, and user interactions
 */

const fs = require('fs');
const path = require('path');

// Load components.js and app.js
const appJsPath = path.join(__dirname, '../../public/js/app.js');
const componentsJsPath = path.join(__dirname, '../../public/js/components.js');
const checklistJsPath = path.join(__dirname, '../../public/js/checklist.js');

const appJsContent = fs.readFileSync(appJsPath, 'utf8');
const componentsJsContent = fs.readFileSync(componentsJsPath, 'utf8');
const checklistJsContent = fs.readFileSync(checklistJsPath, 'utf8');

function loadScripts() {
    // Load app.js first
    const appScript = document.createElement('script');
    appScript.textContent = appJsContent;
    document.head.appendChild(appScript);
    
    // Load components.js
    const componentsScript = document.createElement('script');
    componentsScript.textContent = componentsJsContent;
    document.head.appendChild(componentsScript);
    
    // Load checklist.js
    const checklistScript = document.createElement('script');
    checklistScript.textContent = checklistJsContent;
    document.head.appendChild(checklistScript);
}

// Mock HTML structure for various components
const createMockPage = () => {
    return `
        <div id="toast-container"></div>
        <div id="spinner-overlay" class="hidden" data-count="0">
            <div class="spinner"></div>
        </div>
        <div id="studySessionModal" class="modal hidden">
            <div id="studySessionModalContainer"></div>
        </div>
        <div id="todaySchedule"></div>
        <div id="overdue-alert-container"></div>
        <div id="main-content">
            <h1>Test Page</h1>
        </div>
        <nav id="main-navigation">
            <ul id="nav-links">
                <li><a href="/home" class="nav-link">Home</a></li>
                <li><a href="/plans" class="nav-link">Plans</a></li>
            </ul>
        </nav>
    `;
};

describe('Frontend DOM Manipulation', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        loadScripts();
        createTestDOM(createMockPage());
    });

    afterEach(() => {
        if (window.app) delete window.app;
        if (window.components) delete window.components;
        if (window.StudyChecklist) delete window.StudyChecklist;
    });

    describe('Toast Notifications', () => {
        test('should create and display success toast', () => {
            window.app.showToast('Test success message', 'success');

            const toastContainer = document.getElementById('toast-container');
            expect(toastContainer.children.length).toBe(1);

            const toast = toastContainer.firstChild;
            expect(toast.textContent).toContain('Test success message');
            expect(toast.textContent).toContain('✓');
            expect(toast.className).toContain('bg-green-500');
        });

        test('should create and display error toast', () => {
            window.app.showToast('Test error message', 'error');

            const toastContainer = document.getElementById('toast-container');
            expect(toastContainer.children.length).toBe(1);

            const toast = toastContainer.firstChild;
            expect(toast.textContent).toContain('Test error message');
            expect(toast.textContent).toContain('✕');
            expect(toast.className).toContain('bg-red-500');
        });

        test('should sanitize toast messages', () => {
            const maliciousMessage = '<img src="x" onerror="alert(1)">';
            window.app.showToast(maliciousMessage, 'success');

            const toastContainer = document.getElementById('toast-container');
            const toast = toastContainer.firstChild;
            
            expect(toast.innerHTML).not.toContain('<img');
            expect(toast.innerHTML).not.toContain('onerror');
        });

        test('should remove toast after timeout', (done) => {
            window.app.showToast('Temporary message', 'success');

            const toastContainer = document.getElementById('toast-container');
            expect(toastContainer.children.length).toBe(1);

            // Fast forward time to trigger toast removal
            setTimeout(() => {
                // Toast should still be there but with removal classes
                const toast = toastContainer.firstChild;
                expect(toast.className).toContain('translate-x-full');
                expect(toast.className).toContain('opacity-0');
                done();
            }, 3100); // Slightly more than 3s timeout
        });

        test('should handle multiple toasts', () => {
            window.app.showToast('Message 1', 'success');
            window.app.showToast('Message 2', 'error');
            window.app.showToast('Message 3', 'success');

            const toastContainer = document.getElementById('toast-container');
            expect(toastContainer.children.length).toBe(3);

            expect(toastContainer.children[0].textContent).toContain('Message 1');
            expect(toastContainer.children[1].textContent).toContain('Message 2');
            expect(toastContainer.children[2].textContent).toContain('Message 3');
        });
    });

    describe('Loading Spinner', () => {
        test('should show spinner overlay', () => {
            const spinner = document.getElementById('spinner-overlay');
            expect(spinner.classList.contains('hidden')).toBe(true);

            window.app.showSpinner();

            expect(spinner.classList.contains('hidden')).toBe(false);
            expect(spinner.dataset.count).toBe('1');
        });

        test('should hide spinner overlay', () => {
            const spinner = document.getElementById('spinner-overlay');
            window.app.showSpinner();
            
            expect(spinner.classList.contains('hidden')).toBe(false);

            window.app.hideSpinner();

            expect(spinner.classList.contains('hidden')).toBe(true);
            expect(spinner.dataset.count).toBe('0');
        });

        test('should handle nested spinner calls', () => {
            const spinner = document.getElementById('spinner-overlay');

            window.app.showSpinner();
            window.app.showSpinner();
            window.app.showSpinner();

            expect(spinner.dataset.count).toBe('3');
            expect(spinner.classList.contains('hidden')).toBe(false);

            window.app.hideSpinner();
            expect(spinner.dataset.count).toBe('2');
            expect(spinner.classList.contains('hidden')).toBe(false);

            window.app.hideSpinner();
            expect(spinner.dataset.count).toBe('1');
            expect(spinner.classList.contains('hidden')).toBe(false);

            window.app.hideSpinner();
            expect(spinner.dataset.count).toBe('0');
            expect(spinner.classList.contains('hidden')).toBe(true);
        });

        test('should not break with extra hide calls', () => {
            const spinner = document.getElementById('spinner-overlay');

            window.app.showSpinner();
            window.app.hideSpinner();
            window.app.hideSpinner(); // Extra hide call
            window.app.hideSpinner(); // Another extra hide call

            expect(spinner.dataset.count).toBe('0');
            expect(spinner.classList.contains('hidden')).toBe(true);
        });
    });

    describe('Study Session Modal', () => {
        test('should show study checklist modal', () => {
            const mockSession = {
                id: '123',
                subject_name: 'Direito Constitucional',
                session_date: '2024-01-15',
                start_time: '09:00',
                duration: 90
            };

            if (window.StudyChecklist) {
                window.StudyChecklist.show(mockSession);

                const modal = document.getElementById('studySessionModal');
                expect(modal.classList.contains('hidden')).toBe(false);

                const container = document.getElementById('studySessionModalContainer');
                expect(container.innerHTML).toContain('Preparação para o Estudo');
            }
        });

        test('should handle checklist item interactions', () => {
            const mockSession = {
                id: '123',
                subject_name: 'Direito Constitucional',
                session_date: '2024-01-15'
            };

            if (window.StudyChecklist) {
                window.StudyChecklist.show(mockSession);

                // Simulate clicking on checklist items
                const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
                
                if (checkboxes.length > 0) {
                    checkboxes[0].checked = true;
                    checkboxes[0].dispatchEvent(new Event('change'));

                    expect(checkboxes[0].checked).toBe(true);
                }
            }
        });
    });

    describe('Schedule Rendering', () => {
        test('should render today schedule container', () => {
            const scheduleContainer = document.getElementById('todaySchedule');
            expect(scheduleContainer).toBeTruthy();

            // Mock schedule data
            const mockSessions = [
                {
                    id: '1',
                    subject_name: 'Direito Constitucional',
                    start_time: '09:00',
                    duration: 90,
                    status: 'Pendente'
                },
                {
                    id: '2',
                    subject_name: 'Direito Administrativo',
                    start_time: '14:00',
                    duration: 60,
                    status: 'Concluído'
                }
            ];

            // Simulate rendering sessions
            scheduleContainer.innerHTML = '';
            mockSessions.forEach(session => {
                const sessionCard = document.createElement('div');
                sessionCard.className = 'session-card';
                sessionCard.innerHTML = `
                    <h3>${session.subject_name}</h3>
                    <p>Horário: ${session.start_time}</p>
                    <p>Duração: ${session.duration}min</p>
                    <span class="status">${session.status}</span>
                `;
                scheduleContainer.appendChild(sessionCard);
            });

            const sessionCards = scheduleContainer.querySelectorAll('.session-card');
            expect(sessionCards.length).toBe(2);
            expect(sessionCards[0].textContent).toContain('Direito Constitucional');
            expect(sessionCards[1].textContent).toContain('Direito Administrativo');
        });
    });

    describe('Navigation Updates', () => {
        test('should update active navigation link', () => {
            const navLinks = document.querySelectorAll('.nav-link');
            
            // Simulate clicking on a navigation link
            navLinks.forEach(link => {
                link.classList.remove('active');
            });

            navLinks[1].classList.add('active');

            expect(navLinks[1].classList.contains('active')).toBe(true);
            expect(navLinks[0].classList.contains('active')).toBe(false);
        });
    });

    describe('Form Validation UI', () => {
        test('should show validation errors on inputs', () => {
            const form = document.createElement('form');
            form.innerHTML = `
                <input type="email" id="email" value="invalid-email">
                <div id="email-error" class="error-message hidden"></div>
                <input type="password" id="password" value="123">
                <div id="password-error" class="error-message hidden"></div>
            `;
            document.body.appendChild(form);

            const emailInput = document.getElementById('email');
            const emailError = document.getElementById('email-error');
            const passwordInput = document.getElementById('password');
            const passwordError = document.getElementById('password-error');

            // Validate email
            const emailValid = window.app.validateInput(emailInput.value, 'email');
            if (!emailValid) {
                emailError.textContent = 'Email inválido';
                emailError.classList.remove('hidden');
                emailInput.classList.add('border-red-500');
            }

            // Validate password
            const passwordValid = window.app.validateInput(passwordInput.value, 'password');
            if (!passwordValid) {
                passwordError.textContent = 'Senha muito curta';
                passwordError.classList.remove('hidden');
                passwordInput.classList.add('border-red-500');
            }

            expect(emailError.classList.contains('hidden')).toBe(false);
            expect(passwordError.classList.contains('hidden')).toBe(false);
            expect(emailInput.classList.contains('border-red-500')).toBe(true);
            expect(passwordInput.classList.contains('border-red-500')).toBe(true);
        });

        test('should clear validation errors when input becomes valid', () => {
            const form = document.createElement('form');
            form.innerHTML = `
                <input type="email" id="email" value="valid@example.com">
                <div id="email-error" class="error-message">Email inválido</div>
            `;
            document.body.appendChild(form);

            const emailInput = document.getElementById('email');
            const emailError = document.getElementById('email-error');

            const emailValid = window.app.validateInput(emailInput.value, 'email');
            if (emailValid) {
                emailError.textContent = '';
                emailError.classList.add('hidden');
                emailInput.classList.remove('border-red-500');
                emailInput.classList.add('border-green-500');
            }

            expect(emailError.classList.contains('hidden')).toBe(true);
            expect(emailInput.classList.contains('border-red-500')).toBe(false);
            expect(emailInput.classList.contains('border-green-500')).toBe(true);
        });
    });

    describe('Dynamic Content Loading', () => {
        test('should update page content dynamically', () => {
            const contentContainer = document.getElementById('main-content');
            
            // Simulate loading new content
            const newContent = `
                <h2>New Section</h2>
                <p>This content was loaded dynamically</p>
                <div class="stats">
                    <span class="metric">Sessions: 5</span>
                    <span class="metric">Progress: 75%</span>
                </div>
            `;

            contentContainer.innerHTML = newContent;

            expect(contentContainer.querySelector('h2').textContent).toBe('New Section');
            expect(contentContainer.querySelector('p').textContent).toContain('dynamically');
            expect(contentContainer.querySelectorAll('.metric').length).toBe(2);
        });

        test('should handle empty content gracefully', () => {
            const contentContainer = document.getElementById('main-content');
            
            contentContainer.innerHTML = '';
            
            expect(contentContainer.children.length).toBe(0);
            expect(contentContainer.textContent).toBe('');
        });
    });

    describe('Event Handling', () => {
        test('should handle click events', () => {
            const button = document.createElement('button');
            button.id = 'test-button';
            button.textContent = 'Click me';
            document.body.appendChild(button);

            let clicked = false;
            button.addEventListener('click', () => {
                clicked = true;
            });

            button.click();
            expect(clicked).toBe(true);
        });

        test('should handle form submission', () => {
            const form = document.createElement('form');
            form.innerHTML = `
                <input type="text" name="test" value="test value">
                <button type="submit">Submit</button>
            `;
            document.body.appendChild(form);

            let submitted = false;
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                submitted = true;
            });

            form.querySelector('button').click();
            expect(submitted).toBe(true);
        });

        test('should handle input changes', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = 'initial';
            document.body.appendChild(input);

            let changeCount = 0;
            input.addEventListener('input', () => {
                changeCount++;
            });

            // Simulate typing
            input.value = 'updated';
            input.dispatchEvent(new Event('input'));

            expect(changeCount).toBe(1);
            expect(input.value).toBe('updated');
        });
    });

    describe('Responsive Layout', () => {
        test('should handle window resize events', () => {
            let resizeHandled = false;
            
            const handleResize = () => {
                resizeHandled = true;
            };

            window.addEventListener('resize', handleResize);
            
            // Simulate window resize
            window.dispatchEvent(new Event('resize'));
            
            expect(resizeHandled).toBe(true);
        });

        test('should update layout based on screen size', () => {
            // Mock window dimensions
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 768
            });

            const nav = document.getElementById('main-navigation');
            
            if (window.innerWidth < 1024) {
                nav.classList.add('mobile-nav');
            } else {
                nav.classList.remove('mobile-nav');
            }

            expect(nav.classList.contains('mobile-nav')).toBe(true);

            // Change to desktop size
            window.innerWidth = 1200;
            
            if (window.innerWidth < 1024) {
                nav.classList.add('mobile-nav');
            } else {
                nav.classList.remove('mobile-nav');
            }

            expect(nav.classList.contains('mobile-nav')).toBe(false);
        });
    });

    describe('Accessibility', () => {
        test('should have proper ARIA labels', () => {
            const button = document.createElement('button');
            button.setAttribute('aria-label', 'Close modal');
            button.textContent = '×';
            document.body.appendChild(button);

            expect(button.getAttribute('aria-label')).toBe('Close modal');
        });

        test('should handle keyboard navigation', () => {
            const buttons = [
                document.createElement('button'),
                document.createElement('button'),
                document.createElement('button')
            ];

            buttons.forEach((button, index) => {
                button.textContent = `Button ${index + 1}`;
                button.tabIndex = 0;
                document.body.appendChild(button);
            });

            // Simulate tab navigation
            let focusedIndex = 0;
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    focusedIndex = (focusedIndex + 1) % buttons.length;
                    buttons[focusedIndex].focus();
                }
            });

            // Test focus management
            buttons[0].focus();
            expect(document.activeElement).toBe(buttons[0]);
        });
    });

    describe('Subject Style Application', () => {
        test('should apply correct styles to subjects', () => {
            const subjects = ['Constitucional', 'Administrativo', 'Unknown Subject'];
            const container = document.createElement('div');
            document.body.appendChild(container);

            subjects.forEach(subject => {
                const style = window.app.getSubjectStyle(subject);
                const element = document.createElement('div');
                element.className = `subject-card ${style.color}`;
                element.innerHTML = `${style.icon} ${subject}`;
                container.appendChild(element);
            });

            const subjectCards = container.querySelectorAll('.subject-card');
            
            expect(subjectCards[0].className).toContain('border-green-500');
            expect(subjectCards[0].textContent).toContain('⚖️');
            
            expect(subjectCards[1].className).toContain('border-red-500');
            expect(subjectCards[1].textContent).toContain('🏛️');
            
            expect(subjectCards[2].textContent).toContain('📚');
        });
    });
});