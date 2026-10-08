<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ForumUploadsInLibrary;
use BitApps\BitConnect\Services\UploadClaims;
use PHPUnit\Framework\TestCase;

/**
 * Forum uploads kept out of the Media Library and the media picker.
 *
 * @internal
 *
 * @coversNothing
 */
final class ForumUploadsInLibraryTest extends TestCase
{
    public function testThePickerLeavesForumUploadsOut(): void
    {
        $args = ForumUploadsInLibrary::filterPickerQuery(['post_type' => 'attachment']);

        self::assertSame(
            [['key' => UploadClaims::PORTAL_META, 'compare' => 'NOT EXISTS']],
            $args['meta_query']
        );
        self::assertSame('attachment', $args['post_type']);
    }

    // A topic's own media, and a gallery an editor reopens, name their posts:
    // hiding forum uploads there would show a topic with its files missing.
    public function testAQueryNamingItsPostsOrTheirParentIsLeftAlone(): void
    {
        self::assertSame(['post_parent' => 7], ForumUploadsInLibrary::filterPickerQuery(['post_parent' => 7]));
        self::assertSame(['post__in' => [3, 4]], ForumUploadsInLibrary::filterPickerQuery(['post__in' => [3, 4]]));
    }

    public function testAConditionAlreadyOnTheQueryIsKept(): void
    {
        $existing = [['key' => 'other', 'value' => 1]];

        $args = ForumUploadsInLibrary::withMeta(['meta_query' => $existing], 'EXISTS');

        self::assertSame(
            ['relation' => 'AND', $existing, ['key' => UploadClaims::PORTAL_META, 'compare' => 'EXISTS']],
            $args['meta_query']
        );
    }
}
