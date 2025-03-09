module.exports = {
  root: true,
  env: { browser: false, es2020: true, "jest": true },
  extends: [
    'eslint:recommended',
    'airbnb',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', '**.test.js'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  rules: {
    'func-names': 'off',
    'prefer-arrow-callback': 'warn',
    'no-unused-vars': [
        'error',
        {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
        },
    ],
    'no-undef': 'error',
    "import/extensions": ["error", "never", {  ignorePackages: true , pattern: { "js": "always", } }],
  }
}