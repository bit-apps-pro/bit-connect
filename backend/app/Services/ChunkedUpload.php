<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use InvalidArgumentException;

/**
 * A large upload sent in pieces, assembled here, then checked as a whole.
 *
 * One request carrying a whole video is at the mercy of everything between the
 * member and PHP: a proxy that gives up on a request after a minute or two, a
 * phone that loses signal for a second and has to send the whole file again.
 * In pieces of a few megabytes each request is short, and a piece that fails
 * is the only thing sent again.
 *
 * Nothing is trusted until the file is whole. Each piece is appended to a
 * `.part` file named for the member and a random id the browser chose; the
 * finished file then goes through AttachmentValidatorService exactly as a
 * single upload does — extension, the file's own bytes, its size for its kind
 * — before WordPress is given it.
 *
 * Retrying is safe: a piece sent again for an offset already written replaces
 * what was written from there on, and a piece for an offset beyond what has
 * arrived is not written at all. Either way the reply says how much has
 * arrived, and the browser carries on from there.
 */
final class ChunkedUpload
{
    /** The largest piece accepted, whatever the browser sends. */
    public const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

    /** Unfinished uploads one member may have under way at once. */
    private const MAX_OPEN_PER_USER = 3;

    /** How long an unfinished upload is kept before it is cleared away. */
    private const STALE_AFTER = DAY_IN_SECONDS;

    private const DIR_NAME = 'bit-connect-chunks';

    /**
     * Append one piece.
     *
     * @param array{name?: string, tmp_name?: string, error?: int, size?: int} $chunk a $_FILES entry
     *
     * @throws InvalidArgumentException when the piece or the upload is refused
     *
     * @return array{received: int, file?: array{name: string, tmp_name: string, size: int, error: int, type: string}}
     *                                                                                                                  `file` once the last piece has arrived, ready for the validator
     */
    public static function receive(int $userId, string $uploadId, int $offset, int $total, string $name, array $chunk): array
    {
        self::assertId($uploadId);
        self::assertAllowed($name, $total);

        if (empty($chunk['tmp_name']) || !is_uploaded_file($chunk['tmp_name']) || (int) ($chunk['error'] ?? \UPLOAD_ERR_NO_FILE) !== \UPLOAD_ERR_OK) {
            throw new InvalidArgumentException('The upload piece did not arrive.');
        }

        $length = (int) filesize($chunk['tmp_name']);
        if ($length <= 0 || $length > self::MAX_CHUNK_BYTES) {
            throw new InvalidArgumentException('The upload piece is empty or too large.');
        }

        $path = self::partPath($userId, $uploadId);

        if (!is_file($path)) {
            if ($offset !== 0) {
                // The start of this upload is not here — cleared away, or never
                // sent. The browser has to begin again.
                return ['received' => 0];
            }

            self::assertRoomFor($userId);
        }

        $handle = fopen($path, 'c+b');
        if ($handle === false) {
            throw new InvalidArgumentException('The upload could not be stored.');
        }

        $failed = false;

        try {
            flock($handle, \LOCK_EX);
            $received = (int) fstat($handle)['size'];

            // Further on than what has arrived: a piece in between went missing.
            if ($offset > $received) {
                return ['received' => $received];
            }

            if ($offset + $length > $total) {
                $failed = true;

                throw new InvalidArgumentException('The upload is larger than it said it would be.');
            }

            // A piece sent again — its reply was lost — replaces what it wrote.
            ftruncate($handle, $offset);
            fseek($handle, $offset);

            $source = fopen($chunk['tmp_name'], 'rb');
            $copied = $source === false ? 0 : (int) stream_copy_to_stream($source, $handle);
            if ($source !== false) {
                fclose($source);
            }

            if ($copied !== $length) {
                $failed = true;

                throw new InvalidArgumentException('The upload could not be stored.');
            }

            fflush($handle);
            $received = $offset + $length;
        } finally {
            flock($handle, \LOCK_UN);
            fclose($handle);

            if ($failed) {
                self::discard($userId, $uploadId);
            }
        }

        if ($received < $total) {
            return ['received' => $received];
        }

        return [
            'received' => $received,
            'file'     => [
                'name'     => $name,
                'tmp_name' => $path,
                'size'     => $received,
                'error'    => \UPLOAD_ERR_OK,
                'type'     => '',
            ],
        ];
    }

