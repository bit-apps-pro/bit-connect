<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\AttachmentValidatorService;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * Pins down what may be uploaded as an attachment.
 *
 * This is the plugin's only barrier between a member and the uploads directory.
 * The controller it replaced trusted $_FILES['type'], a value the client sends
 * — a PHP webshell announced as image/jpeg walked straight through. Every test
 * here writes a real file with real leading bytes, because reading the content
 * rather than the name is the whole point of the service.
 *
 * @internal
 *
 * @coversNothing
 */
final class AttachmentValidatorServiceTest extends TestCase
{
    private const JPEG = "\xFF\xD8\xFF\xE0" . 'JFIF-ish body';

    private const PNG = "\x89PNG\r\n\x1A\n" . 'png body';

    private const PDF = '%PDF-1.7 body';

    private AttachmentValidatorService $validator;

    /** @var string[] */
    private array $tempFiles = [];

    protected function setUp(): void
    {
        $this->validator = new AttachmentValidatorService();
    }

    protected function tearDown(): void
    {
        foreach ($this->tempFiles as $path) {
            @unlink($path);
        }

        $this->tempFiles = [];
        $GLOBALS['__php_uploaded_files'] = [];
    }

    // -----------------------------------------------------------------------
    // What is accepted
    // -----------------------------------------------------------------------

    public function testAJpegAnnouncedAsAJpegIsAccepted(): void
    {
        $validated = $this->validator->validate($this->upload('holiday.jpg', self::JPEG));

        $this->assertSame('holiday.jpg', $validated['name']);
        $this->assertSame('image/jpeg', $validated['type']);
    }

    public function testAPngIsAccepted(): void
    {
        $this->assertSame('image/png', $this->validator->validate($this->upload('diagram.png', self::PNG))['type']);
    }

    public function testAPdfIsAccepted(): void
    {
        $this->assertSame('application/pdf', $this->validator->validate($this->upload('invoice.pdf', self::PDF))['type']);
    }

    public function testTheJpegExtensionIsAcceptedInBothItsSpellings(): void
    {
        $this->assertSame('image/jpeg', $this->validator->validate($this->upload('holiday.jpeg', self::JPEG))['type']);
    }

    public function testAnUppercaseExtensionIsAccepted(): void
    {
        $this->assertSame('image/jpeg', $this->validator->validate($this->upload('HOLIDAY.JPG', self::JPEG))['type']);
    }

    /**
     * The verified name and type replace whatever the client sent, so nothing
     * downstream reads the client's version by accident.
     */
    public function testTheClientReportedTypeIsReplacedByTheVerifiedOne(): void
    {
        $file = $this->upload('holiday.jpg', self::JPEG);
        $file['type'] = 'application/x-php';

        $this->assertSame('image/jpeg', $this->validator->validate($file)['type']);
    }

    // -----------------------------------------------------------------------
    // The attack this service exists for
    // -----------------------------------------------------------------------

    public function testAScriptAnnouncedAsAnImageIsRejected(): void
    {
        $file = $this->upload('shell.php', '<?php echo shell_exec($_GET["c"]); ?>');
        $file['type'] = 'image/jpeg';

        $this->expectExceptionMessageMatches('/\.php extension are not allowed/');
        $this->validator->validate($file);
    }

    public function testADoubleExtensionHidingAScriptIsRejected(): void
    {
        $file = $this->upload('shell.php.jpg', self::JPEG);

        $this->expectExceptionMessageMatches('/disallowed extension \(\.php\)/');
        $this->validator->validate($file);
    }

    /**
     * Script source carries no recognisable signature at all, so it is refused
     * as unverifiable rather than as a mismatch — the earlier of the two
     * content checks, and the one that catches anything core cannot name.
     */
    public function testAnAllowedExtensionOverUnrecognisableBytesIsRejected(): void
    {
        $file = $this->upload('not-really.png', '<?php echo 1; ?>');

        $this->expectExceptionMessage('File type could not be verified. The file may be corrupt or its type is disallowed.');
        $this->validator->validate($file);
    }

    public function testAJpegRenamedToPdfIsRejected(): void
    {
        $file = $this->upload('report.pdf', self::JPEG);

        $this->expectExceptionMessageMatches('/does not match its extension/');
        $this->validator->validate($file);
    }

    /**
     * Browsers render these as active content, so they are blocked whatever the
     * magic-byte check says about them.
     */
    public function testActiveContentTypesAreBlockedOutright(): void
    {
        foreach (['payload.svg', 'page.html', 'script.js', 'data.xml'] as $name) {
            try {
                $this->validator->validate($this->upload($name, self::PNG));
                $this->fail($name . ' should have been rejected');
            } catch (InvalidArgumentException $exception) {
                $this->assertStringContainsString('are not allowed', $exception->getMessage());
            }
        }
    }

