import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
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
    eslintReact.configs['recommended-typescript'],
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2020,
            },
        },
        plugins: {
            'react-hooks': eslintPluginReactHooks,
            perfectionist: eslintPluginPerfectionist,
            vitest: eslintPluginVitest,
        },
        rules: {
            ...eslintPluginReactHooks.configs.recommended.rules,
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
