<?php

define('ABSPATH', __DIR__ . '/');

// Time constants core defines, used in class constants that are evaluated on load.
if (!defined('MINUTE_IN_SECONDS')) {
    define('MINUTE_IN_SECONDS', 60);
}

// Minimal WP_Role stub
if (!class_exists('WP_Role')) {
    class WP_Role
    {
        public string $name;

        public array $capabilities;

        public function __construct(string $name, array $capabilities)
        {
            $this->name         = $name;
            $this->capabilities = $capabilities;
        }

        public function add_cap(string $cap, bool $grant = true): void
        {
            $this->capabilities[$cap] = $grant;
        }

        public function remove_cap(string $cap): void
        {
            unset($this->capabilities[$cap]);
        }
    }
}

// Minimal WP_Roles stub
if (!class_exists('WP_Roles')) {
    class WP_Roles
    {
        private array $roles = [];

        public function setRoles(array $roles): void
        {
            $this->roles = $roles;
        }

        public function get_names(): array
        {
            return array_map(fn ($r) => $r->name, $this->roles);
        }

        public function getRole(string $slug): ?WP_Role
        {
            return $this->roles[$slug] ?? null;
        }
    }
}

$GLOBALS['__wp_roles'] = new WP_Roles();

function wp_roles(): WP_Roles
{
    return $GLOBALS['__wp_roles'];
}

function get_role(string $slug): ?WP_Role
{
    return $GLOBALS['__wp_roles']->getRole($slug);
}

function get_option(string $key, $default = false)
{
    return $GLOBALS['__wp_options'][$key] ?? $default;
}

function update_option(string $key, $value): void
{
    $GLOBALS['__wp_options'][$key] = $value;
}

if (!function_exists('status_header')) {
    function status_header($code): void
    {
        $GLOBALS['__wp_status_header'] = (int) $code;
    }
}

if (!function_exists('nocache_headers')) {
    function nocache_headers(): void
    {
        $GLOBALS['__wp_nocache_headers'] = true;
    }
}

if (!function_exists('get_posts')) {
    /**
     * Minimal stand-in honouring only the filters the plugin queries with.
     *
     * Seed $GLOBALS['__wp_posts'] with WP_Post objects carrying post_name,
     * post_type and post_status.
     *
     * @param array<string, mixed> $args
     *
     * @return array<int, WP_Post>
     */
    function get_posts(array $args = []): array
    {
        $matches = array_values(
            array_filter(
                $GLOBALS['__wp_posts'] ?? [],
                static function ($post) use ($args) {
                    foreach (['name' => 'post_name', 'post_type' => 'post_type', 'post_status' => 'post_status'] as $arg => $field) {
                        if (isset($args[$arg]) && $args[$arg] !== 'any' && ($post->{$field} ?? null) !== $args[$arg]) {
                            return false;
                        }
                    }

                    return true;
                }
            )
        );

        $limit = (int) ($args['posts_per_page'] ?? $args['numberposts'] ?? -1);
        $matches = $limit > 0 ? \array_slice($matches, 0, $limit) : $matches;

        // Callers that ask for ids get ids. Without this the stub handed back
        // WP_Post objects whatever was asked for, so code doing the ordinary
        // `'fields' => 'ids'` and then casting to int could not be tested.
        if (($args['fields'] ?? '') === 'ids') {
            return array_map(static fn ($post) => (int) ($post->ID ?? 0), $matches);
        }

        return $matches;
    }
}

// ---------------------------------------------------------------------------
// i18n / filters
// ---------------------------------------------------------------------------

if (!function_exists('__')) {
    function __($text, $domain = 'default')
    {
        return $text;
    }
}

if (!function_exists('apply_filters')) {
    // Pass-through by default; a test may pre-seed $GLOBALS['__wp_filters'][$tag]
    // with a fixed value to override the filtered result.
    //
    // Keyed on presence rather than on the value being non-null: null is a
    // meaningful answer from several of these filters — it is how a site says
    // "show no badge" — and ?? would have quietly handed back the unfiltered
    // value instead.
    function apply_filters($tag, $value, ...$args)
    {
        if (!\array_key_exists($tag, $GLOBALS['__wp_filters'] ?? [])) {
            return $value;
        }

        $seeded = $GLOBALS['__wp_filters'][$tag];

        // A seeded callable stands in for a real filter callback, for the
        // filters whose answer depends on their arguments — the pro add-on's
        // per-member badge lookup, say, which a single fixed value cannot
        // express. Every other seed is a plain value and is returned as-is.
        return \is_callable($seeded) ? $seeded($value, ...$args) : $seeded;
    }
}

// ---------------------------------------------------------------------------
// Transients (backed by $GLOBALS['__wp_transients'])
// ---------------------------------------------------------------------------

if (!function_exists('get_transient')) {
    function get_transient(string $key)
    {
        return $GLOBALS['__wp_transients'][$key] ?? false;
    }
}

if (!function_exists('set_transient')) {
    function set_transient(string $key, $value, int $ttl = 0): bool
    {
        $GLOBALS['__wp_transients'][$key] = $value;

        return true;
    }
}

if (!function_exists('delete_transient')) {
    function delete_transient(string $key): bool
    {
        unset($GLOBALS['__wp_transients'][$key]);

        return true;
    }
}

// ---------------------------------------------------------------------------
// Capabilities / current user (backed by $GLOBALS)
// ---------------------------------------------------------------------------

if (!function_exists('current_user_can')) {
    function current_user_can(string $capability): bool
    {
        return !empty($GLOBALS['__wp_caps'][$capability]);
    }
}

if (!function_exists('get_current_user_id')) {
    function get_current_user_id(): int
    {
        return (int) ($GLOBALS['__wp_current_user_id'] ?? 0);
    }
}

