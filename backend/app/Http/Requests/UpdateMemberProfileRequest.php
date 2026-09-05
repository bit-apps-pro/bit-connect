<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\MemberProfileService;

/**
 * Request input properties.
 *
 * @property string                $bio          short self-description
 * @property int                   $id           WP user ID (from route param)
 * @property array<string, string> $links        network key → URL
 * @property string                $display_name name shown beside their posts
 * @property string                $slug         profile URL segment
 */
final class UpdateMemberProfileRequest extends Request
{
    /**
     * Owner only: a profile is the member's own identity. Moderating what
     * someone wrote about themselves is a wp-admin job, not a portal one.
     */
    public function authorize()
    {
        $userId = (int) $this->id;

        return $userId > 0 && get_current_user_id() === $userId;
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to edit your profile.';
        }

        return 'You can only edit your own profile.';
    }

    public function rules()
    {
        return [
            'id' => ['required', 'integer', 'min:1'],
            // Every field is nullable because the form submits all of them and
            // an empty one means "clear this", not "reject this". `nullable`
            // also has to come first for another reason: `max` reports a failure
            // on an empty string, so without it a cleared bio would be rejected
            // as too long.
            'bio'          => ['nullable', 'string', 'max:' . MemberProfileService::MAX_BIO_LENGTH],
            'display_name' => ['nullable', 'string', 'max:60'],
            'links'        => ['nullable', 'array'],
            'slug'         => ['nullable', 'string', 'max:60'],
        ];
    }

    public function messages()
    {
        return [
            'bio.max'          => __('Your bio is too long.', 'bit-connect'),
            'display_name.max' => __('Display name must be 60 characters or fewer.', 'bit-connect'),
            'id.integer'       => __('User ID must be a valid integer.', 'bit-connect'),
            'id.required'      => __('User ID is required.', 'bit-connect'),
        ];
    }

    /**
     * Whether the member submitted this field at all.
     *
     * Distinguishes "cleared" from "not sent": a payload that omits `bio`
     * should leave the stored bio alone, while one sending `""` should erase it.
     *
     * @param string $field
     */
    public function submitted($field): bool
    {
        return $this->has($field);
    }

    /**
     * The bio, stripped to plain text within the length cap.
     */
    public function sanitizedBio(): string
    {
        return MemberProfileService::sanitizeBio($this->bio);
    }

    /**
     * Known link keys only, escaped, with unusable URLs dropped.
     *
     * @return array<string, string>
     */
    public function sanitizedLinks(): array
    {
        return MemberProfileService::sanitizeLinks($this->links);
    }

    /**
     * The display name as plain text.
     *
     * Sanitised here rather than relying on the `sanitize:` rules, which write
     * into the validator's own store that controllers never read.
     */
    public function sanitizedDisplayName(): string
    {
        return \is_string($this->display_name) ? trim(sanitize_text_field($this->display_name)) : '';
    }

    /**
     * The submitted slug, exactly as typed. Normalising and validating is
     * ProfileSlugService's job.
     */
    public function submittedSlug(): string
    {
        return \is_string($this->slug) ? trim($this->slug) : '';
    }
}
