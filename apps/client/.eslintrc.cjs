module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    settings: {
        react: {
            version: 'detect',
        },
    },
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'react', 'react-hooks', 'perfectionist', 'vitest', 'prettier'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
        'plugin:prettier/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    rules: {
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
};
