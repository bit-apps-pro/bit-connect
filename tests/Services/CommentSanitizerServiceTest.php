<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\CommentSanitizerService;
use PHPUnit\Framework\TestCase;

class CommentSanitizerServiceTest extends TestCase
{
    public function testAllowedHtmlWhitelistsExpectedTags(): void
    {
        $allowed = (new CommentSanitizerService())->getAllowedHtml();

        foreach (['p', 'strong', 'em', 'a', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li'] as $tag) {
            $this->assertArrayHasKey($tag, $allowed, "expected <{$tag}> to be allowed");
        }
    }

    public function testAllowedHtmlExcludesDangerousTags(): void
    {
        $allowed = (new CommentSanitizerService())->getAllowedHtml();

        foreach (['script', 'iframe', 'object', 'embed', 'style', 'table'] as $tag) {
            $this->assertArrayNotHasKey($tag, $allowed, "did not expect <{$tag}> to be allowed");
        }
    }

    public function testLinkTagDoesNotAllowEventHandlers(): void
    {
        $allowed = (new CommentSanitizerService())->getAllowedHtml();

        $this->assertArrayHasKey('href', $allowed['a']);
        $this->assertArrayNotHasKey('onclick', $allowed['a']);
    }

    // -------------------------------------------------------------------------
    // Classes
    //
    // Links admit `class` so a mention keeps looking like one. That makes the
    // allowlist in normalize() the thing standing between a comment and the
    // site's whole stylesheet, so it is checked here rather than assumed.
    // -------------------------------------------------------------------------

    public function testKeepsTheMentionClassOnALink(): void
    {
        $html = '<p><a class="bc-mention" href="/user/aiden-carter">@Aiden Carter</a></p>';

        $this->assertStringContainsString(
            'class="bc-mention"',
            (new CommentSanitizerService())->sanitize($html)
        );
    }

    public function testDropsEveryOtherClass(): void
    {
        $html = '<p class="bc-fixed bc-inset-0"><a class="bc-mention danger" href="/user/aiden-carter">@Aiden Carter</a></p>';

        $sanitized = (new CommentSanitizerService())->sanitize($html);

        $this->assertStringContainsString('class="bc-mention"', $sanitized);
        $this->assertStringNotContainsString('danger', $sanitized);
        $this->assertStringNotContainsString('bc-fixed', $sanitized);
        $this->assertStringNotContainsString('bc-inset-0', $sanitized);
    }
}
