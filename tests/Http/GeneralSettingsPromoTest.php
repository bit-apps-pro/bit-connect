<?php

namespace BitApps\BitConnect\Tests\Http;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Http\Requests\UpdateGeneralSettingsRequest;
use PHPUnit\Framework\TestCase;

/**
 * The portal sidebar's Bit Apps credit card.
 *
 * The default matters more than the feature: the card is an outbound link on
 * pages the site owner published, so it may only appear where an admin asked
 * for it — and no partial payload, or install that predates the setting, may
 * turn it on by accident. The switch is all an admin controls; the copy is the
 * plugin's own.
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
        $this->assertFalse(GeneralSettings::promo(['communityTitle' => 'Acme Community'])['enabled']);
    }

    public function testStaysOffWhenTheOptionIsNotEvenAnArray(): void
    {
        $this->assertFalse(GeneralSettings::promo(false)['enabled']);
        $this->assertFalse(GeneralSettings::promo(null)['enabled']);
        $this->assertFalse(GeneralSettings::promo('yes')['enabled']);
    }

    public function testServesThePluginsOwnCopy(): void
    {
        $promo = GeneralSettings::promo(['promo' => ['enabled' => true]]);

        $this->assertTrue($promo['enabled']);
        $this->assertSame('https://bitapps.pro', $promo['url']);
        $this->assertSame('A Bit Apps product', $promo['eyebrow']);
        $this->assertSame('Built with Bit Connect', $promo['headline']);
        $this->assertSame('We also build', $promo['prefix']);
        $this->assertSame(
            ['smart WordPress forms', 'no-code automations', 'communities like this'],
            $promo['phrases']
        );
        $this->assertSame('Explore our plugins', $promo['cta']);
    }

    /**
     * An older version let admins write the card; that wording is not served.
     */
    public function testIgnoresWordingAnOlderVersionStored(): void
    {
        $promo = GeneralSettings::promo([
            'promo' => ['enabled' => true, 'headline' => 'Built by Acme', 'url' => 'https://acme.test'],
        ]);

        $this->assertSame('Built with Bit Connect', $promo['headline']);
        $this->assertSame('https://bitapps.pro', $promo['url']);
    }

    public function testStoresOnlyTheSwitch(): void
    {
        $data = $this->update([
            'promo' => ['enabled' => true, 'headline' => 'Built by Acme', 'url' => 'javascript:alert(1)'],
        ]);

        $this->assertSame(['enabled' => true], $data['promo']);
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
    public function testAPayloadWithoutTheCardLeavesTheSwitchAlone(): void
    {
        $this->store(['enabled' => true]);

        $this->assertTrue($this->update(['communityTitle' => 'Acme Community'])['promo']['enabled']);
    }

    public function testACardWithoutTheSwitchLeavesItAlone(): void
    {
        $this->store(['enabled' => true]);

        $this->assertTrue($this->update(['promo' => []])['promo']['enabled']);
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
