import assert from 'assert';
import { formatUserProfile, calculateDiscount } from './userUtils.js';

console.log('Running test suite for userUtils...');

// Test 1: Normal user
const normalUser = { profile: { name: 'Alice' } };
assert.strictEqual(formatUserProfile(normalUser), 'ALICE', 'Test 1 failed');
console.log('✔ Test 1 passed: normal user formatted');

// Test 2: Calculate discount
assert.strictEqual(calculateDiscount(100, 0.2), 80, 'Test 2 failed');
console.log('✔ Test 2 passed: discount calculated');

// Test 3: Null / undefined user or profile
const missingProfileUser = {};
try {
  const result = formatUserProfile(missingProfileUser);
  console.log('Result:', result);
} catch (err) {
  console.error(err);
  process.exit(1);
}
