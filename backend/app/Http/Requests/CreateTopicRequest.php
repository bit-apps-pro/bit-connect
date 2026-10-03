<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Http\Rules\InRule;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\PostingLimits;
use BitApps\BitConnect\Services\TopicFormFields;
use BitApps\BitConnect\Services\TopicTaxonomies;

/**
 * Provides validation for creating a topic.
 *
 * @property string $post_title
 * @property string $post_content
 * @property null|string $post_name
 * @property null|string $post_status
 * @property null|array $attachments
 * @property null|array $topic-types
 * @property null|array $stages
 * @property null|array $statuses
 * @property null|array $tags
 */
final class CreateTopicRequest extends Request
{
    public function authorize()
    {
        return PermissionService::canCreatePost();
    }

    public function rules()
    {
        $rules = [
            'post_title'   => ['required', 'string', 'sanitize:text', 'max:200'],
            'post_content' => ['required', 'string', 'max:' . PostingLimits::TOPIC_HTML_CEILING],
            // `sanitize:title` is WordPress' own `sanitize_title()`, so whatever
            // reaches the service is already a valid slug. Left blank, the
            // service derives one from the title the way core does.
            'post_name' => ['nullable', 'string', 'sanitize:title', 'max:200'],
            // Publish is the only status this endpoint creates: the allowlist
            // is a statement of what this plugin does rather than a gate on it.
            // Hiding a reported topic is moderation's, and goes through
            // ContentVisibilityService rather than this request.
            'post_status' => ['nullable', 'string', new InRule(['publish'])],
            'attachments' => ['nullable', 'array'],
            // Required when the admin made it so (Settings → Topic form), and
            // enforced here rather than only in the portal's form, which is
            // just one of the ways a topic gets created.
            'topic-types' => [self::presence('topicType'), 'integer', 'min:1'],
            'tags'        => ['nullable', 'array'],
            'tags.*'      => ['nullable', 'integer', 'min:1'],
        ];

        // One term each from a taxonomy another plugin files topics under,
        // required when that plugin says so — see TopicTaxonomies.
        foreach (TopicTaxonomies::all() as $param => $entry) {
            $rules[$param] = [$entry['required'] ? 'required' : 'nullable', 'integer', 'min:1'];
        }

        return $rules;
    }

    public function messages()
    {
        $messages = [
            'post_title.required'   => 'The topic title is required.',
            'post_title.max'        => 'The topic title cannot exceed 200 characters.',
            'post_name.string'      => 'The topic slug must be a string.',
            'post_name.max'         => 'The topic slug cannot exceed 200 characters.',
            'post_content.required' => 'The topic description is required.',
            'post_content.max'      => 'The topic description is too long.',
            'topic-type'            => 'Each topic type must be a valid ID.',

            'topic-types.required' => 'Choose a topic type.',

            'tags.*.integer' => 'Each tag must be a valid ID.',
            'tags.*.min'     => 'Each tag ID must be at least 1.',
        ];

        foreach (TopicTaxonomies::all() as $param => $entry) {
            $messages[$param . '.required'] = \sprintf('Choose a %s.', $entry['singular']);
        }

        return $messages;
    }

    /**
     * `required` or `nullable` for one of the form's optional fields, by the
     * mode the admin set for it. A hidden field is never asked, so it is as
     * free to leave out as an optional one.
     *
     * @param string $field `topicType`
     */
    private static function presence(string $field): string
    {
        return TopicFormFields::isRequired($field) ? 'required' : 'nullable';
    }
}
