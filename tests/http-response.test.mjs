import test from 'node:test';
import assert from 'node:assert/strict';
import {privateJson,readJsonBody} from '../lib/http-response.js';

test('private HR responses cannot be cached and preserve caller response metadata',async()=>{
  const response=privateJson({id:'record-1'},{status:201,headers:{Vary:'Accept-Language','X-Test':'retained'}});
  assert.equal(response.status,201);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Accept-Language, Cookie');assert.equal(response.headers.get('x-test'),'retained');assert.deepEqual(await response.json(),{id:'record-1'});
});
test('JSON body limits apply to chunked bytes and UTF-8 before parsing',async()=>{
  const encoder=new TextEncoder();
  const make=(chunks,headers={})=>new Request('http://localhost/test',{method:'POST',headers,duplex:'half',body:new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(encoder.encode(chunk));controller.close();}})});
  assert.deepEqual(await readJsonBody(make(['{"name":','"Person"}']),32),{name:'Person'});
  await assert.rejects(readJsonBody(make(['{"name":"','x'.repeat(32),'"}']),32),{status:413});
  await assert.rejects(readJsonBody(make(['{"name":"','أ'.repeat(16),'"}']),32),{status:413});
  await assert.rejects(readJsonBody(make(['{}'],{'Content-Length':'100'}),32),{status:413});
  await assert.rejects(readJsonBody(make(['invalid']),32),{status:400});
});
