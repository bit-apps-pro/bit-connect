/**
 * What the public free-source repository is, expressed as data.
 *
 * `publish-free-source.mjs` builds the mirror from this; `assert-no-pro.mjs`
 * audits the result against it. One list, so the generator and the gate cannot
 * drift apart and quietly agree to publish something they should not.
 */

/** Directories and files that never reach the public repository. */
export const STRIPPED_PATHS = [
  // The pro plugin: PHP, its own vendor tree, the licensing logic.
  'pro',

  // Internal working notes. Several describe pro packaging.
  'AGENTS.md',
  'CLAUDE.md',
  'FORUM-AUDIT.md',
  '.claude',
  '.vscode',
  'docs-local',

  // The local Docker environment. It is scaffolding for developing *this*
  // checkout — Traefik hostnames, a seeded WordPress, Adminer, Mailpit — and
  // none of it is needed to read, build or run the plugin. `docs/dnsmasq.conf`
  // goes with it: it exists only to resolve the Traefik hostnames.
  '.docker',
  '.dockerignore',
  'docker-compose.yml.example',
  'docs/dnsmasq.conf',

  // Used by `pnpm plugin:commons:sync` and a vitest glob, never by the build.
  // Dropping it means an outside clone needs no `--recurse-submodules`.
  '.gitmodules',
  '_bitapps-plugin-commons'
]

/**
 * The `.pro` modules the free tree carries as stubs.
 *
 * These paths hold a placeholder — the right filename, a `return null` body, no
 * implementation. The add-on's real modules live at the mirrored paths under
 * `pro/frontend`, and `vite-plugin-pro-overlay` resolves to those instead when
 * `BIT_PRO_OVERLAY_DIR` is set. Nothing is substituted at publish time.
 *
 * They cannot simply be deleted from the free tree: Vite resolves every import
 * before it tree-shakes, and the dispatch siblings import them by name. Since
 * `IS_PRO_ACTIVE` is a compile-time `false` in the free build, Rollup drops the
 * stub and the emitted bundle is the same as if nothing were there.
 *
 * The list is what the audit checks against: every `.pro` file in the published
 * tree must appear here and must carry the stub marker.
 */
export const STUBBED_MODULES = [
  'frontend/admin/src/pages/manager/data/use-badges-admin.pro.ts',
  'frontend/admin/src/pages/manager/ui/badges-column-header.pro.tsx',
  'frontend/admin/src/pages/manager/ui/capability-popover.pro.tsx',
  'frontend/admin/src/pages/manager/ui/profile-badges-modal.pro.tsx',
  'frontend/admin/src/pages/manager/ui/user-badges-popover.pro.tsx',
  'frontend/admin/src/pages/notifications/internal/email-delivery-section.pro.tsx',
  'frontend/admin/src/pages/notifications/internal/email-wording-section.pro.tsx',
  'frontend/admin/src/pages/settings/internal/moderation-section.pro.tsx',
  'frontend/admin/src/pages/support/internal/version-panel.pro.tsx'
]

/**
 * Data hooks that call pro-only REST endpoints.
 *
 * Imported by `.pro` modules and nothing else, so they moved wholesale into
 * `pro/frontend` and no stub is needed: the overlay modules that use them are
 * their only callers, and there they resolve as ordinary siblings.
 *
 * They are still listed because the audit asserts their *absence* from the
 * published tree — the day one is added back under `frontend/`, that is a leak,
 * and this is what catches it. Gate 4 also lifts its marker strings from them.
 */
export const PRO_ONLY_MODULES = [
  // The commons licence closure. Not Bit Connect pro code, but licence machinery
  // all the same, and `scripts/route-commons-pro.mjs` moves the whole of it into
  // the overlay on every commons sync. Nothing free imports any of it — the two
  // commons components that did are pruned by the same script — so none of it
  // needs a stub, and this list is what asserts it stayed gone.
  'frontend/_plugin-commons/components/License.pro.tsx',
  'frontend/_plugin-commons/components/LicenseActivationNotice.pro.tsx',
  'frontend/_plugin-commons/components/LicenseInvalidAlert.pro.tsx',
  'frontend/_plugin-commons/components/SupportPage/CheckNewUpdate.tsx',
  'frontend/_plugin-commons/components/SupportPage/data/useCheckLicenseValidity.tsx',
  'frontend/_plugin-commons/components/SupportPage/data/useCheckUpdate.tsx',

  'frontend/admin/src/pages/manager/data/use-delete-profile-badge.ts',
  'frontend/admin/src/pages/manager/data/use-profile-badges.ts',
  'frontend/admin/src/pages/manager/data/use-reorder-profile-badges.ts',
  'frontend/admin/src/pages/manager/data/use-save-profile-badge.ts',
  'frontend/admin/src/pages/manager/data/use-update-user-badges.ts'
]

