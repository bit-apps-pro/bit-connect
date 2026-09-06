## Pro Separation Guide

### How to Separate Free and Pro code.

To separate free and pro code, you need to separate the code into two different files. For example, you can create a file called `Feature.tsx` and `Feature.pro.tsx` and then import the both files in the main file. When calling the feature, you can check if the user is a pro user or not.

**Which flag to dispatch on.** There are two, and they answer different questions:

- `isPro()` (`@plugin-commons/utils/isPro`) — a **build-time** literal: is this the
  pro bundle? Vite replaces `import.meta.env.VITE_PRO` with `"false"` in the free
  build, so Rollup folds the branch away and drops the `.pro` module entirely.
- `IS_PRO_ACTIVE` (`@common/helpers/pro-access`) — `isPro() && config.IS_PRO`, so it
  also asks whether the **license is valid at runtime**.

**Prefer `IS_PRO_ACTIVE`.** It still folds to `false` in the free build (the bundle
flag is the left half of the `&&`), so you keep the dead-code elimination *and* a pro
build with an expired license correctly falls back to the free UI. Use bare `isPro()`
only where a runtime license check would be wrong.

The parent file should contain **only** the dispatch — no other markup — so that
nothing else is dragged into the free bundle with it.

#### ✅ (Do's) Example for, `.tsx` file:

```tsx
import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import FeatureFree from './Feature.free'
import FeaturePro from './Feature.pro'

export default function Feature(props: FeatureProps) {
  return IS_PRO_ACTIVE ? <FeaturePro {...props} /> : <FeatureFree {...props} />
}
```

Verify the split actually took effect — this is the test that matters:

```bash
pnpm build:admin && pnpm build:admin:pro
# a string unique to a .pro file must be absent from assets/ and present in pro/assets/
grep -rl "some pro-only string" assets/      # → no match
grep -rl "some pro-only string" pro/assets/  # → matches
```

#### ✅ (Do's) Example for, `.ts` file:

```ts
import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import { utilFunctionFree } from './utils.free'
import { utilFunctionPro } from './utils.pro'

const yourFunction = () => {
  const result = IS_PRO_ACTIVE ? utilFunctionPro() : utilFunctionFree()
  ...
}
```

For **hooks**, select the implementation at module scope rather than calling one
conditionally — the choice is constant for the life of the bundle, so the call site
stays a single unconditional hook call and the rules of hooks still hold:

```ts
const useFeature: () => FeatureApi = IS_PRO_ACTIVE ? useFeaturePro : useFeatureFree
export default useFeature
```

See `frontend/admin/src/pages/manager/data/use-badges-admin.ts` for a worked example.

---

Avoid pro checking in the same file. Instead, create a separate file for pro code and import it in the main file.

#### ❌ (Don't) Example for, `.tsx` file:

```tsx
export const YourComponent = () => {
  const isPro = isPro()

  return (
    <div>
      {isPro ? (
        <div>
          <ul>
            <li>list item 1</li>
            <li>list item 2</li>
            <li>list item 4</li>
            ...
          </ul>
        </div>
      ) : (
        <div>
          <ul>
            <li>free list item 1</li>
            <li>free list item 2</li>
            <li>free list item 3</li>
            ...
          </ul>
        </div>
      )}
    </div>
  )
}
```

✔️ In the above example, the pro checking is done in the same file. Instead, create a separate file for pro code and import it in the main file. Please avoid this and follow the do's example.

#### ❌ (Don't) Example for, `.ts` file:

```ts
export const yourFunction = arr => {
  const isPro = isPro()

  const result = false

  if (isPro) {
    result = arr.map(item => item * 2)
    // pro code
  } else {
    result = arr.map(item => item * 3)
    // free code
  }
}
```

✔️ In the above example, the pro checking is done in the same file and function (yourFunction). Instead, create a separate file for pro code and import it in the main file. Please avoid this and follow the do's example.
