module.exports = {
    root: true,
    env: { node: true, es2022: true },
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'perfectionist', 'vitest', 'prettier'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ],
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
};
