<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\MemberProfileService;
use PHPUnit\Framework\TestCase;

class MemberProfileServiceTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_user_meta'] = [];
    }

    // -------------------------------------------------------------------------
    // Bio
    // -------------------------------------------------------------------------

    public function testStoresAndReadsBackABio(): void
    {
        MemberProfileService::setBio(1, 'Builds things on the weekend.');

        $this->assertSame('Builds things on the weekend.', MemberProfileService::bio(1));
    }

    public function testAMemberWithoutABioGetsAnEmptyString(): void
    {
        $this->assertSame('', MemberProfileService::bio(1));
    }

    public function testAnEmptyBioClearsRatherThanStoringBlank(): void
    {
        MemberProfileService::setBio(1, 'Something');
        MemberProfileService::setBio(1, '');

        $this->assertSame('', MemberProfileService::bio(1));
        // Cleared, not left as an empty row — the form submits every field, and
        // an empty one means "erase this".
        $this->assertArrayNotHasKey('bit_connect_bio', $GLOBALS['__wp_user_meta'][1] ?? []);
    }

    public function testStripsMarkupFromABio(): void
    {
        MemberProfileService::setBio(1, '<script>alert(1)</script>Hello');

        $this->assertSame('alert(1)Hello', MemberProfileService::bio(1));
    }

    public function testTruncatesABioPastTheCap(): void
    {
        MemberProfileService::setBio(1, str_repeat('a', 600));

        $this->assertSame(MemberProfileService::MAX_BIO_LENGTH, mb_strlen(MemberProfileService::bio(1)));
    }

    // -------------------------------------------------------------------------
    // Links
    // -------------------------------------------------------------------------

    public function testKeepsOnlyKnownLinkKeys(): void
    {
        MemberProfileService::setLinks(
            1,
            [
                'github'  => 'https://github.com/aiden',
                'myspace' => 'https://myspace.com/aiden',
            ]
        );

        $this->assertSame(['github' => 'https://github.com/aiden'], MemberProfileService::links(1));
    }

    public function testDropsLinksWithADisallowedProtocol(): void
    {
        MemberProfileService::setLinks(
            1,
            [
                'website' => 'javascript:alert(1)',
                'github'  => 'https://github.com/aiden',
            ]
        );

        $links = MemberProfileService::links(1);

        $this->assertArrayNotHasKey('website', $links);
        $this->assertSame('https://github.com/aiden', $links['github']);
    }

    public function testOmitsKeysTheMemberLeftBlank(): void
    {
        MemberProfileService::setLinks(1, ['github' => 'https://github.com/aiden', 'website' => '']);

        $this->assertSame(['github' => 'https://github.com/aiden'], MemberProfileService::links(1));
    }

    public function testClearingEveryLinkRemovesTheStoredValue(): void
    {
        MemberProfileService::setLinks(1, ['github' => 'https://github.com/aiden']);
        MemberProfileService::setLinks(1, ['github' => '']);

        $this->assertSame([], MemberProfileService::links(1));
        $this->assertArrayNotHasKey('bit_connect_social_links', $GLOBALS['__wp_user_meta'][1] ?? []);
    }

    public function testALaterSaveReplacesTheWholeSetRatherThanMerging(): void
    {
        MemberProfileService::setLinks(1, ['github' => 'https://github.com/aiden']);
        MemberProfileService::setLinks(1, ['website' => 'https://aiden.dev']);

        $this->assertSame(['website' => 'https://aiden.dev'], MemberProfileService::links(1));
    }

    public function testNonArrayInputYieldsNoLinks(): void
    {
        $this->assertSame([], MemberProfileService::sanitizeLinks('https://aiden.dev'));
    }
}
