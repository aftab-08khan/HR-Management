import test from 'node:test';
import assert from 'node:assert/strict';
import {validRequestOrigin} from '../lib/request-origin.js';

const request = (origin = 'http://localhost:3000', headers = {}, url = 'http://0.0.0.0:3000/api/demo') => ({url, headers: new Headers({host: 'localhost:3000', ...(origin === null ? {} : {origin}), ...headers})});
const valid = (req, canonical = '') => validRequestOrigin(req, canonical);

test('browser Host resolves localhost origins when Next request URL uses its listening address', () => {
  assert.equal(valid(request()), true);
  assert.equal(valid(request('http://127.0.0.1:3000', {host: '127.0.0.1:3000'})), true);
  assert.equal(valid(request('http://[::1]:3000', {host: '[::1]:3000'})), true);
  assert.equal(valid(request('https://people.example', {host: 'people.example'}, 'https://internal:3000/api/demo')), true);
  assert.equal(valid(request('https://PEOPLE.example:443', {host: 'people.example'}, 'https://internal/api/demo')), true);
});

test('scheme, full hostname and port must match without wildcard or suffix matching', () => {
  for (const origin of ['https://localhost:3000', 'http://localhost:3001', 'http://localhost:3000.evil.test', 'http://evil.localhost:3000', 'http://localhost.evil.test:3000', 'http://0.0.0.0:3000', 'http://evil.test']) assert.equal(valid(request(origin)), false, origin);
  assert.equal(valid(request('http://localhost:3000', {host: '*.localhost:3000'})), false);
});

test('malformed, opaque, credentialed and multi-value origins are rejected', () => {
  for (const origin of ['', 'null', '*', 'ftp://localhost:3000', 'http://localhost:3000/', 'http://localhost:3000/path', 'http://localhost:3000?x=1', 'http://localhost:3000#x', 'http://user@localhost:3000', 'http://user:password@localhost:3000', 'http://localhost:3000 http://evil.test', 'http://localhost:3000,http://evil.test', 'http://local\\host:3000', 'http://*.localhost:3000']) assert.equal(valid(request(origin)), false, origin);
  for (const host of ['', 'localhost:3000/evil', 'localhost:3000@evil.test', 'localhost:3000,evil.test', 'localhost:3000?x=1']) assert.equal(valid(request('http://localhost:3000', {host})), false, host);
});

test('only a valid explicitly configured canonical origin trusts HTTPS proxy termination', () => {
  const proxied = request('https://people.example', {host: 'internal:3000'});
  assert.equal(valid(proxied), false);
  assert.equal(valid(proxied, 'https://people.example'), true);
  assert.equal(valid(proxied, 'https://people.example/custom/api/auth'), true);
  assert.equal(valid(request('https://people.example.evil.test', {host: 'internal:3000'}), 'https://people.example'), false);
  for (const configured of ['*', 'https://*.example', 'ftp://people.example', 'https://user@people.example', 'https://people.example?x=1', 'https://people.example#x']) assert.equal(valid(proxied, configured), false, configured);
});

test('forwarded headers cannot establish a trusted origin or protocol', () => {
  assert.equal(valid(request('https://evil.test', {'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'https'})), false);
  assert.equal(valid(request('https://localhost:3000', {'x-forwarded-proto': 'https'})), false);
  assert.equal(valid(request('http://evil.test', {forwarded: 'host=evil.test;proto=http'})), false);
});

test('cross-site Fetch Metadata blocks every request including canonical origins and CLI-like requests', () => {
  assert.equal(valid(request('http://localhost:3000', {'sec-fetch-site': 'cross-site'})), false);
  assert.equal(valid(request('https://people.example', {'sec-fetch-site': 'cross-site'}), 'https://people.example'), false);
  assert.equal(valid(request(null, {'sec-fetch-site': 'cross-site'})), false);
  assert.equal(valid(request(null)), true);
  assert.equal(valid(request('http://localhost:3000', {'sec-fetch-site': 'same-origin'})), true);
});

test('Host-less trusted requests fall back to the safe request URL origin', () => {
  assert.equal(valid({url: 'http://localhost:3000/api/demo', headers: new Headers({origin: 'http://localhost:3000'})}), true);
  assert.equal(valid({url: 'https://localhost:3000/api/demo', headers: new Headers({origin: 'http://localhost:3000'})}), false);
});
