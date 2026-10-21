<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\PageCache;
use BitApps\BitConnect\Services\PortalLocation;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;
use WP_Term;

/**
 * Pins what the page cache is told when the portal changes.
 *
 * A topic is read at its portal URL, not its permalink, so the purge a cache
 * plugin does on a post save misses it. These pin that each change names the
 * pages a guest reads it on, and that a change every page shows — a setting,
 * a new build — empties them all.
 *
 * `bit_connect_purge_page_cache` carries what was purged: the URLs, or null for
 * every page. The other caches' calls are made beside it.
 *
 * @internal
 *
 * @coversNothing
 */
final class PageCacheTest extends TestCase
{
    private const TOPIC = 20;

    protected function setUp(): void
    {
        // The queue lives for the request, which in PHPUnit is the whole run:
        // a test before this one may have left URLs in it.
        PageCache::flush();
        $GLOBALS['__wp_home_url'] = 'https://example.com';
        $GLOBALS['__wp_options'] = [Config::withPrefix('portal_page') => 'community'];
        $GLOBALS['__wp_actions_fired'] = [];
        PortalLocation::resetCache();

        $this->seedTopic('first-topic');
    }

    protected function tearDown(): void
    {
        PageCache::flush();

        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_post_terms'] = [];
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_actions_fired'] = [];
        PortalLocation::resetCache();
    }

    public function testAnEditPurgesTheTopicAndThePortalHome(): void
    {
        PageCache::handlePostStatusChanged('publish', 'publish', $GLOBALS['__wp_posts'][self::TOPIC]);
        PageCache::flush();

        $this->assertSame(
            ['https://example.com/community', 'https://example.com/community/first-topic'],
            $this->purgedUrls()
        );
        $this->assertSame([PageCache::TAG], $this->fired('litespeed_purge'));
    }

    public function testATopicThatWasNeverPublicPurgesNothing(): void
    {
        PageCache::handlePostStatusChanged('pending', 'draft', $GLOBALS['__wp_posts'][self::TOPIC]);
        PageCache::flush();

        $this->assertSame([], $this->fired('bit_connect_purge_page_cache'));
    }

    /**
     * Core adds `__trashed` to the slug as it trashes a topic, but the cached
     * page is at the slug the topic had.
     */
    public function testATrashedTopicPurgesTheUrlItWasReadAt(): void
    {
        $topic = $GLOBALS['__wp_posts'][self::TOPIC];
        $topic->post_name = 'first-topic__trashed';

        PageCache::handlePostStatusChanged('trash', 'publish', $topic);
        PageCache::flush();

        $this->assertContains('https://example.com/community/first-topic', $this->purgedUrls());
    }

    public function testARenamedTopicPurgesItsOldUrlToo(): void
    {
        $GLOBALS['__wp_post_meta'][self::TOPIC]['_wp_old_slug'] = 'old-name';

        PageCache::topic(self::TOPIC);
        PageCache::flush();

        $this->assertContains('https://example.com/community/old-name', $this->purgedUrls());
        $this->assertContains('https://example.com/community/first-topic', $this->purgedUrls());
    }

    public function testATopicPurgesTheArchivesItIsFiledUnder(): void
    {
        $term = new WP_Term();
        $term->term_id = 7;
        $term->slug = 'bug';
        $term->taxonomy = Taxonomies::TAGS->value;
        $GLOBALS['__wp_terms'] = [$term];
        $GLOBALS['__wp_post_terms'][self::TOPIC][Taxonomies::TAGS->value] = [7];

        PageCache::topic(self::TOPIC);
        PageCache::flush();

        $this->assertContains('https://example.com/community/tag/bug', $this->purgedUrls());
    }

    public function testACommentPurgesItsTopic(): void
    {
        $comment = new WP_Comment();
        $comment->comment_ID = 9;
        $comment->comment_post_ID = self::TOPIC;

        PageCache::handleCommentChanged(9, $comment);
        PageCache::flush();

        $this->assertContains('https://example.com/community/first-topic', $this->purgedUrls());
    }

