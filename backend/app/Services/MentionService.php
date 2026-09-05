<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

/**
 * Who a piece of writing addressed by name.
 *
 * A mention is a link to a member's profile that the author meant as a name.
 * The editor's picker marks the links it writes with MARKUP_CLASS and leaves
 * the plain name as the text; a link whose text starts with "@" counts too, and
 * so does "@aiden-carter" typed by hand outside any link — a rule that only
 * worked when you used the dropdown would look broken to the one person who
 * knew the slug and typed it.
 *
 * Read from the stored content, never from the request. The client could just
 * as easily post a list of user ids, and then "who did this comment mention?"
 * would be a claim by the author rather than a fact about their words — which
 * is the whole difference between a mention and a way to mail anybody on the
 * forum.
 *
 * Nothing here notifies. It answers who was named; NotificationService decides
 * who hears about it, which is where preferences, the actor and the
 * one-event-one-row rule already live.
 */
final class MentionService
{
    /**
     * The most people one comment or topic can address.
     *
     * A ceiling on the blast radius, not a style guide. Naming eleven colleagues
     * is unusual; a paste that names two hundred is how a notification system
     * becomes a mailing list, and the twelfth name silently doing nothing is a
     * far better failure than the two hundredth arriving.
     */
    public const MAX_PER_POST = 10;

    /**
     * The class the editor marks a mention link with.
     *
     * Read here, and the reason the picker can write a bare name: a link the
     * author built out of the dropdown is a mention because they chose one, not
     * because of how its text happens to start. It is also what makes a mention
     * *look* like one wherever the words are rendered, and what tells
     * CommentSanitizerService which single class value is worth letting through
     * on a comment's links.
     *
     * Not the only signal, deliberately. A mention has to survive being retyped
     * or quoted through a sanitizer that has never heard of this class, which is
     * what the "@" in the link text still covers.
     */
    public const MARKUP_CLASS = 'bc-mention';

    /**
     * How many distinct candidate slugs are looked up before the rest are
     * dropped.
     *
     * Each one is a database read, so this bounds the cost of a hostile draft
     * holding a thousand "@" tokens. Higher than MAX_PER_POST because plenty of
     * candidates resolve to nobody — "@here", "@everyone", a typo — and those
     * should not use up a real member's place.
     */
    private const MAX_CANDIDATES = 30;

    /**
     * Everyone this content names.
     *
     * @param string $content stored HTML — a comment body or a topic's post_content
     *
     * @return array<int, int> member ids, deduplicated, capped at MAX_PER_POST
     */
    public static function parse(string $content): array
    {
        if (trim($content) === '') {
            return [];
        }

        // Code is quoted, not addressed. An email in a snippet or a shell
        // variable is not a member of the forum being spoken to, and a paste of
        // someone else's config file should not notify anyone.
        $html = self::withoutCode($content);

        $slugs = array_merge(self::linkedSlugs($html), self::typedSlugs($html));

        $ids = [];

        foreach (\array_slice(array_unique($slugs), 0, self::MAX_CANDIDATES) as $slug) {
            $id = ProfileSlugService::resolve($slug);

            if ($id > 0) {
                // Keyed rather than appended: two spellings of the same member —
                // a current slug and one they used to have — are one mention.
                $ids[$id] = $id;
            }

            if (\count($ids) >= self::MAX_PER_POST) {
                break;
            }
        }

        return array_values($ids);
    }

    /**
     * The names an edit added.
     *
     * An edit re-notifies the people it newly names and nobody else: saving a
     * typo fix would otherwise tell everyone already named that they had been
     * mentioned again, for a comment they were told about when it was written.
     *
     * @param string $before content as it stood
     * @param string $after  content as saved
     *
     * @return array<int, int>
     */
    public static function added(string $before, string $after): array
    {
        return array_values(array_diff(self::parse($after), self::parse($before)));
    }

