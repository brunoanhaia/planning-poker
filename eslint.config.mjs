// Consolidated ESLint flat config (ESLint v9+) for the whole monorepo.
//
// ESLint 9 requires an `eslint.config.*` file at the location it is invoked from.
// Tooling such as CodeRabbit runs ESLint from the repository root, so a single
// root config keeps every entry point (root, workspaces, CI, editors) consistent.
//
// Rules are grouped per workspace because each environment needs different globals
// and plugins (browser + React for the client, Node for the server/shared).
import eslintReact from '@eslint-react/eslint-plugin';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import eslintPluginPerfectionist from 'eslint-plugin-perfectionist';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import eslintPluginVitest from 'eslint-plugin-vitest';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const tsconfigRootDir = (dir) => fileURLToPath(new URL(`./${dir}`, import.meta.url));

/** Shared rules applied to every TypeScript source file in the monorepo. */
const sharedRules = {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'perfectionist/sort-imports': ['warn', { order: 'asc', type: 'natural' }],
};

/** Rules that additionally require the vitest plugin to be registered. */
const vitestRules = {
    'vitest/no-disabled-tests': 'warn',
    'vitest/no-focused-tests': 'error',
};

export default tseslint.config(
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            '**/coverage/**',
            '**/playwright-report/**',
            '**/test-results/**',
        ],
    },
    ...tseslint.configs.recommended,
    eslintPluginPrettier,
    {
        name: 'planitpoker/shared',
        files: ['packages/shared/**/*.ts'],
        languageOptions: {
            globals: { ...globals.node, ...globals.es2022 },
            parserOptions: { tsconfigRootDir: tsconfigRootDir('packages/shared') },
        },
        plugins: {
            perfectionist: eslintPluginPerfectionist,
        },
        rules: sharedRules,
    },
    {
        name: 'planitpoker/server',
        files: ['apps/server/**/*.ts'],
        languageOptions: {
            globals: { ...globals.node, ...globals.es2022 },
            parserOptions: { tsconfigRootDir: tsconfigRootDir('apps/server') },
        },
        plugins: {
            perfectionist: eslintPluginPerfectionist,
            vitest: eslintPluginVitest,
        },
        rules: { ...sharedRules, ...vitestRules },
    },
    {
        name: 'planitpoker/client',
        files: ['apps/client/**/*.{ts,tsx}'],
        languageOptions: {
            globals: { ...globals.browser, ...globals.es2020 },
            parserOptions: { tsconfigRootDir: tsconfigRootDir('apps/client') },
        },
        plugins: {
            ...eslintReact.configs['recommended-typescript'].plugins,
            perfectionist: eslintPluginPerfectionist,
            'react-hooks': eslintPluginReactHooks,
            vitest: eslintPluginVitest,
        },
        rules: {
            ...eslintReact.configs['recommended-typescript'].rules,
            ...eslintPluginReactHooks.configs.recommended.rules,
            ...sharedRules,
            ...vitestRules,
        },
    },
    {
        name: 'planitpoker/e2e',
        files: ['apps/e2e/**/*.ts'],
        languageOptions: {
            globals: { ...globals.node },
            parserOptions: { tsconfigRootDir: tsconfigRootDir('apps/e2e') },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
    {
        // Final override: the @eslint-react preset re-enables `no-explicit-any`
        // through its own plugin instance, so re-assert the project policy last.
        name: 'planitpoker/overrides',
        files: ['**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
        },
    }
);
