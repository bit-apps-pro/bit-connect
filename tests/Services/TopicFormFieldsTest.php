<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Http\Requests\CreateTopicRequest;
use BitApps\BitConnect\Services\TopicFormFields;
use PHPUnit\Framework\TestCase;

/**
 * The topic form's optional fields: hidden, optional or required, per field.
 *
 * An earlier build stored one boolean per field that both drew and required
 * it, so a forum saved by it has to keep drawing the same form.
 *
 * @internal
 *
 * @coversNothing
 */
final class TopicFormFieldsTest extends TestCase
{
    private const OPTION = 'bit_connect_admin_settings';

    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
        $GLOBALS['__wp_filters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_options'] = [];
    }

    public function testTheTopicTypeIsRequiredUntilTheScreenIsSaved(): void
    {
        $this->assertSame(['topicType' => 'required'], TopicFormFields::current());
    }

    public function testASavedModeIsReadBack(): void
    {
        $this->assertSame(['topicType' => 'optional'], TopicFormFields::normalize(['topicType' => 'optional']));
    }

    public function testTheEarlierBooleanKeepsTheFormItDrew(): void
    {
        $this->assertSame(['topicType' => 'hidden'], TopicFormFields::normalize(['requireTopicType' => false]));
    }

    public function testAModeWinsOverAStaleBoolean(): void
    {
        $this->assertSame(
            'optional',
            TopicFormFields::normalize(['topicType' => 'optional', 'requireTopicType' => false])['topicType']
        );
    }

    public function testAnUnknownModeFallsBackToRequired(): void
    {
        $this->assertSame('required', TopicFormFields::normalize(['topicType' => 'sometimes'])['topicType']);
        $this->assertSame('required', TopicFormFields::normalize('garbage')['topicType']);
    }

    public function testTopicCreationRequiresOnlyTheRequiredFields(): void
    {
        update_option(self::OPTION, ['topicFormFields' => ['topicType' => 'required']]);

        $this->assertSame('required', (new CreateTopicRequest())->rules()['topic-types'][0]);
    }

    public function testAHiddenFieldIsNeverRequired(): void
    {
        update_option(self::OPTION, ['topicFormFields' => ['topicType' => 'hidden']]);

        $this->assertSame('nullable', (new CreateTopicRequest())->rules()['topic-types'][0]);
    }

    public function testAnAddedTaxonomyIsRequiredOnlyWhenItSaysSo(): void
    {
        $GLOBALS['__wp_taxonomies'] = ['example-teams'];
        $GLOBALS['__wp_filters']['bit_connect_topic_taxonomies'] = [
            'teams' => ['taxonomy' => 'example-teams', 'singular' => 'Team', 'required' => true],
        ];

        $request = new CreateTopicRequest();

        $this->assertSame(['required', 'integer', 'min:1'], $request->rules()['teams']);
        $this->assertSame('Choose a Team.', $request->messages()['teams.required']);

        $GLOBALS['__wp_filters']['bit_connect_topic_taxonomies']['teams']['required'] = false;

        $this->assertSame('nullable', (new CreateTopicRequest())->rules()['teams'][0]);

        $GLOBALS['__wp_taxonomies'] = [];
    }

    public function testAnAddedTaxonomyCannotTakeOverAFieldTheFormAlreadyHas(): void
    {
        $GLOBALS['__wp_taxonomies'] = ['example-teams'];
        $GLOBALS['__wp_filters']['bit_connect_topic_taxonomies'] = [
            'post_title' => ['taxonomy' => 'example-teams', 'required' => false],
        ];

        $this->assertSame(['required', 'string', 'sanitize:text', 'max:200'], (new CreateTopicRequest())->rules()['post_title']);

        $GLOBALS['__wp_taxonomies'] = [];
    }
}