    /**
     * Slugs from profile links the author meant as a name, not a citation.
     *
     * A member writing "see Aiden's profile" over a link has referred to them;
     * picking Aiden out of the "@" dropdown has spoken to them, and only the
     * second is worth an interruption. Two things say which happened:
     *
     *   - MARKUP_CLASS, which the picker puts on every link it writes. This is
     *     the usual case, and the one that lets the chip read as a plain name.
     *   - an "@" starting the link text, for mentions written before the picker
     *     dropped the prefix, and for anywhere the class did not survive.
     *
     * @return array<int, string>
     */
    private static function linkedSlugs(string $html): array
    {
        if (!preg_match_all('#<a\b([^>]*)>(.*?)</a>#is', $html, $links, PREG_SET_ORDER)) {
            return [];
        }

        $slugs = [];

        foreach ($links as $link) {
            $text = trim(html_entity_decode(wp_strip_all_tags($link[2]), ENT_QUOTES));

            if (!str_starts_with($text, '@') && !self::isMarked($link[1])) {
                continue;
            }

            if (!preg_match('#\bhref=(["\'])(.*?)\1#i', $link[1], $href)) {
                continue;
            }

            $slug = self::slugFromProfileUrl($href[2]);

            if ($slug !== '') {
                $slugs[] = $slug;
            }
        }

        return $slugs;
    }

    /**
     * Slugs typed as plain text, outside any link.
     *
     * Links are removed first rather than scanned: the visible text of a picked
     * mention is a display name ("Aiden Carter"), and reading its first word as
     * a slug would address whoever happens to own "aiden" instead.
     *
     * @return array<int, string>
     */
    private static function typedSlugs(string $html): array
    {
        $withoutLinks = preg_replace('#<a\b[^>]*>.*?</a>#is', ' ', $html) ?? $html;
        $plain = html_entity_decode(wp_strip_all_tags($withoutLinks), ENT_QUOTES);

        // The lookbehind is what keeps an email address out: the local part of
        // "release@example.com" is a word character, so its "@" never opens a
        // mention. A "/" is excluded for the same reason — a URL ending in a
        // handle is a link, not a name being spoken.
        $pattern = '/(?<![\w@\/.-])@([a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9])/i';

        return preg_match_all($pattern, $plain, $matches)
            ? array_map('sanitize_title', $matches[1])
            : [];
    }

    /**
     * Whether a link's attributes carry the editor's mention marker.
     *
     * Matched against the split class list rather than the raw attribute, so a
     * link somebody gave a class of "bc-mention-ish" is not read as one.
     */
    private static function isMarked(string $attributes): bool
    {
        if (!preg_match('#\bclass=(["\'])(.*?)\1#i', $attributes, $class)) {
            return false;
        }

        $names = preg_split('/\s+/', trim(html_entity_decode($class[2], ENT_QUOTES)));

        return \is_array($names) && \in_array(self::MARKUP_CLASS, $names, true);
    }

    /**
     * The profile slug a URL points at, or '' when it points somewhere else.
     *
     * Host-checked so a link to another site's /user/ path cannot address a
     * member here. A relative href has no host and is ours by definition.
     */
    private static function slugFromProfileUrl(string $href): string
    {
        $href = trim(html_entity_decode($href, ENT_QUOTES));

        if ($href === '') {
            return '';
        }

        $host = wp_parse_url($href, PHP_URL_HOST);

        if (\is_string($host) && $host !== '' && $host !== wp_parse_url(home_url('/'), PHP_URL_HOST)) {
            return '';
        }

        $path = wp_parse_url($href, PHP_URL_PATH);

        if (!\is_string($path)) {
            return '';
        }

        // Anchored to the end of the path, so the profile route is the thing
        // being linked to and not a prefix of something deeper.
        return preg_match('#/user/([^/]+)/?$#', $path, $matched)
            ? sanitize_title(urldecode($matched[1]))
            : '';
    }

    /**
     * The content with code blocks and inline code removed.
     */
    private static function withoutCode(string $html): string
    {
        $stripped = preg_replace('#<(pre|code)\b[^>]*>.*?</\1>#is', ' ', $html);

        return \is_string($stripped) ? $stripped : $html;
    }
}
