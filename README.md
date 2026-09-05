# Bit Connect

A community forum for WordPress. Your users open topics for feature requests,
bug reports and feedback; everyone else upvotes and comments; and you move each
topic through the stages of your roadmap so people can see what you are actually
building.

This repository holds the complete source of the **free** plugin — the one
published on WordPress.org. Everything the plugin ships is built from what is
here, and the sections below are enough to build it yourself.

- Plugin page: <https://bitapps.pro/bit-connect>
- License: GPL-2.0-or-later (see [LICENSE](LICENSE))

## Building the plugin

The compiled JavaScript and CSS under `assets/` are **not committed** — they are
generated. To produce them:

```bash
git clone https://github.com/Bit-Apps-Pro/bit-connect.git
cd bit-connect
composer install
pnpm install
pnpm build:free
```

That writes `assets/` (WordPress admin panel) and `assets/client/` (the public
portal). At that point the directory *is* the plugin: copy it into
`wp-content/plugins/bit-connect` and activate it.

Requirements: **PHP ≥ 8.2**, **Node ≥ 20**, **pnpm ≥ 9**, and Composer 2. No
private registry, credential or submodule is involved — a plain `git clone` is
enough, and no `.env` is needed to build.

### An installable zip

To get the file you would upload under **Plugins → Add New → Upload Plugin**:

```bash
pnpm prod:free-zip
```

That builds the frontend, resolves PHP dependencies with `--no-dev`, stages the
shipped files, strips development artefacts, and writes
`build/bit-connect-<version>.zip`. The version comes from the `Version:` header
in [bit-connect.php](bit-connect.php). Your working tree is left as it was —
development dependencies are reinstalled once the staging copy has been taken.

### How the build is wired

| Piece | Where |
| --- | --- |
| Admin panel entry and config | [vite.config.mts](vite.config.mts), [frontend/admin/](frontend/admin/) |
| Portal entry and config | [vite.config.client.mts](vite.config.client.mts), [frontend/client/](frontend/client/) |
| Portal server-side render | [backend/app/SSR/](backend/app/SSR/) — rendered by PHP per request, not prebuilt |
| PHP plugin | [bit-connect.php](bit-connect.php), [backend/](backend/) |

The frontend is React + TypeScript, bundled by [Vite](https://vitejs.dev), with
Ant Design and Tailwind (namespaced with a prefix so it cannot collide with a
theme). PHP dependencies are re-namespaced at install time by
[Imposter](https://github.com/TypistTech/imposter-plugin) under
`BitApps\BitConnect\Deps\`, so two plugins bundling the same library never
fight.

## Developing

```bash
pnpm dev            # admin + portal dev servers
pnpm test           # Vitest
pnpm ts-check       # TypeScript
pnpm lint           # ESLint (writes fixes)
pnpm test:e2e       # Playwright, against DEV_DOMAIN
composer test       # PHPUnit (needs tests.config.php — see the setup guide)
composer analyze    # PHPStan
composer lint       # php-cs-fixer + PHPCS (writes fixes)
```

To work on the plugin, clone it into the plugins directory of any WordPress
install you can run locally:

```bash
cd wp-content/plugins
git clone https://github.com/Bit-Apps-Pro/bit-connect.git
cd bit-connect
composer install && pnpm install
pnpm build:free      # once, so the plugin has assets to activate with
```

Activate **Bit Connect** in wp-admin, then run `pnpm dev`. It starts two Vite
servers — the admin panel on `:3000` and the portal on `:3001` — and writes a
`.port` file. That file is how PHP knows to load the dev servers instead of the
built files, so both hot-reload while you edit. Stopping `pnpm dev` removes it
and the plugin goes back to serving `assets/`; if a crash ever leaves `.port`
behind, delete it by hand.

`cp .env.example .env` if you need to change where the dev servers bind, serve
them over HTTPS, or point the end-to-end tests at your site. Every value in it
is optional.

[docs/project-setup-instruction.md](docs/project-setup-instruction.md) walks
through the whole setup, including wp-cli.

## About the Pro add-on

Some features are provided by **Bit Connect Pro**, a separate add-on plugin that
is not hosted on WordPress.org and whose source is not in this repository.
Everything in the free plugin works without it.

You will see a few `*.pro.tsx` placeholder modules in the admin source. They
exist so the import graph resolves: each free screen dispatches on
`IS_PRO_ACTIVE`, which is a compile-time `false` in this build, so the bundler
removes the placeholder and its branch entirely. Nothing in `assets/` comes from
them — they carry no implementation to begin with.

## Contributing

Issues and pull requests are welcome here. Development happens in a private
monorepo that holds both the free plugin and the add-on, so accepted changes are
applied there and land back in this repository with the next release; the commit
history here is one publication per released version rather than a running log.
