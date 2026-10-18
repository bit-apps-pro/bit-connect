<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Services\TagApprovalService;
use PHPUnit\Framework\TestCase;
use WP_Term;

/**
 * Approval is the flag coming off, and nothing else: the tag, its topics and
 * who suggested it all stay as they were.
 *
 * @internal
 *
 * @coversNothing
 */
final class TagApprovalServiceTest extends TestCase
{
    protected function setUp(): void
    {
        $pending = new WP_Term();
        $pending->term_id = 21;
        $pending->slug = 'suggested';
        $pending->name = 'Suggested';
        $pending->taxonomy = Taxonomies::TAGS->value;

        $type = new WP_Term();
        $type->term_id = 22;
        $type->slug = 'billing';
        $type->name = 'Billing';
        $type->taxonomy = Taxonomies::TOPIC_TYPES->value;

        $GLOBALS['__wp_terms'] = [$pending, $type];
        $GLOBALS['__wp_term_meta'] = [
            21 => [TagApprovalService::META_STATUS => 'pending', TagApprovalService::META_CREATOR => 7],
        ];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_terms'] = [];
        $GLOBALS['__wp_term_meta'] = [];
    }

    public function testApprovingKeepsTheTagAndWhoSuggestedIt(): void
    {
        $this->assertSame([21], TagApprovalService::pendingIds());

        $this->assertTrue(TagApprovalService::approve(21));

        $this->assertFalse(TagApprovalService::isPending(21));
        $this->assertSame([], TagApprovalService::pendingIds());
        $this->assertSame(7, (int) get_term_meta(21, TagApprovalService::META_CREATOR, true));
        $this->assertNotNull(get_term(21));
    }

    public function testOnlyATagCanBeApproved(): void
    {
        $result = TagApprovalService::approve(22);

        $this->assertTrue(is_wp_error($result));
        $this->assertTrue(is_wp_error(TagApprovalService::approve(404)));
    }
}
