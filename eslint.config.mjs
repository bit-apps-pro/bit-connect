import base from './.config/_plugin-commons/eslint-config.mjs'

export default [
  ...base,
  {
    // The `.pro` modules in this tree are stubs: the real implementations live
    // in the add-on, and each stub only has to accept the props contract and
    // render nothing. That shape is unused props and a literal `null` by
    // design, so the two rules that object to it are relaxed for stubs only.
    files: ['frontend/**/*.pro.ts', 'frontend/**/*.pro.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'unicorn/no-null': 'off'
    }
  }
]
