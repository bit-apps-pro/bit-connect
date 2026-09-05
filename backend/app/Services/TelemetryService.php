<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Enum\Taxonomies;
use WP_Error;
use WP_Post;
use WP_Role;
use WP_Roles;

/**
 * What the diagnostic report is allowed to say, and when it may say anything.
 *
 * The vendored `bitapps/wp-telemetry` package decides both for itself, and gets
 * both wrong for a plugin published on WordPress.org:
 *
 *   1. `trackingOptOut()` posts to the reporting server — so declining to be
 *      tracked was itself reported. Data left the site at the moment consent
 *      was refused, which is the one moment it must not.
 *   2. The report carried the site's `admin_email`, the administrator's first
 *      and last name, and the server's public IP — the last fetched by calling
 *      out to `icanhazip.com`, a third service nothing disclosed. None of that
 *      is anonymous, and none of it tells us anything about how the forum is
 *      used.
 *
 * `vendor/` is not committed, so neither can be fixed by editing the package —
 * `composer install` would put it straight back. This service is the plugin's
 * own gate in front of it, built from the two hooks the package does expose:
 * `pre_http_request`, to stop a request that should never be made, and the
 * `bit_connect_telemetry_data` filter, to decide what the payload actually is.
 * Both should also be fixed upstream in wp-telemetry; until they are, this is
 * what makes the shipped plugin match what readme.txt promises.
 *
 * The replacement payload is shaped like the plugin rather than like a
 * WordPress install: how the forum is placed, how people get into it, how much
 * is in it, and which features are switched on. Every field is a count, a
 * boolean or a setting value the administrator chose. Nothing identifies a
 * person, a topic or a site beyond the URL the package sends as its own key.
 */
final class TelemetryService
{
    /**
     * Host of the IP-echo service the vendored package calls.
     */
    private const IP_LOOKUP_HOST = 'icanhazip.com';

    /**
     * Fields the vendored package collects that this plugin will not send.
     */
    private const STRIPPED_FIELDS = [
        'admin_email',
        'first_name',
        'last_name',
        'ip_address',
    ];

    /**
     * Raised while a code path that builds a telemetry report is running, so
     * the outbound IP lookup can be refused without touching any other
     * plugin's HTTP traffic.
     */
    private static bool $reporting = false;

    public static function register(): void
    {
        Hooks::addFilter('pre_http_request', [self::class, 'refuseUndisclosedRequests'], 10, 3);
        Hooks::addFilter(Config::withPrefix('telemetry_data'), [self::class, 'reshapeReport']);

        // Every route into the package's getTrackingData(), marked before its
        // own handler runs. admin_init is where the opt-in link in the notice
        // is handled (the package hooks it at the default priority); the other
        // two are the weekly cron and activation.
        Hooks::addAction('admin_init', [self::class, 'beginReporting'], 5);
        Hooks::addAction(Config::withPrefix('send_tracking_event'), [self::class, 'beginReporting'], 5);
        Hooks::addAction(Config::withPrefix('activate'), [self::class, 'beginReporting'], 5);
    }

    /**
     * Mark this request as one that may build a report.
     */
    public static function beginReporting(): void
    {
        self::$reporting = true;
    }

    /**
     * Refuse two outbound requests before they are made.
     *
     * The IP lookup is refused outright: the report no longer carries an IP, so
     * there is nothing to look one up for. It is matched by host and only while
     * a report is being built, so an unrelated plugin asking the same service
     * is left alone.
     *
     * A post to the reporting server is refused whenever tracking is not
     * allowed. That is what stops the opt-out beacon, and it holds for any
     * other unconsented send the package might add later — the rule is "no
     * consent, no request", not "block this one call".
     *
     * @param array|false|WP_Error $preempt short-circuit value; false lets the request proceed
     * @param array                $_args   request arguments, unused — this decides on the URL alone
     * @param string               $url     request URL
     *
     * @return array|false|WP_Error
     */
    public static function refuseUndisclosedRequests($preempt, $_args, $url) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        // Somebody earlier in the filter chain already answered.
        if ($preempt !== false) {
            return $preempt;
        }

        if (!\is_string($url) || $url === '') {
            return $preempt;
        }

        $host = (string) wp_parse_url($url, PHP_URL_HOST);

        if (self::$reporting && self::hostMatches($host, self::IP_LOOKUP_HOST)) {
            return new WP_Error(
                'bit_connect_ip_lookup_refused',
                'Bit Connect does not report IP addresses.'
            );
        }