    /** Throw an unfinished upload away. */
    public static function discard(int $userId, string $uploadId): void
    {
        if (!self::isId($uploadId)) {
            return;
        }

        $path = self::partPath($userId, $uploadId);
        if (is_file($path)) {
            wp_delete_file($path);
        }
    }

    /** Whether a path is an assembled upload this class wrote. */
    public static function owns(string $path): bool
    {
        $real = realpath($path);
        $dir = realpath(self::dir());

        return $real !== false && $dir !== false && str_starts_with($real, $dir . \DIRECTORY_SEPARATOR) && str_ends_with($real, '.part');
    }

    /** Delete unfinished uploads nobody has added to in a day. */
    public static function cleanup(): void
    {
        $dir = self::dir();
        if (!is_dir($dir)) {
            return;
        }

        foreach (glob($dir . '/*.part') ?: [] as $path) {
            $modified = filemtime($path);
            if ($modified !== false && $modified < time() - self::STALE_AFTER) {
                wp_delete_file($path);
            }
        }
    }

    public static function isId(string $uploadId): bool
    {
        return preg_match('/^[a-f0-9]{32}$/', $uploadId) === 1;
    }

    /**
     * Where unfinished uploads are kept: beside the site's uploads, so on the
     * same disk the finished file is moved to, and not in a temp directory a
     * host may clear between two pieces.
     */
    private static function dir(): string
    {
        return rtrim((string) (wp_upload_dir()['basedir'] ?? ''), '/') . '/' . self::DIR_NAME;
    }

    private static function partPath(int $userId, string $uploadId): string
    {
        $dir = self::dir();

        if (!is_dir($dir)) {
            wp_mkdir_p($dir);
            // Nothing in here is meant to be fetched. The names are random,
            // but a server that honours these files is told so as well.
            file_put_contents($dir . '/index.php', "<?php\n// Silence is golden.\n");
            file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
        }

        return $dir . '/' . $userId . '-' . $uploadId . '.part';
    }

    /**
     * @throws InvalidArgumentException
     */
    private static function assertId(string $uploadId): void
    {
        if (!self::isId($uploadId)) {
            throw new InvalidArgumentException('The upload id is not valid.');
        }
    }

    /**
     * Refuse, before anything is stored, a file the finished check would
     * refuse anyway by its name or its size.
     *
     * @throws InvalidArgumentException
     */
    private static function assertAllowed(string $name, int $total): void
    {
        $ext = strtolower(pathinfo(sanitize_file_name($name), \PATHINFO_EXTENSION));
        $types = AttachmentValidatorService::attachmentTypes();

        if ($ext === '' || !isset($types[$ext])) {
            throw new InvalidArgumentException(esc_html("File type .{$ext} is not allowed."));
        }

        $max = PostingLimits::maxFileSizeFor($types[$ext][0]);
        if ($total <= 0 || $total > $max) {
            throw new InvalidArgumentException(esc_html(\sprintf('File is too large (%s MB). Maximum allowed size is %s MB.', round($total / 1048576, 1), round($max / 1048576, 1))));
        }
    }

    /**
     * @throws InvalidArgumentException
     */
    private static function assertRoomFor(int $userId): void
    {
        if (\count(glob(self::dir() . '/' . $userId . '-*.part') ?: []) >= self::MAX_OPEN_PER_USER) {
            throw new InvalidArgumentException('Too many uploads are under way. Wait for one to finish.');
        }
    }
}