if (!function_exists('user_can')) {
    /**
     * Per-user capabilities, keyed by id in $GLOBALS['__wp_user_caps'].
     *
     * Deliberately separate from current_user_can()'s store: the notification
     * layer asks about people who are not the one making the request — every
     * moderator, or the recipient of a mention — and a single shared cap map
     * would make "can this member moderate?" answer for whoever happened to be
     * logged in.
     *
     * @param int|WP_User $user
     */
    function user_can($user, string $capability): bool
    {
        $userId = is_object($user) ? (int) $user->ID : (int) $user;

        return !empty($GLOBALS['__wp_user_caps'][$userId][$capability]);
    }
}

if (!function_exists('network_home_url')) {
    function network_home_url($path = '')
    {
        return rtrim($GLOBALS['__wp_home_url'] ?? 'https://example.com', '/') . $path;
    }
}

if (!function_exists('get_post')) {
    function get_post($postId)
    {
        return $GLOBALS['__wp_posts'][$postId] ?? null;
    }
}

if (!function_exists('get_comment')) {
    function get_comment($commentId)
    {
        return $GLOBALS['__wp_comments'][$commentId] ?? null;
    }
}

if (!class_exists('WP_Post')) {
    /**
     * Carries every column wp_posts has, defaulted the way a fresh row is.
     *
     * Declared rather than left to dynamic properties because the plugin reads
     * a post's fields unconditionally when shaping an API response, and an
     * undeclared one raises a notice that PHPUnit turns into a failure — a
     * failure about the stub rather than about the code under test.
     */
    #[\AllowDynamicProperties]
    class WP_Post
    {
        public $ID = 0;

        public $post_author = 0;

        public $post_date = '0000-00-00 00:00:00';

        public $post_date_gmt = '0000-00-00 00:00:00';

        public $post_content = '';

        public $post_title = '';

        public $post_excerpt = '';

        public $post_status = 'publish';

        public $comment_status = 'open';

        public $ping_status = 'open';

        public $post_name = '';

        public $post_modified = '0000-00-00 00:00:00';

        public $post_modified_gmt = '0000-00-00 00:00:00';

        public $post_parent = 0;

        public $guid = '';

        public $menu_order = 0;

        public $post_type = 'post';

        public $post_mime_type = '';

        public $comment_count = 0;
    }
}

if (!class_exists('WP_Comment')) {
    #[\AllowDynamicProperties]
    class WP_Comment
    {
        public $user_id;
    }
}

if (!class_exists('WP_Term')) {
    #[\AllowDynamicProperties]
    class WP_Term
    {
        public $term_id = 0;

        public $name = '';

        public $slug = '';

        public $taxonomy = '';

        public $description = '';
    }
}

if (!function_exists('get_term_by')) {
    /**
     * Resolves against $GLOBALS['__wp_terms'], a list of WP_Term objects.
     * Anything not declared there is absent, which is the state that matters:
     * it is what keeps an unknown archive URL a 404.
     */
    function get_term_by($field, $value, $taxonomy = '')
    {
        foreach ($GLOBALS['__wp_terms'] ?? [] as $term) {
            if ($term->{$field} === $value && ($taxonomy === '' || $term->taxonomy === $taxonomy)) {
                return $term;
            }
        }

        return false;
    }
}

if (!function_exists('translate_user_role')) {
    function translate_user_role(string $name): string
    {
        return $name;
    }
}

if (!function_exists('sanitize_key')) {
    function sanitize_key($key): string
    {
        return strtolower(preg_replace('/[^a-z0-9_\-]/', '', (string) $key));
    }
}

// ---------------------------------------------------------------------------
// Escaping, formatting and head helpers used by the SSR/SEO renderers.
// These mirror WordPress semantics closely enough to assert on the emitted
// markup; they are not a substitute for WordPress itself.
// ---------------------------------------------------------------------------

