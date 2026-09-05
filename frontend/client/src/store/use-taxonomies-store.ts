import { type TaxonomiesResponse } from '@features/topic-modal/data/use-taxonomies'
import { create } from 'zustand'

interface TaxonomiesState {
  actions: {
    setTaxonomies: (taxonomies: TaxonomiesResponse | undefined) => void
  }
  taxonomies: TaxonomiesResponse | undefined
}

const useTaxonomiesStore = create<TaxonomiesState>(set => ({
  actions: {
    setTaxonomies: taxonomies => set({ taxonomies })
  },
  taxonomies: undefined
}))

export const useTaxonomiesStoreSelect = () => useTaxonomiesStore(state => state.taxonomies)
export const useTaxonomiesStoreActions = () => useTaxonomiesStore(state => state.actions)
