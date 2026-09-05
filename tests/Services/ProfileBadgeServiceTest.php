<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\BadgeTone;
use BitApps\BitConnectPro\Services\ProfileBadgeService;
use BitApps\BitConnect\Services\UserBadgeService;
use PHPUnit\Framework\TestCase;

/**
 * Pins down the badge catalog an admin authors and hands out.
 *
 * One rule holds the whole design up: a badge's id is fixed for life, because
 * the id is what every member wearing it stores. Regenerate it on a rename and
 * the badge silently falls off everyone who had it — no error, no log, just a
 * forum where the Developers stopped being Developers.
 *
 * The same property is what makes deleting safe. Assignments are resolved
 * against the catalog on every read, so a deleted badge's id simply stops
 * resolving, and restoring it under the old id gives it back to exactly the
 * people who had it.
 *
 * @internal
 *
 * @coversNothing
 */
final class ProfileBadgeServiceTest extends TestCase
{
    private const MEMBER = 3;

    private const OPTION = 'bit_connect_profile_badges';

    protected function setUp(): void
    {
        ProfileBadgeService::flush();
        UserBadgeService::flush();
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_user_meta'] = [];

        ProfileBadgeService::flush();
        UserBadgeService::flush();
    }

    // -----------------------------------------------------------------------
    // Creating
    // -----------------------------------------------------------------------

    public function testANewBadgeTakesItsIdFromItsName(): void
    {
        $saved = ProfileBadgeService::save(['label' => 'Developer', 'tone' => 'green']);

        $this->assertSame(['id' => 'developer', 'label' => 'Developer', 'tone' => 'green'], $saved['badge']);
        $this->assertSame('', $saved['error']);
    }

    /**
     * sanitize_key() alone drops a space rather than turning it into a
     * separator, so "Group Expert" would have been stored as `groupexpert` —
     * and the id is shown beside its badge on the admin screen.
     */
    public function testATwoWordNameBecomesAHyphenatedId(): void
    {
        $this->assertSame('group-expert', ProfileBadgeService::save(['label' => 'Group Expert'])['badge']['id']);
    }

    public function testTwoBadgesWithTheSameNameGetDistinctIds(): void
    {
        ProfileBadgeService::save(['label' => 'Support']);

        $this->assertSame('support-2', ProfileBadgeService::save(['label' => 'Support'])['badge']['id']);
    }

    /**
     * A name of only punctuation or non-latin script sanitizes to nothing, and
     * every badge still needs an id to be assigned under.
     */
    public function testANameThatSanitizesToNothingStillGetsAnId(): void
    {
        $this->assertSame('badge', ProfileBadgeService::save(['label' => '★★★'])['badge']['id']);
    }

    public function testABadgeWithNoNameIsRefused(): void
    {
        $refused = ProfileBadgeService::save(['label' => '   ']);

        $this->assertNull($refused['badge']);
        $this->assertNotSame('', $refused['error']);
        $this->assertSame([], ProfileBadgeService::catalog());
    }

    /**
     * A badge is read beside a name at 10px; a sentence in one wraps the line
     * it is meant to annotate.
     */
    public function testALongNameIsCutToWhatFitsAByline(): void
    {
        $saved = ProfileBadgeService::save(['label' => str_repeat('a', 40)]);

        $this->assertSame(24, mb_strlen($saved['badge']['label']));
    }

    /**
     * The tone reaches the client as a CSS key, so an unknown one would render
     * an unstyled pill.
     */
    public function testAnUnknownToneFallsBackToOneThePortalCanStyle(): void
    {
        $saved = ProfileBadgeService::save(['label' => 'Developer', 'tone' => 'chartreuse']);

        $this->assertSame(BadgeTone::fallback()->value, $saved['badge']['tone']);
    }

    public function testTheCatalogIsCappedAndSaysSoRatherThanFailingQuietly(): void
    {
        for ($i = 1; $i <= ProfileBadgeService::MAX_CATALOG; ++$i) {
            ProfileBadgeService::save(['label' => 'Badge ' . $i]);
        }

        $refused = ProfileBadgeService::save(['label' => 'One too many']);

        $this->assertNull($refused['badge']);
        $this->assertNotSame('', $refused['error']);
        $this->assertCount(ProfileBadgeService::MAX_CATALOG, ProfileBadgeService::catalog());
    }

    // -----------------------------------------------------------------------
    // Editing
    // -----------------------------------------------------------------------

