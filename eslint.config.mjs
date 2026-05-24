import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import nextPlugin from '@next/eslint-plugin-next'
import tseslint from 'typescript-eslint'

/**
 * Flat ESLint config for spawn-crm (Next.js 16 + React 19 + TypeScript).
 *
 * Estructura:
 *   1. ignores globales
 *   2. base JS rules
 *   3. reglas type-aware aplicadas SOLO a .ts/.tsx
 *   4. reglas no-type-aware para archivos JS (configs, scripts)
 *
 * Reglas estrictas pedidas en el roadmap del CRM:
 *   - no-floating-promises  (atrapa `.then(setX)` sin .catch)
 *   - no-explicit-any
 *   - react-hooks/exhaustive-deps
 *   - no-restricted-syntax que bloquea `parseFloat(String(...))`
 *     (usar `parseNumeric` de `@/lib/utils`)
 */
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'next-env.d.ts',
      'drizzle/**',
      'supabase/migrations/**',
      'scripts/**',
    ],
  },

  js.configs.recommended,

  // ── TypeScript con type info (solo .ts/.tsx) ───────────────────
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    rules: {
      // Next.js
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // React Hooks
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',

      // Reglas estrictas del roadmap
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',

      // Bloquear `parseFloat(String(...))` — usar parseNumeric()
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='parseFloat'][arguments.0.type='CallExpression'][arguments.0.callee.name='String']",
          message:
            'No uses parseFloat(String(...)). Importá `parseNumeric` desde `@/lib/utils` — maneja null/NaN y separadores AR/US.',
        },
      ],

      // Sensible defaults
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // ── JS files (next.config.mjs, postcss.config, etc.) ───────────
  // Desactiva reglas type-aware que requerirían tsconfig.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
)
