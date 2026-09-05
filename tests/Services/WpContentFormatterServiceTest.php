<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\WpContentFormatterService;
use PHPUnit\Framework\TestCase;

/**
 * Pins down the shape content is stored in.
 *
 * What the portal's editor emits is not what a WordPress theme styles. Themes
 * hang their typography off the Gutenberg block classes, so a heading that
 * reaches the database without one renders in a different font from the same
 * heading written in the block editor — a difference nothing reports, because
 * the content is otherwise intact.
 *
 * The classes asserted here are the same ones quill-wp-formatter.ts applies in
 * the browser. A direct API call bypasses that formatter entirely, which is why
 * both ends do the work and why this end is the one that has to be right.
 *
 * @internal
 *
 * @coversNothing
 */
final class WpContentFormatterServiceTest extends TestCase
{
    private WpContentFormatterService $formatter;

    protected function setUp(): void
    {
        $this->formatter = new WpContentFormatterService();
    }

    // -----------------------------------------------------------------------
    // Nothing to format
    // -----------------------------------------------------------------------

    public function testEmptyContentStaysEmpty(): void
    {
        $this->assertSame('', $this->formatter->format(''));
        $this->assertSame('', $this->formatter->format("   \n  "));
    }

    // -----------------------------------------------------------------------
    // Editor artefacts
    // -----------------------------------------------------------------------

    /**
     * ql-* classes are editor state, not content. They mean nothing outside the
     * editor and must not reach the database.
     */
    public function testQuillClassesAreStripped(): void
    {
        $this->assertSame('<p>Hi</p>', $this->formatter->format('<p class="ql-align-center ql-indent-1">Hi</p>'));
    }

    public function testAClassAttributeLeftEmptyByStrippingIsRemovedEntirely(): void
    {
        $this->assertStringNotContainsString('class=""', $this->formatter->format('<p class="ql-indent-1">Hi</p>'));
    }

    public function testClassesThatAreNotQuillsAreKept(): void
    {
        $this->assertSame('<p>Hi</p>', $this->formatter->format('<p class="ql-align-center">Hi</p>'));
        $this->assertStringContainsString('class="mine wp-block-heading"', $this->formatter->format('<h3 class="mine">Hi</h3>'));
    }

    // -----------------------------------------------------------------------
    // Gutenberg block classes
    // -----------------------------------------------------------------------

    public function testEveryHeadingLevelGetsTheBlockClass(): void
    {
        foreach (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as $tag) {
            $this->assertSame(
                "<{$tag} class=\"wp-block-heading\">Title</{$tag}>",
                $this->formatter->format("<{$tag}>Title</{$tag}>")
            );
        }
    }

    public function testBothListKindsGetTheBlockClass(): void
    {
        $this->assertStringContainsString('<ul class="wp-block-list">', $this->formatter->format('<ul><li>a</li></ul>'));
        $this->assertStringContainsString('<ol class="wp-block-list">', $this->formatter->format('<ol><li>a</li></ol>'));
    }

    public function testAnExistingClassIsAppendedToRatherThanReplaced(): void
    {
        $this->assertSame(
            '<h2 class="custom wp-block-heading">Title</h2>',
            $this->formatter->format('<h2 class="custom">Title</h2>')
        );
    }

    public function testContentThatAlreadyCarriesTheClassIsNotGivenItTwice(): void
    {
        $this->assertSame(
            '<h2 class="wp-block-heading">Title</h2>',
            $this->formatter->format('<h2 class="wp-block-heading">Title</h2>')
        );
    }

    public function testOtherAttributesOnTheElementSurvive(): void
    {
        $formatted = $this->formatter->format('<h2 id="section-one">Title</h2>');

        $this->assertStringContainsString('id="section-one"', $formatted);
        $this->assertStringContainsString('wp-block-heading', $formatted);
    }

    // -----------------------------------------------------------------------
    // Code blocks
    // -----------------------------------------------------------------------

    /**
     * The editor emits <pre class="ql-syntax">, which wp_kses reduces to a bare
     * <pre>. Gutenberg's shape is a classed <pre> around a <code>.
     */
    public function testABarePreBecomesAGutenbergCodeBlock(): void
    {
        $this->assertSame(
            '<pre class="wp-block-code"><code>echo 1;</code></pre>',
            $this->formatter->format('<pre>echo 1;</pre>')
        );
    }

    public function testAPreThatAlreadyWrapsItsCodeIsNotWrappedAgain(): void
    {
        $this->assertSame(
            '<pre class="wp-block-code"><code>echo 1;</code></pre>',
            $this->formatter->format('<pre><code>echo 1;</code></pre>')
        );
    }

    public function testALanguageClassOnAPreSurvivesBesideTheBlockClass(): void
    {
        $this->assertSame(
            '<pre class="lang-php wp-block-code"><code>echo 1;</code></pre>',
            $this->formatter->format('<pre class="lang-php">echo 1;</pre>')
        );
    }

    public function testAMultilineCodeBlockKeepsItsLines(): void
    {
        $formatted = $this->formatter->format("<pre>line one\nline two</pre>");

        $this->assertStringContainsString("line one\nline two", $formatted);
    }

    // -----------------------------------------------------------------------
    // Images
    // -----------------------------------------------------------------------

    public function testABareImageIsWrappedInAGutenbergFigure(): void
    {
        $this->assertSame(
            '<figure class="wp-block-image"><img src="a.png" alt="a" /></figure>',
            $this->formatter->format('<img src="a.png" alt="a" />')
        );
    }

