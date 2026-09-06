<?php

namespace BitApps\BitConnect\Sniffs;

use PHP_CodeSniffer\Files\File;
use PHP_CodeSniffer\Sniffs\Sniff;

class AbsPathSecuritySniff implements Sniff
{
    /**
     * Returns the token types that this sniff wants to listen to.
     *
     * @return array
     */
    public function register()
    {
        return [T_OPEN_TAG];
    }

    /**
     * Processes this sniff, when one of its tokens is encountered.
     *
     * @param File $phpcsFile The file being scanned.
     * @param int  $stackPtr  The position of the current token in the stack.
     *
     * @return void
     */
    public function process(File $phpcsFile, $stackPtr)
    {
        // Look for files that are PHP scripts (not libraries, includes, etc.)
        if ($this->isScriptFile($phpcsFile)) {
            $tokens = $phpcsFile->getTokens();
            $hasAbspathCheck = false;

            // Calculate total lines and search within first 20 lines
            $totalLines = \count(array_unique(array_column($tokens, 'line')));
            $endLine = min($tokens[$stackPtr]['line'] + 20, $totalLines);

            for ($i = $stackPtr; $i < $phpcsFile->numTokens; $i++) {
                // Check if we've passed the desired line range
                if ($tokens[$i]['line'] > $endLine) {
                    break;
                }

                // Look for common ABSPATH security check patterns
                if ($this->isAbspathSecurityCheck($phpcsFile, $i)) {
                    $hasAbspathCheck = true;
                    break;
                }
            }

            // Report error and provide fix if no ABSPATH security check is found
            if (!$hasAbspathCheck) {
                $error = 'Missing ABSPATH security check. Direct script access should be prevented.';
                $fix = $phpcsFile->addFixableError($error, $stackPtr, 'MissingAbspathCheck');

                if ($fix) {
                    $this->fixAbspathSecurity($phpcsFile, $stackPtr);
                }
            }
        }
    }

    /**
     * Automatically fix missing ABSPATH security check.
     *
     * @param File $phpcsFile The file being scanned.
     * @param int  $stackPtr  The position of the current token in the stack.
     */
    private function fixAbspathSecurity(File $phpcsFile, $stackPtr)
    {
        $tokens = $phpcsFile->getTokens();

        // Find the first non-whitespace token after the opening PHP tag
        $firstNonWhitespace = $phpcsFile->findNext(
            [T_WHITESPACE, T_INLINE_HTML, T_COMMENT, T_DOC_COMMENT],
            $stackPtr + 1,
            null,
            true
        );

        // Prepare the ABSPATH security check code
        $absPathCheck = "\n\n// Prevent direct script access\nif (!defined('ABSPATH')) {\n    exit;\n}\n";

        // If there's a namespace or other declaration, insert after it
        // Otherwise, insert right after the opening PHP tag
        if ($tokens[$firstNonWhitespace]['code'] === T_NAMESPACE) {
            // Find the end of the namespace declaration
            $semicolon = $phpcsFile->findNext(T_SEMICOLON, $firstNonWhitespace);
            $phpcsFile->fixer->addContent($semicolon, $absPathCheck);
        } else {
            // Insert right after the opening PHP tag
            $phpcsFile->fixer->addContent($stackPtr, $absPathCheck);
        }
    }

    /**
     * Determine if the file is likely a script that needs ABSPATH protection.
     *
     * @param File $phpcsFile The file being scanned.
     *
     * @return bool
     */
    private function isScriptFile(File $phpcsFile)
    {
        $fileName = $phpcsFile->getFileName();

        // Exclude test files, libraries, and other non-script files
        $excludePatterns = [
            '/test/i',
            '/lib/i',
            '/vendor/i',
            '/Tests/i',
            '/mock/i',
            '/interface/i',
            '/abstract/i'
        ];

        foreach ($excludePatterns as $pattern) {
            if (preg_match($pattern, $fileName)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if the current tokens represent an ABSPATH security check.
     *
     * @param File $phpcsFile The file being scanned.
     * @param int  $stackPtr  The current token position.
     *
     * @return bool
     */
    private function isAbspathSecurityCheck(File $phpcsFile, $stackPtr)
    {
        $tokens = $phpcsFile->getTokens();

        // Look for defined() function or !defined() check
        return (bool) ($this->isDefinedCheck($phpcsFile, $stackPtr));
    }

    /**
     * Check for defined() or !defined('ABSPATH') patterns.
     *
     * @param File $phpcsFile The file being scanned.
     * @param int  $stackPtr  The current token position.
     *
     * @return bool
     */
    private function isDefinedCheck(File $phpcsFile, $stackPtr)
    {
        $tokens = $phpcsFile->getTokens();
        $currentToken = $tokens[$stackPtr];

        // Check for 'defined' function call
        if ($currentToken['code'] === T_STRING && strtolower($currentToken['content']) === 'defined') {
            // Find the opening parenthesis
            $openBracket = $phpcsFile->findNext(T_WHITESPACE, $stackPtr + 1, null, true);
            if (isset($tokens[$openBracket]) && $tokens[$openBracket]['code'] === T_OPEN_PARENTHESIS) {
                // Find the first parameter (should be 'ABSPATH')
                $firstParam = $phpcsFile->findNext(T_WHITESPACE, $openBracket + 1, null, true);
                if (isset($tokens[$firstParam]) && $tokens[$firstParam]['code'] === T_CONSTANT_ENCAPSED_STRING) {
                    // Check if the parameter is 'ABSPATH'
                    $content = trim($tokens[$firstParam]['content'], "'\"");
                    if (strtoupper($content) === 'ABSPATH') {
                        // Check context - look for if statement or logical check
                        $beforeDefined = $phpcsFile->findPrevious(T_WHITESPACE, $stackPtr - 1, null, true);

                        // Check for potential exit/die paths
                        return $this->checkForExitPath($phpcsFile, $firstParam);
                    }
                }
            }
        }

        return false;
    }

    /**
     * Check for potential exit paths after ABSPATH check.
     *
     * @param File $phpcsFile The file being scanned.
     * @param int  $startPtr  The starting token position.
     *
     * @return bool
     */
    private function checkForExitPath(File $phpcsFile, $startPtr)
    {
        $tokens = $phpcsFile->getTokens();
        $closeBracket = $phpcsFile->findNext(T_CLOSE_PARENTHESIS, $startPtr);

        // Check immediate context after defined() check
        if ($closeBracket !== false) {
            // Look for potential exit scenarios
            $afterClose = $phpcsFile->findNext(T_WHITESPACE, $closeBracket + 1, null, true);

            // Check for exit/die directly after
            if (
                isset($tokens[$afterClose])
                && ($tokens[$afterClose]['code'] === T_EXIT
                    || strtolower($tokens[$afterClose]['content']) === 'die')
            ) {
                return true;
            }

            // Check for if statement scenarios
            $ifToken = $phpcsFile->findPrevious(T_IF, $startPtr);
            if ($ifToken !== false) {
                $scopeOpener = $tokens[$ifToken]['scope_opener'];
                $scopeCloser = $tokens[$ifToken]['scope_closer'];

                // Search within if block for exit/die
                for ($i = $scopeOpener + 1; $i < $scopeCloser; $i++) {
                    if (
                        $tokens[$i]['code'] === T_EXIT
                        || (isset($tokens[$i]['content'])
                            && strtolower($tokens[$i]['content']) === 'die')
                    ) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}
