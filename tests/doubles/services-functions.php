<?php

namespace BitApps\BitConnect\Services;

/**
 * Namespaced overrides for PHP built-ins the services call unqualified.
 *
 * PHP resolves an unqualified function call to the current namespace first, so
 * a function defined here shadows the global one for everything under
 * BitApps\BitConnect\Services — and only for that namespace.
 *
 * Each one falls through to the real built-in unless a test opts in, so nothing
 * changes behaviour by being loaded.
 */

/**
 * Treats paths a test registered in $GLOBALS['__php_uploaded_files'] as
 * uploads.
 *
 * Without this the upload validator is untestable: is_uploaded_file() answers
 * true only for a file PHP itself received over multipart/form-data, so every
 * test would stop at the first guard and none of the extension, magic-byte or
 * double-extension rules below it would ever run.
 */
function is_uploaded_file($path)
{
    if (!empty($GLOBALS['__php_uploaded_files'][$path])) {
        return true;
    }

    return \is_uploaded_file($path);
}
