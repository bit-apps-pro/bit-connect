<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Services\MembersOnlyGuard;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Error;
use WP_Post;
use WP_Query;
use WP_REST_Request;

/**
 * The doors core opens onto topics, closed while the forum is members-only.
 *
 * The topic post type is public and `show_in_rest`, so core served its topics
 * over `/wp/v2/bit-connect`, the feeds and the site search to logged-out
 * visitors of a forum the portal itself refused them. Each test runs both ways:
 * the guard must shut these for a guest of a closed forum, and must leave
 * core's behaviour alone for an open forum and for anyone logged in.
 *
 * @internal
 *
 * @coversNothing
 */
final class MembersOnlyGuardTest extends TestCase
{
    private const TOPIC = 11;

    private const PAGE = 12;

    private const TOPIC_COMMENT = 21;

    private const PAGE_COMMENT = 22;

    protected function setUp(): void
    {
        $this->portal('logged_in');

        $GLOBALS['__wp_posts'] = [
            self::TOPIC => $this->post(self::TOPIC, 'bit-connect'),
            self::PAGE  => $this->post(self::PAGE, 'page'),
        ];
        $GLOBALS['__wp_comments'] = [
            self::TOPIC_COMMENT => $this->comment(self::TOPIC),
            self::PAGE_COMMENT  => $this->comment(self::PAGE),
        ];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_comments'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__wp_is_admin'] = false;
    }

    #[DataProvider('topicRoutes')]
    public function testAGuestOfAClosedForumIsRefusedTheTopicRoutes(string $route): void
    {
        $result = MembersOnlyGuard::refuseRestRoute(null, null, $this->rest($route));

        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertSame('rest_forbidden', $result->get_error_code());
    }

    #[DataProvider('topicRoutes')]
    public function testAGuestOfAnOpenForumIsNot(string $route): void
    {
        $this->portal('everyone');

        $this->assertNull(MembersOnlyGuard::refuseRestRoute(null, null, $this->rest($route)));
    }

    #[DataProvider('topicRoutes')]
    public function testALoggedInVisitorOfAClosedForumIsNot(string $route): void
    {
        $GLOBALS['__wp_current_user_id'] = 5;

        $this->assertNull(MembersOnlyGuard::refuseRestRoute(null, null, $this->rest($route)));
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function topicRoutes(): array
    {
        return [
            'topic list'      => ['/wp/v2/bit-connect'],
            'one topic'       => ['/wp/v2/bit-connect/11'],
            'topic revisions' => ['/wp/v2/bit-connect/11/revisions'],
            'topic tags'      => ['/wp/v2/bit-connect-tags'],
            'one status'      => ['/wp/v2/bit-connect-statuses/3'],
        ];
    }

    /**
     * Only this plugin's routes: a core route sharing the prefix's first
     * letters, or any other post type, is none of the guard's business.
     */
    public function testRoutesOfOtherTypesStayOpen(): void
    {
        $this->assertFalse(MembersOnlyGuard::isClosedRoute('/wp/v2/posts', []));
        $this->assertFalse(MembersOnlyGuard::isClosedRoute('/wp/v2/pages/12', []));
        $this->assertFalse(MembersOnlyGuard::isClosedRoute('/wp/v2/bit-connect-other', []));
    }

    public function testACommentOnATopicIsClosedAndOneOnAPageIsNot(): void
    {
        $this->assertTrue(MembersOnlyGuard::isClosedRoute('/wp/v2/comments/' . self::TOPIC_COMMENT, []));
        $this->assertFalse(MembersOnlyGuard::isClosedRoute('/wp/v2/comments/' . self::PAGE_COMMENT, []));
        $this->assertFalse(MembersOnlyGuard::isClosedRoute('/wp/v2/comments/999', []));
    }

    public function testTheCommentListIsClosedWhenItAsksForATopic(): void
    {
        $this->assertTrue(MembersOnlyGuard::isClosedRoute('/wp/v2/comments', ['post' => self::TOPIC]));
        $this->assertTrue(MembersOnlyGuard::isClosedRoute('/wp/v2/comments', ['post' => [self::PAGE, self::TOPIC]]));
        $this->assertFalse(MembersOnlyGuard::isClosedRoute('/wp/v2/comments', ['post' => [self::PAGE]]));
    }

    /**
     * The unfiltered list stays open to a guest, with topic comments taken out
     * of the types it reads.
     */
    public function testTheUnfilteredCommentListLeavesTopicsOut(): void
    {
        $args = MembersOnlyGuard::withoutTopicComments(['number' => 10]);

        $this->assertSame(['post', 'page', 'attachment'], $args['post_type']);

        $this->portal('everyone');
        $this->assertSame(['number' => 10], MembersOnlyGuard::withoutTopicComments(['number' => 10]));
    }

    public function testTheSearchRouteLeavesTopicsOut(): void
    {
        $args = MembersOnlyGuard::withoutTopicsInSearch(['post_type' => ['post', 'bit-connect']]);
        $this->assertSame(['post'], $args['post_type']);

        // A search for topics alone must find nothing, not widen to everything.
        $args = MembersOnlyGuard::withoutTopicsInSearch(['post_type' => ['bit-connect']]);
        $this->assertSame([0], $args['post__in']);
    }

    public function testATopicIsNotEmbeddedForAGuest(): void
    {
        $this->assertSame(0, MembersOnlyGuard::refuseOembed(self::TOPIC));
        $this->assertSame(self::PAGE, MembersOnlyGuard::refuseOembed(self::PAGE));

        $GLOBALS['__wp_current_user_id'] = 5;
        $this->assertSame(self::TOPIC, MembersOnlyGuard::refuseOembed(self::TOPIC));
    }

    public function testTheCommentFeedLeavesTopicCommentsOut(): void
    {
        $where = MembersOnlyGuard::withoutTopicCommentsInFeed("WHERE comment_approved = '1'");

        $this->assertSame(
            "WHERE comment_approved = '1' AND comment_post_ID NOT IN (SELECT ID FROM wp_posts WHERE post_type = 'bit-connect')",
            $where
        );

        $this->portal('everyone');
        $this->assertSame('WHERE 1', MembersOnlyGuard::withoutTopicCommentsInFeed('WHERE 1'));
    }

    /**
     * `?s=` with no type searches every searchable type, topics included.
     */
    public function testTheSiteSearchLeavesTopicsOut(): void
    {
        $query = $this->mainQuery(['search' => true]);

        MembersOnlyGuard::restrictMainQuery($query);

        $this->assertSame(['post', 'page', 'attachment'], $query->vars['post_type']);
    }

    public function testATopicFeedFindsNothing(): void
    {
        $query = $this->mainQuery(['feed' => true], ['post_type' => 'bit-connect']);

        MembersOnlyGuard::restrictMainQuery($query);

        $this->assertSame([0], $query->vars['post__in']);
    }

    public function testAFeedOfSeveralTypesKeepsTheOthers(): void
    {
        $query = $this->mainQuery(['feed' => true], ['post_type' => ['post', 'bit-connect']]);

        MembersOnlyGuard::restrictMainQuery($query);

        $this->assertSame(['post'], $query->vars['post_type']);
    }

    public function testATopicTaxonomyArchiveFindsNothing(): void
    {
        $query = $this->mainQuery(['tax' => true]);

        MembersOnlyGuard::restrictMainQuery($query);

        $this->assertSame([0], $query->vars['post__in']);
    }

    /**
     * A topic URL must still reach the portal, which shows the sign-in prompt;
     * narrowing an ordinary query would turn it into a 404.
     */
    public function testAnyOtherMainQueryIsLeftAlone(): void
    {
        $query = $this->mainQuery([], ['post_type' => 'bit-connect']);

        MembersOnlyGuard::restrictMainQuery($query);

        $this->assertSame(['post_type' => 'bit-connect'], $query->vars);
    }

    public function testTheMainQueryIsLeftAloneForAnOpenForumAMemberAndTheAdmin(): void
    {
        $this->portal('everyone');
        $query = $this->mainQuery(['search' => true]);
        MembersOnlyGuard::restrictMainQuery($query);
        $this->assertSame([], $query->vars);

        $this->portal('logged_in');
        $GLOBALS['__wp_current_user_id'] = 5;
        $query = $this->mainQuery(['search' => true]);
        MembersOnlyGuard::restrictMainQuery($query);
        $this->assertSame([], $query->vars);

        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__wp_is_admin'] = true;
        $query = $this->mainQuery(['search' => true]);
        MembersOnlyGuard::restrictMainQuery($query);
        $this->assertSame([], $query->vars);
    }

    public function testASecondaryQueryIsLeftAlone(): void
    {
        $query = $this->mainQuery(['search' => true, 'main' => false]);

        MembersOnlyGuard::restrictMainQuery($query);

        $this->assertSame([], $query->vars);
    }

    private function portal(string $access): void
    {
        $GLOBALS['__wp_options'] = [
            Config::withPrefix('general_settings') => ['portalAccess' => $access],
        ];
    }

    private function post(int $id, string $type): WP_Post
    {
        $post = new WP_Post();
        $post->ID = $id;
        $post->post_type = $type;

        return $post;
    }

    private function comment(int $postId): WP_Comment
    {
        $comment = new WP_Comment();
        $comment->comment_post_ID = (string) $postId;

        return $comment;
    }

    /**
     * @param array<string, mixed> $params
     */
    private function rest(string $route, array $params = []): WP_REST_Request
    {
        return new class($route, $params) extends WP_REST_Request {
            public function __construct(private string $route, private array $params)
            {
                parent::__construct();
            }

            public function get_route()
            {
                return $this->route;
            }

            public function get_params()
            {
                return $this->params;
            }
        };
    }

    /**
     * A main query in the given state, recording what the guard sets.
     *
     * @param array<string, bool>  $flags
     * @param array<string, mixed> $vars
     */
    private function mainQuery(array $flags, array $vars = []): WP_Query
    {
        return new class($flags, $vars) extends WP_Query {
            /** @var array<string, mixed> */
            public array $vars;

            /** @var array<string, bool> */
            private array $flags;

            public function __construct(array $flags, array $vars)
            {
                $this->flags = $flags;
                $this->vars = $vars;
            }

            public function is_main_query()
            {
                return $this->flags['main'] ?? true;
            }

            public function is_feed($feeds = '')
            {
                return $this->flags['feed'] ?? false;
            }

            public function is_search()
            {
                return $this->flags['search'] ?? false;
            }

            public function is_tax($taxonomy = '', $term = '')
            {
                return $this->flags['tax'] ?? false;
            }

            public function get($key, $default = '')
            {
                return $this->vars[$key] ?? $default;
            }

            public function set($key, $value)
            {
                $this->vars[$key] = $value;
            }
        };
    }
}
