import assert from "node:assert/strict";
import test from "node:test";
import {
  actressEditorialProfiles,
  editorialGuides,
  genreEditorialProfiles,
  reportDefinitions,
} from "./editorialContent.ts";

test("publishes the planned editorial content set without duplicate slugs", () => {
  assert.equal(editorialGuides.length, 6);
  assert.equal(new Set(editorialGuides.map((guide) => guide.slug)).size, 6);
  assert.equal(reportDefinitions.length, 3);
  assert.equal(new Set(reportDefinitions.map((report) => report.slug)).size, 3);
});

test("keeps every guide substantial and internally connected", () => {
  for (const guide of editorialGuides) {
    assert.ok(guide.sections.length >= 4, guide.slug);
    assert.ok(guide.faq.length >= 2, guide.slug);
    assert.ok(guide.related.length >= 3, guide.slug);
    assert.ok(guide.related.every((link) => link.href.startsWith("/")), guide.slug);
  }
});

test("includes curated profiles for the first-wave entities", () => {
  assert.equal(Object.keys(genreEditorialProfiles).length, 10);
  assert.equal(Object.keys(actressEditorialProfiles).length, 20);
  for (const profile of [
    ...Object.values(genreEditorialProfiles),
    ...Object.values(actressEditorialProfiles),
  ]) {
    assert.equal(profile.priorities.length, 3);
    assert.ok(profile.lead.length >= 30);
    assert.ok(profile.caution.length >= 30);
  }
});
