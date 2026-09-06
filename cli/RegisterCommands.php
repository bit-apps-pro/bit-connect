<?php

use BitApps\BitConnect\CLI\DatabaseCommands;
use BitApps\BitConnect\CLI\PluginCommands;
use BitApps\BitConnect\Config;

if (defined('WP_CLI') && WP_CLI) {
    WP_CLI::add_command(Config::SLUG . ' db', new DatabaseCommands());
    WP_CLI::add_command(Config::SLUG . ' use', new PluginCommands());
}