    /**
     * The rule the whole design rests on: renaming Developer to Engineering
     * must not strip the badge from everyone wearing it.
     */
    public function testRenamingABadgeKeepsItsIdAndSoKeepsItsWearers(): void
    {
        ProfileBadgeService::save(['label' => 'Developer', 'tone' => 'green']);
        ProfileBadgeService::assign(self::MEMBER, ['developer']);

        $renamed = ProfileBadgeService::save(['id' => 'developer', 'label' => 'Engineering', 'tone' => 'teal']);

        $this->assertSame('developer', $renamed['badge']['id']);
        $this->assertSame('Engineering', $renamed['badge']['label']);
        $this->assertSame([['id' => 'developer', 'label' => 'Engineering', 'tone' => 'teal']], ProfileBadgeService::badgesFor(self::MEMBER));
    }

    public function testEditingABadgeDoesNotMoveItInTheCatalog(): void
    {
        ProfileBadgeService::save(['label' => 'First']);
        ProfileBadgeService::save(['label' => 'Second']);

        ProfileBadgeService::save(['id' => 'first', 'label' => 'Renamed']);

        $this->assertSame(['first', 'second'], array_column(ProfileBadgeService::catalog(), 'id'));
    }

    /**
     * An id nothing answers to is a create, not a failed edit — the admin
     * screen sends the id it has, and a stale one should still produce a badge.
     */
    public function testSavingAgainstAnIdNothingAnswersToCreatesABadge(): void
    {
        $saved = ProfileBadgeService::save(['id' => 'gone', 'label' => 'Support']);

        $this->assertSame('gone', $saved['badge']['id']);
        $this->assertCount(1, ProfileBadgeService::catalog());
    }

    // -----------------------------------------------------------------------
    // Deleting
    // -----------------------------------------------------------------------

    /**
     * Members keep the id in their meta and it simply stops resolving, so a
     * delete costs one option write however many people wore it.
     */
    public function testDeletingABadgeLeavesItsWearersAloneAndTheyStopShowingIt(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::assign(self::MEMBER, ['developer']);

        ProfileBadgeService::delete('developer');

        $this->assertSame([], ProfileBadgeService::badgesFor(self::MEMBER));
        $this->assertSame(['developer'], ProfileBadgeService::assignedIds(self::MEMBER));
    }

    public function testRestoringABadgeUnderItsOldIdGivesItBackToWhoHadIt(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::assign(self::MEMBER, ['developer']);
        ProfileBadgeService::delete('developer');

        ProfileBadgeService::save(['label' => 'Developer']);

        $this->assertSame(['developer'], array_column(ProfileBadgeService::badgesFor(self::MEMBER), 'id'));
    }

    public function testDeletingSomethingThatIsNotThereLeavesTheCatalogAlone(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);

