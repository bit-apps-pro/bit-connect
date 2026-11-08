<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use RuntimeException;

/**
 * Why CommentService refused a comment, and the HTTP status that says so.
 *
 * The message is the one the portal has always shown, so a route that turns
 * this into a response answers exactly as the comment endpoint did before the
 * write moved out of it.
 */
final class CommentRejected extends RuntimeException
{
    private int $status;

    public function __construct(string $message, int $status)
    {
        parent::__construct($message);
        $this->status = $status;
    }

    public function status(): int
    {
        return $this->status;
    }
}
