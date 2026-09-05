<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ContentSanitizerService;
use PHPUnit\Framework\TestCase;

class ContentSanitizerServiceTest extends TestCase
{
    public function testAllowedHtmlWhitelistsExpectedTags(): void
    {
        $allowed = (new ContentSanitizerService())->getAllowedHtml();

        // Core Quill formatting tags are present.
        foreach (['p', 'strong', 'em', 'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'code'] as $tag) {
            $this->assertArrayHasKey($tag, $allowed, "expected <{$tag}> to be allowed");
        }
    }

    public function testAllowedHtmlExcludesDangerousTags(): void
    {
        $allowed = (new ContentSanitizerService())->getAllowedHtml();

        foreach (['script', 'iframe', 'object', 'embed', 'style', 'form'] as $tag) {
            $this->assertArrayNotHasKey($tag, $allowed, "did not expect <{$tag}> to be allowed");
        }
    }

    public function testLinkTagAllowsHrefButControlsAttributes(): void
    {
        $allowed = (new ContentSanitizerService())->getAllowedHtml();

        $this->assertArrayHasKey('href', $allowed['a']);
        $this->assertArrayHasKey('rel', $allowed['a']);
        $this->assertArrayHasKey('target', $allowed['a']);
        // onclick and other event handlers must not be whitelisted.
        $this->assertArrayNotHasKey('onclick', $allowed['a']);
    }

    public function testImageTagAllowsSrcButNotEvents(): void
    {
        $allowed = (new ContentSanitizerService())->getAllowedHtml();

        $this->assertArrayHasKey('src', $allowed['img']);
        $this->assertArrayNotHasKey('onerror', $allowed['img']);
    }
}
