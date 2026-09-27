import slugify from '@common/helpers/slugify'

import { type Product, type ProductFormData, type ProductFormValues } from './types'

/** The form's flat fields → the REST body, icons nested under term meta. */
export function toProductBody(values: ProductFormValues): ProductFormData {
  return {
    description: values.description,
    meta: {
      bit_connect_icon_dark_id: values.icon_dark_id || 0,
      bit_connect_icon_dark_url: values.icon_dark_url,
      bit_connect_icon_id: values.icon_id || 0,
      bit_connect_icon_url: values.icon_url
    },
    name: values.name,
    ...(values.slug ? { slug: slugify(values.slug) } : {})
  }
}

/** A stored product → the form's flat fields. */
export function toProductFormValues(product: Product): ProductFormValues {
  return {
    description: product.description,
    icon_dark_id: product.meta?.bit_connect_icon_dark_id || 0,
    icon_dark_url: product.meta?.bit_connect_icon_dark_url,
    icon_id: product.meta?.bit_connect_icon_id || 0,
    icon_url: product.meta?.bit_connect_icon_url,
    name: product.name,
    slug: product.slug
  }
}
