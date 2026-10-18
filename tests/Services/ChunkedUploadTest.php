<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ChunkedUpload;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * Pins down what a large upload sent in pieces may and may not do before it
 * is whole. The assembling itself needs PHP to have received the pieces as
 * uploads, so it is checked against the running site rather than here.
 *
 * @internal
 *
 * @coversNothing
 */
final class ChunkedUploadTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/bit-connect-chunk-test-' . bin2hex(random_bytes(4));
        $GLOBALS['__wp_upload_basedir'] = $this->dir;
        $GLOBALS['__wp_filters'] = [];
    }

    protected function tearDown(): void
    {
        foreach (glob($this->dir . '/bit-connect-chunks/{,.}*', GLOB_BRACE) ?: [] as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
        @rmdir($this->dir . '/bit-connect-chunks');
        @rmdir($this->dir);
        unset($GLOBALS['__wp_upload_basedir']);
        $GLOBALS['__wp_filters'] = [];
    }

    public function testOnlyARandomIdOfTheExpectedShapeIsAccepted(): void
    {
        $this->assertTrue(ChunkedUpload::isId(str_repeat('a1', 16)));
        $this->assertFalse(ChunkedUpload::isId('../../wp-config'));
        $this->assertFalse(ChunkedUpload::isId(str_repeat('A1', 16)));
        $this->assertFalse(ChunkedUpload::isId(str_repeat('a', 31)));
    }

    public function testAMalformedIdIsRefusedBeforeAnythingIsStored(): void
    {
        $this->expectException(InvalidArgumentException::class);

        ChunkedUpload::receive(1, '../evil', 0, 10, 'clip.mp4', []);
    }

    public function testAFileTypeTheForumDoesNotTakeIsRefusedAtTheFirstPiece(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('File type .exe is not allowed.');

        ChunkedUpload::receive(1, str_repeat('ab', 16), 0, 10, 'setup.exe', []);
    }

    public function testAPieceThatDidNotArriveAsAnUploadIsRefused(): void
    {
        $fake = tempnam(sys_get_temp_dir(), 'chunk');
        file_put_contents($fake, 'not an upload');

        try {
            $this->expectException(InvalidArgumentException::class);
            $this->expectExceptionMessage('The upload piece did not arrive.');

            ChunkedUpload::receive(1, str_repeat('ab', 16), 0, 13, 'a.png', ['tmp_name' => $fake, 'error' => 0]);
        } finally {
            unlink($fake);
        }
    }

    public function testOnlyAFileItWroteIsTakenForAnAssembledUpload(): void
    {
        mkdir($this->dir . '/bit-connect-chunks', 0777, true);
        $own = $this->dir . '/bit-connect-chunks/1-' . str_repeat('ab', 16) . '.part';
        file_put_contents($own, 'x');

        $this->assertTrue(ChunkedUpload::owns($own));
        $this->assertFalse(ChunkedUpload::owns($this->dir . '/bit-connect-chunks/../../etc/passwd'));
        $this->assertFalse(ChunkedUpload::owns(__FILE__));
    }

    public function testAnUploadNobodyAddedToInADayIsClearedAway(): void
    {
        mkdir($this->dir . '/bit-connect-chunks', 0777, true);
        $stale = $this->dir . '/bit-connect-chunks/1-' . str_repeat('ab', 16) . '.part';
        $fresh = $this->dir . '/bit-connect-chunks/1-' . str_repeat('cd', 16) . '.part';
        file_put_contents($stale, 'x');
        file_put_contents($fresh, 'x');
        touch($stale, time() - 2 * DAY_IN_SECONDS);

        ChunkedUpload::cleanup();

        $this->assertFileDoesNotExist($stale);
        $this->assertFileExists($fresh);
    }
}
