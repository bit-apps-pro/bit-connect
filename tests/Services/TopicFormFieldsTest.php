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

    public function testBothFieldsAreRequiredUntilTheScreenIsSaved(): void
    {
        $this->assertSame(['topicType' => 'required', 'department' => 'required'], TopicFormFields::current());
    }

    public function testASavedModeIsReadBack(): void
    {
        $this->assertSame(
            ['topicType' => 'optional', 'department' => 'hidden'],
            TopicFormFields::normalize(['topicType' => 'optional', 'department' => 'hidden'])
        );
    }

    public function testTheEarlierBooleansKeepTheFormTheyDrew(): void
    {
        $this->assertSame(
            ['topicType' => 'required', 'department' => 'hidden'],
            TopicFormFields::normalize(['requireTopicType' => true, 'requireDepartment' => false])
        );
    }

    public function testAModeWinsOverAStaleBoolean(): void
    {
        $this->assertSame(
            'optional',
            TopicFormFields::normalize(['department' => 'optional', 'requireDepartment' => false])['department']
        );
    }

    public function testAnUnknownModeFallsBackToRequired(): void
    {
        $this->assertSame('required', TopicFormFields::normalize(['topicType' => 'sometimes'])['topicType']);
        $this->assertSame('required', TopicFormFields::normalize('garbage')['department']);
    }

    public function testTopicCreationRequiresOnlyTheRequiredFields(): void
    {
        update_option(self::OPTION, ['topicFormFields' => ['topicType' => 'required', 'department' => 'optional']]);

        $rules = (new CreateTopicRequest())->rules();

        $this->assertSame('required', $rules['topic-types'][0]);
        $this->assertSame('nullable', $rules['departments'][0]);
    }

    public function testAHiddenFieldIsNeverRequired(): void
    {
        update_option(self::OPTION, ['topicFormFields' => ['topicType' => 'hidden', 'department' => 'hidden']]);

        $rules = (new CreateTopicRequest())->rules();

        $this->assertSame('nullable', $rules['topic-types'][0]);
        $this->assertSame('nullable', $rules['departments'][0]);
    }
}
