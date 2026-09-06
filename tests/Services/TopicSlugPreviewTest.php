<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\TopicService;
use PHPUnit\Framework\TestCase;

/**
 * TopicService::previewSlug() backs the availability check the topic form runs
 * while an author types. Its whole job is to agree with the save, so these
 * assert that it asks core the same question wp_insert_post() would rather than
 * deciding anything itself.
 */
class TopicSlugPreviewTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_unique_slug_calls'] = [];
        unset($GLOBALS['__wp_unique_slug_result']);
    }

    public function testReportsAFreeSlugAsAvailable(): void
    {
        $preview = TopicService::previewSlug('getting-started');

        $this->assertTrue($preview['available']);
        $this->assertSame('getting-started', $preview['slug']);
        $this->assertSame('getting-started', $preview['requested']);
    }

    /**
     * "Taken" is not a lookup of its own — it is core handing back something
     * other than what it was given.
     */
    public function testReportsTheSlugTheSaveWouldReallyUse(): void
    {
        $GLOBALS['__wp_unique_slug_result'] = 'getting-started-2';

        $preview = TopicService::previewSlug('getting-started');

        $this->assertFalse($preview['available']);
        $this->assertSame('getting-started-2', $preview['slug']);
        $this->assertSame('getting-started', $preview['requested']);
    }

    public function testSanitizesBeforeAsking(): void
    {
        $preview = TopicService::previewSlug('  Getting Started!!  ');

        $this->assertSame('getting-started', $GLOBALS['__wp_unique_slug_calls'][0]['slug']);
        // The author is told the form their input took, not the raw text.
        $this->assertSame('getting-started', $preview['requested']);
    }

    /**
     * Otherwise an author re-saving an edit form would be told their own
     * permalink is taken, by themselves.
     */
    public function testExcludesTheTopicBeingEditedFromTheClash(): void
    {
        TopicService::previewSlug('kept-slug', 42);

        $this->assertSame(42, $GLOBALS['__wp_unique_slug_calls'][0]['postId']);
    }

    public function testTreatsANewTopicAsBelongingToNoPost(): void
    {
        TopicService::previewSlug('brand-new');

        $this->assertSame(0, $GLOBALS['__wp_unique_slug_calls'][0]['postId']);
    }

    /**
     * wp_unique_post_slug() short-circuits for drafts and hands the slug back
     * untouched, which would report every slug on earth as free.
     */
    public function testAsksAboutAPublishedTopic(): void
    {
        TopicService::previewSlug('anything');

        $this->assertSame('publish', $GLOBALS['__wp_unique_slug_calls'][0]['postStatus']);
        $this->assertSame('bit-connect', $GLOBALS['__wp_unique_slug_calls'][0]['postType']);
    }

    /**
     * Nothing sluggable in it: the save falls back to the title, so there is no
     * slug yet for a verdict to be about — and no question worth asking core.
     */
    public function testAsksNothingWhenTheInputReducesToNothing(): void
    {
        $preview = TopicService::previewSlug('!!!');

        $this->assertSame([], $GLOBALS['__wp_unique_slug_calls']);
        $this->assertTrue($preview['available']);
        $this->assertSame('', $preview['slug']);
        $this->assertSame('', $preview['requested']);
    }
}
