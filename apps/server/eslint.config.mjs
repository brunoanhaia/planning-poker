import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import eslintPluginPerfectionist from 'eslint-plugin-perfectionist';
import eslintPluginVitest from 'eslint-plugin-vitest';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
    ...tseslint.configs.recommended,
    eslintPluginPrettier,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
        },
        plugins: {
            perfectionist: eslintPluginPerfectionist,
            vitest: eslintPluginVitest,
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'off',
            'vitest/no-disabled-tests': 'warn',
            'vitest/no-focused-tests': 'error',
            'perfectionist/sort-imports': [
                'warn',
                {
                    type: 'natural',
                    order: 'asc',
                },
            ],
        },
    }
);