if (!function_exists('esc_html')) {
    function esc_html($text)
    {
        return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('esc_attr')) {
    function esc_attr($text)
    {
        return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('esc_url')) {
    function esc_url($url)
    {
        $url = trim((string) $url);

        // Mirrors the protocol allow-list: anything not http/https/relative is dropped.
        if ($url !== '' && !preg_match('#^(https?:)?//|^/#i', $url)) {
            return '';
        }

        return htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('esc_html__')) {
    function esc_html__($text, $domain = 'default')
    {
        return esc_html($text);
    }
}

if (!function_exists('_n')) {
    function _n($single, $plural, $number, $domain = 'default')
    {
        return (int) $number === 1 ? $single : $plural;
    }
}

if (!function_exists('number_format_i18n')) {
    function number_format_i18n($number)
    {
        return number_format((float) $number);
    }
}

if (!function_exists('home_url')) {
    function home_url($path = '')
    {
        return rtrim($GLOBALS['__wp_home_url'] ?? 'https://example.com', '/') . $path;
    }
}

if (!function_exists('get_bloginfo')) {
    function get_bloginfo($show = '')
    {
        return $GLOBALS['__wp_bloginfo'][$show] ?? '';
    }
}

if (!function_exists('wp_strip_all_tags')) {
    function wp_strip_all_tags($text, $removeBreaks = false)
    {
        // Real WP removes script/style blocks with their contents before
        // stripping tags — inline CSS must not count as readable text.
        $text = preg_replace('#<(script|style)[^>]*?>.*?</\1>#si', '', (string) $text);

        return trim(strip_tags($text));
    }
}

if (!function_exists('strip_shortcodes')) {
    function strip_shortcodes($content)
    {
        return preg_replace('/\[[^\]]*\]/', '', (string) $content);
    }
}

if (!function_exists('wp_trim_words')) {
    function wp_trim_words($text, $numWords = 55, $more = '…')
    {
        $words = preg_split('/\s+/', trim((string) $text), -1, PREG_SPLIT_NO_EMPTY);

        if (count($words) <= $numWords) {
            return implode(' ', $words);
        }

        return implode(' ', array_slice($words, 0, $numWords)) . $more;
    }
}

if (!function_exists('wpautop')) {
    function wpautop($text, $br = true)
    {
        return '<p>' . (string) $text . '</p>';
    }
}

if (!function_exists('wp_kses_post')) {
    function wp_kses_post($content)
    {
        // Enough of kses to prove that script/handler injection is stripped.
        $content = preg_replace('#<script\b[^>]*>.*?</script>#is', '', (string) $content);

        return preg_replace('/\son\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $content);
    }
}

if (!function_exists('wp_check_invalid_utf8')) {
    function wp_check_invalid_utf8($text, $strip = false)
    {
        return mb_check_encoding((string) $text, 'UTF-8') ? (string) $text : '';
    }
}

if (!function_exists('wp_kses')) {
    /**
     * A passthrough, deliberately.
     *
     * kses is core's, and a half-written copy of it here would let a test claim
     * the sanitizers strip something that only this stub stripped. Passing the
     * content through leaves the plugin's *own* pipeline steps — the size
     * limits, the URL rules, the class allowlist — testable, and leaves anything
     * that is genuinely kses's job untestable rather than falsely proven.
     *
     * @param mixed $content
     * @param mixed $allowed
     */
    function wp_kses($content, $allowed = [])
    {
        return (string) $content;
    }
}

if (!function_exists('date_i18n')) {
    function date_i18n($format, $timestamp = null)
    {
        return gmdate($format, $timestamp ?? time());
    }
}

if (!function_exists('wp_json_encode')) {
    function wp_json_encode($data, $options = 0, $depth = 512)
    {
        return json_encode($data, $options, $depth);
    }
}

if (!function_exists('has_post_thumbnail')) {
    function has_post_thumbnail($post = null)
    {
        return isset($GLOBALS['__wp_thumbnails'][(int) $post]);
    }
}

if (!function_exists('get_the_post_thumbnail_url')) {
    function get_the_post_thumbnail_url($post = null, $size = 'post-thumbnail')
    {
        return $GLOBALS['__wp_thumbnails'][(int) $post] ?? false;
    }
}

if (!function_exists('wp_unslash')) {
    function wp_unslash($value)
    {
        return is_array($value) ? array_map('wp_unslash', $value) : stripslashes((string) $value);
    }
}

if (!function_exists('remove_action')) {
    function remove_action($tag, $callback, $priority = 10): bool
    {
        $GLOBALS['__wp_removed_actions'][$tag][] = $callback;

        return true;
    }
}

if (!function_exists('user_trailingslashit')) {
    /**
     * Models a permalink structure with no trailing slash, which is what the
     * portal URLs in these tests use.
     */
    function user_trailingslashit($string, $typeOfUrl = '')
    {
        return $string;
    }
}

if (!function_exists('get_site_icon_url')) {
    function get_site_icon_url($size = 512, $url = '', $blogId = 0)
    {
        return $GLOBALS['__wp_site_icon'] ?? '';
    }
}

if (!function_exists('add_action')) {
    function add_action($tag, $callback, $priority = 10, $acceptedArgs = 1): void
    {
        $GLOBALS['__wp_actions'][$tag][] = $callback;
    }
}

if (!function_exists('add_filter')) {
    function add_filter($tag, $callback, $priority = 10, $acceptedArgs = 1): void
    {
        $GLOBALS['__wp_filter_callbacks'][$tag][] = $callback;
    }
}

// ---------------------------------------------------------------------------
// Users, user meta and mail.
//
// The plugin keeps no user tables — profile slugs, bios, links, cover images and
// pending email changes all live in user meta — so a working meta store is what
// makes those services testable at all. Backed by $GLOBALS like every other stub
// here; reset it in setUp().
// ---------------------------------------------------------------------------

if (!\defined('DAY_IN_SECONDS')) {
    define('DAY_IN_SECONDS', 86400);
}

if (!class_exists('WP_Error')) {
    class WP_Error
    {
        private $code;

        private $message;

        public function __construct($code = '', $message = '')
        {
            $this->code = $code;
            $this->message = $message;
        }

        public function get_error_code()
        {
            return $this->code;
        }

        public function get_error_message()
        {
            return $this->message;
        }
    }
}

if (!function_exists('is_wp_error')) {
    function is_wp_error($thing)
    {
        return $thing instanceof WP_Error;
    }
}

if (!class_exists('WP_User')) {
    #[\AllowDynamicProperties]
    class WP_User
    {
        public $ID = 0;

        public $display_name = '';

        public $roles = [];

        public $user_email = '';

        public $user_login = '';

        public $user_pass = '';

        public $user_registered = '';

        /**
         * Answers from $GLOBALS['__wp_user_caps'], the same store user_can()
         * reads, so a capability granted for a test is visible however the code
         * under test happens to ask about it.
         */
        public function has_cap($capability)
        {
            return !empty($GLOBALS['__wp_user_caps'][(int) $this->ID][$capability]);
        }
    }
}

if (!function_exists('get_userdata')) {
    function get_userdata($userId)
    {
        return $GLOBALS['__wp_users'][(int) $userId] ?? false;
    }
}

if (!function_exists('wp_update_user')) {
    function wp_update_user($data)
    {
        $userId = (int) ($data['ID'] ?? 0);
        $user = $GLOBALS['__wp_users'][$userId] ?? null;

        if (!$user) {
            return new WP_Error('invalid_user_id', 'Invalid user ID.');
        }

        foreach ($data as $key => $value) {
            if ($key !== 'ID') {
                $user->{$key} = $value;
            }
        }

        // Real WordPress fires this on every profile save, which is exactly the
        // hook ProfileSlugService listens to — tests that skip it would miss the
        // slug/display-name interaction entirely.
        foreach ($GLOBALS['__wp_actions']['profile_update'] ?? [] as $callback) {
            $callback($userId);
        }

        return $userId;
    }
}

if (!function_exists('get_user_meta')) {
    function get_user_meta($userId, $key, $single = false)
    {
        $value = $GLOBALS['__wp_user_meta'][(int) $userId][$key] ?? '';

        return $single ? $value : [$value];
    }
}

if (!function_exists('update_user_meta')) {
    function update_user_meta($userId, $key, $value)
    {
        $GLOBALS['__wp_user_meta'][(int) $userId][$key] = $value;

        return true;
    }
}

if (!function_exists('delete_user_meta')) {
    function delete_user_meta($userId, $key)
    {
        unset($GLOBALS['__wp_user_meta'][(int) $userId][$key]);

        return true;
    }
}

if (!function_exists('get_users')) {
    /**
     * Only the two meta shapes ProfileSlugService::resolve() asks for: an exact
     * match on the current slug, and a LIKE against the serialised alias array.
     */
    function get_users($args = [])
    {
        $key = $args['meta_key'] ?? '';
        $needle = $args['meta_value'] ?? '';
        $isLike = ($args['meta_compare'] ?? '=') === 'LIKE';
        $found = [];

        foreach ($GLOBALS['__wp_user_meta'] ?? [] as $userId => $meta) {
            $stored = $meta[$key] ?? null;

            if ($isLike) {
                if (\is_array($stored) && \in_array(trim((string) $needle, '"'), $stored, true)) {
                    $found[] = $userId;
                }

                continue;
            }

            if ($stored !== null && (string) $stored === (string) $needle) {
                $found[] = $userId;
            }
        }

        return \array_slice($found, 0, (int) ($args['number'] ?? \count($found)));
    }
}

if (!function_exists('sanitize_title')) {
    function sanitize_title($title)
    {
        $slug = strtolower(trim((string) $title));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);

        return trim((string) $slug, '-');
    }
}

if (!function_exists('sanitize_text_field')) {
    function sanitize_text_field($str)
    {
        return trim(strip_tags((string) $str));
    }
}

if (!function_exists('sanitize_textarea_field')) {
    function sanitize_textarea_field($str)
    {
        return trim(strip_tags((string) $str));
    }
}

if (!function_exists('sanitize_email')) {
    function sanitize_email($email)
    {
        return trim((string) $email);
    }
}

if (!function_exists('is_email')) {
    function is_email($email)
    {
        return (bool) filter_var((string) $email, FILTER_VALIDATE_EMAIL);
    }
}

if (!function_exists('email_exists')) {
    function email_exists($email)
    {
        foreach ($GLOBALS['__wp_users'] ?? [] as $userId => $user) {
            if (strtolower((string) $user->user_email) === strtolower((string) $email)) {
                return $userId;
            }
        }

        return false;
    }
}

if (!function_exists('esc_url_raw')) {
    function esc_url_raw($url, $protocols = null)
    {
        $url = trim((string) $url);
        $allowed = $protocols ?: ['http', 'https'];
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        return \in_array($scheme, $allowed, true) ? $url : '';
    }
}

if (!function_exists('wp_generate_password')) {
    function wp_generate_password($length = 12, $specialChars = true, $extraSpecialChars = false)
    {
        // Deterministic in tests; the real one is random, but nothing here
        // asserts on unpredictability.
        return substr(str_repeat('abcdef0123456789', 8), 0, (int) $length);
    }
}

if (!function_exists('wp_check_password')) {
    /**
     * Mirrors the property that matters here: an empty stored hash matches
     * nothing at all, not even an empty password.
     */
    function wp_check_password($password, $hash, $userId = '')
    {
        return $hash !== '' && (string) $hash === 'hashed:' . $password;
    }
}

if (!function_exists('wp_mail')) {
    function wp_mail($to, $subject, $message, $headers = '', $attachments = [])
    {
        $GLOBALS['__wp_mail'][] = compact('to', 'subject', 'message');

        return true;
    }
}

if (!function_exists('wp_parse_url')) {
    function wp_parse_url($url, $component = -1)
    {
        return parse_url((string) $url, $component);
    }
}

if (!function_exists('url_to_postid')) {
    /**
     * Resolves whatever $GLOBALS['__wp_urls_to_postid'] declares, keyed by the
     * path without surrounding slashes. Everything else is a 404, which is the
     * state that matters: it is what lets the portal claim a URL in root mode.
     */
    function url_to_postid($url)
    {
        $path = trim((string) parse_url((string) $url, PHP_URL_PATH), '/');

        return (int) ($GLOBALS['__wp_urls_to_postid'][$path] ?? 0);
    }
}

if (!function_exists('wp_unique_post_slug')) {
    /**
     * Records every call in $GLOBALS['__wp_unique_slug_calls'] and hands back
     * whatever $GLOBALS['__wp_unique_slug_result'] holds, defaulting to the
     * slug unchanged — core's answer for "nothing else has this".
     *
     * Reimplementing core's `-2` suffixing here would only test the
     * reimplementation. What callers are responsible for is asking core the
     * right question, so the stub makes the question observable instead.
     */
    function wp_unique_post_slug($slug, $postId, $postStatus, $postType, $postParent = 0)
    {
        $GLOBALS['__wp_unique_slug_calls'][] = compact('slug', 'postId', 'postStatus', 'postType', 'postParent');

        return $GLOBALS['__wp_unique_slug_result'] ?? $slug;
    }
}

// ---------------------------------------------------------------------------
// Object meta (posts, comments, terms)
//
// One store per object type, keyed by id then meta key, mirroring core's
// separate meta tables. Single reads answer '' for a key that was never
// written, which is what core does and what the services branch on.
// ---------------------------------------------------------------------------

if (!function_exists('get_post_meta')) {
    function get_post_meta($postId, $key = '', $single = false)
    {
        $meta = $GLOBALS['__wp_post_meta'][(int) $postId] ?? [];

        if ($key === '') {
            return $meta;
        }

        $value = $meta[$key] ?? '';

        return $single ? $value : ($value === '' ? [] : [$value]);
    }
}

if (!function_exists('update_post_meta')) {
    function update_post_meta($postId, $key, $value)
    {
        $GLOBALS['__wp_post_meta'][(int) $postId][$key] = $value;

        return true;
    }
}

if (!function_exists('add_post_meta')) {
    function add_post_meta($postId, $key, $value, $unique = false)
    {
        if ($unique && isset($GLOBALS['__wp_post_meta'][(int) $postId][$key])) {
            return false;
        }

        $GLOBALS['__wp_post_meta'][(int) $postId][$key] = $value;

        return true;
    }
}

if (!function_exists('delete_post_meta')) {
    function delete_post_meta($postId, $key, $value = '')
    {
        unset($GLOBALS['__wp_post_meta'][(int) $postId][$key]);

        return true;
    }
}

if (!function_exists('get_comment_meta')) {
    function get_comment_meta($commentId, $key = '', $single = false)
    {
        $meta = $GLOBALS['__wp_comment_meta'][(int) $commentId] ?? [];

        if ($key === '') {
            return $meta;
        }

        $value = $meta[$key] ?? '';

        return $single ? $value : ($value === '' ? [] : [$value]);
    }
}

if (!function_exists('update_comment_meta')) {
    function update_comment_meta($commentId, $key, $value)
    {
        $GLOBALS['__wp_comment_meta'][(int) $commentId][$key] = $value;

        return true;
    }
}

if (!function_exists('delete_comment_meta')) {
    function delete_comment_meta($commentId, $key, $value = '')
    {
        unset($GLOBALS['__wp_comment_meta'][(int) $commentId][$key]);

        return true;
    }
}

if (!function_exists('get_term_meta')) {
    function get_term_meta($termId, $key = '', $single = false)
    {
        $meta = $GLOBALS['__wp_term_meta'][(int) $termId] ?? [];

        if ($key === '') {
            return $meta;
        }

        $value = $meta[$key] ?? '';

        return $single ? $value : ($value === '' ? [] : [$value]);
    }
}

if (!function_exists('update_term_meta')) {
    function update_term_meta($termId, $key, $value)
    {
        $GLOBALS['__wp_term_meta'][(int) $termId][$key] = $value;

        return true;
    }
}

if (!function_exists('delete_term_meta')) {
    function delete_term_meta($termId, $key, $value = '')
    {
        unset($GLOBALS['__wp_term_meta'][(int) $termId][$key]);

        return true;
    }
}

// ---------------------------------------------------------------------------
// Terms
//
// Backed by the same $GLOBALS['__wp_terms'] list get_term_by() reads, so a test
// seeds terms once and every lookup agrees on them.
// ---------------------------------------------------------------------------

if (!function_exists('get_terms')) {
    /**
     * Honours only the arguments the plugin queries with: taxonomy, a
     * meta_key/meta_value pair and number. hide_empty is accepted and ignored —
     * the stub has no counts to hide by.
     *
     * @param array<string, mixed> $args
     *
     * @return array<int, WP_Term>
     */
    function get_terms(array $args = []): array
    {
        $matches = array_values(
            array_filter(
                $GLOBALS['__wp_terms'] ?? [],
                static function ($term) use ($args) {
                    if (isset($args['taxonomy']) && $term->taxonomy !== $args['taxonomy']) {
                        return false;
                    }

                    if (isset($args['meta_key'])) {
                        $meta = $GLOBALS['__wp_term_meta'][(int) $term->term_id][$args['meta_key']] ?? '';

                        if (!isset($args['meta_value'])) {
                            return $meta !== '';
                        }

                        return (string) $meta === (string) $args['meta_value'];
                    }

                    return true;
                }
            )
        );

        $limit = (int) ($args['number'] ?? 0);

        return $limit > 0 ? \array_slice($matches, 0, $limit) : $matches;
    }
}

if (!function_exists('get_term')) {
    function get_term($termId, $taxonomy = '')
    {
        foreach ($GLOBALS['__wp_terms'] ?? [] as $term) {
            if ((int) $term->term_id === (int) $termId) {
                return $term;
            }
        }

        return null;
    }
}

if (!function_exists('wp_insert_term')) {
    /**
     * Appends a term to $GLOBALS['__wp_terms'] with the next free id and
     * answers core's array shape. Records nothing else: what callers are
     * responsible for is the meta they set on the result.
     */
    function wp_insert_term($name, $taxonomy, $args = [])
    {
        $ids = array_map(static fn ($term) => (int) $term->term_id, $GLOBALS['__wp_terms'] ?? []);
        $termId = ($ids === [] ? 0 : max($ids)) + 1;

        $term = new WP_Term();
        $term->term_id = $termId;
        $term->name = (string) $name;
        $term->slug = (string) ($args['slug'] ?? $name);
        $term->taxonomy = (string) $taxonomy;

        $GLOBALS['__wp_terms'][] = $term;

        return ['term_id' => $termId, 'term_taxonomy_id' => $termId];
    }
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

if (!function_exists('current_time')) {
    /**
     * Answers whatever $GLOBALS['__wp_current_time'] holds so a recorded
     * timestamp is assertable, falling back to the real clock.
     */
    function current_time($type = 'mysql', $gmt = 0)
    {
        if (isset($GLOBALS['__wp_current_time'])) {
            return $GLOBALS['__wp_current_time'];
        }

        return $type === 'timestamp' ? time() : gmdate('Y-m-d H:i:s');
    }
}

// ---------------------------------------------------------------------------
// Comments beyond a single lookup
// ---------------------------------------------------------------------------

if (!function_exists('get_comments')) {
    /**
     * Honours only what the plugin queries with: a parent id and fields=ids.
     * Reads $GLOBALS['__wp_comments'], the same store get_comment() answers
     * from, so a seeded thread is consistent across both.
     *
     * @param array<string, mixed> $args
     *
     * @return array<int, int|WP_Comment>
     */
    function get_comments(array $args = []): array
    {
        $matches = [];

        foreach ($GLOBALS['__wp_comments'] ?? [] as $commentId => $comment) {
            if (isset($args['parent']) && (int) ($comment->comment_parent ?? 0) !== (int) $args['parent']) {
                continue;
            }

            if (isset($args['post_id']) && (int) ($comment->comment_post_ID ?? 0) !== (int) $args['post_id']) {
                continue;
            }

            $matches[] = ($args['fields'] ?? '') === 'ids' ? (int) $commentId : $comment;
        }

        return $matches;
    }
}

if (!function_exists('wp_delete_comment')) {
    /**
     * Removes the comment from the store and records the call in
     * $GLOBALS['__wp_deleted_comments'], so a test can assert both that it is
     * gone and that it was deleted rather than trashed.
     */
    function wp_delete_comment($commentId, $forceDelete = false)
    {
        $commentId = (int) $commentId;

        if (!isset($GLOBALS['__wp_comments'][$commentId])) {
            return false;
        }

        unset($GLOBALS['__wp_comments'][$commentId]);

        $GLOBALS['__wp_deleted_comments'][] = ['id' => $commentId, 'force' => (bool) $forceDelete];

        return true;
    }
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

if (!function_exists('sanitize_file_name')) {
    function sanitize_file_name($name)
    {
        $name = preg_replace('/[^A-Za-z0-9._-]/', '', (string) $name);

        return trim((string) $name, '.-');
    }
}

if (!function_exists('wp_check_filetype_and_ext')) {
    /**
     * Stands in for core's magic-byte check by sniffing the real file's leading
     * bytes. Reimplementing all of core would only test the reimplementation;
     * what matters to the validator is that the answer comes from the content
     * rather than from the name, so the stub reads the content too.
     *
     * @return array{ext: false|string, type: false|string, proper_filename: false}
     */
    function wp_check_filetype_and_ext($file, $filename, $mimes = null): array
    {
        $signatures = [
            "\xFF\xD8\xFF"     => ['jpg', 'image/jpeg'],
            "\x89PNG\r\n\x1A\n" => ['png', 'image/png'],
            'GIF89a'           => ['gif', 'image/gif'],
            'GIF87a'           => ['gif', 'image/gif'],
            '%PDF-'            => ['pdf', 'application/pdf'],
        ];

        $head = (string) @file_get_contents((string) $file, false, null, 0, 16);

        foreach ($signatures as $magic => $answer) {
            if (strncmp($head, $magic, \strlen($magic)) === 0) {
                return ['ext' => $answer[0], 'type' => $answer[1], 'proper_filename' => false];
            }
        }

        // RIFF....WEBP
        if (strncmp($head, 'RIFF', 4) === 0 && substr($head, 8, 4) === 'WEBP') {
            return ['ext' => 'webp', 'type' => 'image/webp', 'proper_filename' => false];
        }

        return ['ext' => false, 'type' => false, 'proper_filename' => false];
    }
}

// ---------------------------------------------------------------------------
// Writing posts and comment statuses
// ---------------------------------------------------------------------------

if (!function_exists('wp_update_post')) {
    /**
     * Applies the update to $GLOBALS['__wp_posts'] and answers the post id.
     * Set $GLOBALS['__wp_update_post_error'] to make it fail, which is the
     * branch that decides whether a half-finished hide leaves meta behind.
     *
     * @param array<string, mixed> $postarr
     */
    function wp_update_post(array $postarr = [], $wpError = false)
    {
        if (!empty($GLOBALS['__wp_update_post_error'])) {
            return new WP_Error('update_failed', 'Could not update the post.');
        }

        $postId = (int) ($postarr['ID'] ?? 0);
        $post = $GLOBALS['__wp_posts'][$postId] ?? null;

        if (!$post) {
            return 0;
        }

        foreach ($postarr as $field => $value) {
            if ($field !== 'ID') {
                $post->{$field} = $value;
            }
        }

        return $postId;
    }
}

if (!function_exists('wp_set_comment_status')) {
    /**
     * Moves a comment between approved ('1') and held ('0'). Set
     * $GLOBALS['__wp_set_comment_status_fails'] to refuse, which is what makes
     * the rollback path testable.
     */
    function wp_set_comment_status($commentId, $status, $wpError = false)
    {
        if (!empty($GLOBALS['__wp_set_comment_status_fails'])) {
            return false;
        }

        $comment = $GLOBALS['__wp_comments'][(int) $commentId] ?? null;

        if (!$comment) {
            return false;
        }

        $comment->comment_approved = $status === 'approve' ? '1' : '0';

        return true;
    }
}

if (!function_exists('register_post_status')) {
    /**
     * @param array<string, mixed> $args
     */
    function register_post_status($status, array $args = []): void
    {
        $GLOBALS['__wp_post_statuses'][$status] = $args;
    }
}

if (!function_exists('_n_noop')) {
    function _n_noop($singular, $plural, $domain = null): array
    {
        return ['0' => $singular, '1' => $plural, 'singular' => $singular, 'plural' => $plural, 'domain' => $domain];
    }
}

// ---------------------------------------------------------------------------
// Attachments
//
// $GLOBALS['__wp_attachments'] maps an attachment id to the URLs it serves,
// keyed by image size: [12 => ['thumbnail' => '...', 'large' => '...']]. An id
// that is absent stands for a file deleted outside the portal, which is the
// case the dangling-reference cleanup exists for.
// ---------------------------------------------------------------------------

if (!function_exists('wp_get_attachment_image_url')) {
    function wp_get_attachment_image_url($attachmentId, $size = 'thumbnail', $icon = false)
    {
        return $GLOBALS['__wp_attachments'][(int) $attachmentId][$size] ?? false;
    }
}

if (!function_exists('wp_delete_attachment')) {
    function wp_delete_attachment($attachmentId, $forceDelete = false)
    {
        $attachmentId = (int) $attachmentId;

        $GLOBALS['__wp_deleted_attachments'][] = ['id' => $attachmentId, 'force' => (bool) $forceDelete];

        unset($GLOBALS['__wp_attachments'][$attachmentId]);

        return true;
    }
}

if (!function_exists('get_user_by')) {
    /**
     * Resolves against $GLOBALS['__wp_users'], the store get_userdata() reads.
     */
    function get_user_by($field, $value)
    {
        $column = ['id' => 'ID', 'email' => 'user_email', 'login' => 'user_login', 'slug' => 'user_nicename'][$field] ?? $field;

        foreach ($GLOBALS['__wp_users'] ?? [] as $user) {
            if (isset($user->{$column}) && (string) $user->{$column} === (string) $value) {
                return $user;
            }
        }

        return false;
    }
}

// ---------------------------------------------------------------------------
// Session and nonces
// ---------------------------------------------------------------------------

if (!function_exists('is_user_logged_in')) {
    function is_user_logged_in(): bool
    {
        return (int) ($GLOBALS['__wp_current_user_id'] ?? 0) > 0;
    }
}

if (!function_exists('wp_verify_nonce')) {
    /**
     * Accepts only the token $GLOBALS['__wp_valid_nonce'] names, for the action
     * it was issued against. Everything else fails, which is the state that
     * matters — a stub that waved every value through would leave the check it
     * is standing in for untested.
     */
    function wp_verify_nonce($nonce, $action = -1)
    {
        $valid = $GLOBALS['__wp_valid_nonce'] ?? null;

        if ($valid === null || (string) $nonce === '' || (string) $nonce !== (string) $valid) {
            return false;
        }

        $issuedFor = $GLOBALS['__wp_valid_nonce_action'] ?? $action;

        return (string) $issuedFor === (string) $action ? 1 : false;
    }
}

if (!function_exists('do_action')) {
    function do_action($tag, ...$args): void
    {
        $GLOBALS['__wp_actions_fired'][] = ['tag' => $tag, 'args' => $args];
    }
}

if (!function_exists('cache_users')) {
    function cache_users(array $userIds): void
    {
        // Warms a cache the stubs do not have; nothing to do.
    }
}

if (!function_exists('_prime_post_caches')) {
    function _prime_post_caches(array $postIds, $updateTermCache = true, $updateMetaCache = true): void
    {
        // Warms a cache the stubs do not have; nothing to do.
    }
}

if (!function_exists('get_permalink')) {
    function get_permalink($post = 0, $leavename = false)
    {
        $postId = is_object($post) ? (int) ($post->ID ?? 0) : (int) $post;

        return ($GLOBALS['__wp_home_url'] ?? 'https://example.com') . '/?p=' . $postId;
    }
}

if (!function_exists('get_comment_link')) {
    function get_comment_link($comment = null, $args = [])
    {
        $commentId = is_object($comment) ? (int) ($comment->comment_ID ?? 0) : (int) $comment;
        $postId = is_object($comment) ? (int) ($comment->comment_post_ID ?? 0) : 0;

        return ($GLOBALS['__wp_home_url'] ?? 'https://example.com') . '/?p=' . $postId . '#comment-' . $commentId;
    }
}

// ---------------------------------------------------------------------------
// Posts: creating, deleting, terms and attached media
// ---------------------------------------------------------------------------

if (!function_exists('wp_insert_post')) {
    /**
     * Appends a post to $GLOBALS['__wp_posts'] with the next free id and
     * answers that id, the way core does.
     *
     * @param array<string, mixed> $postarr
     */
    function wp_insert_post(array $postarr = [], $wpError = false)
    {
        if (!empty($GLOBALS['__wp_insert_post_error'])) {
            return new WP_Error('insert_failed', 'Could not create the post.');
        }

        $ids = array_map('intval', array_keys($GLOBALS['__wp_posts'] ?? []));
        $postId = ($ids === [] ? 0 : max($ids)) + 1;

        $post = new WP_Post();
        $post->ID = $postId;

        foreach ($postarr as $field => $value) {
            $post->{$field} = $value;
        }

        $GLOBALS['__wp_posts'][$postId] = $post;

        return $postId;
    }
}

if (!function_exists('wp_delete_post')) {
    /**
     * Removes the post and answers it, which is what callers check for — a
     * false answer is how core reports that there was nothing to delete.
     */
    function wp_delete_post($postId, $forceDelete = false)
    {
        $postId = (int) $postId;
        $post = $GLOBALS['__wp_posts'][$postId] ?? null;

        if (!$post) {
            return false;
        }

        unset($GLOBALS['__wp_posts'][$postId]);

        $GLOBALS['__wp_deleted_posts'][] = ['id' => $postId, 'force' => (bool) $forceDelete];

        return $post;
    }
}

if (!function_exists('wp_set_post_terms')) {
    /**
     * Records the assignment in $GLOBALS['__wp_post_terms'], keyed by post then
     * taxonomy, and makes get_the_terms() answer from the seeded term list.
     *
     * @param array<int, int|string>|string $terms
     */
    function wp_set_post_terms($postId, $terms = '', $taxonomy = 'post_tag', $append = false)
    {
        $ids = array_map('intval', (array) $terms);

        $GLOBALS['__wp_post_terms'][(int) $postId][$taxonomy] = $append
            ? array_merge($GLOBALS['__wp_post_terms'][(int) $postId][$taxonomy] ?? [], $ids)
            : $ids;

        return $ids;
    }
}

if (!function_exists('get_the_terms')) {
    /**
     * @return array<int, WP_Term>|false
     */
    function get_the_terms($postId, $taxonomy)
    {
        $postId = is_object($postId) ? (int) $postId->ID : (int) $postId;
        $ids = $GLOBALS['__wp_post_terms'][$postId][$taxonomy] ?? [];

        if ($ids === []) {
            return false;
        }

        $terms = [];

        foreach ($GLOBALS['__wp_terms'] ?? [] as $term) {
            if (\in_array((int) $term->term_id, $ids, true)) {
                $terms[] = $term;
            }
        }

        return $terms === [] ? false : $terms;
    }
}

if (!function_exists('get_attached_media')) {
    /**
     * Attachments are ordinary posts with a post_parent, so this reads the same
     * store every other post lookup does.
     *
     * @return array<int, WP_Post>
     */
    function get_attached_media($type, $postId = 0): array
    {
        $postId = is_object($postId) ? (int) $postId->ID : (int) $postId;

        return array_values(
            array_filter(
                $GLOBALS['__wp_posts'] ?? [],
                static fn ($post) => ($post->post_type ?? '') === 'attachment'
                    && (int) ($post->post_parent ?? 0) === $postId
            )
        );
    }
}

if (!function_exists('get_attached_file')) {
    function get_attached_file($attachmentId, $unfiltered = false)
    {
        return $GLOBALS['__wp_attached_files'][(int) $attachmentId] ?? false;
    }
}

if (!function_exists('wp_get_attachment_url')) {
    function wp_get_attachment_url($attachmentId = 0)
    {
        return $GLOBALS['__wp_attachments'][(int) $attachmentId]['full']
            ?? ($GLOBALS['__wp_home_url'] ?? 'https://example.com') . '/uploads/' . (int) $attachmentId;
    }
}

if (!function_exists('get_comments_number')) {
    function get_comments_number($postId = 0)
    {
        $postId = is_object($postId) ? (int) $postId->ID : (int) $postId;
        $count = 0;

        foreach ($GLOBALS['__wp_comments'] ?? [] as $comment) {
            if ((int) ($comment->comment_post_ID ?? 0) === $postId) {
                ++$count;
            }
        }

        return $count;
    }
}

if (!function_exists('get_the_author_meta')) {
    function get_the_author_meta($field = '', $userId = false)
    {
        $user = $GLOBALS['__wp_users'][(int) $userId] ?? null;

        return $user ? ($user->{$field} ?? '') : '';
    }
}

if (!function_exists('get_avatar_url')) {
    function get_avatar_url($idOrEmail, $args = null)
    {
        return ($GLOBALS['__wp_home_url'] ?? 'https://example.com') . '/avatar/' . (is_object($idOrEmail) ? '0' : (string) $idOrEmail);
    }
}

// ---------------------------------------------------------------------------
// Sessions, login URLs and multisite
// ---------------------------------------------------------------------------

if (!function_exists('wp_get_current_user')) {
    function wp_get_current_user()
    {
        return $GLOBALS['__wp_users'][(int) ($GLOBALS['__wp_current_user_id'] ?? 0)] ?? new WP_User();
    }
}

if (!function_exists('wp_login_url')) {
    /**
     * Core filters this, so on a real site it already points at whatever login
     * page the site actually uses — which is why the plugin falls back to it
     * rather than inventing one.
     */
    function wp_login_url($redirect = '')
    {
        $base = ($GLOBALS['__wp_home_url'] ?? 'https://example.com') . '/wp-login.php';

        return $redirect === '' ? $base : $base . '?redirect_to=' . rawurlencode($redirect);
    }
}

if (!function_exists('wp_logout_url')) {
    function wp_logout_url($redirect = '')
    {
        $base = ($GLOBALS['__wp_home_url'] ?? 'https://example.com') . '/wp-login.php?action=logout';

        return $redirect === '' ? $base : $base . '&redirect_to=' . rawurlencode($redirect);
    }
}

if (!function_exists('is_multisite')) {
    function is_multisite(): bool
    {
        return !empty($GLOBALS['__wp_is_multisite']);
    }
}

if (!function_exists('get_site_option')) {
    function get_site_option($key, $default = false)
    {
        return $GLOBALS['__wp_site_options'][$key] ?? $default;
    }
}

// Counting APIs used by the telemetry profile. Each answers the shape core
// answers with, so the code under test takes its normal path rather than a
// defensive one.
if (!function_exists('wp_count_posts')) {
    function wp_count_posts($postType = 'post', $perm = '')
    {
        return (object) ($GLOBALS['__wp_post_counts'] ?? ['publish' => 0, 'private' => 0, 'draft' => 0]);
    }
}

if (!function_exists('wp_count_terms')) {
    function wp_count_terms($args = [])
    {
        $taxonomy = is_array($args) ? ($args['taxonomy'] ?? '') : $args;

        return $GLOBALS['__wp_term_counts'][$taxonomy] ?? 0;
    }
}

if (!function_exists('wp_next_scheduled')) {
    function wp_next_scheduled($hook, $args = [])
    {
        return $GLOBALS['__wp_scheduled'][$hook] ?? false;
    }
}

// Test doubles for plugin classes, loaded before the autoloader below — that
// order is what makes them stand in for the real thing, since PHP only consults
// an autoloader for a class that is not already defined.
require_once __DIR__ . '/doubles/FollowModel.php';

require_once __DIR__ . '/doubles/ActivityLog.php';

require_once __DIR__ . '/doubles/Notification.php';

require_once __DIR__ . '/doubles/Vote.php';

require_once __DIR__ . '/doubles/Report.php';

require_once __DIR__ . '/doubles/services-functions.php';

require_once __DIR__ . '/doubles/wpdb.php';

require_once __DIR__ . '/doubles/pro-features.php';

require_once __DIR__ . '/../vendor/autoload.php';
