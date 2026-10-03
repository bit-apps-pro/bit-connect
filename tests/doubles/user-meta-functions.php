<?php

/**
 * delete_metadata() over the same $GLOBALS['__wp_user_meta'] store the
 * bootstrap's get/update/delete_user_meta() use. User meta only, and only the
 * $delete_all form the uninstaller calls.
 */
if (!function_exists('delete_metadata')) {
    function delete_metadata($metaType, $objectId, $metaKey, $metaValue = '', $deleteAll = false)
    {
        if ($metaType !== 'user') {
            return false;
        }

        foreach (array_keys($GLOBALS['__wp_user_meta'] ?? []) as $userId) {
            if ($deleteAll || (int) $userId === (int) $objectId) {
                unset($GLOBALS['__wp_user_meta'][$userId][$metaKey]);
            }
        }

        return true;
    }
}
