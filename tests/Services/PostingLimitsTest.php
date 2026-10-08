<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\PostingLimits;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * Pins down how much a topic or a comment may hold.
 *
 * This plugin limits nothing: with nobody answering `bit_connect_posting_limits`
 * a member may post as long a text, with as many images and files, as the
 * server takes. The valuable cases are the listener's: its limits are enforced,
 * a malformed answer falls back to no limit rather than to something stricter,
 * and no answer may promise a file larger than the server will take.
 *
 * @internal
 *
 * @coversNothing
 */
final class PostingLimitsTest extends TestCase
{
    private const MB = 1024 * 1024;

    protected function setUp(): void
    {
        $GLOBALS['__wp_filters'] = [];
        unset($GLOBALS['__wp_max_upload_size'], $GLOBALS['__wp_mime_types']);
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_filters'] = [];
        unset($GLOBALS['__wp_max_upload_size'], $GLOBALS['__wp_mime_types']);
    }

    public function testWithNobodyListeningNothingIsLimited(): void
    {
        $limits = PostingLimits::all();

        $this->assertSame(['attachments' => null, 'characters' => null, 'images' => null, 'videos' => null], $limits['topic']);
        $this->assertSame(['attachments' => null, 'characters' => null, 'images' => null, 'videos' => null], $limits['comment']);
    }

    public function testWithNobodyListeningAnUploadIsHeldToTheServerAlone(): void
    {
        $GLOBALS['__wp_max_upload_size'] = 100 * self::MB;

        $this->assertSame(100 * self::MB, PostingLimits::maxFileSize());
    }

    public function testWithNobodyListeningAnythingIsAccepted(): void
    {
        PostingLimits::assertWithin('comment', str_repeat('<p><img src="a.png">' . str_repeat('x', 1000) . '</p>', 50), range(1, 40));

        $this->addToAssertionCount(1);
    }

    public function testAListenerSetsTheLimits(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = [
            'topic'       => ['attachments' => 10, 'images' => 30],
            'comment'     => ['attachments' => 0, 'characters' => 500, 'images' => 2],
            'maxFileSize' => 8 * self::MB,
        ];

        $limits = PostingLimits::all();

        $this->assertSame(['attachments' => 10, 'characters' => null, 'images' => 30, 'videos' => null], $limits['topic']);
        $this->assertSame(['attachments' => 0, 'characters' => 500, 'images' => 2, 'videos' => null], $limits['comment']);
        $this->assertSame(8 * self::MB, $limits['maxFileSize']);
    }

    public function testAMalformedAnswerMeansNoLimitNotAStricterOne(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = [
            'topic'       => ['attachments' => -1, 'characters' => 0, 'images' => 'lots'],
            'maxFileSize' => 0,
        ];
        $GLOBALS['__wp_max_upload_size'] = 64 * self::MB;

        $limits = PostingLimits::all();

        $this->assertSame(['attachments' => null, 'characters' => null, 'images' => null, 'videos' => null], $limits['topic']);
        $this->assertSame(64 * self::MB, $limits['maxFileSize']);
    }

    public function testANonArrayAnswerMeansNoLimit(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = null;

        $this->assertSame(PostingLimits::DEFAULTS['topic'], PostingLimits::all()['topic']);
    }

    public function testTheFileSizeNeverExceedsWhatTheServerAccepts(): void
    {
        $GLOBALS['__wp_max_upload_size'] = 2 * self::MB;
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['maxFileSize' => 50 * self::MB];

        $this->assertSame(2 * self::MB, PostingLimits::maxFileSize());
    }

    public function testTooManyImagesAreRefused(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['comment' => ['images' => 10]];

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('You can add up to 10 images to a comment.');

        PostingLimits::assertWithin('comment', str_repeat('<IMG src="a.png">', 11), []);
    }

    public function testTooManyFilesAreRefused(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['topic' => ['attachments' => 5]];

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('You can attach up to 5 files to a topic.');

        PostingLimits::assertWithin('topic', '', [1, 2, 3, 4, 5, 6]);
    }

    public function testALimitOfOneReadsInTheSingular(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['topic' => ['images' => 1]];

        $this->expectExceptionMessage('You can add only 1 image to a topic.');

        PostingLimits::assertWithin('topic', '<img src="a.png"><img src="b.png">', []);
    }

