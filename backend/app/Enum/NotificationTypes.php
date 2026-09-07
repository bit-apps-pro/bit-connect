<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Attributes\Description;
use BitApps\BitConnect\Enum\Attributes\Label;
use BitApps\BitConnect\Enum\Concerns\EnumHelper;

/**
 * Everything the forum can tell a member about.
 *
 * One vocabulary, deliberately short. Every notifiable event is a case here and
 * nothing dispatches a type that is not — which is what lets the preference
 * screen, the digest email and the admin defaults all be written once against
 * cases() instead of being kept in step with a list of call sites by hand.
 *
 * A backed enum: every WordPress, database and API call takes ->value. Passing
 * the case itself is a fatal, not a type error.
 *
 * Labels are written from the recipient's point of view, because that is where
 * they are read — a preference row saying "Someone replied to your comment" is
 * answerable, "Comment reply" is a database column. __() cannot run inside
 * attribute arguments, so the translated wording lives in translatedLabel() and
 * translatedDescription() below — read those for display, label() for the raw
 * English.
 */
enum NotificationTypes: string
{
    use EnumHelper;

    #[Label('Someone comments on your topic')]
    #[Description('A new top-level comment on a topic you wrote or follow.')]
    case TOPIC_REPLY = 'topic_reply';

    #[Label('Someone replies to your comment')]
    #[Description('A direct reply to something you wrote in a thread.')]
    case COMMENT_REPLY = 'comment_reply';

    #[Label('A new topic is posted')]
    #[Description('A topic appears under a product or tag you follow.')]
    case TOPIC_NEW = 'topic_new';

    #[Label('Someone mentions you')]
    #[Description('Your name is used in a topic or comment.')]
    case MENTION = 'mention';

    #[Label('Someone upvotes your post')]
    #[Description('Collapsed into one entry per item, so a popular post is one line and not fifty.')]
    case VOTE_RECEIVED = 'vote_received';

    #[Label('Your report is reviewed')]
    #[Description('A moderator reaches a decision on something you reported.')]
    case REPORT_RESOLVED = 'report_resolved';

    #[Label('Your content is moderated')]
    #[Description('Something you wrote was hidden or removed after review.')]
    case CONTENT_ACTIONED = 'content_actioned';

    #[Label('You are given a badge')]
    #[Description('An admin awards you a profile badge.')]
    case BADGE_AWARDED = 'badge_awarded';

    #[Label('A topic you follow changes status')]
    #[Description('The stage or status moves on a topic you wrote or follow.')]
    case TOPIC_STATUS_CHANGED = 'topic_status_changed';

    #[Label('A new report needs review')]
    #[Description('Sent to moderators only, when a report enters the queue.')]
    case REPORT_FILED = 'report_filed';

    /**
     * The label, translated.
     *
     * A match over literals rather than __($type->label()): `wp i18n make-pot`
     * reads source, not runtime, so a __() whose argument is an expression puts
     * nothing in the catalog — and a lookup the catalog does not hold returns
     * the English string in every locale. Wrapping at the read site translated
     * none of these; this does.
     *
     * The #[Label] attributes above remain the English wording every non-display
     * reader gets. EnumLabelTranslationTest asserts the two agree case
     * by case, so a reworded attribute cannot silently leave this behind.
     *
     * Static and typed by parameter rather than `self`: the coding standard's
     * sniff does not treat an enum as class scope.
     */
    public static function translatedLabel(NotificationTypes $type): string
    {
        return match ($type) {
            self::TOPIC_REPLY           => __('Someone comments on your topic', 'bit-connect'),
            self::COMMENT_REPLY         => __('Someone replies to your comment', 'bit-connect'),
            self::TOPIC_NEW             => __('A new topic is posted', 'bit-connect'),
            self::MENTION               => __('Someone mentions you', 'bit-connect'),
            self::VOTE_RECEIVED         => __('Someone upvotes your post', 'bit-connect'),
            self::REPORT_RESOLVED       => __('Your report is reviewed', 'bit-connect'),
            self::CONTENT_ACTIONED      => __('Your content is moderated', 'bit-connect'),
            self::BADGE_AWARDED         => __('You are given a badge', 'bit-connect'),
            self::TOPIC_STATUS_CHANGED  => __('A topic you follow changes status', 'bit-connect'),
            self::REPORT_FILED          => __('A new report needs review', 'bit-connect'),
        };
    }

