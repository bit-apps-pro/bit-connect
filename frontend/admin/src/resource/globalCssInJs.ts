import { type Interpolation, type Theme } from '@emotion/react'
import twColors from 'tailwindcss/colors'

const globalCssInJs = ({ token }: Theme, isDark: boolean) =>
  ({
    '.ant-input-affix-wrapper-focused:has(.ant-input), .ant-select-focused .ant-select-selector': {
      borderColor: `${token.colorPrimary}!important`,
      boxShadow: `none !important`,
      outline: `2px solid ${token.colorPrimary} !important`,
      transition: 'box-shadow 0s, outline .2s cubic-bezier(0.18, 0.89, 0.32, 1.28) !important'
    },
    '.ant-input-borderless': {
      border: `1px solid transparent !important`
    },
    '.ant-input:not(:has(~ .ant-input-suffix))': {
      '&:focus': {
        borderColor: `${token.colorPrimary}!important`,
        boxShadow: `none !important`,
        outline: `2px solid ${token.colorPrimary} !important`
      },
      '&:hover': {
        borderColor: `${token.colorPrimary}!important`
      },
      transition: 'box-shadow 0s, outline .2s cubic-bezier(0.18, 0.89, 0.32, 1.28) !important'
    },
    '.ant-popover code': {
      backgroundColor: token.colorBgTextActive,
      border: `1px solid ${token.colorBorder}`,
      borderRadius: '4px',
      fontSize: '.75rem',
      margin: '0 2px',
      padding: '.1875rem .25rem'
    },
    '.flow-draggable-item': {
      backgroundColor: token.colorBgContainer,
      border: `1px solid ${token.colorBorder}`,
      borderRadius: token.borderRadius
    },
    '.flow-draggable-item-dragging': {
      boxShadow: token.boxShadowSecondary,
      cursor: 'grabbing !important',
      zIndex: '99999 !important'
    },
    '.mi-array-between': {
      borderRadius: '0 !important'
    },
    '.mi-common-variable': {
      backgroundColor: isDark ? twColors.blue[900] : twColors.blue[200],
      borderColor: isDark ? twColors.blue[700] : twColors.blue[300]
    },
    '.mi-func-end, .mi-array-end': {
      borderRadius: '0 7px 7px 0 !important'
    },
    '.mi-func-start, .mi-array-start': {
      borderRadius: '7px 0 0 7px !important'
    },
    '.mi-func-start, .mi-array-start, .mi-func-end, .mi-array-end': {
      backgroundColor: isDark ? twColors.slate[800] : twColors.slate[100],
      borderColor: isDark ? twColors.slate[700] : twColors.slate[300]
    },
    '.mi-highlight-func': {
      outline: `2px solid ${token['cyan-4']}`
    },
    '.mi-highlight-func-2': {
      outline: `2px solid ${token['blue-4']}`
    },
    '.mi-highlight-func-error': {
      backgroundColor: token['red-1'],
      outline: `2px solid ${token['red-3']}`
    },
    '.mi-paragraph': { fontSize: '14px', lineHeight: '1.9 !important', margin: '0', minHeight: '27px' },
    '.mix-input p.is-editor-empty:not(:has([data-type=tag]:first-of-type)):before': {
      color: token.colorTextPlaceholder,
      content: 'attr(data-placeholder)',
      float: 'left',
      height: '0',
      pointerEvents: 'none'
    },
    '.mix-tag': {
      // backgroundColor: '#f3f3f3',
      borderRadius: '7px',
      borderStyle: 'solid',
      borderWidth: '1px',
      cursor: 'pointer',
      fontWeight: '600 !important',
      marginInline: '3px',
      padding: '2px 3px',
      whiteSpace: 'nowrap'
    },

    // mix input styles
    '.mix-tag-input': {
      '&:focus': {
        border: `1px solid ${token.colorPrimary}`,
        outline: `2px solid ${token.colorPrimary}`
      },
      '&:hover': { border: `1px solid ${token.colorPrimaryBorderHover}` },
      '&.mix-tag-input-error': {
        borderColor: token.colorError,
        outlineColor: token.colorError
      },
      backgroundColor: token.colorBgContainer,
      border: `1px solid ${token.colorBorder}`,
      borderRadius: '10px',
      display: 'block',
      fontSize: '1rem',
      minHeight: '27px',
      outline: '2px solid transparent',
      padding: '0.11rem 0.3125rem',
      transition: 'outline-color 0.2s ease-in-out'
    }
  }) as Interpolation<Theme>
export default globalCssInJs
