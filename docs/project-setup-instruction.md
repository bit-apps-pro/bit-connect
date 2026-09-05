# Bit Flow Setup Guide

This guide will walk you through the process of setup the Bit Flow project.

## Table of Contents

1. [Installation](#installation)
   - [Install Wordpress](#install-wordpress)
   - [Enable Debugging](#enable-debugging)
   - [Clone the repository](#clone-the-repository)
2. [Setup Environments](#setup-environments)
   - [project env](##setup-project-env-file)
   - [test env](#setup-test-env-file)
3. [Install Dependencies](#install-dependencies)
4. [Install wp-cli](#install-wp-cli)
   - [Install wp-cli](#install-wp-cli)
   - [Verify wp-cli installation](#verify-wp-cli-installation)
5. [Activate the Plugin](#activate-the-plugin)
6. [Run the Project](#run-the-project)

## Installation

### Install Wordpress

1. Create a new database for your WordPress installation.
2. Download and Install [WordPress](https://wordpress.org/download/) on your local machine or server.

### Enable Debugging

1. Open the `wp-config.php` file in the root directory of your WordPress installation.
2. Add the following lines to enable debugging:

```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('SAVEQUERIES', false);
define('SCRIPT_DEBUG', false);
define('WP_DEBUG_DISPLAY', false);
@ini_set('display_errors', 0);
```

### Clone the repository

1. Open your terminal or command prompt.
2. Navigate to the wordpress `plugin` directory and clone the repository.

```bash
# You should clone the repo using SSH
git clone git@github.com:Bit-Apps-Pro/bit-pi.git
```

## Setup Environments

### Setup Project Env File

1. Copy the `.env.example` file to `.env` in the root directory of the project.

```bash
cp .env.example .env
```

### Setup Test Env File

1. Copy the `tests.config.sample.php` file to `tests.config.php` in the root directory of the project.

```bash
cp tests.config.sample.php tests.config.php
```

2. Open the `tests.config.php` file and update the domain to match your local WordPress installation. at the bottom of the file, you will find the following line:

```php
# replace your_domain.test with your local domain
define('WP_TESTS_DOMAIN', 'your_domain.test');
```

## Install Dependencies

1. Navigate to the cloned repository directory or open the Bit Flow to your code editor.
2. Run the following command to install the necessary dependencies:

```bash
# Install Node.js dependencies
pnpm install
```

```bash
# Install PHP dependencies for both plugins.
# `pro/` is a separate Composer root with its own vendor tree and Imposter
# prefix, so it has to be installed separately from the free plugin.
composer install && composer pro:install
```

```bash
# Install submodules
pnpm sm:add && pnpm plugin:commons:sync
```

## Install wp-cli

1. Install [wp-cli](https://wp-cli.org/#installing) if you haven't already. You can follow the instructions on the official website to install it.
2. After installing, you can verify the installation by running:

```bash
wp --info
```

## Activate the Plugin

1. Run the following command to activate the plugin:

```bash
wp plugin activate bit-pi
```

2. Run the following command to activate the pro plugin:

```bash
composer pro:enable
```

## Run the Project

1. Run the following command to start the development server:

```bash
pnpm dev:pro
```
