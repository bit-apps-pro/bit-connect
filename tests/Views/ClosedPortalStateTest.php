<?php

namespace BitApps\BitConnect\Tests\Views;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Views\TopicsView;
use PHPUnit\Framework\TestCase;
use WP_Post;
use WP_Term;

/**
 * What a members-only portal hands a logged-out visitor in its markup.
 *
 * The portal showed them a sign-in prompt, but the topic page's hydration
 * state carried the whole topic — title and body — and the list page every
 * topic on it, readable in the page source by anyone who looked. The state is
 * in the markup whatever the client does with it, so it must be empty.
 *
 * @internal
 *
 * @coversNothing
 */
final class ClosedPortalStateTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [
            Config::withPrefix('general_settings') => ['portalAccess' => 'logged_in'],
        ];

        $topic = new WP_Post();
        $topic->ID = 11;
        $topic->post_type = 'bit-connect';
        $topic->post_name = 'secret-topic';
        $topic->post_title = 'Secret topic';
        $GLOBALS['__wp_posts'] = [11 => $topic];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_posts'] = [];
        $GLOBALS['__wp_current_user_id'] = 0;
    }

    public function testATopicRouteCarriesNoTopicForAGuest(): void
    {
        $view = (new TopicsView())->prepareTopicDetailsData('secret-topic');

        $this->assertSame(['topicDetails' => ['topic' => null]], $view->getState());
        $this->assertNull($view->getViewData()['topic']);
        $this->assertTrue(TopicsView::isClosed());
    }

    public function testTheListRouteCarriesNoTopicsForAGuest(): void
    {
        $view = (new TopicsView())->prepareData(1);

        $this->assertSame(['data' => [], 'stages' => []], $view->getState());
        $this->assertSame([], $view->getViewData()['topics']);
    }

    public function testAnArchiveRouteCarriesNoTopicsForAGuest(): void
    {
        $term = new WP_Term();
        $term->term_id = 3;
        $term->taxonomy = 'bit-connect-tags';

        $view = (new TopicsView())->prepareArchiveData($term);

        $this->assertSame(['data' => [], 'stages' => []], $view->getState());
        $this->assertSame([], $view->getViewData()['topics']);
    }

    public function testTheRoutesAreOpenToAMemberAndOnAnOpenForum(): void
    {
        $GLOBALS['__wp_current_user_id'] = 5;
        $this->assertFalse(TopicsView::isClosed());

        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__wp_options'][Config::withPrefix('general_settings')]['portalAccess'] = 'everyone';
        $this->assertFalse(TopicsView::isClosed());
    }
}
