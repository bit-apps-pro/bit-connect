<?php

namespace BitApps\BitConnect\Model;

// Prevent direct script access
if (!defined('ABSPATH')) {
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
class Post extends Model
{
    public $timestamps = false;

    public $casts = ['details' => 'object'];

    protected $prefix = '';

    protected $fillable = [
        'user_id',
        'command',
        'details',
        'created_at',
    ];

    public function user()
    {
        return $this->hasOne(User::class, 'ID', 'user_id');
    }
}
