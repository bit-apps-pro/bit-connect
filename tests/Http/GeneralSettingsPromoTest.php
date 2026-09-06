<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Http\Requests\UpdateGeneralSettingsRequest;
use PHPUnit\Framework\TestCase;

/**
 * The portal sidebar's promo card.
 *
 * The default matters more than the feature: the card is an outbound link on
 * pages the site owner published, so it may only appear where an admin asked
 * for it — and no partial payload, or install that predates the setting, may
 * turn it on by accident.
 *
 * @internal
 *
 * @coversNothing
 */
final class GeneralSettingsPromoTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_options'] = [];
    }

    public function testStaysOffForAnInstallThatNeverSawTheSetting(): void
    {
        $promo = GeneralSettings::promo(['communityTitle' => 'Acme Community']);

        $this->assertFalse($promo['enabled']);
        $this->assertSame('', $promo['url']);
        $this->assertSame('', $promo['eyebrow']);
        $this->assertSame('', $promo['headline']);
        $this->assertSame('', $promo['prefix']);
        $this->assertSame([], $promo['phrases']);
        $this->assertSame('', $promo['cta']);
    }

    public function testStaysOffWhenTheOptionIsNotEvenAnArray(): void
    {
        $this->assertFalse(GeneralSettings::promo(false)['enabled']);
        $this->assertFalse(GeneralSettings::promo(null)['enabled']);
        $this->assertFalse(GeneralSettings::promo('yes')['enabled']);
    }

    public function testStoresEveryLineOfTheCard(): void
    {
        $data = $this->update([
            'promo' => [
                'enabled'  => true,
                'url'      => 'https://bitapps.pro',
                'eyebrow'  => 'A Bit Apps product',
                'headline' => 'Built with Bit Connect',
                'prefix'   => 'We also build',
                'phrases'  => ['smart forms', 'no-code automations'],
                'cta'      => 'Explore our plugins',
            ],
        ]);

        $this->assertTrue($data['promo']['enabled']);
        $this->assertSame('https://bitapps.pro', $data['promo']['url']);
        $this->assertSame('A Bit Apps product', $data['promo']['eyebrow']);
        $this->assertSame('Built with Bit Connect', $data['promo']['headline']);
        $this->assertSame('We also build', $data['promo']['prefix']);
        $this->assertSame(['smart forms', 'no-code automations'], $data['promo']['phrases']);
        $this->assertSame('Explore our plugins', $data['promo']['cta']);
    }

    /**
     * A form post sends "1"/"on" rather than a real boolean.
     */
    public function testReadsTheSwitchFromAFormPost(): void
    {
        $this->assertTrue($this->update(['promo' => ['enabled' => 'on']])['promo']['enabled']);
        $this->assertTrue($this->update(['promo' => ['enabled' => '1']])['promo']['enabled']);
        $this->assertFalse($this->update(['promo' => ['enabled' => '0']])['promo']['enabled']);
        $this->assertFalse($this->update(['promo' => ['enabled' => '']])['promo']['enabled']);
    }

    /**
     * The onboarding form posts only the branding fields.
     */
    public function testAPayloadWithoutTheCardLeavesTheStoredOneAlone(): void
    {
        $this->store([
            'enabled'  => true,
            'headline' => 'Built by Acme',
            'url'      => 'https://acme.test',
            'phrases'  => ['our other plugins'],
        ]);

        $data = $this->update(['communityTitle' => 'Acme Community']);

        $this->assertTrue($data['promo']['enabled']);
        $this->assertSame('Built by Acme', $data['promo']['headline']);
        $this->assertSame('https://acme.test', $data['promo']['url']);
        $this->assertSame(['our other plugins'], $data['promo']['phrases']);
    }

    /**
     * Same reasoning one level down: an admin build that posts the switch but
     * not the copy is editing the switch, not blanking the wording.
     */
    public function testAPartialCardKeepsTheKeysItOmits(): void
    {
        $this->store([
            'enabled'  => false,
            'headline' => 'Built by Acme',
            'url'      => 'https://acme.test',
            'phrases'  => ['our other plugins'],
        ]);

        $data = $this->update(['promo' => ['enabled' => true]]);

        $this->assertTrue($data['promo']['enabled']);
        $this->assertSame('Built by Acme', $data['promo']['headline']);
        $this->assertSame('https://acme.test', $data['promo']['url']);
        $this->assertSame(['our other plugins'], $data['promo']['phrases']);
    }

    /**
     * Nothing fills the gap: an emptied line is a row the card no longer has.
     */
    public function testAnEmptiedLineStaysEmpty(): void
    {
        $this->store([
            'enabled'  => true,
            'headline' => 'Built by Acme',
            'eyebrow'  => 'An Acme product',
            'url'      => 'https://acme.test',
        ]);

        $data = $this->update([
            'promo' => ['headline' => '', 'eyebrow' => '', 'url' => '', 'phrases' => [], 'cta' => ''],
        ]);

        $this->assertSame('', $data['promo']['headline']);
        $this->assertSame('', $data['promo']['eyebrow']);
        $this->assertSame('', $data['promo']['url']);
        $this->assertSame('', $data['promo']['cta']);
        $this->assertSame([], $data['promo']['phrases']);
        $this->assertTrue($data['promo']['enabled'], 'blanking the copy is not switching the card off');
    }

    public function testRefusesALinkTheBrowserShouldNotFollow(): void
    {
        $data = $this->update(['promo' => ['url' => 'javascript:alert(1)']]);

        $this->assertSame('', $data['promo']['url']);
    }

    public function testStripsMarkupFromEveryLine(): void
    {
        $data = $this->update([
            'promo' => [
                'eyebrow'  => '<em>An Acme product</em>',
                'headline' => '<script>alert(1)</script>Built by Acme',
                'prefix'   => '<b>We also build</b>',
                'phrases'  => ['<b>bold ideas</b>'],
                'cta'      => '<i>See our work</i>',
            ],
        ]);

        $this->assertSame('An Acme product', $data['promo']['eyebrow']);
        $this->assertSame('alert(1)Built by Acme', $data['promo']['headline']);
        $this->assertSame('We also build', $data['promo']['prefix']);
        $this->assertSame(['bold ideas'], $data['promo']['phrases']);
        $this->assertSame('See our work', $data['promo']['cta']);
    }

    public function testDropsBlankPhrasesAndKeepsTheAdminsOrder(): void
    {
        $data = $this->update([
            'promo' => ['phrases' => ['first', '   ', '', 'second', 'third']],
        ]);

        $this->assertSame(['first', 'second', 'third'], $data['promo']['phrases']);
    }

    public function testCapsTheListAndTheLineLength(): void
    {
        $data = $this->update([
            'promo' => [
                'headline' => str_repeat('a', 200),
                'phrases'  => array_map(static fn (int $i) => 'phrase ' . $i, range(1, 25)),
            ],
        ]);

        $this->assertSame(80, mb_strlen($data['promo']['headline']));
        $this->assertCount(10, $data['promo']['phrases']);
        $this->assertSame('phrase 1', $data['promo']['phrases'][0]);
    }

    /**
     * @param array<string, mixed> $promo
     */
    private function store(array $promo): void
    {
        $GLOBALS['__wp_options'][Config::withPrefix(GeneralSettings::OPTION_NAME->value)] = [
            'communityTitle' => 'Acme Community',
            'promo'          => $promo,
        ];
    }

    /**
     * @param array<string, mixed> $input
     *
     * @return array<string, mixed>
     */
    private function update(array $input): array
    {
        $request = new UpdateGeneralSettingsRequest();

        foreach ($input as $key => $value) {
            $request->{$key} = $value;
        }

        return $request->toSettingsData();
    }
}
