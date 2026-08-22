/**
 * TestBed bootstrap for the standalone coverage run (vitest.coverage.config.ts).
 *
 * The `@angular/build:unit-test` builder generates this wiring itself from the
 * `providersFile` option, so `npm test` never loads this file. The coverage run
 * bypasses that builder (its v8 coverage collects no data — see
 * docs/test-coverage.md), so the same environment has to be set up by hand here.
 * Keep it in sync with test-providers.ts.
 */
import 'zone.js';
import 'zone.js/testing';

import { NgModule } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

import providers from './test-providers';

@NgModule({ providers })
export class TestModule {}

getTestBed().initTestEnvironment([BrowserTestingModule, TestModule], platformBrowserTesting(), {
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});
