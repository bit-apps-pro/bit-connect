<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\UpdateMemberProfileRequest;
use BitApps\BitConnect\Services\MemberProfileService;
use BitApps\BitConnect\Services\ProfileSlugService;
use BitApps\BitConnect\Services\UserProfileService;
use WP_User;

/**
 * The details a member writes about themselves.
 *
 * POST /users/{id}/profile — display name, profile URL, bio and links
 *
 * Owner-only; see UpdateMemberProfileRequest::authorize().
 *
 * One endpoint for all four fields because they are one form. Splitting them
 * would mean a member editing their name and their bio together gets two
 * requests that can half-succeed.
 */
final class MemberProfileController
{
    private const HTTP_BAD_REQUEST = 400;

    private const HTTP_NOT_FOUND = 404;

    public function update(UpdateMemberProfileRequest $request)
    {
        $userId = (int) $request->id;
        $user = get_userdata($userId);

        if (!$user instanceof WP_User) {
            return Response::error(__('User not found.', 'bit-connect'))->httpStatus(self::HTTP_NOT_FOUND);
        }

        // Both are checked before anything is written, so a rejected slug does
        // not leave the display name already changed.
        $errors = $this->validate($request, $userId);

        if ($errors !== []) {
            return Response::error($errors, self::HTTP_BAD_REQUEST)->code('VALIDATION');
        }

        // The slug goes first. setCustomSlug() pins it, and only a pinned slug
        // survives the profile_update that wp_update_user() fires next — in the
        // other order the name change would re-derive the slug, retire the one
        // the member just chose, and leave a slug nobody ever used squatting in
        // their alias list.
        $this->applySlug($request, $userId);

        $nameError = $this->applyDisplayName($request, $userId);

        if ($nameError !== null) {
            return Response::error(['display_name' => [$nameError]], self::HTTP_BAD_REQUEST)->code('VALIDATION');
        }

        if ($request->submitted('bio')) {
            MemberProfileService::setBio($userId, $request->sanitizedBio());
        }

        if ($request->submitted('links')) {
            MemberProfileService::setLinks($userId, $request->sanitizedLinks());
        }

        return Response::success(
            [
                'user' => (new UserProfileService())->profile($userId),
            ]
        );
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /**
     * Field checks that the request rules cannot express, in the shape the
     * client already knows how to map onto form fields.
     *
     * @return array<string, array<int, string>> empty when everything is usable
     */
    private function validate(UpdateMemberProfileRequest $request, int $userId): array
    {
        $errors = [];

        if ($this->slugChanged($request, $userId)) {
            $slugError = ProfileSlugService::validateSlug($request->submittedSlug(), $userId);

            if ($slugError !== null) {
                $errors['slug'] = [$slugError];
            }
        }

        // A blank display name would leave the member anonymous on every topic
        // and comment they have written, so it is the one field here that
        // cannot be cleared.
        if ($request->submitted('display_name') && $request->sanitizedDisplayName() === '') {
            $errors['display_name'] = [__('Please enter a display name.', 'bit-connect')];
        }

        return $errors;
    }

    /**
     * A submitted slug only counts as a change when it normalises to something
     * other than what the member already has.
     *
     * Without this, saving the form after editing only the bio would pin the
     * slug and stop it tracking the display name — a side effect the member
     * never asked for.
     */
    private function slugChanged(UpdateMemberProfileRequest $request, int $userId): bool
    {
        if (!$request->submitted('slug')) {
            return false;
        }

        $submitted = $request->submittedSlug();

        if ($submitted === '') {
            return false;
        }

        return ProfileSlugService::normalizeSlug($submitted) !== ProfileSlugService::slugFor($userId);
    }

    private function applySlug(UpdateMemberProfileRequest $request, int $userId): void
    {
        if ($this->slugChanged($request, $userId)) {
            ProfileSlugService::setCustomSlug($userId, $request->submittedSlug());
        }
    }

    /**
     * Write the submitted display name, if one was sent.
     *
     * @return null|string error message, or null on success
     */
    private function applyDisplayName(UpdateMemberProfileRequest $request, int $userId): ?string
    {
        if (!$request->submitted('display_name')) {
            return null;
        }

        // Blankness is rejected in validate() before anything is written.
        $result = wp_update_user(['ID' => $userId, 'display_name' => $request->sanitizedDisplayName()]);

        // Single exit returning an expression: an early `return null;` gets
        // rewritten to a bare `return;` by cs-fixer, which then fails the
        // declared `?string` return type under PHPStan.
        return is_wp_error($result) ? $result->get_error_message() : null;
    }
}
