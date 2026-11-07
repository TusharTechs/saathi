import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import protocol from '../packages/clinical-content/src/adult.v1.json' with { type:'json' };
import lock from '../packages/clinical-content/src/protocol.lock.json' with { type:'json' };

// The database stores each protocol version once and refuses different content under the same version
// ("Protocol version content conflict"), so every report would fail after an edit without a version bump.
test('protocol content changes only with a new version', () => {
  const sha256 = createHash('sha256').update(JSON.stringify(protocol)).digest('hex');
  if (lock.version === protocol.version) assert.equal(sha256, lock.sha256, `adult.v1.json changed but its version did not. Bump "version", then set protocol.lock.json to {version:"<new>", sha256:"${sha256}"}.`);
  else assert.fail(`protocol.lock.json is for ${lock.version}; set it to {version:"${protocol.version}", sha256:"${sha256}"}.`);
});