    public function testExecutablesAreBlockedOutright(): void
    {
        $this->expectExceptionMessageMatches('/\.exe extension are not allowed/');
        $this->validator->validate($this->upload('installer.exe', 'MZ binary'));
    }

    // -----------------------------------------------------------------------
    // Everything else that is refused
    // -----------------------------------------------------------------------

    public function testAFileThatNeverArrivedIsRejected(): void
    {
        $this->expectExceptionMessage('No valid file was uploaded.');
        $this->validator->validate(['name' => 'holiday.jpg', 'tmp_name' => '']);
    }

    public function testAPathThatWasNotUploadedIsRejected(): void
    {
        $file = $this->upload('holiday.jpg', self::JPEG);
        $GLOBALS['__php_uploaded_files'] = [];

        $this->expectExceptionMessage('No valid file was uploaded.');
        $this->validator->validate($file);
    }

    public function testATruncatedUploadIsRejected(): void
    {
        $file = $this->upload('holiday.jpg', self::JPEG);
        $file['error'] = \UPLOAD_ERR_PARTIAL;

        $this->expectExceptionMessage('The file was only partially uploaded. Please try again.');
        $this->validator->validate($file);
    }

    public function testAnUploadOverThePhpLimitIsRejected(): void
    {
        $file = $this->upload('holiday.jpg', self::JPEG);
        $file['error'] = \UPLOAD_ERR_INI_SIZE;

        $this->expectExceptionMessage('The uploaded file exceeds the maximum allowed size.');
        $this->validator->validate($file);
    }

    public function testAServerSideUploadFailureAsksTheMemberToContactSupport(): void
    {
        $file = $this->upload('holiday.jpg', self::JPEG);
        $file['error'] = \UPLOAD_ERR_CANT_WRITE;

        $this->expectExceptionMessage('Server upload error. Please contact support.');
        $this->validator->validate($file);
    }

    public function testAnUnrecognisedErrorCodeIsStillAnError(): void
    {
        $file = $this->upload('holiday.jpg', self::JPEG);
        $file['error'] = 99;

        $this->expectExceptionMessage('Unknown upload error.');
        $this->validator->validate($file);
    }

    public function testAnEmptyFileIsRejected(): void
    {
        $this->expectExceptionMessage('Uploaded file is empty or unreadable.');
        $this->validator->validate($this->upload('holiday.jpg', ''));
    }

    /**
     * Measured off the bytes on disk rather than the size the client reported,
     * which is as forgeable as the MIME type.
     */
    public function testAFileOverTheLimitIsRejectedOnItsRealSize(): void
    {
        $oversized = self::JPEG . str_repeat('x', AttachmentValidatorService::MAX_FILE_SIZE);

        $file = $this->upload('huge.jpg', $oversized);
        $file['size'] = 1024;

        $this->expectExceptionMessageMatches('/File is too large .*Maximum allowed size is 5 MB/');
        $this->validator->validate($file);
    }

    public function testAFileWithNoExtensionIsRejected(): void
    {
        $this->expectExceptionMessage('File must have a valid extension.');
        $this->validator->validate($this->upload('README', self::JPEG));
    }

    public function testAFileWithNoUsableNameIsRejected(): void
    {
        $file = $this->upload('holiday.jpg', self::JPEG);
        $file['name'] = '???';

        $this->expectExceptionMessage('File name is missing or invalid.');
        $this->validator->validate($file);
    }

    public function testAnUnlistedButHarmlessTypeIsStillRefused(): void
    {
        $this->expectExceptionMessageMatches('/File type \.zip is not allowed/');
        $this->validator->validate($this->upload('archive.zip', 'PK binary'));
    }

    // -----------------------------------------------------------------------
    // The contract shared with the frontend
    // -----------------------------------------------------------------------

    /**
     * The portal refuses the same files before uploading them; a limit that
     * drifts apart here shows up as a file the browser accepts and the server
     * throws away.
     */
    public function testTheLimitAndAllowlistMatchTheOnesTheFrontendEnforces(): void
    {
        $this->assertSame(5 * 1024 * 1024, AttachmentValidatorService::MAX_FILE_SIZE);
        $this->assertSame(
            ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'],
            array_keys(AttachmentValidatorService::ALLOWED)
        );
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Writes real bytes to a real path and registers it as an upload.
     *
     * @return array<string, mixed> a $_FILES entry
     */
    private function upload(string $name, string $bytes): array
    {
        $path = tempnam(sys_get_temp_dir(), 'bc-upload-');
        file_put_contents($path, $bytes);

        $this->tempFiles[] = $path;
        $GLOBALS['__php_uploaded_files'][$path] = true;

        return [
            'name'     => $name,
            'type'     => 'application/octet-stream',
            'tmp_name' => $path,
            'error'    => \UPLOAD_ERR_OK,
            'size'     => \strlen($bytes),
        ];
    }
}
