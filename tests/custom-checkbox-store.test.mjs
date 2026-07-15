import assert from 'node:assert/strict';
import test from 'node:test';

const { mergeCustomCheckboxLists } = await import('../src/custom-checkbox-store.js');

test('checkbox merge preserves defaults when imported provider has no checkboxes', () => {
  const defaults = [
    { id: 'default-1', text: 'Bonne tolérance', value: 'Le dispositif est bien toléré', family: 'tolérance', pinned: false, favorite: false }
  ];

  assert.deepEqual(
    mergeCustomCheckboxLists(defaults, []),
    defaults
  );
});

test('checkbox merge keeps defaults and appends imported custom checkboxes', () => {
  const defaults = [
    { id: 'default-1', text: 'Bonne tolérance', value: 'Le dispositif est bien toléré', family: 'tolérance', pinned: false, favorite: false }
  ];
  const imported = [
    { id: 'custom-1', text: 'WAVE vu', value: 'Le signal WAVE est mentionné', family: 'technique', pinned: false, favorite: true }
  ];

  const merged = mergeCustomCheckboxLists(defaults, imported);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].text, 'Bonne tolérance');
  assert.equal(merged[1].text, 'WAVE vu');
});