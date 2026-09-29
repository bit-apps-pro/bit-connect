<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\DepartmentNaming;
use PHPUnit\Framework\TestCase;

/**
 * What the departments taxonomy is called, and the segment its archives use.
 *
 * The plugin's own answer is fixed; `bit_connect_department_naming` may name it
 * otherwise, and each field it gets wrong falls back on its own rather than
 * taking the portal's routes down with it.
 *
 * @internal
 *
 * @coversNothing
 */
final class DepartmentNamingTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_filters'] = [];
    }

    protected function tearDown(): void
    {
        $GLOBALS['__wp_filters'] = [];
    }

    public function testDepartmentIsTheDefaultName(): void
    {
        $this->assertSame(
            ['singular' => 'Department', 'plural' => 'Departments', 'slug' => 'department'],
            DepartmentNaming::get()
        );
    }

    public function testAFilterRenamesIt(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_department_naming'] = [
            'singular' => 'Product',
            'plural'   => 'Products',
            'slug'     => 'Our Products',
        ];

        $this->assertSame(
            ['singular' => 'Product', 'plural' => 'Products', 'slug' => 'our-products'],
            DepartmentNaming::get()
        );
    }

    public function testEachInvalidFieldFallsBackOnItsOwn(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_department_naming'] = [
            'singular' => '  ',
            'plural'   => 'Products',
            'slug'     => '!!!',
        ];

        $this->assertSame(
            ['singular' => 'Department', 'plural' => 'Products', 'slug' => 'department'],
            DepartmentNaming::get()
        );
    }

    public function testASegmentAnotherRouteOwnsIsRefused(): void
    {
        foreach (['tag', 'stage', 'page', 'user', 'notifications'] as $taken) {
            $GLOBALS['__wp_filters']['bit_connect_department_naming'] = ['slug' => $taken];

            $this->assertSame('department', DepartmentNaming::slug(), $taken . ' was accepted.');
        }
    }

    public function testANonArrayAnswerIsIgnored(): void
    {
        $GLOBALS['__wp_filters']['bit_connect_department_naming'] = 'Products';

        $this->assertSame('department', DepartmentNaming::slug());
    }
}