    public function testAZeroLimitRefusesAnyOfThatKind(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['topic' => ['attachments' => 0]];

        $this->expectExceptionMessage('Files cannot be attached to a topic.');

        PostingLimits::assertWithin('topic', '', [1]);
    }

    public function testALongerCommentIsRefusedByItsVisibleLength(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['comment' => ['characters' => 10]];

        // Markup and entities do not count: this is ten characters a reader sees.
        PostingLimits::assertWithin('comment', '<p><strong>abcde</strong>&amp;fghi</p>', null);

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('A comment can be up to 10 characters long.');

        PostingLimits::assertWithin('comment', '<p>abcdefghijk</p>', null);
    }

    public function testCharactersAreCountedNotBytes(): void
    {
        // Fifteen bytes in UTF-8, five characters on the screen.
        $this->assertSame(5, PostingLimits::countCharacters('<p>বাংলা</p>'));
    }

    /**
     * An edit that sends neither — a status change — is not counted, so a
     * topic written under looser limits can still be moved along.
     */
    public function testWhatAnEditDoesNotSendIsNotCounted(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = [
            'topic' => ['attachments' => 0, 'characters' => 1, 'images' => 0],
        ];

        PostingLimits::assertWithin('topic', null, null);

        $this->addToAssertionCount(1);
    }

    public function testVideosAreCountedApartFromOtherFiles(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['comment' => ['attachments' => 2, 'videos' => 1]];
        $GLOBALS['__wp_mime_types'] = [1 => 'video/mp4', 2 => 'application/pdf', 3 => 'image/png'];

        // One video and two files: within both limits, though three in all.
        PostingLimits::assertWithin('comment', null, [1, 2, 3]);

        $GLOBALS['__wp_mime_types'][4] = 'video/webm';

        $this->expectExceptionMessage('You can add only 1 video to a comment.');
        PostingLimits::assertWithin('comment', null, [1, 2, 4]);
    }

    public function testAVideoPlacedInTheTextCountsWithTheAttachedOnes(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['topic' => ['videos' => 2]];
        $GLOBALS['__wp_mime_types'] = [1 => 'video/mp4', 2 => 'application/pdf'];

        $inline = '<p>Watch</p><figure class="wp-block-video"><video src="a.mp4" controls></video></figure>';

        // One in the text and one attached: two, within the limit.
        PostingLimits::assertWithin('topic', $inline, [1, 2]);

        $this->expectExceptionMessage('You can add up to 2 videos to a topic.');
        PostingLimits::assertWithin('topic', $inline . '<VIDEO src="b.mp4"></VIDEO>', [1, 2]);
    }

    public function testAVideoInTheTextIsCountedEvenWhenNoAttachmentsAreSent(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['comment' => ['videos' => 0]];

        $this->expectExceptionMessage('Videos cannot be added to a comment.');
        PostingLimits::assertWithin('comment', '<video src="a.mp4"></video>', null);
    }

    public function testAZeroVideoLimitRefusesAnyVideo(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['topic' => ['videos' => 0]];
        $GLOBALS['__wp_mime_types'] = [1 => 'video/quicktime'];

        $this->expectExceptionMessage('Videos cannot be added to a topic.');
        PostingLimits::assertWithin('topic', null, [1]);
    }

    public function testEachKindOfFileMayHaveItsOwnSize(): void
    {
        $GLOBALS['__wp_max_upload_size'] = 200 * self::MB;
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = [
            'maxFileSize'       => 10 * self::MB,
            'maxFileSizeByKind' => ['video' => 100 * self::MB, 'image' => 5 * self::MB],
        ];

        $this->assertSame(5 * self::MB, PostingLimits::maxFileSizeFor('image/png'));
        $this->assertSame(100 * self::MB, PostingLimits::maxFileSizeFor('video/mp4'));
        // No size of its own: the general one.
        $this->assertSame(10 * self::MB, PostingLimits::maxFileSizeFor('application/pdf'));
        // The ceiling before the kind is known is the largest of them.
        $this->assertSame(100 * self::MB, PostingLimits::maxFileSize());
    }

    public function testAKindsSizeNeverExceedsWhatTheServerAccepts(): void
    {
        $GLOBALS['__wp_max_upload_size'] = 20 * self::MB;
        $GLOBALS['__wp_filters']['bit_connect_posting_limits'] = ['maxFileSizeByKind' => ['video' => 500 * self::MB]];

        $this->assertSame(20 * self::MB, PostingLimits::maxFileSizeFor('video/mp4'));
    }
}