        $this->assertSame(['developer'], array_column(ProfileBadgeService::delete('gone'), 'id'));
    }

    // -----------------------------------------------------------------------
    // Ordering
    // -----------------------------------------------------------------------

    public function testReorderingDecidesWhichBadgeABylineShowsFirst(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::save(['label' => 'Support']);
        ProfileBadgeService::assign(self::MEMBER, ['developer', 'support']);

        ProfileBadgeService::reorder(['support', 'developer']);

        $this->assertSame('support', ProfileBadgeService::badgesFor(self::MEMBER)[0]['id']);
    }

    /**
     * A stale admin screen reordering four of five badges should not delete the
     * fifth.
     */
    public function testABadgeMissingFromAReorderKeepsItsPlaceAtTheEnd(): void
    {
        ProfileBadgeService::save(['label' => 'One']);
        ProfileBadgeService::save(['label' => 'Two']);
        ProfileBadgeService::save(['label' => 'Three']);

        $reordered = ProfileBadgeService::reorder(['three', 'one']);

        $this->assertSame(['three', 'one', 'two'], array_column($reordered, 'id'));
    }

    public function testIdsNothingAnswersToAreIgnoredByAReorder(): void
    {
        ProfileBadgeService::save(['label' => 'One']);
        ProfileBadgeService::save(['label' => 'Two']);

        $this->assertSame(['two', 'one'], array_column(ProfileBadgeService::reorder(['gone', 'two', 'one']), 'id'));
    }

    // -----------------------------------------------------------------------
    // Handing badges out
    // -----------------------------------------------------------------------

    public function testAMemberWearsWhatTheyWereGiven(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::save(['label' => 'Support']);

        $this->assertSame(['developer', 'support'], ProfileBadgeService::assign(self::MEMBER, ['developer', 'support']));
    }

    /**
     * Dropped here rather than stored and ignored later, so what is written
     * back is what the admin screen reads on its next fetch.
     */
    public function testAnIdTheCatalogDoesNotKnowIsNotStored(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);

        $this->assertSame(['developer'], ProfileBadgeService::assign(self::MEMBER, ['developer', 'invented']));
        $this->assertSame(['developer'], ProfileBadgeService::assignedIds(self::MEMBER));
    }

    public function testTheSameBadgeTwiceIsWornOnce(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);

        $this->assertSame(['developer'], ProfileBadgeService::assign(self::MEMBER, ['developer', 'developer']));
    }

    /**
     * Every badge a member wears rides on every byline they appear in, so the
     * number of them stays small enough to read.
     */
    public function testAMemberCannotWearMoreThanTheCap(): void
    {
        foreach (['One', 'Two', 'Three', 'Four'] as $label) {
            ProfileBadgeService::save(['label' => $label]);
        }

        $assigned = ProfileBadgeService::assign(self::MEMBER, ['one', 'two', 'three', 'four']);

        $this->assertCount(ProfileBadgeService::MAX_PER_MEMBER, $assigned);
    }

    public function testTakingEveryBadgeAwayClearsTheMemberEntirely(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::assign(self::MEMBER, ['developer']);

        $this->assertSame([], ProfileBadgeService::assign(self::MEMBER, []));
        $this->assertSame([], ProfileBadgeService::assignedIds(self::MEMBER));
    }

    public function testNobodyIsNotAMember(): void
    {
        $this->assertSame([], ProfileBadgeService::assign(0, ['developer']));
        $this->assertSame([], ProfileBadgeService::assignedIds(0));
        $this->assertSame([], ProfileBadgeService::badgesFor(0));
    }

    /**
     * The admin screen renders the catalog with checkmarks, so it needs to know
     * what is ticked even for a badge the catalog no longer has.
     */
    public function testTheRawAssignedIdsSurviveTheirBadgeBeingDeleted(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::assign(self::MEMBER, ['developer']);
        ProfileBadgeService::delete('developer');

        $this->assertSame(['developer'], ProfileBadgeService::assignedIds(self::MEMBER));
    }

    // -----------------------------------------------------------------------
    // Resolving
    // -----------------------------------------------------------------------

    /**
     * Catalog order rather than assignment order: priority belongs to the
     * badge, not to the moment it was handed out, so two members wearing
     * Developer and Support show the same one first.
     */
    public function testBadgesComeBackInCatalogOrderRatherThanAssignmentOrder(): void
    {
        ProfileBadgeService::save(['label' => 'Developer']);
        ProfileBadgeService::save(['label' => 'Support']);

        ProfileBadgeService::assign(self::MEMBER, ['support', 'developer']);

        $this->assertSame(['developer', 'support'], array_column(ProfileBadgeService::badgesFor(self::MEMBER), 'id'));
    }

    // -----------------------------------------------------------------------
    // Reading a catalog that has been through other hands
    // -----------------------------------------------------------------------

    /**
     * The catalog is an option, and an option can be anything by the time it
     * comes back — hand-edited, restored from an older shape, or written by
     * another plugin.
     */
    public function testRowsThatAreNotBadgesAreDroppedRatherThanRendered(): void
    {
        $GLOBALS['__wp_options'][self::OPTION] = [
            ['id' => 'developer', 'label' => 'Developer', 'tone' => 'green'],
            ['id' => 'nameless', 'label' => ''],
            ['label' => 'No id'],
            'not-an-array',
            null,
        ];

        $this->assertSame(['developer'], array_column(ProfileBadgeService::catalog(), 'id'));
    }

    /**
     * A duplicate id would make assignment ambiguous — first wins, which is
     * also the higher priority.
     */
    public function testADuplicateIdIsKeptOnceAtItsHigherPriority(): void
    {
        $GLOBALS['__wp_options'][self::OPTION] = [
            ['id' => 'developer', 'label' => 'Developer', 'tone' => 'green'],
            ['id' => 'developer', 'label' => 'Impostor', 'tone' => 'amber'],
        ];

        $catalog = ProfileBadgeService::catalog();

        $this->assertCount(1, $catalog);
        $this->assertSame('Developer', $catalog[0]['label']);
    }

    public function testAnOptionThatIsNotAListComesBackEmpty(): void
    {
        $GLOBALS['__wp_options'][self::OPTION] = 'corrupted';

        $this->assertSame([], ProfileBadgeService::catalog());
    }

    public function testAForumWithNoBadgesHasAnEmptyCatalog(): void
    {
        $this->assertSame([], ProfileBadgeService::catalog());
    }
}
