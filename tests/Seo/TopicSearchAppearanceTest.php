<?php

namespace BitApps\BitConnect\Tests\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use WP_Post;

/**
 * A topic's own search title, description and image win over the derived ones
 * in the head — and only in the head.
 *
 * The structured data keeps describing the content as it is: a title tuned for
 * a snippet is not the headline of the discussion, and a Google rich result
 * built from a DiscussionForumPosting whose headline disagrees with the page
 * is the kind of mismatch that gets the markup ignored.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicSearchAppearanceTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [
            Config::withPrefix('portal_page')      => 'community',
            Config::withPrefix('general_settings') => [
                'portalAccess'   => 'everyone',
                'communityTitle' => 'Acme Community',
            ],
        ];
        $GLOBALS['__wp_home_url'] = 'https://example.com';
        $GLOBALS['__wp_bloginfo'] = ['name' => 'Acme'];
        $GLOBALS['__wp_filters'] = [];
        $GLOBALS['__wp_site_icon'] = 'https://example.com/icon.png';
        $GLOBALS['__wp_thumbnails'] = [];
        $GLOBALS['__wp_posts'] = [$this->makePortalPage()];

        $this->resetMeta();
        PortalLocation::resetCache();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_posts'] = [];
        $this->resetMeta();
        PortalLocation::resetCache();
    }

    public function testWithoutOverridesTheHeadIsDerivedFromTheTopic(): void
    {
        SeoMeta::forTopic($this->makeTopic());
        $meta = SeoMeta::meta();

        $this->assertSame('How do I reset my password', $meta['title']);
        $this->assertStringContainsString('You can reset it from the account page.', $meta['description']);
        $this->assertSame('https://example.com/icon.png', $meta['image']);
    }

    public function testEachOverrideReplacesItsDerivedValue(): void
    {
        SeoMeta::forTopic($this->makeTopic([
            'seo' => [
                'title'       => 'Reset your password in two steps',
                'description' => 'Where the reset link lives and what to do when it does not arrive.',
                'image'       => 'https://example.com/reset.png',
            ],
        ]));

        $head = SeoMeta::head();

        $this->assertStringContainsString('content="Reset your password in two steps"', $head);
        $this->assertStringContainsString(
            'name="description" content="Where the reset link lives and what to do when it does not arrive."',
            $head
        );
        $this->assertStringContainsString('content="https://example.com/reset.png"', $head);
        $this->assertStringNotContainsString('icon.png', $head);
        $this->assertStringContainsString('summary_large_image', $head);
    }

    public function testABlankOverrideLeavesThatFieldDerived(): void
    {
        SeoMeta::forTopic($this->makeTopic([
            'seo' => ['title' => 'Custom title only', 'description' => '', 'image' => ''],
        ]));

        $meta = SeoMeta::meta();

        $this->assertSame('Custom title only', $meta['title']);
        $this->assertStringContainsString('You can reset it from the account page.', $meta['description']);
        $this->assertSame('https://example.com/icon.png', $meta['image']);
    }

    public function testTheDocumentTitleFollowsTheOverride(): void
    {
        SeoMeta::forTopic($this->makeTopic(['seo' => ['title' => 'Custom title']]));

        $parts = SeoMeta::filterTitle(['title' => 'How do I reset my password', 'page' => 'Page 2']);

        $this->assertSame('Custom title', $parts['title']);
    }

    public function testStructuredDataKeepsTheRealHeadline(): void
    {
        SeoMeta::forTopic($this->makeTopic(['seo' => ['title' => 'Custom title']]));

        $head = SeoMeta::head();

        $this->assertStringContainsString('"headline":"How do I reset my password"', $head);
        $this->assertStringNotContainsString('"headline":"Custom title"', $head);
        // The breadcrumb names the page as its content does, too.
        $this->assertStringContainsString('"name":"How do I reset my password"', $head);
    }

    public function testAHostileOverrideIsSanitisedBeforeItReachesTheHead(): void
    {
        SeoMeta::forTopic($this->makeTopic([
            'seo' => [
                'title' => '<script>alert(1)</script>Safe',
                'image' => 'javascript:alert(1)',
            ],
        ]));

        $head = SeoMeta::head();

        $this->assertStringNotContainsString('<script>alert', $head);
        $this->assertStringContainsString('og:title" content="alert(1)Safe"', $head);
        $this->assertStringNotContainsString('javascript:', $head);
        $this->assertStringContainsString('icon.png', $head);
    }

    public function testTheBridgeSeesTheOverrideToo(): void
    {
        // SeoPluginBridge reads meta() rather than head(), so the values the
        // SEO plugin prints have to already carry the override there.
        SeoMeta::forTopic($this->makeTopic(['seo' => ['description' => 'Bridged description']]));

        $this->assertSame('Bridged description', SeoMeta::meta()['description']);
    }

    private function resetMeta(): void
    {
        $reflection = new ReflectionClass(SeoMeta::class);
        $reflection->getProperty('meta')->setValue(null, null);
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    private function makeTopic(array $overrides = []): array
    {
        return array_merge([
            'ID'                => 1,
            'post_title'        => 'How do I reset my password',
            'post_name'         => 'how-do-i',
            'post_status'       => 'publish',
            'post_content'      => 'You can reset it from the account page.',
            'post_excerpt'      => '',
            'post_date'         => '2026-03-04 10:00:00',
            'post_date_gmt'     => '2026-03-04 10:00:00',
            'post_modified_gmt' => '2026-03-05 09:00:00',
            'author_name'       => 'Casey',
            'comments_count'    => 0,
        ], $overrides);
    }

    private function makePortalPage(): WP_Post
    {
        $page = new WP_Post();
        $page->ID = 7;
        $page->post_type = 'page';
        $page->post_status = 'publish';
        $page->post_name = 'community';
        $page->post_title = 'Community';

        return $page;
    }
}
