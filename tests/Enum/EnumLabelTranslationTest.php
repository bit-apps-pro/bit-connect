<?php

namespace BitApps\BitConnect\Tests\Enum;

use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\ReportStatus;
use PHPUnit\Framework\TestCase;

/**
 * The enum labels say the same thing twice, and this is what keeps them equal.
 *
 * #[Label] attributes cannot call __() — attribute arguments are constant
 * expressions — and __($case->label()) does not work either, because
 * `wp i18n make-pot` reads source rather than runtime: a __() whose argument is
 * an expression puts nothing in the .pot, and a lookup the catalog does not hold
 * returns English in every locale. So the translated wording lives in a
 * match over string literals, which the extractor can read, and the attribute
 * stays as the raw English every non-display reader gets.
 *
 * That leaves two copies of each string and no compiler to hold them together.
 * These tests are the compiler: reword an attribute without rewording the match
 * and the pair stops agreeing here, rather than months later as a translation
 * that silently stopped applying.
 *
 * __() is a pass-through in tests/bootstrap.php, so comparing the two is
 * comparing the literals.
 *
 * Iterating cases() also proves each match is exhaustive — a case added without
 * a match arm throws \UnhandledMatchError instead of quietly shipping.
 *
 * @internal
 *
 * @coversNothing
 */
class EnumLabelTranslationTest extends TestCase
{
    public function testNotificationTypeLabelsMatchTheirAttributes(): void
    {
        foreach (NotificationTypes::cases() as $case) {
            $this->assertSame(
                $case->label(),
                NotificationTypes::translatedLabel($case),
                "NotificationTypes::{$case->name} label drifted from its #[Label] attribute"
            );
        }
    }

    public function testNotificationTypeDescriptionsMatchTheirAttributes(): void
    {
        foreach (NotificationTypes::cases() as $case) {
            $this->assertSame(
                $case->description(),
                NotificationTypes::translatedDescription($case),
                "NotificationTypes::{$case->name} description drifted from its #[Description] attribute"
            );
        }
    }

    public function testCapabilityLabelsMatchTheirAttributes(): void
    {
        foreach (Capabilities::cases() as $case) {
            $this->assertSame(
                $case->label(),
                Capabilities::translatedLabel($case),
                "Capabilities::{$case->name} label drifted from its #[Label] attribute"
            );
        }
    }

    /**
     * The map the capability settings screen renders, keyed the way it reads it.
     */
    public function testTranslatedCapabilityLabelsCoverEveryCase(): void
    {
        $this->assertSame(Capabilities::labels(), Capabilities::translatedLabels());
    }

    public function testActivityActionLabelsMatchTheirAttributes(): void
    {
        foreach (ActivityActions::cases() as $case) {
            $this->assertSame(
                $case->label(),
                ActivityActions::translatedLabel($case),
                "ActivityActions::{$case->name} label drifted from its #[Label] attribute"
            );
        }
    }

    public function testReportStatusLabelsMatchTheirAttributes(): void
    {
        foreach (ReportStatus::cases() as $case) {
            $this->assertSame(
                $case->label(),
                ReportStatus::translatedLabel($case),
                "ReportStatus::{$case->name} label drifted from its #[Label] attribute"
            );
        }
    }
}
