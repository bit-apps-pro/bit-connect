<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}


/**
 * Enum for Taxonomies.
 */
enum Taxonomies: string
{
    case TOPIC_TYPES = 'bit-connect-topic-types';
    case DEPARTMENTS = 'bit-connect-departments';
    case STAGES = 'bit-connect-stages';
    case STATUSES = 'bit-connect-statuses';
    case TAGS = 'bit-connect-tags';
}
