import test from 'node:test';
import assert from 'node:assert/strict';
import { useLoad } from '../../web/src/composables/useLoad';

test('staff screen load exposes an API failure and recovers when retried', async () => {
  let attempts = 0;
  const request = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('Server temporarily unavailable');
    return { month: '2026-11' };
  };
  const screen = useLoad(request);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(screen.data.value, null);
  assert.equal(screen.error.value.message, 'Server temporarily unavailable');
  await screen.reload();
  assert.deepEqual(screen.data.value, { month: '2026-11' });
  assert.equal(screen.error.value, null);
});

test('staff screen load preserves the last good data when a later refresh fails', async () => {
  let fail = false;
  const request = async () => {
    if (fail) throw new Error('Offline');
    return { month: '2026-11' };
  };
  const screen = useLoad(request);
  await new Promise(resolve => setTimeout(resolve, 0));
  fail = true;
  await screen.reload();
  assert.deepEqual(screen.data.value, { month: '2026-11' });
  assert.equal(screen.error.value.message, 'Offline');
});
