import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseNotionPageId,
  isResolvableNotionPageRef,
} from '../../../connectors/notion/notion-id.core.js';

describe('parseNotionPageId', () => {
  it('parses notion.so links', () => {
    const id = parseNotionPageId(
      'https://www.notion.so/Roadmap-36c3d6c5230581ea83efd43b2b284066',
    );
    assert.equal(id, '36c3d6c5-2305-81ea-83ef-d43b2b284066');
  });

  it('parses app.notion.com links with slug prefix', () => {
    const id = parseNotionPageId(
      'https://app.notion.com/p/8-18-30--36c3d6c5230581ea83efd43b2b284066',
    );
    assert.equal(id, '36c3d6c5-2305-81ea-83ef-d43b2b284066');
  });

  it('rejects non-notion http urls', () => {
    assert.equal(parseNotionPageId('https://example.com/page'), null);
  });

  it('detects resolvable refs', () => {
    assert.equal(isResolvableNotionPageRef('36c3d6c5-2305-81ea-83ef-d43b2b284066'), true);
    assert.equal(isResolvableNotionPageRef('https://app.notion.com/p/bad'), false);
  });
});
