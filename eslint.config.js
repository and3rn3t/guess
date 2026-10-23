// Extends the shared @and3rn3t/eslint-config with guess-specific rules and
// file contexts (Workers, Node scripts, shadcn/ui).
import and3rn3t from '@and3rn3t/eslint-config'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  ...and3rn3t,
  { ignores: ['coverage/'] },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      // React Compiler rules from react-hooks v7 — disabled until codebase is updated
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      ...jsxA11y.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Cloudflare Workers — no React rules, service-worker globals
    files: ['functions/**/*.ts', 'tail-worker/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Node.js scripts — run via tsx in Node, not in the browser
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // shadcn/ui auto-generated components — exempt from a11y and fast-refresh rules
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'jsx-a11y/anchor-has-content': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/no-autofocus': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
]
