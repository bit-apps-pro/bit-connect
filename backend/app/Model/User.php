<?php

namespace BitApps\BitConnect\Model;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}


use BitApps\BitConnect\Deps\BitApps\WPDatabase\Model;

/**
 * Model for log.
 *
 * @property string $created_at
 * @property string $command
 * @property string $details
 * @property int    $user_id
 */
class User extends Model
{
    public $timestamps = false;

    protected $prefix = '';

    protected $fillable = [];
}
