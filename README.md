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
portal, including its server-rendered entry). At that point the directory *is*
the plugin: copy it into `wp-content/plugins/bit-connect` and activate it, or
run `pnpm prod:free-zip` to get an installable zip in `build/`.

Requirements: **PHP ≥ 8.2**, **Node ≥ 20**, **pnpm**, and Composer. No private
registry, credential or submodule is involved — a plain `git clone` is enough.

### How the build is wired

| Piece | Where |
| --- | --- |
| Admin panel entry and config | [vite.config.mts](vite.config.mts), [frontend/admin/](frontend/admin/) |
| Portal entry and config | [vite.config.client.mts](vite.config.client.mts), [frontend/client/](frontend/client/) |
| Portal server-side render | [vite.config.client.ssr.mts](vite.config.client.ssr.mts), [bin/prerender.js](bin/prerender.js) |
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
pnpm lint           # ESLint
composer test       # PHPUnit
composer analyze    # PHPStan
composer lint       # php-cs-fixer + PHPCS
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

Activate **Bit Connect** in wp-admin, then run `pnpm dev`. In development the
plugin serves the Vite dev servers instead of the built files, so the admin
panel and the portal both hot-reload while you edit.

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
