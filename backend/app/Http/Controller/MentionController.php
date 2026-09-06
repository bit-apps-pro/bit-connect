<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\SearchMentionsRequest;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\ProfileSlugService;

/**
 * The list behind the "@" in an editor.
 *
 * Answers one question — "who did they mean?" — and answers it with the member
 * as the portal already shows them: display name, avatar, and the profile URL
 * the mention will link to. The URL is built here rather than in the client
 * because only the server knows where the portal lives (root or under a slug),
 * and a mention pointing at the wrong path is a mention nobody can follow.
 */
final class MentionController
{
    /**
     * How many names the picker offers.
     *
     * Short on purpose: a dropdown is scanned, not read. Anyone whose colleague
     * is not in the first eight has typed too little, and one more letter is a
     * faster way to the right person than a scrollable list.
     */
    private const LIMIT = 8;

    public function search(SearchMentionsRequest $request)
    {
        $term = trim((string) ($request->q ?? ''));

        // Every member on the forum is not an answer to "@". The picker opens on
        // the "@" itself and asks with an empty term on the first keystroke, so
        // returning the first eight accounts would show a list unrelated to
        // anything the author has typed.
        if ($term === '') {
            return Response::success([]);
        }

        $users = get_users(
            [
                'search' => '*' . $term . '*',
                // Display name alone. user_login and user_email are the two
                // fields this must never search: matching on them turns a
                // convenience into a way to confirm somebody's login or address
                // one character at a time.
                'search_columns' => ['display_name'],
                'number'         => self::LIMIT,
                'orderby'        => 'display_name',
                'order'          => 'ASC',
            ]
        );

        $members = [];

        foreach ($users as $user) {
            $slug = ProfileSlugService::slugFor((int) $user->ID);

            // No slug, no mention: the link is the mention, and there is nothing
            // to point it at. slugFor() backfills, so this is all but
            // unreachable — it is here so a broken account cannot ship a
            // half-built link into somebody's comment.
            if ($slug === '') {
                continue;
            }

            $members[] = [
                'id'   => (int) $user->ID,
                'name' => (string) $user->display_name,
                'slug' => $slug,
                // Root-relative, and that is the whole reason the server builds
                // it: an absolute URL is read as another site by both sanitizers
                // the content passes through, which would publish a colleague's
                // profile link as nofollow and open it in a new tab. Relative
                // also keeps working if the site later moves domain.
                'href'   => wp_make_link_relative(PortalLocation::url('user/' . $slug)),
                'avatar' => (string) get_avatar_url($user->ID, ['size' => 48]),
            ];
        }

        return Response::success($members);
    }
}
