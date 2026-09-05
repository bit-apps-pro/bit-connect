<?php

namespace BitApps\BitConnect\Services;

use InvalidArgumentException;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

/**
 * AttachmentValidatorService — validates uploaded files before WordPress handles them.
 *
 * The existing AttachmentController uses $_FILES['file']['type'] for MIME
 * validation.  That value is supplied by the browser/HTTP client — it is NOT
 * read from the file's bytes and CANNOT be trusted.  An attacker can upload a
 * PHP webshell with Content-Type: image/jpeg and the old code would accept it.
 *
 * This service uses WordPress's own wp_check_filetype_and_ext() which calls
 * PHP's finfo extension to read magic bytes from the actual file content,
 * making MIME spoofing ineffective.
 *
 * Validation pipeline:
 *   1. Presence check (file exists in $_FILES and was not truncated)
 *   2. PHP upload error codes
 *   3. File size against MAX_FILE_SIZE
 *   4. Extension extracted from the real filename (not MIME)
 *   5. Double-extension / dangerous-extension check
 *   6. Allowed-extension allowlist
 *   7. wp_check_filetype_and_ext() — magic-byte MIME validation
 *   8. Extension/MIME consistency cross-check
 */
final class AttachmentValidatorService
{
    /**
     * Maximum file size in bytes.
     * Must stay in sync with MAX_FILE_SIZE_BYTES in attachment-validation.ts.
     */
    public const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

    /**
     * Allowed file extensions and their expected MIME types.
     * Must stay in sync with ALLOWED_TYPES in attachment-validation.ts.
     *
     * Format: 'ext' => ['mime/type', ...]
     */
    public const ALLOWED = [
        'jpg'  => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png'  => ['image/png'],
        'gif'  => ['image/gif'],
        'webp' => ['image/webp'],
        'pdf'  => ['application/pdf'],
        'doc'  => ['application/msword'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ];

    /**
     * Extensions that are always blocked, regardless of what MIME detection says.
     *
     * This list covers server-side scripting languages, executables, and
     * file types that browsers render as active content (SVG, HTML).
     * Even if WordPress's wp_check_filetype_and_ext() passes them, we reject.
     */
    private const DANGEROUS_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'php7', 'phtml', 'phar',
        'pl', 'py', 'rb',
        'sh', 'bash', 'zsh',
        'exe', 'bat', 'cmd', 'com', 'msi', 'vbs', 'ps1',
        'js', 'jsx', 'ts', 'tsx',
        'html', 'htm', 'shtml',
        'svg', 'xml', 'xhtml',
        'htaccess', 'htpasswd',
        'cgi',
    ];

    /**
     * Validate an uploaded file from $_FILES.
     *
     * @param array $file A single entry from $_FILES (e.g. $_FILES['file']).
     *
     * @throws InvalidArgumentException when the file fails any validation rule
     *
     * @return array the validated file array (same structure as $file input)
     */
    public function validate(array $file): array
    {
        // 1. Presence
        if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            throw new InvalidArgumentException('No valid file was uploaded.');
        }

        // 2. PHP upload error codes
        $this->checkUploadError($file['error'] ?? \UPLOAD_ERR_NO_FILE);

        // 3. File size — check actual bytes on disk, not the client-reported size
        $actualSize = filesize($file['tmp_name']);
        if ($actualSize === false || $actualSize === 0) {
            throw new InvalidArgumentException('Uploaded file is empty or unreadable.');
        }

        if ($actualSize > self::MAX_FILE_SIZE) {
            $mb = round($actualSize / (1024 * 1024), 1);

            throw new InvalidArgumentException("File is too large ({$mb} MB). Maximum allowed size is 5 MB.");
        }

        // 4. Sanitize and extract extension from the real filename
        $rawName = $file['name'] ?? '';
        $safeName = sanitize_file_name($rawName);

        if ($safeName === '') {
            throw new InvalidArgumentException('File name is missing or invalid.');
        }

        $ext = strtolower(pathinfo($safeName, \PATHINFO_EXTENSION));

        if ($ext === '') {
            throw new InvalidArgumentException('File must have a valid extension.');
        }

        // 5. Double-extension check: e.g. "shell.php.jpg"
        //    Reject if ANY part of the filename (except the last) is dangerous.
        $parts = explode('.', strtolower($safeName));
        for ($i = 1; $i < \count($parts) - 1; ++$i) {
            if (\in_array($parts[$i], self::DANGEROUS_EXTENSIONS, true)) {
                throw new InvalidArgumentException("File name contains a disallowed extension (.{$parts[$i]}).");
            }
        }

        // 6. Unconditionally block dangerous extensions
        if (\in_array($ext, self::DANGEROUS_EXTENSIONS, true)) {
            throw new InvalidArgumentException("Files with the .{$ext} extension are not allowed.");
        }

        // 7. Allowed-extension allowlist check
        if (!\array_key_exists($ext, self::ALLOWED)) {
            $allowed = implode(', ', array_keys(self::ALLOWED));

            throw new InvalidArgumentException("File type .{$ext} is not allowed. Allowed types: {$allowed}.");
        }

        // 8. Magic-byte MIME validation via wp_check_filetype_and_ext().
        //    This reads the actual file bytes — it cannot be spoofed by the client.
        //    Requires wp-admin includes to be loaded (caller must include them first).
        $checked = wp_check_filetype_and_ext($file['tmp_name'], $safeName);

        if (empty($checked['ext']) || empty($checked['type'])) {
            throw new InvalidArgumentException('File type could not be verified. The file may be corrupt or its type is disallowed.');
        }

        // 9. Cross-check: the magic-byte MIME must match the expected MIMEs for this extension
        $expectedMimes = self::ALLOWED[$ext];
        if (!\in_array($checked['type'], $expectedMimes, true)) {
            throw new InvalidArgumentException("File content does not match its extension (.{$ext}). Upload rejected.");
        }

        // Return the file array with the server-verified name and type substituted
        return array_merge(
            $file,
            [
                'name' => $safeName,
                'type' => $checked['type'],
            ]
        );
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Convert PHP upload error codes into human-readable messages.
     *
     * @throws InvalidArgumentException for any non-OK error code
     */
    private function checkUploadError(int $code): void
    {
        switch ($code) {
            case \UPLOAD_ERR_OK:
                return;

            case \UPLOAD_ERR_INI_SIZE:
            case \UPLOAD_ERR_FORM_SIZE:
                throw new InvalidArgumentException('The uploaded file exceeds the maximum allowed size.');

            case \UPLOAD_ERR_PARTIAL:
                throw new InvalidArgumentException('The file was only partially uploaded. Please try again.');

            case \UPLOAD_ERR_NO_FILE:
                throw new InvalidArgumentException('No file was uploaded.');

            case \UPLOAD_ERR_NO_TMP_DIR:
            case \UPLOAD_ERR_CANT_WRITE:
            case \UPLOAD_ERR_EXTENSION:
                throw new InvalidArgumentException('Server upload error. Please contact support.');

            default:
                throw new InvalidArgumentException('Unknown upload error.');
        }
    }
}
