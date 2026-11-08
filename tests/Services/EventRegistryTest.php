<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\Events\EventRegistry;
use PHPUnit\Framework\TestCase;

/**
 * The catalogue of public events, and what another plugin may add to it.
 *
 * The hook names are a contract with every automation built on them, so the
 * checks here are about the names holding still: each one is the prefix plus
 * its key, and nothing another plugin answers can rename or replace one.
 *
 * @internal
 *
 * @coversNothing
 */
final class EventRegistryTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_filters'] = [];
        EventRegistry::flush();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_filters'] = [];
        EventRegistry::flush();
    }

    public function testEveryHookIsThePrefixAndItsKey(): void
    {
        foreach (EventRegistry::all() as $key => $entry) {
            self::assertSame('bit_connect_' . $key, $entry['hook']);
            self::assertContains($entry['group'], EventRegistry::GROUPS);
            self::assertNotSame('', $entry['label']);
            self::assertNotSame([], $entry['fields']);
        }
    }

    public function testTheFreeEventsAreListed(): void
    {
        self::assertSame(
            [
                'topic_created', 'topic_status_changed', 'comment_created', 'topic_voted',
                'member_registered', 'member_logged_in', 'report_filed', 'report_resolved',
                'moderation_action',
            ],
            array_keys(EventRegistry::all())
        );
    }

    public function testEveryFieldExampleIsAScalar(): void
    {
        foreach (EventRegistry::all() as $entry) {
            foreach ($entry['fields'] as $name => $example) {
                self::assertIsString($name);
                self::assertTrue($example === null || \is_scalar($example), $name);
            }
        }
    }

    public function testAnotherPluginMayAddAnEvent(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_integration_events'] = [
            'poll_voted' => [
                'hook'   => 'bit_connect_poll_voted',
                'group'  => 'engagement',
                'label'  => 'A member votes in a poll',
                'fields' => ['poll_option_ids' => '1,2', 'nested' => ['no']],
            ],
        ];

        $entry = EventRegistry::all()['poll_voted'] ?? null;

        self::assertNotNull($entry);
        self::assertSame(['poll_option_ids' => '1,2'], $entry['fields']);
        self::assertTrue(EventRegistry::has('poll_voted'));
    }

    public function testAnotherPluginCannotTakeOverAFreeEvent(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_integration_events'] = [
            'topic_created' => [
                'hook'   => 'bit_connect_topic_created',
                'group'  => 'content',
                'label'  => 'Something else',
                'fields' => [],
            ],
        ];

        self::assertSame('A new post becomes public', EventRegistry::all()['topic_created']['label']);
    }

    public function testAMalformedEntryIsDropped(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_integration_events'] = [
            'renamed'     => ['hook' => 'other_prefix_renamed', 'group' => 'content', 'label' => 'x', 'fields' => []],
            'bad_group'   => ['hook' => 'bit_connect_bad_group', 'group' => 'sales', 'label' => 'x', 'fields' => []],
            'no_label'    => ['hook' => 'bit_connect_no_label', 'group' => 'content', 'label' => '', 'fields' => []],
            'Bad-Key'     => ['hook' => 'bit_connect_Bad-Key', 'group' => 'content', 'label' => 'x', 'fields' => []],
            'not_an_array' => 'nope',
        ];

        self::assertSame(
            ['topic_created', 'topic_status_changed', 'comment_created', 'topic_voted', 'member_registered', 'member_logged_in', 'report_filed', 'report_resolved', 'moderation_action'],
            array_keys(EventRegistry::all())
        );
    }

    public function testASampleCarriesTheEnvelopeAndTheFields(): void
    {
        $sample = EventRegistry::sample('comment_created');

        self::assertSame('comment_created', $sample['event']);
        self::assertSame(1, $sample['schema_version']);
        self::assertArrayHasKey('event_id', $sample);
        self::assertArrayHasKey('comment_id', $sample);
        self::assertArrayHasKey('topic_id', $sample);
        self::assertArrayHasKey('author_email', $sample);
        self::assertSame([], EventRegistry::sample('no_such_event'));
    }
}
