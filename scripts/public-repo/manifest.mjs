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
 * Pro frontend modules, each replaced by the stub of the same path under
 * `pro-stubs/`.
 *
 * They cannot simply be deleted: Vite resolves every import before it
 * tree-shakes, the dispatch siblings import them by name, and four `.free`
 * files import their props types from them. The stub keeps the type surface and
 * drops the implementation; `IS_PRO_ACTIVE` is a compile-time `false` in the
 * free build, so Rollup removes the stub exactly as it removes the real module
 * today, and the emitted bundle is unchanged.
 */
export const STUBBED_MODULES = [
  'frontend/admin/src/pages/manager/data/use-badges-admin.pro.ts',
  'frontend/admin/src/pages/manager/ui/badges-column-header.pro.tsx',
  'frontend/admin/src/pages/manager/ui/capability-popover.pro.tsx',
  'frontend/admin/src/pages/manager/ui/profile-badges-modal.pro.tsx',
  'frontend/admin/src/pages/manager/ui/user-badges-popover.pro.tsx',
  'frontend/admin/src/pages/notifications/internal/email-delivery-section.pro.tsx',
  'frontend/admin/src/pages/notifications/internal/email-wording-section.pro.tsx',
  'frontend/admin/src/pages/settings/internal/moderation-section.pro.tsx'
]

/**
 * Data hooks that call pro-only REST endpoints.
 *
 * Verified to be imported by `.pro` modules and nothing else, so they delete
 * outright — no stub, no dangling import. `assert-no-pro.mjs` re-checks that
 * claim against the staged tree rather than trusting this comment.
 */
export const PRO_ONLY_MODULES = [
  'frontend/admin/src/pages/manager/data/use-delete-profile-badge.ts',
  'frontend/admin/src/pages/manager/data/use-profile-badges.ts',
  'frontend/admin/src/pages/manager/data/use-reorder-profile-badges.ts',
  'frontend/admin/src/pages/manager/data/use-save-profile-badge.ts',
  'frontend/admin/src/pages/manager/data/use-update-user-badges.ts'
]

/**
 * `.pro`-suffixed files that are published deliberately.
 *
 * These are shared Bit Apps commons, not Bit Connect pro code: they already
 * live in the public `Bit-Apps-Pro/_bitapps-plugin-commons` repository, and
 * `SupportPage.tsx` and `AllPluginEssentials.tsx` import them *unconditionally*
 * — so they are compiled into the shipped free `assets/`, and WordPress.org
 * requires the source of everything in that bundle.
 */
export const PUBLISHED_PRO_SUFFIXED = [
  'frontend/_plugin-commons/components/License.pro.tsx',
  'frontend/_plugin-commons/components/LicenseActivationNotice.pro.tsx',
  'frontend/_plugin-commons/components/LicenseInvalidAlert.pro.tsx'
]

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
