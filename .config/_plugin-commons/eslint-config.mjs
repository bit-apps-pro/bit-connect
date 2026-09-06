import { fixupPluginRules } from '@eslint/compat'
import { default as eslint } from '@eslint/js'
import stylisticTs from '@stylistic/eslint-plugin-ts'
import i18next from 'eslint-plugin-i18next'
import importPlugin from 'eslint-plugin-import'
import jsxA11Y from 'eslint-plugin-jsx-a11y'
import perfectionist from 'eslint-plugin-perfectionist'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import promise from 'eslint-plugin-promise'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import unusedImports from 'eslint-plugin-unused-imports'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import translateObjProp from './obj-prop-translate.mjs'

export default defineConfig(
  {
    ignores: [
      '**/*.gen.ts',
      '**/vite.config.ts',
      '**/commitlint.config.js',
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
      '**/coverage/**',
      '**/eslint-config.mjs'
    ]
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  perfectionist.configs['recommended-natural'],
  i18next.configs['flat/recommended'],
  jsxA11Y.flatConfigs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      import: fixupPluginRules(importPlugin),
      jsxA11Y,
      promise,
      react,
      'react-hooks': fixupPluginRules(reactHooks),
      'react-refresh': reactRefresh,
      stylisticTs,
      'translate-obj-prop': {
        rules: {
          'translate-obj-prop': translateObjProp['translate-obj-prop']
        }
      },
      unicorn: eslintPluginUnicorn,
      'unused-imports': unusedImports
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...eslintPluginUnicorn.configs['flat/recommended'].rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/indent': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-use-before-define': ['error', { classes: false, functions: false }],
      '@typescript-eslint/semi': 'off',
      allowImplicit: 'off',
      'array-callback-return': 'off',
      'arrow-parens': 0,
      camelcase: ['error', { properties: 'never' }],
      'consistent-return': 'off',
      'i18next/no-literal-string': [
        'warn',
        {
          callees: {
            exclude: [
              '__',
              'i18n(ext)?',
              't',
              'require',
              'addEventListener',
              'removeEventListener',
              'postMessage',
              'getElementById',
              'dispatch',
              'commit',
              'includes',
              'indexOf',
              'endsWith',
              'startsWith'
            ]
          },
          'jsx-attributes': {
            include: [
              'title',
              'aria-label',
              'okText',
              'cancelText',
              'placeholder',
              'description',
              'label',
              'helperText',
              'invalidMessage'
            ],
            'object-properties': {
              include: ['label', 'description', 'helperText', 'invalidMessage', 'title']
            }
          },
          mode: 'jsx-only'
        }
      ],
      'import/consistent-type-specifier-style': ['error', 'prefer-inline'],
      'import/extensions': 'off',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/no-empty-named-blocks': 'error',
      'import/no-extraneous-dependencies': 'error',
      'import/no-import-module-exports': 'error',
      'import/no-relative-packages': 'error',
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
      indent: 'off',
      'linebreak-style': ['error', 'unix'],
      'max-len': ['error', { code: 350 }],
      'newline-per-chained-call': ['error', { ignoreChainWithDepth: 4 }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-param-reassign': [
        'error',
        { ignorePropertyModificationsForRegex: ['^draft', '^prev', '^prv', 'acc'], props: true }
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['_bitapps-plugin-commons'],
              message:
                'Use `@plugin-commons/*` instead, make sure plugin commons are synced and up to date.'
            },
            {
              group: ['@wordpress/i18n'],
              message: 'use `@common/helpers/i18nWrap` instead.'
            },
            {
              group: ['react-icons/*', '!react-icons/lu'],
              message:
                'This project only use Lucide icon, different icons library are restricted unless missing icon. Use `react-icons/lu` instead. icons list `https://react-icons.github.io/react-icons/icons/lu/`'
            }
          ]
        }
      ],
      'translate-obj-prop/translate-obj-prop': ['warn'],

      'object-curly-newline': [
        'error',
        {
          ExportDeclaration: { consistent: true },
          ImportDeclaration: { consistent: true },
          ObjectExpression: { consistent: true },
          ObjectPattern: { consistent: true }
        }
      ],

      'perfectionist/sort-modules': ['error', { partitionByComment: true, partitionByNewLine: true }],
      'perfectionist/sort-objects': ['error', { partitionByComment: true, partitionByNewLine: true }],

      'react-hooks/exhaustive-deps': 'warn',
      'react/destructuring-assignment': 0,
      'react/jsx-filename-extension': [1, { extensions: ['.js', '.jsx', '.ts', '.tsx'] }],
      'react/jsx-uses-react': 'off',
      'react/no-unescaped-entities': [
        'error',
        {
          forbid: [
            { alternatives: ['&gt;'], char: '>' },
            { alternatives: ['&lt;'], char: '<' }
          ]
        }
      ],
      'react/no-unknown-property': ['error', { ignore: ['css'] }],
      'react/prop-types': 0,
      'react/react-in-jsx-scope': 'off',
      'react/require-default-props': [0, { functions: 'ignore' }],
      'template-curly-spacing': 'off',
      'unicorn/explicit-length-check': 'off',
      'unicorn/filename-case': [
        'error',
        { cases: { camelCase: true, kebabCase: true, pascalCase: true } }
      ],
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-global-this': 'off',
      'unicorn/prefer-switch': ['error', { minimumCases: 6 }],

      'unicorn/prevent-abbreviations': [
        'error',
        {
          replacements: {
            arg: false,
            args: false,
            arr: false,
            btn: false,
            db: false,
            doc: false,
            docs: false,
            e: false,
            elm: false,
            err: false,
            func: false,
            i: false,
            idx: false,
            msg: false,
            num: false,
            obj: false,
            param: false,
            params: false,
            prev: false,
            prop: false,
            props: false,
            prv: false,
            ref: false,
            req: false,
            res: false,
            str: false,
            tmp: false,
            val: false,
            var: false,
            vars: false
          }
        }
      ],

      'unused-imports/no-unused-imports': 'error',

      'unused-imports/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          vars: 'all',
          varsIgnorePattern: '^_'
        }
      ]
    },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true, project: ['./tsconfig.json'] } },
      react: { version: 'detect' }
    }
  },
  eslintConfigPrettier
)
