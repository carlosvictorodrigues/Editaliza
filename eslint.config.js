const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        ignores: [
            'node_modules/**',
            'backup_*/**',
            'tests/e2e/**',
            'tests/unit/pages/**',
            'tests/unit/timer/**',
            'tests/helpers/**',
            'tests/database-test.js',
            'tests/test-server.js',
            'js/**',
            'validate_avatars.js'
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
                clearInterval: 'readonly'
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
        files: ['public/js/**/*.js'],
        languageOptions: {
            sourceType: 'script',
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
                cancelAnimationFrame: 'readonly'
            }
        }
    },
    {
        files: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
        languageOptions: {
            globals: {
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