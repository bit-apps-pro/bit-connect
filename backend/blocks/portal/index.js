/**
 * The Bit Connect portal block, as the editor sees it.
 *
 * The portal itself is an app that boots on the live page; nothing of it can
 * run inside the editor. What is drawn here is a still picture of it — the
 * header, the sidebar of stages, the toolbar and a list of topics — so the
 * page editor, the inserter and the template picker show what the page will
 * carry instead of a line of shortcode text.
 *
 * Plain script, no build step: it is a handful of elements, and shipping it
 * as written keeps the block out of the app bundles entirely.
 */
;(function (blocks, element, blockEditor, i18n) {
  const { createElement } = element
  const { __ } = i18n

  const BASE = 'bit-connect-portal-preview'

  // Widths are percentages, varied so each group reads as a list of different
  // things rather than a striped box.
  const STAGES = [58, 46, 64, 50]
  const TYPES = [2.4, 6.5, 5.5, 4.8, 5.2]
  const TOPICS = [
    { summary: 88, title: 62, votes: 24 },
    { summary: 74, title: 48, votes: 17 },
    { summary: 81, title: 70, votes: 9 },
    { summary: 66, title: 40, votes: 3 }
  ]

  function box(name, props, ...children) {
    return createElement('span', { className: `${BASE}__${name}`, ...props }, ...children)
  }

  function bar(modifier, width) {
    return box(`bar ${BASE}__bar--${modifier}`, { style: { width: `${width}%` } })
  }

  function stage(width, index) {
    return box(
      index === 0 ? `stage ${BASE}__stage--active` : 'stage',
      { key: index },
      bar(index === 0 ? 'active' : 'label', width)
    )
  }

  function type(width, index) {
    return box(index === 0 ? `type ${BASE}__type--active` : 'type', {
      key: index,
      style: { width: `${width}em` }
    })
  }

  function topic(item, index) {
    return box(
      'topic',
      { key: index },
      box('votes', {}, box('arrow'), String(item.votes)),
      box(
        'text',
        {},
        bar('title', item.title),
        bar('summary', item.summary),
        box('meta', {}, box('chip'), box(`chip ${BASE}__chip--muted`))
      )
    )
  }

  function Edit() {
    return createElement(
      'div',
      blockEditor.useBlockProps({ className: BASE }),
      box(
        'header',
        {},
        box('logo'),
        createElement('strong', { className: `${BASE}__name` }, __('Community', 'bit-connect')),
        box('spacer'),
        box('dot'),
        box('dot')
      ),
      box(
        'body',
        {},
        box(
          'sidebar',
          {},
          bar('heading', 44),
          STAGES.map((width, index) => stage(width, index))
        ),
        box(
          'main',
          {},
          box(
            'toolbar',
            {},
            box('search', {}, __('Search topics…', 'bit-connect')),
            box('button', {}, __('New topic', 'bit-connect'))
          ),
          box(
            'types',
            {},
            TYPES.map((width, index) => type(width, index))
          ),
          box(
            'list',
            {},
            TOPICS.map((item, index) => topic(item, index))
          )
        )
      ),
      createElement(
        'p',
        { className: `${BASE}__note` },
        __('Your Bit Connect community portal appears here on the live page.', 'bit-connect')
      )
    )
  }

  blocks.registerBlockType('bit-connect/portal', {
    edit: Edit,
    // Rendered on the server, by the same code as the shortcode. The block
    // API asks for a literal null here, not undefined.
    // eslint-disable-next-line unicorn/no-null
    save: () => null,
    transforms: {
      from: [
        {
          blocks: ['core/shortcode'],
          // A Shortcode block holding `[bit-connect]` offers "Transform to Bit Connect".
          isMatch: attributes => /^\s*\[bit-connect[\s\]]/.test(attributes.text || ''),
          transform: () => blocks.createBlock('bit-connect/portal'),
          type: 'block'
        }
      ]
    }
  })
})(globalThis.wp.blocks, globalThis.wp.element, globalThis.wp.blockEditor, globalThis.wp.i18n)
