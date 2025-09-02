const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        ignores: [
            'node_modules/**',
            'backup_*/**',
            'tests/**',
            'validate_avatars.js',
            'EXAMPLE_INTEGRATION.js',
            'EXEMPLO_USO_REPOSITORIES.js',
            'add-missing-columns-direct.js',
            'analyze-weight-algorithm.js',
            'analyze_avatars.js',
            'check*.js',
            'create*.js',
            'database*.js',
            'delete*.js',
            'drop*.js',
            'execute*.js',
            'export*.js',
            'fix*.js',
            'inspect*.js',
            'list*.js',
            'manual*.js',
            'migrate*.js',
            'print*.js',
            'query*.js',
            'register*.js',
            'remove*.js',
            'reset*.js',
            'restore*.js',
            'rollback*.js',
            'save*.js',
            'script*.js',
            'setup*.js',
            'sync*.js',
            'test*.js',
            'update*.js',
            'verify*.js',
            'weighted*.js',
            '*.test.js',
            '*.spec.js',
            'cards.js',
            'cookies.txt',
            'dashboard*.json',
            'migrations/**'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                global: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                window: 'readonly'
            }
        },
        rules: {
            'prefer-const': 'error',
            'no-unused-vars': ['warn', { 
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            'no-console': ['warn', { 
                allow: ['warn', 'error', 'info'] 
            }],
            'quotes': ['error', 'single', { 
                allowTemplateLiterals: true 
            }],
            'semi': ['error', 'always']
        }
    },
    {
        files: ['js/**/*.js', 'public/js/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                console: 'readonly',
                document: 'readonly',
                window: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                navigator: 'readonly',
                fetch: 'readonly',
                CustomEvent: 'readonly',
                define: 'readonly',
                HTMLElement: 'readonly',
                Event: 'readonly',
                XMLHttpRequest: 'readonly',
                FormData: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                SpeechSynthesisUtterance: 'readonly',
                speechSynthesis: 'readonly',
                confirm: 'readonly',
                URL: 'readonly',
                crypto: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                Uint8Array: 'readonly',
                Array: 'readonly',
                Object: 'readonly',
                JSON: 'readonly',
                Date: 'readonly',
                Math: 'readonly',
                Promise: 'readonly',
                Error: 'readonly',
                URLSearchParams: 'readonly',
                location: 'readonly',
                alert: 'readonly',
                components: 'readonly',
                TimerSystem: 'readonly',
                StudyChecklist: 'readonly',
                EDITALIZA_ACHIEVEMENTS: 'readonly',
                updateTodayProgress: 'readonly',
                updateStudyStatistics: 'readonly',
                minimumSpacing: 'readonly'
            }
        }
    },
    {
        files: ['public/sw.js'],
        languageOptions: {
            globals: {
                self: 'readonly',
                caches: 'readonly',
                clients: 'readonly',
                fetch: 'readonly'
            }
        }
    },
    {
        files: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                crypto: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
                Uint8Array: 'readonly',
                Array: 'readonly',
                Object: 'readonly',
                JSON: 'readonly',
                Date: 'readonly',
                Math: 'readonly',
                Promise: 'readonly',
                Error: 'readonly',
                // Jest globals
                expect: 'readonly',
                test: 'readonly',
                describe: 'readonly',
                beforeAll: 'readonly',
                beforeEach: 'readonly',
                afterAll: 'readonly',
                afterEach: 'readonly',
                jest: 'readonly',
                it: 'readonly'
            }
        },
        rules: {
            // Regras mais relaxadas para testes
            'no-console': 'off',
            'no-unused-vars': ['warn', { 
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],
            'max-lines': 'off',
            'max-len': 'off'
        }
    }
];