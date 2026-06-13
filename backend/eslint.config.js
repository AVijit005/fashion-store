const eslintPluginTypescript = require('@typescript-eslint/eslint-plugin');
const parserTypescript = require('@typescript-eslint/parser');
const prettierPlugin = require('eslint-plugin-prettier/recommended');

module.exports = [
  {
    ignores: ['dist', 'node_modules', 'prisma', '.eslintrc.js', 'eslint.config.js', 'test/**/*.ts'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: parserTypescript,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': eslintPluginTypescript,
    },
    rules: {
      ...eslintPluginTypescript.configs.recommended.rules,
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  prettierPlugin,
];
