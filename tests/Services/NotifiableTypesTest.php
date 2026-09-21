<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Services\ExtensionPoints;
use PHPUnit\Framework\TestCase;

/**
 * Pins down which events a member may be asked about.
 *
 * Every case this plugin raises by itself, which is all of them bar
 * BADGE_AWARDED: nothing here awards a profile badge, so on a forum with only
 * this plugin installed a preference row for it is a switch that can never be
 * honoured. The case stays in the enum — a badge awarded by another plugin
 * arrives as this type and has to be renderable — and the row comes back when
 * something answers the filter.
 *
 * The valuable cases are the last three. A listener answering with nonsense
 * must not be able to empty a member's preference screen or to smuggle in an
 * event the dispatcher has no vocabulary for.
 *
 * @internal
 *
 * @coversNothing
 */
final class NotifiableTypesTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_filters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_filters'] = [];
    }

    public function testWithNobodyListeningBadgesAreNotOffered(): void
    {
        $this->assertNotContains(NotificationTypes::BADGE_AWARDED, ExtensionPoints::notifiableTypes());
    }

    public function testWithNobodyListeningEveryOtherTypeIsOffered(): void
    {
        $offered = ExtensionPoints::notifiableTypes();

        foreach (NotificationTypes::cases() as $type) {
            if ($type === NotificationTypes::BADGE_AWARDED) {
                continue;
            }

            $this->assertContains($type, $offered, $type->value . ' should be offered');
        }
    }

    public function testAListenerPutsTheBadgeRowBack(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_notifiable_types']
            = static fn ($types) => [...$types, 'badge_awarded'];

        $this->assertContains(NotificationTypes::BADGE_AWARDED, ExtensionPoints::notifiableTypes());
    }

    public function testASlugThisPluginDoesNotKnowIsDropped(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_notifiable_types']
            = static fn ($types) => [...$types, 'invented_by_a_listener'];

        foreach (ExtensionPoints::notifiableTypes() as $type) {
            $this->assertInstanceOf(NotificationTypes::class, $type);
        }
    }

    public function testAnEmptyAnswerLeavesThisPluginsOwnList(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_notifiable_types'] = static fn () => [];

        $this->assertContains(NotificationTypes::TOPIC_REPLY, ExtensionPoints::notifiableTypes());
    }

    public function testAnAnswerThatIsNotAListLeavesThisPluginsOwnList(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_notifiable_types'] = static fn () => 'badge_awarded';

        $offered = ExtensionPoints::notifiableTypes();

        $this->assertContains(NotificationTypes::TOPIC_REPLY, $offered);
        $this->assertNotContains(NotificationTypes::BADGE_AWARDED, $offered);
    }

    public function testADuplicatedSlugIsOfferedOnce(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_notifiable_types']
            = static fn ($types) => [...$types, 'badge_awarded', 'badge_awarded'];

        $offered = ExtensionPoints::notifiableTypes();

        $this->assertSame(\count($offered), \count(array_unique($offered, SORT_REGULAR)));
    }
}
