# Bit Connect Setup Guide

How to get Bit Connect running on a local WordPress install, from a fresh clone
to a hot-reloading dev server. [README.md](../README.md) is the short version;
this is the whole path, including wp-cli and the test suites.

## Table of Contents

1. [Requirements](#requirements)
2. [Install WordPress](#install-wordpress)
   - [Enable debugging](#enable-debugging)
   - [Clone the repository](#clone-the-repository)
3. [Install dependencies](#install-dependencies)
4. [Build the assets](#build-the-assets)
5. [Activate the plugin](#activate-the-plugin)
6. [Run the dev servers](#run-the-dev-servers)
7. [Environment file](#environment-file)
8. [Tests and checks](#tests-and-checks)
9. [Packaging a release](#packaging-a-release)

## Requirements

- **PHP** ≥ 8.2
- **Node** ≥ 20 and **pnpm** ≥ 9
- **Composer** 2
- A local **WordPress** ≥ 6.8

Nothing else: no private registry, credential or submodule is involved.

## Install WordPress

1. Create a database for the install.
2. Download and install [WordPress](https://wordpress.org/download/) locally.

### Enable debugging

In `wp-config.php`:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('SAVEQUERIES', false);
define('SCRIPT_DEBUG', false);
define('WP_DEBUG_DISPLAY', false);
@ini_set('display_errors', 0);
```

### Clone the repository

Clone into the plugins directory of that install, under the plugin slug — the
directory name has to be `bit-connect`:

```bash
cd wp-content/plugins
git clone https://github.com/Bit-Apps-Pro/bit-connect.git
cd bit-connect
```

## Install dependencies

```bash
composer install   # PHP; also re-namespaces the vendor tree with Imposter
pnpm install       # Node
```

`composer install` runs [Imposter](https://github.com/TypistTech/imposter-plugin)
on the way out, which re-namespaces the installed PHP dependencies under
`BitApps\BitConnect\Deps\` so two plugins bundling the same library never fight.

## Build the assets

`assets/` is generated and not committed, so the plugin has nothing to load
until you build it once:

```bash
pnpm build:free
```

That is three steps — `build:admin`, `build:client`, `build:ssr` — and writes:

| Output | What it is |
| --- | --- |
| `assets/` | the wp-admin panel bundle |
| `assets/client/` | the public portal bundle |
| `assets/client/ssr/` | the portal's server-rendered HTML and `routes.json` |

## Activate the plugin

Either activate **Bit Connect** from wp-admin → Plugins, or:

```bash
wp plugin activate bit-connect
```

If you do not have [wp-cli](https://wp-cli.org/#installing) installed, install
it and check it with `wp --info`; `composer install` also pulls in a copy at
`vendor/wp-cli/wp-cli/bin/wp`, which is what the `composer connect` shortcut
runs.

The plugin also ships dev-only wp-cli commands in [cli/](../cli/) —
`wp bit-connect db` and `wp bit-connect use`. They are registered only when the
environment variable `bit_connect_CLI_ACTIVE` is set (see
`Config::getEnv('CLI_ACTIVE')`), so they stay out of the way on a normal
install.

## Run the dev servers

```bash
pnpm dev          # admin + portal, both with hot reload
pnpm dev:admin    # just the wp-admin panel
pnpm dev:client   # just the portal
```

With the plugin active and a dev server running, the plugin serves Vite instead
of the built files, so both apps hot-reload while you edit.

## Environment file

```bash
cp .env.example .env
```

Every value in it is optional — the build and the dev servers work without a
`.env` at all. Set one when you need to point the end-to-end tests at your site
(`DEV_DOMAIN`), serve the dev servers over HTTPS, or bind them to a hostname
other than `localhost`.

For the PHPUnit suite, copy the sample test config as well and edit the database
credentials in it:

```bash
cp tests.config.sample.php tests.config.php
```

> **Warning:** the PHPUnit suite **drops every table** with the configured
> prefix. Point `DB_NAME` at a throwaway database, never at your dev site's.

## Tests and checks

```bash
pnpm test         # Vitest — admin and portal
pnpm ts-check     # TypeScript, all three projects
pnpm lint         # ESLint (writes fixes)
pnpm lint:css     # Stylelint (writes fixes)
pnpm test:e2e     # Playwright, against DEV_DOMAIN

composer test     # PHPUnit — needs tests.config.php
composer analyze  # PHPStan
composer lint     # php-cs-fixer + PHPCS (writes fixes)
composer compat   # PHP 8.2+ compatibility sniff
composer rector   # Rector, dry run
```

## Packaging a release

```bash
pnpm prod:free-zip
```

Builds, stages the plugin in `build/bit-connect/`, prunes the dev-only files
([scripts/prune-build.mjs](../scripts/prune-build.mjs)) and leaves an
installable `build/bit-connect-<version>.zip` — the artefact that ships to
WordPress.org. Only `assets/`, `backend/`, `languages/`, `vendor/`,
`bit-connect.php`, `composer.json` and `readme.txt` go into it; the tooling,
tests, `cli/` and `docs/` stay in the repository.