        if (!self::isReportingEndpoint($url) || self::isTrackingAllowed()) {
            return $preempt;
        }

        // Answer as a delivered request rather than an error: the package does
        // not check the result, and a WP_Error here would surface in any HTTP
        // debugging as a failure the administrator cannot act on.
        return [
            'headers'  => [],
            'body'     => '',
            'response' => ['code' => 204, 'message' => 'No Content'],
            'cookies'  => [],
            'filename' => null,
        ];
    }

    /**
     * Replace the package's payload with one that describes the forum.
     *
     * @param mixed $data the package's assembled report
     *
     * @return array<string, mixed>
     */
    public static function reshapeReport($data): array
    {
        $data = \is_array($data) ? $data : [];

        foreach (self::STRIPPED_FIELDS as $field) {
            unset($data[$field]);
        }

        $data['forum'] = self::forumProfile();

        return $data;
    }

    /**
     * The forum, described in aggregate.
     *
     * Cached for a day. The report is sent weekly at most, so this is computed
     * far less often than it is asked for — but `telemetry_data` is a public
     * filter and nothing stops something else firing it on a page load.
     *
     * @return array<string, mixed>
     */
    public static function forumProfile(): array
    {
        $cacheKey = Config::VAR_PREFIX . 'telemetry_profile';
        $cached = get_transient($cacheKey);

        if (\is_array($cached)) {
            return $cached;
        }

        $notifications = Config::getOption(NotificationSettings::OPTION_NAME->value, []);
        $notifications = NotificationSettings::normalize($notifications);

        $profile = [
            'schema'        => 2,
            'placement'     => self::placement(),
            'access'        => PortalAccess::isPublic() ? 'everyone' : 'logged_in',
            'auth'          => self::authProfile(),
            'content'       => self::contentCounts(),
            'taxonomy'      => self::taxonomyCounts(),
            'roles'         => self::roleCounts(),
            'notifications' => array_merge(
                [
                    'enabled'           => NotificationSettings::isEnabled($notifications),
                    'default_frequency' => NotificationSettings::defaultFrequency($notifications),
                    'retention_days'    => NotificationSettings::retentionDays($notifications),
                ],
                self::notificationChannelCounts($notifications)
            ),
            'seo' => [
                'server_rendering' => SeoSettings::bool('serverRendering'),
                'meta_owner'       => SeoSettings::metaOwner(),
                'index_profiles'   => SeoSettings::bool('indexProfiles'),
            ],
            'edition' => [
                'pro_installed' => Config::isProInstalled(),
                'pro_licensed'  => Config::isProActivated(),
            ],
        ];

        set_transient($cacheKey, $profile, DAY_IN_SECONDS);

        return $profile;
    }

    /**
     * Forget the cached profile — called when the plugin's own settings change.
     */
    public static function forgetProfile(): void
    {
        delete_transient(Config::VAR_PREFIX . 'telemetry_profile');
    }

    /**
     * Where the portal is served from.
     */
    private static function placement(): string
    {
        if (PortalLocation::isRoot()) {
            return 'site_root';
        }

        return PortalLocation::page() instanceof WP_Post ? 'page' : 'unconfigured';
    }

    /**
     * How people get in. Modes and switches only — no URLs, which on a custom
     * login page would name a path on the administrator's own site.
     *
     * @return array<string, mixed>
     */
    private static function authProfile(): array
    {
        return [
            'mode'               => AuthService::getMode(),
            'registration_open'  => AuthService::canRegister(),
            'email_verification' => AuthService::requiresEmailVerification(),
        ];
    }

    /**
     * How much is in the forum.
     *
     * @return array<string, int>
     */
    private static function contentCounts(): array
    {
        $counts = (array) wp_count_posts(PostTypes::BIT_CONNECT->value);

        $published = (int) ($counts['publish'] ?? 0);
        $private = (int) ($counts['private'] ?? 0);

        return [
            'topics'         => $published + $private,
            'private_topics' => $private,
            'comments'       => self::commentCount(),
            'votes'          => self::tableCount('votes'),
            'follows'        => self::tableCount('follows'),
            'reports'        => self::tableCount('reports'),
        ];
    }

    /**
     * Approved comments on forum topics.
     */
    private static function commentCount(): int
    {
        $count = get_comments(
            [
                'count'     => true,
                'status'    => 'approve',
                'post_type' => PostTypes::BIT_CONNECT->value,
            ]
        );

        return (int) $count;
    }

    /**
     * Row count for one of the plugin's own tables.
     *
     * Returns 0 rather than failing when the table is not there: a site part
     * way through its migrations should still be able to send a report.
     */
    private static function tableCount(string $table): int
    {
        $name = Connection::wpPrefix() . Config::VAR_PREFIX . $table;

        $exists = Connection::get_var(Connection::prepare('SHOW TABLES LIKE %s', $name));

        if ($exists !== $name) {
            return 0;
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery -- the table name is built from the install prefix and a literal; no caller input reaches it, and the existence check above is what makes it a real table.
        return (int) Connection::get_var("SELECT COUNT(*) FROM `{$name}`");
    }

    /**
     * How the forum is organised — the size of each vocabulary, never the terms
     * themselves, which are frequently the names of unreleased work.
     *
     * @return array<string, int>
     */
    private static function taxonomyCounts(): array
    {
        $counts = [];

        foreach (Taxonomies::cases() as $taxonomy) {
            $total = wp_count_terms(
                [
                    'taxonomy'   => $taxonomy->value,
                    'hide_empty' => false,
                ]
            );

            // Strip the plugin's own prefix so the key reads as the concept:
            // "bit-connect-topic-types" becomes "topic_types".
            $key = str_replace('-', '_', (string) preg_replace('/^bit-connect-/', '', $taxonomy->value));

            $counts[$key] = is_wp_error($total) ? 0 : (int) $total;
        }

        return $counts;
    }

    /**
     * How many roles hold forum capabilities, and how many can moderate.
     *
     * Counts only. Role *names* are frequently custom and site-specific, and a
     * list of them describes the customer's organisation rather than their use
     * of the forum.
     *
     * @return array<string, int>
     */
    private static function roleCounts(): array
    {
        $roles = wp_roles();

        if (!$roles instanceof WP_Roles) {
            return ['participating' => 0, 'moderating' => 0];
        }

        $capabilities = Capabilities::values();
        $participating = 0;
        $moderating = 0;

        // Walked through get_names()/get_role() rather than the $roles array
        // property: the property is the same shape in core but not something a
        // role-editor plugin is obliged to keep populated, and these two are
        // the documented way in.
        foreach (array_keys($roles->get_names()) as $slug) {
            $role = get_role($slug);

            if (!$role instanceof WP_Role) {
                continue;
            }

            $granted = array_keys(array_filter((array) $role->capabilities));

            if (array_intersect($granted, $capabilities) === []) {
                continue;
            }

            ++$participating;

            if (\in_array(Capabilities::MODERATE->value, $granted, true)) {
                ++$moderating;
            }
        }

        return [
            'participating' => $participating,
            'moderating'    => $moderating,
        ];
    }

    /**
     * How many notification types are delivered on each channel, and how many
     * leave the choice to the member.
     *
     * Counted per channel rather than as one "types enabled" figure because a
     * type is not on or off — it has an in-app default and an email default,
     * and the interesting question is which of the two forums actually use.
     *
     * @param array<string, mixed> $settings
     *
     * @return array<string, int>
     */
    private static function notificationChannelCounts(array $settings): array
    {
        $counts = ['types_total' => 0, 'types_inapp' => 0, 'types_email' => 0, 'types_member_choice' => 0];

        foreach (NotificationTypes::cases() as $type) {
            $row = NotificationSettings::forType($settings, $type);

            ++$counts['types_total'];

            if (!empty($row['inapp'])) {
                ++$counts['types_inapp'];
            }

            if (!empty($row['email'])) {
                ++$counts['types_email'];
            }

            if (!empty($row['userMayOverride'])) {
                ++$counts['types_member_choice'];
            }
        }

        return $counts;
    }

    /**
     * Whether the administrator has opted in, read the same way the vendored
     * package reads it.
     */
    private static function isTrackingAllowed(): bool
    {
        return (bool) get_option(Config::VAR_PREFIX . 'allow_tracking');
    }

    /**
     * Whether a URL addresses the Bit Apps reporting server.
     */
    private static function isReportingEndpoint(string $url): bool
    {
        $base = Config::TELEMETRY_SERVER_URL;

        return str_starts_with($url, $base);
    }

    /**
     * Host comparison that also matches a subdomain of the named host.
     */
    private static function hostMatches(string $host, string $needle): bool
    {
        $host = strtolower($host);

        return $host === $needle || str_ends_with($host, '.' . $needle);
    }
}
