import tseslint from 'typescript-eslint';
import eslintPluginReact from 'eslint-plugin-react';
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
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2020,
            },
        },
        plugins: {
            react: eslintPluginReact,
            'react-hooks': eslintPluginReactHooks,
            perfectionist: eslintPluginPerfectionist,
            vitest: eslintPluginVitest,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            ...eslintPluginReact.configs.recommended.rules,
            ...eslintPluginReact.configs['jsx-runtime'].rules,
            ...eslintPluginReactHooks.configs.recommended.rules,
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'off',
            'react/prop-types': 'off',
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
