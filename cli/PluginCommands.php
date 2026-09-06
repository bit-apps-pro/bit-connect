<?php

namespace BitApps\BitConnect\CLI;

use BitApps\BitConnect\Config;
use WP_CLI;

// require_once( ABSPATH . 'wp-admin/includes/plugin.php' );
include_once ABSPATH . 'wp-admin/includes/plugin.php';
class PluginCommands
{
    public const PRO_PLUGIN_INDEX = Config::PRO_PLUGIN_SLUG . '/' . Config::PRO_PLUGIN_SLUG . '.php';

    public const DEV = 'DEV';

    public const PRO_PLUGIN = 'PRO_PLUGIN';

    public function enablePro()
    {
        $sourceDirectory = realpath(__DIR__ . DIRECTORY_SEPARATOR . '../pro');

        $destinationDirectory = WP_PLUGIN_DIR . DIRECTORY_SEPARATOR . Config::PRO_PLUGIN_SLUG;

        if (!file_exists($sourceDirectory)) {
            WP_CLI::error('Source directory not found!');
        }

        if (!file_exists($destinationDirectory)) {
            $this->createSymlink($sourceDirectory, $destinationDirectory);
        }

        $isActivated = shell_exec('wp plugin activate ' . Config::PRO_PLUGIN_SLUG);

        if (!$isActivated) {
            WP_CLI::error('Plugin activate error!');
        }

        WP_CLI::success('The pro plugin is now active !');
    }

    public function disablePro()
    {
        $proPluginDir = WP_PLUGIN_DIR . DIRECTORY_SEPARATOR . Config::PRO_PLUGIN_SLUG;

        if (file_exists($proPluginDir) && is_plugin_active(self::PRO_PLUGIN_INDEX)) {
            $isDeactivated = shell_exec('wp plugin deactivate ' . Config::PRO_PLUGIN_SLUG);

            if (!$isDeactivated) {
                WP_CLI::error('Plugin deactivate error!');
            } else {
                WP_CLI::success('The pro plugin is now deactivated !');
            }
        } else {
            WP_CLI::warning('The pro plugin is not found or the plugin is not active!');
        }
    }

    public function toggleDev($_, $assocArgs)
    {
        if (!isset($assocArgs['active'])) {
            WP_CLI::error('missing parameter use wp bit-pi use toggleDev --active=y|n');

            return;
        }

        $flag = strtolower($assocArgs['active']) === 'y' ? true : false;

        self::writeEnvFlag(self::DEV, $flag);

        WP_CLI::success(\sprintf('The %s constant is %s.', self::DEV, $flag ? 'Enable' : 'Disable'));
    }

    public function createSymlink($source, $destination)
    {
        $isLinuxOS = strtoupper(substr(PHP_OS, 0, 3)) === 'LIN';
        if ($isLinuxOS) {
            $symlinkStatus = symlink($source, $destination);
            if (!$symlinkStatus) {
                WP_CLI::error('Symlink creation error!' . $symlinkStatus);
            }
        } else {
            shell_exec("cd bin && run-command-as-admin.bat node ../scripts/create-symlink.js {$source} {$destination}");
        }
    }

    /**
     * Flip a flag in the repository's .env.
     *
     * Lives here rather than on Dotenv because Dotenv ships inside the plugin
     * and this does not belong in a distributed build: it writes to the plugin
     * directory with file_put_contents rather than through WP_Filesystem, and
     * calls WP_CLI, a class that only exists under the CLI. The shipped Dotenv
     * reads .env and nothing else.
     *
     * @param string $key  the constant to set
     * @param bool   $flag the value to write
     *
     * @return false|int bytes written
     */
    private static function writeEnvFlag($key, $flag)
    {
        $envFilePath = realpath(__DIR__ . DIRECTORY_SEPARATOR . '../.env');

        if ($envFilePath === false) {
            WP_CLI::error('No .env file found in the plugin directory.');

            return false;
        }

        $lines = file($envFilePath, FILE_IGNORE_NEW_LINES);

        $value = $flag ? 'true' : 'false';

        $pattern = "/^{$key}\\s*=\\s*(.*)/m";

        $envKeyValue = "{$key} = {$value}";

        $found = false;

        foreach ($lines as &$line) {
            if (preg_match($pattern, $line)) {
                $line = $envKeyValue;
                $found = true;

                break;
            }
        }

        unset($line);

        if (!$found) {
            $lines[] = $envKeyValue;
        }

        $isContentUpdated = file_put_contents($envFilePath, implode("\n", $lines));

        if ($isContentUpdated === false) {
            WP_CLI::error(\sprintf('Error writing to %s!', $envFilePath));
        }

        return $isContentUpdated;
    }
}
