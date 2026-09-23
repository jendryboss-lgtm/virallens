const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['node_modules/', 'supabase/functions/', 'dist/', '.expo/'],
  },
  {
    rules: {
      'import/no-unresolved': 'off',
    },
  },
]);
