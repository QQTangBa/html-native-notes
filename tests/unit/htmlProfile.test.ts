// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildHtmlProfile,
  embedHtmlProfile,
  extractEmbeddedHtmlProfile,
  migrateHtmlProfile,
} from '../../bridge/profile/htmlProfile';

const sampleHtml = [
  '<!doctype html>',
  '<html>',
  '<head>',
  '  <title>Market Notes</title>',
  '  <meta name="keywords" content="ai, research">',
  '  <meta name="description" content="A generated research page">',
  '  <link rel="stylesheet" href="./theme.css">',
  '  <style>:root { --accent: #2f80ed; --surface: #ffffff; }</style>',
  '</head>',
  '<body>',
  '  <h1>Market Notes</h1>',
  '  <p data-ainote-block-id="intro">Opening context.</p>',
  '  <img src="./assets/chart.png" alt="Chart">',
  '  <script src="./app.js"></script>',
  '</body>',
  '</html>',
].join('\n');

describe('HTML Profile', () => {
  it('builds profile metadata, assets, theme variables, AI context, and block ids from HTML', () => {
    const profile = buildHtmlProfile(sampleHtml, {
      sourcePath: '/vault/imports/market.html',
      sourceHash: 'sha256-source',
    });

    expect(profile).toMatchObject({
      schemaVersion: 1,
      profileVersion: 1,
      title: 'Market Notes',
      tags: ['ai', 'research'],
      source: {
        path: '/vault/imports/market.html',
        hash: 'sha256-source',
      },
      aiContext: {
        summary: 'A generated research page',
        headings: ['Market Notes'],
      },
      themeVars: {
        '--accent': '#2f80ed',
        '--surface': '#ffffff',
      },
    });
    expect(profile.assets).toEqual([
      { kind: 'stylesheet', src: './theme.css' },
      { kind: 'image', src: './assets/chart.png', alt: 'Chart' },
      { kind: 'script', src: './app.js' },
    ]);
    expect(profile.blocks).toEqual([
      { id: 'block-0001', selector: 'h1:nth-of-type(1)', text: 'Market Notes' },
      { id: 'intro', selector: '[data-ainote-block-id="intro"]', text: 'Opening context.' },
    ]);
  });

  it('embeds and extracts profile JSON without rewriting body content', () => {
    const profile = buildHtmlProfile(sampleHtml, {
      sourcePath: '/vault/imports/market.html',
      sourceHash: 'sha256-source',
    });

    const embedded = embedHtmlProfile(sampleHtml, profile);
    const extracted = extractEmbeddedHtmlProfile(embedded);

    expect(embedded).toContain('<script type="application/json" id="ainote-profile">');
    expect(embedded).toContain('<p data-ainote-block-id="intro">Opening context.</p>');
    expect(extracted).toEqual(profile);
  });

  it('migrates legacy profile metadata into the current schema', () => {
    const migrated = migrateHtmlProfile({
      version: 0,
      title: 'Legacy',
      labels: ['old', 'html'],
      sourcePath: '/legacy/page.html',
      sourceHash: 'sha256-old',
    });

    expect(migrated).toMatchObject({
      schemaVersion: 1,
      profileVersion: 1,
      title: 'Legacy',
      tags: ['old', 'html'],
      source: {
        path: '/legacy/page.html',
        hash: 'sha256-old',
      },
    });
    expect(migrated.assets).toEqual([]);
    expect(migrated.blocks).toEqual([]);
    expect(migrated.themeVars).toEqual({});
  });
});
