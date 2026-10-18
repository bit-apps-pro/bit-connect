<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\AttachmentProcessing;
use PHPUnit\Framework\TestCase;
use WP_Error;

/**
 * Pins down the work done on an upload after it is stored, which is asked for
 * in a request of its own and may be asked for again.
 *
 * @internal
 *
 * @coversNothing
 */
final class AttachmentProcessingTest extends TestCase
{
    private string $file;

    protected function setUp(): void
    {
        $this->file = tempnam(sys_get_temp_dir(), 'bc-upload');
        $GLOBALS['__wp_images'] = [];
        $GLOBALS['__wp_subsize_calls'] = [];
        $GLOBALS['__wp_attachment_meta'] = [];
        $GLOBALS['__wp_attached_files'] = [];
    }

    protected function tearDown(): void
    {
        @unlink($this->file);
        unset(
            $GLOBALS['__wp_images'],
            $GLOBALS['__wp_subsize_calls'],
            $GLOBALS['__wp_subsize_result'],
            $GLOBALS['__wp_attachment_meta'],
            $GLOBALS['__wp_attached_files']
        );
    }

    // wp_update_image_subsizes() makes only the sizes still missing, which is
    // what lets a request that ran out of time be followed by another.
    public function testAPictureGetsTheSizesStillMissing(): void
    {
        $GLOBALS['__wp_images'] = [7];

        $this->assertTrue(AttachmentProcessing::run(7));
        $this->assertSame([7], $GLOBALS['__wp_subsize_calls']);
    }

    public function testAPictureThatCannotBeProcessedSaysWhy(): void
    {
        $GLOBALS['__wp_images'] = [7];
        $GLOBALS['__wp_subsize_result'] = new WP_Error('image_no_editor', 'No image editor.');

        $result = AttachmentProcessing::run(7);

        $this->assertInstanceOf(WP_Error::class, $result);
        $this->assertSame('No image editor.', $result->get_error_message());
    }

    public function testADocumentGetsItsMetadataFromTheStoredFile(): void
    {
        $GLOBALS['__wp_attached_files'][8] = $this->file;

        $this->assertTrue(AttachmentProcessing::run(8));
        $this->assertSame(['generated_from' => $this->file], $GLOBALS['__wp_attachment_meta'][8]);
        $this->assertSame([], $GLOBALS['__wp_subsize_calls']);
    }

    public function testADocumentWithMetadataIsLeftAlone(): void
    {
        $GLOBALS['__wp_attached_files'][8] = $this->file;
        $GLOBALS['__wp_attachment_meta'][8] = ['filesize' => 10];

        $this->assertTrue(AttachmentProcessing::run(8));
        $this->assertSame(['filesize' => 10], $GLOBALS['__wp_attachment_meta'][8]);
    }

    public function testAnAttachmentWhoseFileIsGoneIsAnError(): void
    {
        $GLOBALS['__wp_attached_files'][8] = $this->file . '-gone';

        $this->assertInstanceOf(WP_Error::class, AttachmentProcessing::run(8));
        $this->assertArrayNotHasKey(8, $GLOBALS['__wp_attachment_meta']);
    }
}
