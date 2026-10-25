import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_CREDENTIALS,demoCredentialRole} from '../lib/demo-credentials.js';

test('sample credentials resolve all three explicit demo roles',()=>{
  for(const account of DEMO_CREDENTIALS)assert.equal(demoCredentialRole(` ${account.email.toUpperCase()} `,account.password),account.role);
  assert.deepEqual(DEMO_CREDENTIALS.map(account=>account.role),['admin','hr','employee']);
});
test('wrong, malformed and oversized sample credentials never select a role',()=>{
  for(const account of DEMO_CREDENTIALS)assert.equal(demoCredentialRole(account.email,'incorrect'),null);
  for(const [email,password] of [[null,'PeopleOS@2026!'],['unknown@peopleos.co','PeopleOS@2026!'],['alex@peopleos.co',null],['a'.repeat(255),'PeopleOS@2026!'],['alex@peopleos.co','x'.repeat(129)]])assert.equal(demoCredentialRole(email,password),null);
});