/**
 * `.pro`-suffixed files that are published deliberately.
 *
 * Empty, and kept as the place to record an exception if one is ever justified.
 *
 * It used to hold the three commons licence components, on the reasoning that
 * `frontend/_plugin-commons` is a verbatim copy of a public submodule which
 * `pnpm plugin:commons:sync` empties and re-writes, so a local edit could not
 * survive the next sync. That is no longer true: `scripts/route-commons-pro.mjs`
 * runs as part of the sync and moves the licence closure into the overlay, so
 * its source never reaches the public repository at all. It is listed in
 * `PRO_ONLY_MODULES` now, and gate 5 of `assert-no-pro.mjs` stays as the second
 * line of defence over the built bundle.
 */
export const PUBLISHED_PRO_SUFFIXED = []

/**
 * The only PHP files in the free plugin allowed to name the pro namespace.
 *
 * Both do it through `class_exists`, which is how free detects the add-on. Any
 * other occurrence means pro code reached the mirror.
 */
export const PRO_NAMESPACE_ALLOWLIST = ['backend/app/Config.php', 'backend/hooks/api.php']

/** `package.json` scripts that only make sense in the monorepo. */
export const DROPPED_PACKAGE_SCRIPTS = [
  'build:admin:pro',
  'build:client:pro',
  'build:pro',
  'dev:admin:pro',
  'dev:client:pro',
  'dev:docker',
  'dev:docker:pro',
  'dev:pro',
  'exp:bun-dev',
  'plugin:commons:cp',
  'plugin:commons:sync',
  'prod',
  'prod:pro',
  'prod:pro-zip',
  'prod:zip',
  'sm:add',
  'sm:clear-cache',
  'sm:pull',
  // Type-checks the pro overlay against the free tree. Meaningless without the
  // overlay, and pro/frontend/tsconfig.json goes with `pro/`.
  'ts-check:pro',

  // Translation-template maintenance. `bitapps-plugin-i18n` shells out to
  // `react-gettext-parser`, which is a transitive dependency of
  // `bitapps-dev-utils` and so is not on PATH after a clean install — the step
  // fails on any fresh clone, this repository included. The `.pot` files it
  // would regenerate are committed and maintained upstream, so an outside build
  // has no reason to run it and every reason not to trip over it.
  'i18n',
  'translate',
  'translate:all'
]

/** `package.json` scripts rewritten to their free-only form. */
export const REWRITTEN_PACKAGE_SCRIPTS = {
  build: 'pnpm build:free',
  // Not dropped, despite building both editions here: `bitapps-plugin-build`
  // shells out to `pnpm run build:silent` by name, so removing it breaks
  // `prod:free-zip` from inside the packaging tool.
  'build:silent': 'pnpm build:free',
  // `_bitapps-plugin-commons` is stripped from the mirror, so linting it there
  // fails on a path that does not exist.
  lint: 'eslint frontend --fix',
  // `--noi18n` for the reason above: the templates ship with the source.
  'prod:free-zip':
    "pnpm bitapps-plugin-build --slug 'bit-connect' --outdir build --noi18n && " +
    'node ./scripts/prune-build.mjs --slug bit-connect --outdir build && ' +
    'cd build && zip -rq bit-connect.zip bit-connect && cd .. && ' +
    'node ./scripts/rename-build-zip.mjs --slug bit-connect --outdir build',
  production: 'composer install --no-dev && pnpm install && pnpm build:free'
}

/** `composer.json` scripts that only make sense in the monorepo. */
export const DROPPED_COMPOSER_SCRIPTS = ['pro:install', 'pro:install:prod']
