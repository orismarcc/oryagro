import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// Marca como "usados" os identificadores que só aparecem no JSX (<motion.div>,
// <Icon />). Substitui o eslint-plugin-react (jsx-uses-vars), que trazia uma
// dependência vulnerável (minimatch 3 / brace-expansion).
const jsxUsaVars = {
  rules: {
    'jsx-uses-vars': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        return {
          JSXOpeningElement(node) {
            let alvo = node.name;
            while (alvo.type === 'JSXMemberExpression') alvo = alvo.object;
            if (alvo.type === 'JSXIdentifier') context.sourceCode.markVariableAsUsed(alvo.name, node);
          },
        };
      },
    },
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { local: jsxUsaVars },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // jsx-uses-vars: marca identificadores usados em JSX (ex: <motion.div>) como
      // "usados" — sem isto, no-unused-vars dava falso-positivo em motion, ícones, etc.
      'local/jsx-uses-vars': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