    public function testSomethingOtherThanATopicPurgesNothing(): void
    {
        $GLOBALS['__wp_posts'][self::TOPIC]->post_type = 'post';

        PageCache::topic(self::TOPIC);
        PageCache::flush();

        $this->assertSame([], $this->fired('bit_connect_purge_page_cache'));
    }

    public function testSeveralChangesInOneRequestPurgeOnce(): void
    {
        PageCache::topic(self::TOPIC);
        PageCache::topic(self::TOPIC);
        PageCache::flush();

        $this->assertCount(1, $this->fired('bit_connect_purge_page_cache'));
    }

    /**
     * A setting is in every page — the members-only switch decides whether a
     * guest's page may show topics at all — so every page goes.
     */
    public function testSavingAPortalSettingPurgesEveryPortalPage(): void
    {
        PageCache::handleOptionChanged(Config::withPrefix(GeneralSettings::OPTION_NAME->value));
        PageCache::flush();

        $this->assertSame([null], $this->fired('bit_connect_purge_page_cache'));
    }

    public function testEveryPortalPageOutranksTheUrlsQueuedBesideIt(): void
    {
        PageCache::topic(self::TOPIC);
        PageCache::portal();
        PageCache::flush();

        $this->assertSame([null], $this->fired('bit_connect_purge_page_cache'));
    }

    public function testAnOptionThePortalDoesNotReadPurgesNothing(): void
    {
        PageCache::handleOptionChanged('blogdescription');
        PageCache::handleOptionChanged(Config::withPrefix('notification_settings'));
        PageCache::flush();

        $this->assertSame([], $this->fired('bit_connect_purge_page_cache'));
    }

    public function testAnotherPluginNamesItsOwnOptions(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_page_cache_options'] = static fn (array $options) => [...$options, 'bit_connect_pro_portal_banners'];

        PageCache::handleOptionChanged('bit_connect_pro_portal_banners');
        PageCache::flush();

        unset($GLOBALS['__wp_filters']['bit_connect_page_cache_options']);

        $this->assertSame([null], $this->fired('bit_connect_purge_page_cache'));
    }

    public function testATermOfThePortalPurgesEveryPortalPage(): void
    {
        PageCache::handleTermChanged(7, 7, Taxonomies::TOPIC_TYPES->value);
        PageCache::handleTermChanged(8, 8, 'category');
        PageCache::flush();

        $this->assertSame([null], $this->fired('bit_connect_purge_page_cache'));
    }

    /**
     * A page cached before an update names a bundle the update removed.
     */
    public function testANewBuildPurgesEveryPortalPageOnce(): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix('page_cache_build')] = 'an-old-build|an-old-build';

        PageCache::purgeOnNewBuild();
        PageCache::flush();
        PageCache::purgeOnNewBuild();
        PageCache::flush();

        $this->assertSame([null], $this->fired('bit_connect_purge_page_cache'));
        $this->assertNotSame('an-old-build|an-old-build', $GLOBALS['__wp_options'][Config::withPrefix('page_cache_build')]);
    }

    /**
     * @return list<string>
     */
    private function purgedUrls(): array
    {
        $urls = $this->fired('bit_connect_purge_page_cache')[0] ?? [];
        sort($urls);

        return $urls;
    }

    /**
     * The first argument of each firing of an action.
     *
     * @return list<mixed>
     */
    private function fired(string $tag): array
    {
        $args = [];

        foreach ($GLOBALS['__wp_actions_fired'] as $fired) {
            if ($fired['tag'] === $tag) {
                $args[] = $fired['args'][0] ?? null;
            }
        }

        return $args;
    }

    private function seedTopic(string $slug): void
    {
        $topic = new WP_Post();
        $topic->ID = self::TOPIC;
        $topic->post_type = PostTypes::BIT_CONNECT->value;
        $topic->post_name = $slug;
        $topic->post_status = 'publish';

        $GLOBALS['__wp_posts'][self::TOPIC] = $topic;
    }
}