    public function testAnUnclosedImageTagIsWrappedToo(): void
    {
        $this->assertSame(
            '<p>before</p><figure class="wp-block-image"><img src="a.png"></figure><p>after</p>',
            $this->formatter->format('<p>before</p><img src="a.png"><p>after</p>')
        );
    }

    /**
     * The case the old pattern was reaching for and could not express: an image
     * already inside a figure must not be wrapped a second time.
     */
    public function testAnImageAlreadyInAFigureIsLeftAlone(): void
    {
        $already = '<figure class="wp-block-image"><img src="a.png" alt="a" /></figure>';

        $this->assertSame($already, $this->formatter->format($already));
    }

    public function testAFigureAndABareImageSideBySideAreTreatedSeparately(): void
    {
        $this->assertSame(
            '<figure><img src="a.png" /></figure><figure class="wp-block-image"><img src="b.png" /></figure>',
            $this->formatter->format('<figure><img src="a.png" /></figure><img src="b.png" />')
        );
    }

    public function testEveryBareImageInARunIsWrapped(): void
    {
        $this->assertSame(
            '<figure class="wp-block-image"><img src="a.png" /></figure>'
            . '<figure class="wp-block-image"><img src="b.png" /></figure>',
            $this->formatter->format('<img src="a.png" /><img src="b.png" />')
        );
    }

    // -----------------------------------------------------------------------
    // Links
    // -----------------------------------------------------------------------

    /**
     * Tab-nabbing: a link opening in a new tab hands the opener to whatever it
     * opened unless rel says otherwise.
     */
    public function testAnExternalLinkIsGivenRelAndOpensInANewTab(): void
    {
        $this->assertSame(
            '<a href="https://example.com" rel="noopener noreferrer" target="_blank">x</a>',
            $this->formatter->format('<a href="https://example.com">x</a>')
        );
    }

    /**
     * Overwritten rather than merged, so a rel="nofollow" the author pasted in
     * cannot leave the link without noopener.
     */
    public function testAnExternalLinksOwnRelAndTargetAreReplaced(): void
    {
        $this->assertSame(
            '<a href="https://example.com" rel="noopener noreferrer" target="_blank">x</a>',
            $this->formatter->format('<a href="https://example.com" target="_self" rel="nofollow">x</a>')
        );
    }

    public function testAPlainHttpLinkIsTreatedAsExternalToo(): void
    {
        $this->assertStringContainsString(
            'rel="noopener noreferrer" target="_blank"',
            $this->formatter->format('<a href="http://example.com">x</a>')
        );
    }

    public function testAnInternalLinkKeepsNeitherRelNorTarget(): void
    {
        $this->assertSame(
            '<a href="/topic/1">x</a>',
            $this->formatter->format('<a href="/topic/1" target="_blank" rel="noopener">x</a>')
        );
    }

    public function testAnInPageAnchorStaysInThePage(): void
    {
        $this->assertSame('<a href="#top">x</a>', $this->formatter->format('<a href="#top" target="_blank">x</a>'));
    }

    public function testAQueryOnlyLinkIsTreatedAsInternal(): void
    {
        $this->assertSame('<a href="?page=2">x</a>', $this->formatter->format('<a href="?page=2" target="_blank">x</a>'));
    }

    // -----------------------------------------------------------------------
    // Whitespace and stray wrapping
    // -----------------------------------------------------------------------

    /**
     * wpautop adds its own paragraphs during the_content, so a doubled wrapper
     * arriving from the client comes out tripled on the page.
     */
    public function testADoubledParagraphWrapperIsCollapsed(): void
    {
        $this->assertSame('<p>hi</p>', $this->formatter->format('<p><p>hi</p></p>'));
    }

    public function testParagraphsHoldingNothingButSpaceAreDropped(): void
    {
        $this->assertSame('<p>real</p>', $this->formatter->format('<p>&nbsp;</p><p>real</p>'));
        $this->assertSame('<p>real</p>', $this->formatter->format('<p>   </p><p>real</p>'));
    }

    public function testRunsOfBlankLinesAreReducedToOne(): void
    {
        $this->assertSame("<p>a</p>\n\n<p>b</p>", $this->formatter->format("<p>a</p>\n\n\n\n<p>b</p>"));
    }

    public function testTrailingSpaceIsTrimmedFromEveryLine(): void
    {
        $this->assertSame("<p>a</p>\n<p>b</p>", $this->formatter->format("<p>a</p>   \n<p>b</p>"));
    }

    // -----------------------------------------------------------------------
    // Text
    // -----------------------------------------------------------------------

    /**
     * The steps are deliberately regex-based rather than DOM-based: DOMDocument
     * mangles multibyte text and wraps everything in a doctype it was never
     * given.
     */
    public function testMultibyteTextSurvivesUntouched(): void
    {
        $bengali = '<p>আমি বাংলায় লিখছি</p>';

        $this->assertSame($bengali, $this->formatter->format($bengali));
    }

    public function testAWholeDocumentIsFormattedInOnePass(): void
    {
        $formatted = $this->formatter->format(
            '<h2 class="ql-align-center">Title</h2>'
            . '<p>&nbsp;</p>'
            . '<p>See <a href="https://example.com">this</a>.</p>'
            . '<ul><li>one</li></ul>'
            . '<img src="a.png" />'
            . '<pre>echo 1;</pre>'
        );

        $this->assertSame(
            '<h2 class="wp-block-heading">Title</h2>'
            . '<p>See <a href="https://example.com" rel="noopener noreferrer" target="_blank">this</a>.</p>'
            . '<ul class="wp-block-list"><li>one</li></ul>'
            . '<figure class="wp-block-image"><img src="a.png" /></figure>'
            . '<pre class="wp-block-code"><code>echo 1;</code></pre>',
            $formatted
        );
    }
}
