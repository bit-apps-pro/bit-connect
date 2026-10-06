<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\TagApprovalService;
use BitApps\BitConnect\Services\TagResolverService;
use PHPUnit\Framework\TestCase;
use WP_Term;

/**
 * Names become ids in exactly one place, and that place refuses to create a
 * tag by accident: a typed name lands on the tag that already exists whenever
 * one does, and becomes a new, pending tag only for a member allowed to
 * suggest one and still within their day's allowance.
 *
 * @internal
 *
 * @coversNothing
 */
final class TagResolverServiceTest extends TestCase
{
    private const TAGS = Taxonomies::TAGS->value;

    private const MEMBER = 7;

    protected function setUp(): void
    {
        $GLOBALS['__wp_terms'] = [
            $this->term(11, 'wordpress', 'WordPress'),
            $this->term(12, 'api-integrations', 'API & Integrations'),
        ];
        $GLOBALS['__wp_term_meta'] = [];
        $GLOBALS['__wp_current_time'] = '2026-10-06 12:00:00';
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_term_meta'] = [];
        unset($GLOBALS['__wp_current_time']);
    }

    public function testIdsPassThroughAndDuplicatesCollapse(): void
    {
        $this->assertSame([11, 12], TagResolverService::resolve([11, '12', 11, 0], self::MEMBER, false)['ids']);
    }

    public function testATypedNameLandsOnTheExistingTagWhateverItsCaseOrSpelling(): void
    {
        $this->assertSame([11], TagResolverService::resolve(['wordpress'], self::MEMBER, false)['ids']);
        $this->assertSame([11], TagResolverService::resolve(['WordPress'], self::MEMBER, false)['ids']);
        $this->assertSame([11], TagResolverService::resolve(['#WordPress'], self::MEMBER, false)['ids']);
        $this->assertSame([11], TagResolverService::resolve(['  WordPress '], self::MEMBER, false)['ids']);
        $this->assertSame([12], TagResolverService::resolve(['API & Integrations'], self::MEMBER, false)['ids']);

        $this->assertCount(2, $GLOBALS['__wp_terms']);
    }

    public function testAMemberWithoutTheCapabilityCannotAddATag(): void
    {
        $result = TagResolverService::resolve([11, 'brand new'], self::MEMBER, false);

        $this->assertTrue(is_wp_error($result));
        $this->assertSame('bit_connect_tag_create_forbidden', $result->get_error_code());
        $this->assertCount(2, $GLOBALS['__wp_terms']);
    }

    public function testAnAllowedMemberGetsAPendingTagThatRemembersThem(): void
    {
        $result = TagResolverService::resolve(['Brand New'], self::MEMBER, true);

        $this->assertSame([13], $result['ids']);
        $this->assertSame([['id' => 13, 'name' => 'Brand New']], $result['created']);
        $created = get_term(13);
        $this->assertSame('Brand New', $created->name);
        $this->assertSame('brand-new', $created->slug);
        $this->assertTrue(TagApprovalService::isPending(13));
        $this->assertSame(self::MEMBER, (int) get_term_meta(13, TagApprovalService::META_CREATOR, true));
        $this->assertSame('2026-10-06 12:00:00', get_term_meta(13, TagApprovalService::META_CREATED_AT, true));
        $this->assertSame([13], TagApprovalService::pendingIds());
    }

    public function testTheSameNewNameTwiceInOneTopicIsOneTag(): void
    {
        $this->assertSame([13], TagResolverService::resolve(['fresh', 'Fresh'], self::MEMBER, true)['ids']);
        $this->assertCount(3, $GLOBALS['__wp_terms']);
    }

    public function testTheDailyAllowanceIsEnforced(): void
    {
        $names = ['one', 'two', 'three', 'four'];
        $result = TagResolverService::resolve(\array_slice($names, 0, TagApprovalService::DAILY_LIMIT + 1), self::MEMBER, true);

        $this->assertTrue(is_wp_error($result));
        $this->assertSame('bit_connect_tag_limit', $result->get_error_code());
    }

    public function testYesterdaysSuggestionsDoNotCountAgainstToday(): void
    {
        $GLOBALS['__wp_current_time'] = '2026-10-05 11:00:00';
        TagResolverService::resolve(['a', 'b', 'c'], self::MEMBER, true);

        $GLOBALS['__wp_current_time'] = '2026-10-06 12:00:00';
        $this->assertSame(0, TagApprovalService::createdToday(self::MEMBER));
        $this->assertCount(1, TagResolverService::resolve(['d'], self::MEMBER, true)['created']);
    }

    public function testBlankAndOverlongNamesAreTrimmedRatherThanCreated(): void
    {
        $this->assertSame(['ids' => [], 'created' => []], TagResolverService::resolve(['', '   ', '#'], self::MEMBER, true));
        $this->assertSame(60, mb_strlen(TagResolverService::normalise(str_repeat('x', 80))));
    }

    private function term(int $id, string $slug, string $name): WP_Term
    {
        $term = new WP_Term();
        $term->term_id = $id;
        $term->slug = $slug;
        $term->name = $name;
        $term->taxonomy = self::TAGS;
        $term->description = '';

        return $term;
    }
}
