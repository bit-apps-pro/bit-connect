/* eslint-disable translate-obj-prop/translate-obj-prop */

export default {
  'translate-obj-prop': {
    create(context) {
      const translatableObjKeys = new Set([
        'addConnectionHelpingText',
        'cancelText',
        'description',
        'helperText',
        'label',
        'okText',
        'placeholder',
        'title'
      ])
      return {
        Property(node) {
          // Check if the property is "label"
          if (
            node.key &&
            translatableObjKeys.has(node.key.name) &&
            node.value.type === 'Literal' &&
            typeof node.value.value === 'string'
          ) {
            // Report a warning if `label` is not translated
            context.report({
              fix(fixer) {
                // Replace the value with a translation function call
                const fixedValue = `__('${node.value.value.replaceAll("'", String.raw`\'`)}')`
                return fixer.replaceText(node.value, fixedValue)
              },
              message: 'property should be wrapped in a translation function.',
              node
            })
          }
        }
      }
    },
    meta: {
      docs: {
        description: 'Ensure that the translatable property is wrapped in a translation function.'
      },
      fixable: 'code', // Indicates that this rule has an auto-fix
      schema: [], // No options needed
      type: 'suggestion' // Indicates this rule is a suggestion
    }
  }
}
