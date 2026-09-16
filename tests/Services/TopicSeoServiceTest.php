<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\TopicSeoService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The per-topic search appearance record: what it stores, what it refuses.
 *
 * Every value here ends up in the document head of a public page, so the
 * interesting cases are the hostile ones — markup in a title, a javascript:
 * URL as the image — and the housekeeping one: a topic set back to blank must
 * leave nothing behind.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicSeoServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        $GLOBALS['__wp_post_meta'] = [];
    }

    public function testATopicThatNeverSetAnythingAnswersBlankInFull(): void
    {
        $this->assertSame(TopicSeoService::blank(), TopicSeoService::forPost(10));
        $this->assertFalse(TopicSeoService::isSet(TopicSeoService::forPost(10)));
    }

    public function testWhatIsSavedIsWhatIsReadBack(): void
    {
        TopicSeoService::save(10, [
            'title'       => 'Reset your password in two steps',
            'description' => 'The account page has a reset link; here is where it is.',
            'image'       => 'https://example.com/reset.png',
        ]);

        $this->assertSame(
            [
                'title'       => 'Reset your password in two steps',
                'description' => 'The account page has a reset link; here is where it is.',
                'image'       => 'https://example.com/reset.png',
            ],
            TopicSeoService::forPost(10)
        );
    }

    public function testARecordMissingAFieldStillAnswersEveryKey(): void
    {
        $GLOBALS['__wp_post_meta'][10][TopicSeoService::META_KEY] = ['title' => 'Only a title'];

        $this->assertSame(
            ['title' => 'Only a title', 'description' => '', 'image' => ''],
            TopicSeoService::forPost(10)
        );
    }

    public function testSettingEveryFieldBackToBlankRemovesTheRecord(): void
    {
        TopicSeoService::save(10, ['title' => 'Custom']);
        $this->assertArrayHasKey(TopicSeoService::META_KEY, $GLOBALS['__wp_post_meta'][10]);

        TopicSeoService::save(10, ['title' => '', 'description' => '   ', 'image' => '']);

        $this->assertArrayNotHasKey(TopicSeoService::META_KEY, $GLOBALS['__wp_post_meta'][10] ?? []);
    }

    public function testMarkupAndLineBreaksAreFlattenedToOneLineOfText(): void
    {
        $clean = TopicSeoService::sanitize([
            'title'       => "  <b>Bold</b> title\n",
            'description' => "First line.\n\nSecond   line <script>alert(1)</script>",
        ]);

        $this->assertSame('Bold title', $clean['title']);
        $this->assertSame('First line. Second line alert(1)', $clean['description']);
    }

    public function testValuesAreCutAtTheirCaps(): void
    {
        $clean = TopicSeoService::sanitize([
            'title'       => str_repeat('a', TopicSeoService::TITLE_MAX + 50),
            'description' => str_repeat('b', TopicSeoService::DESCRIPTION_MAX + 50),
        ]);

        $this->assertSame(TopicSeoService::TITLE_MAX, mb_strlen($clean['title']));
        $this->assertSame(TopicSeoService::DESCRIPTION_MAX, mb_strlen($clean['description']));
    }

    #[DataProvider('notAnImageUrl')]
    public function testOnlyAWebUrlSurvivesAsTheImage(string $input): void
    {
        $this->assertSame('', TopicSeoService::sanitize(['image' => $input])['image']);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function notAnImageUrl(): array
    {
        return [
            'javascript scheme' => ['javascript:alert(1)'],
            'data uri'          => ['data:image/png;base64,AAAA'],
            'scheme relative'   => ['//example.com/a.png'],
            'bare path'         => ['/wp-content/uploads/a.png'],
            'plain words'       => ['not a url'],
            'too long'          => ['https://example.com/' . str_repeat('x', TopicSeoService::IMAGE_MAX)],
        ];
    }

    public function testNonScalarInputIsTreatedAsBlank(): void
    {
        $clean = TopicSeoService::sanitize(['title' => ['nested'], 'description' => null, 'image' => 5]);

        $this->assertSame(TopicSeoService::blank(), $clean);
    }

    public function testAHandWrittenRecordIsSanitisedOnRead(): void
    {
        $GLOBALS['__wp_post_meta'][10][TopicSeoService::META_KEY] = [
            'title' => '<img src=x onerror=alert(1)>Title',
            'image' => 'javascript:alert(1)',
        ];

        $read = TopicSeoService::forPost(10);

        $this->assertSame('Title', $read['title']);
        $this->assertSame('', $read['image']);
    }
}
