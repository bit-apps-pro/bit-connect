<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\TelemetryService;
use PHPUnit\Framework\TestCase;

/**
 * The two promises readme.txt makes about diagnostic reporting.
 *
 * Both are promises about something *not* happening, which is the kind that
 * rots quietly: nobody notices a request that is made, only one that is
 * missing. The vendored wp-telemetry package broke both — it reported the
 * administrator's name, email and IP, and it posted to the reporting server at
 * the moment somebody declined to be tracked — so these are regression tests
 * against a dependency this repository does not control. If `composer update`
 * changes the package's shape, this is what should fail.
 *
 * @internal
 *
 * @coversNothing
 */
final class TelemetryServiceTest extends TestCase
{
    private const TELEMETRY_URL = Config::TELEMETRY_SERVER_URL . 'plugin-track-create';

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_transients'] = [];
        $GLOBALS['__wp_filters'] = [];
    }

    // -----------------------------------------------------------------------
    // Nothing leaves the site without consent
    // -----------------------------------------------------------------------

    public function testDecliningTrackingSendsNothing(): void
    {
        // No consent stored — the state a site is in when the administrator
        // clicks "skip" on the opt-in notice.
        $result = TelemetryService::refuseUndisclosedRequests(false, [], self::TELEMETRY_URL);

        $this->assertIsArray($result, 'A report posted without consent must be short-circuited, not sent.');
        $this->assertSame(204, $result['response']['code']);
    }

    public function testAReportIsSentOnceTrackingIsAllowed(): void
    {
        update_option(Config::VAR_PREFIX . 'allow_tracking', true);

        $this->assertFalse(
            TelemetryService::refuseUndisclosedRequests(false, [], self::TELEMETRY_URL),
            'With consent given the report must go through untouched.'
        );
    }

    public function testUnrelatedHttpTrafficIsNeverTouched(): void
    {
        $this->assertFalse(
            TelemetryService::refuseUndisclosedRequests(false, [], 'https://api.wordpress.org/plugins/info/1.2/'),
            'The gate must not interfere with any request that is not ours.'
        );
    }

    public function testAnEarlierFilterDecisionIsRespected(): void
    {
        $mocked = ['response' => ['code' => 200, 'message' => 'OK'], 'body' => 'stubbed'];

        $this->assertSame(
            $mocked,
            TelemetryService::refuseUndisclosedRequests($mocked, [], self::TELEMETRY_URL),
            'Something else short-circuiting the request — a test double, an offline-mode plugin — must win.'
        );
    }

    // -----------------------------------------------------------------------
    // The IP lookup the readme never disclosed
    // -----------------------------------------------------------------------

    public function testTheIpLookupIsRefusedWhileAReportIsBuilt(): void
    {
        TelemetryService::beginReporting();

        $result = TelemetryService::refuseUndisclosedRequests(false, [], 'https://icanhazip.com/');

        $this->assertTrue(is_wp_error($result), 'The report must never fetch the server\'s public IP.');
    }

    // -----------------------------------------------------------------------
    // What the payload may say
    // -----------------------------------------------------------------------

    /**
     * @dataProvider personalFieldProvider
     */
    public function testPersonalFieldsAreStrippedFromTheReport(string $field): void
    {
        $reshaped = TelemetryService::reshapeReport(
            [
                'url'         => 'https://example.com',
                'admin_email' => 'admin@example.com',
                'first_name'  => 'Ann',
                'last_name'   => 'Lee',
                'ip_address'  => '203.0.113.7',
            ]
        );

        $this->assertArrayNotHasKey(
            $field,
            $reshaped,
            "readme.txt calls the report anonymous, so it must not carry '{$field}'."
        );
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function personalFieldProvider(): array
    {
        return [
            'admin email' => ['admin_email'],
            'first name'  => ['first_name'],
            'last name'   => ['last_name'],
            'server ip'   => ['ip_address'],
        ];
    }

    public function testTheReportDescribesTheForum(): void
    {
        $reshaped = TelemetryService::reshapeReport(['url' => 'https://example.com']);

        $this->assertArrayHasKey('forum', $reshaped);
        $this->assertSame(2, $reshaped['forum']['schema']);

        foreach (['placement', 'access', 'auth', 'content', 'taxonomy', 'roles', 'notifications', 'seo'] as $section) {
            $this->assertArrayHasKey($section, $reshaped['forum'], "The forum profile lost its '{$section}' section.");
        }
    }

    // -----------------------------------------------------------------------
    // Editions and licences are the add-on's to report, not this plugin's
    // -----------------------------------------------------------------------

    public function testTheReportSaysNothingAboutEditionsOrLicences(): void
    {
        $reshaped = TelemetryService::reshapeReport(['url' => 'https://example.com']);

        $this->assertArrayNotHasKey('edition', $reshaped['forum']);

        array_walk_recursive(
            $reshaped['forum'],
            function ($value, $key): void {
                $this->assertDoesNotMatchRegularExpression(
                    '/(^|_)pro(_|$)|licen[cs]e/i',
                    (string) $key,
                    "forum.{$key}: this plugin has no licence, so its report must not describe one."
                );
            }
        );
    }

    public function testTheAddOnExtendsTheReportThroughTheProfileFilter(): void
    {
        $GLOBALS['__wp_filters'][Config::withPrefix('telemetry_profile')] = static fn (array $profile): array => $profile + ['edition' => ['pro_installed' => true, 'pro_licensed' => false]];

        $reshaped = TelemetryService::reshapeReport(['url' => 'https://example.com']);

        $this->assertSame(['pro_installed' => true, 'pro_licensed' => false], $reshaped['forum']['edition']);
        $this->assertSame(2, $reshaped['forum']['schema'], 'The filter extends the profile; it does not replace it.');
    }

    public function testTheProfileFilterIsAppliedOnTopOfTheCachedProfile(): void
    {
        // Warm the cache with nothing hooked, then hook: what the add-on says
        // must reach the report at once, not after the day-long cache expires.
        TelemetryService::reshapeReport(['url' => 'https://example.com']);
        $GLOBALS['__wp_filters'][Config::withPrefix('telemetry_profile')] = static fn (array $profile): array => $profile + ['edition' => ['pro_installed' => true, 'pro_licensed' => true]];

        $reshaped = TelemetryService::reshapeReport(['url' => 'https://example.com']);

        $this->assertTrue($reshaped['forum']['edition']['pro_licensed']);
        $this->assertArrayNotHasKey(
            'edition',
            $GLOBALS['__wp_transients'][Config::VAR_PREFIX . 'telemetry_profile'],
            'The transient holds only this plugin\'s own data.'
        );
    }

    public function testTheReportCarriesOnlyScalarsAndCounts(): void
    {
        $reshaped = TelemetryService::reshapeReport(['url' => 'https://example.com']);

        // A string that is not a known setting value would mean a name, a
        // title or a URL had crept in. Walk the whole tree rather than naming
        // fields, so a section added later is checked too.
        array_walk_recursive(
            $reshaped['forum'],
            function ($value, $key): void {
                $this->assertTrue(
                    \is_bool($value) || \is_int($value) || \is_string($value),
                    "forum.{$key} is neither a count, a flag nor a setting value."
                );

                if (\is_string($value)) {
                    $this->assertLessThanOrEqual(
                        40,
                        \strlen($value),
                        "forum.{$key} is long enough to be free text — the report carries settings, not content."
                    );
                }
            }
        );
    }
}