    /**
     * The description, translated. See translatedLabel() for why it is a match.
     */
    public static function translatedDescription(NotificationTypes $type): string
    {
        return match ($type) {
            self::TOPIC_REPLY           => __('A new top-level comment on a topic you wrote or follow.', 'bit-connect'),
            self::COMMENT_REPLY         => __('A direct reply to something you wrote in a thread.', 'bit-connect'),
            self::TOPIC_NEW             => __('A topic appears under a product or tag you follow.', 'bit-connect'),
            self::MENTION               => __('Your name is used in a topic or comment.', 'bit-connect'),
            self::VOTE_RECEIVED         => __('Collapsed into one entry per item, so a popular post is one line and not fifty.', 'bit-connect'),
            self::REPORT_RESOLVED       => __('A moderator reaches a decision on something you reported.', 'bit-connect'),
            self::CONTENT_ACTIONED      => __('Something you wrote was hidden or removed after review.', 'bit-connect'),
            self::BADGE_AWARDED         => __('An admin awards you a profile badge.', 'bit-connect'),
            self::TOPIC_STATUS_CHANGED  => __('The stage or status moves on a topic you wrote or follow.', 'bit-connect'),
            self::REPORT_FILED          => __('Sent to moderators only, when a report enters the queue.', 'bit-connect'),
        };
    }

    /**
     * Types only moderators ever receive.
     *
     * Kept out of an ordinary member's preference screen entirely: a row that
     * can never fire is a promise the forum will not keep.
     *
     * Static rather than an instance method, and typed by parameter rather than
     * `self`: the coding standard's sniff does not treat an enum as class scope
     * and rejects both `$this` and a `self` hint inside one.
     */
    public static function isModeratorOnly(NotificationTypes $type): bool
    {
        return $type === self::REPORT_FILED;
    }

    /**
     * Types a member cannot switch off in the app.
     *
     * Only one: being told your content was taken down. Removal is meant to be
     * visible — that is the whole reason this forum grants delete-any and no
     * edit-any (see Capabilities::DELETE_ANY). A member able to silence the
     * notice would be able to make a removal silent after all, which puts back
     * exactly the thing the capability split was drawn to prevent.
     *
     * Email for it remains optional. This governs the in-app record, not the
     * inbox.
     */
    public static function isMandatoryInApp(NotificationTypes $type): bool
    {
        return $type === self::CONTENT_ACTIONED;
    }

    /**
     * Types where repeats collapse onto one row instead of stacking.
     *
     * Votes only. A vote carries nothing of its own to read, so fifty of them
     * are one fact — "fifty people liked this" — and fifty rows would bury
     * every other notification the member has. A reply is the opposite: each
     * one is a distinct thing somebody wrote and needs its own link.
     */
    public static function isCollapsible(NotificationTypes $type): bool
    {
        return $type === self::VOTE_RECEIVED;
    }

    /**
     * Whether this type is on by default, per channel, before an admin or a
     * member has touched anything.
     *
     * The shape of the answer is the shape of the settings blob and of the
     * preference form, so all three stay in step by construction.
     *
     * In-app defaults to on for everything: it costs the member nothing and is
     * the reason they have a bell. Email is far narrower — it leaves the site
     * and lands somewhere the forum does not control, so only the types that
     * are genuinely addressed to one person start switched on. Nobody wants
     * mail every time a stranger upvotes them.
     *
     * @return array{inapp: bool, email: bool}
     */
    public static function channelDefaults(NotificationTypes $type): array
    {
        $emailByDefault = \in_array(
            $type,
            [
                self::COMMENT_REPLY,
                self::TOPIC_REPLY,
                self::MENTION,
                self::REPORT_RESOLVED,
                self::CONTENT_ACTIONED,
            ],
            true
        );

        return [
            'inapp' => true,
            'email' => $emailByDefault,
        ];
    }

    /**
     * The types an ordinary member may be shown and may configure.
     *
     * @return array<int, self>
     */
    public static function memberTypes(): array
    {
        return array_values(
            array_filter(
                self::cases(),
                static fn (self $case): bool => !self::isModeratorOnly($case)
            )
        );
    }
}
