<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\MentionService;
use PHPUnit\Framework\TestCase;

/**
 * What counts as naming somebody, read out of the words that were stored.
 *
 * The cases that matter are mostly the negative ones: an email address, a code
 * sample and a link to another site all contain the shapes a mention is made of,
 * and each one wrongly read is a notification somebody never asked for.
 */
class MentionServiceTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_home_url'] = 'https://forum.example.com';

        $this->seedMember(7, 'aiden-carter');
        $this->seedMember(9, 'priya-nair');
    }

    // -------------------------------------------------------------------------
    // Mentions the picker writes
    // -------------------------------------------------------------------------

    public function testReadsAMentionWrittenAsAProfileLink(): void
    {
        $html = '<p>Thanks <a class="bc-mention" href="https://forum.example.com/user/aiden-carter">@Aiden Carter</a>!</p>';

        $this->assertSame([7], MentionService::parse($html));
    }

    public function testReadsAMentionFromARelativeProfileLink(): void
    {
        $html = '<p><a href="/user/priya-nair">@Priya Nair</a> could you look?</p>';

        $this->assertSame([9], MentionService::parse($html));
    }

    public function testIgnoresAProfileLinkThatIsNotAddressingAnyone(): void
    {
        // A citation, not a mention: the text does not speak to them.
        $html = '<p>See <a href="https://forum.example.com/user/aiden-carter">Aiden\'s profile</a>.</p>';

        $this->assertSame([], MentionService::parse($html));
    }

    public function testIgnoresAProfilePathOnAnotherSite(): void
    {
        $html = '<p><a href="https://elsewhere.example.org/user/aiden-carter">@Aiden Carter</a></p>';

        $this->assertSame([], MentionService::parse($html));
    }

    // -------------------------------------------------------------------------
    // Mentions somebody typed
    // -------------------------------------------------------------------------

    public function testReadsASlugTypedAsPlainText(): void
    {
        $this->assertSame([7], MentionService::parse('<p>@aiden-carter any idea?</p>'));
    }

    public function testDoesNotReadTheLocalPartOfAnEmailAddress(): void
    {
        $this->assertSame([], MentionService::parse('<p>Mail it to releases@aiden-carter.example.com</p>'));
    }

    public function testDoesNotReadNamesInsideCode(): void
    {
        $html = '<pre><code>curl -u @aiden-carter https://api.example.com</code></pre>';

        $this->assertSame([], MentionService::parse($html));
    }

    public function testIgnoresASlugNobodyOwns(): void
    {
        $this->assertSame([], MentionService::parse('<p>@everyone please read</p>'));
    }

    public function testDoesNotReadTheDisplayNameInsideAPickedMentionAsASlug(): void
    {
        // "@Aiden Carter" would otherwise offer "aiden" as a bare token, and on a
        // forum where somebody owns that slug it would notify the wrong member.
        $this->seedMember(4, 'aiden');

        $html = '<p><a href="https://forum.example.com/user/aiden-carter">@Aiden Carter</a></p>';

        $this->assertSame([7], MentionService::parse($html));
    }

    // -------------------------------------------------------------------------
    // Shape of the answer
    // -------------------------------------------------------------------------

    public function testCountsAMemberOnceHoweverManyTimesTheyAreNamed(): void
    {
        $html = '<p>@aiden-carter and again <a href="/user/aiden-carter">@Aiden Carter</a></p>';

        $this->assertSame([7], MentionService::parse($html));
    }

    public function testStopsAtTheCap(): void
    {
        $names = [];

        for ($i = 1; $i <= MentionService::MAX_PER_POST + 5; ++$i) {
            $slug = 'member-' . $i;
            $this->seedMember(100 + $i, $slug);
            $names[] = '@' . $slug;
        }

        $mentioned = MentionService::parse('<p>' . implode(' ', $names) . '</p>');

        $this->assertCount(MentionService::MAX_PER_POST, $mentioned);
    }

    public function testEmptyContentNamesNobody(): void
    {
        $this->assertSame([], MentionService::parse(''));
        $this->assertSame([], MentionService::parse('   '));
    }

    // -------------------------------------------------------------------------
    // Edits
    // -------------------------------------------------------------------------

    public function testAnEditReportsOnlyTheNamesItAdded(): void
    {
        $before = '<p>@aiden-carter what do you think?</p>';
        $after = '<p>@aiden-carter what do you think? @priya-nair you too</p>';

        $this->assertSame([9], MentionService::added($before, $after));
    }

    public function testRewordingAroundTheSameNameAddsNobody(): void
    {
        $before = '<p>@aiden-carter what do you think?</p>';
        $after = '<p>@aiden-carter — what do you think of this?</p>';

        $this->assertSame([], MentionService::added($before, $after));
    }

    public function testRemovingANameAddsNobody(): void
    {
        $before = '<p>@aiden-carter @priya-nair</p>';
        $after = '<p>@aiden-carter</p>';

        $this->assertSame([], MentionService::added($before, $after));
    }

    /**
     * A member with a profile slug, which is the only thing a mention resolves
     * through — ProfileSlugService::resolve() reads exactly this meta key.
     */
    private function seedMember(int $id, string $slug): void
    {
        $GLOBALS['__wp_user_meta'][$id][Config::VAR_PREFIX . 'profile_slug'] = $slug;
    }
}
