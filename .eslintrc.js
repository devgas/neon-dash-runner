module.exports = {
    extends: ['next/core-web-vitals', 'prettier'],
    parser: '@typescript-eslint/parser',
    plugins: ['prettier'],
    rules: {
        'prettier/prettier': 'error',
        '@typescript-eslint/no-unused-vars': [
            'warn',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            },
        ],
    },
}
