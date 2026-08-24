const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const perfectionist = require("eslint-plugin-perfectionist");

const angularClassGroups = [
  { groupName: "injected", selector: "property", elementValuePattern: "^inject[(<]" },
  { groupName: "input", selector: "property", elementValuePattern: "^input[.(<]" },
  { groupName: "input", selector: "property", decoratorNamePattern: "^Input$" },
  { groupName: "model", selector: "property", elementValuePattern: "^model[.(<]" },
  { groupName: "output", selector: "property", elementValuePattern: "^output[(<]" },
  { groupName: "output", selector: "property", decoratorNamePattern: "^Output$" },
  { groupName: "query", selector: "property", elementValuePattern: "^(viewChild|viewChildren|contentChild|contentChildren)[.(<]" },
  { groupName: "query", selector: "property", decoratorNamePattern: "^(ViewChild|ViewChildren|ContentChild|ContentChildren)$" },
  { groupName: "computed", selector: "property", elementValuePattern: "^computed[(<]" },
  { groupName: "signal", selector: "property", elementValuePattern: "^signal[(<]" },
  { groupName: "lifecycle", selector: "method", elementNamePattern: "^ng[A-Z]" },
];

module.exports = tseslint.config(
  {
    // The Playwright screenshot system is plain Node/TS, not Angular — keep the
    // Angular lint rules (and its app-prefix selector rules) away from it.
    ignores: ["playwright/**", "playwright.config.ts"],
  },
  {
    files: ["**/*.ts"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...tseslint.configs.stylistic, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    plugins: { perfectionist },
    rules: {
      // Group class members the way an Angular class reads: what it needs, what it takes in,
      // what it emits, what it derives, then behaviour.
      // Dependency detection is what keeps `x = this.someService.y` from being hoisted above
      // the `inject()` it reads, which would be a construction-time crash, not a lint warning.
      "perfectionist/sort-classes": [
        "warn",
        {
          type: "unsorted",
          useExperimentalDependencyDetection: true,
          groups: [
            "index-signature",
            "static-property",
            "injected",
            "input",
            "model",
            "output",
            "query",
            "computed",
            "signal",
            "property",
            "private-property",
            "constructor",
            "lifecycle",
            ["get-method", "set-method"],
            "method",
            "private-method",
            "unknown",
          ],
          customGroups: angularClassGroups,
        },
      ],
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@angular-eslint/component-class-suffix": [
        "error",
        {
          suffixes: ["Component", "Page"],
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.html"],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      "@angular-eslint/template/attributes-order": [
        "warn",
        {
          alphabetical: true,
          order: ["STRUCTURAL_DIRECTIVE", "TEMPLATE_REFERENCE", "ATTRIBUTE_BINDING", "INPUT_BINDING", "TWO_WAY_BINDING", "OUTPUT_BINDING"],
        },
      ],
    },
  },
);
