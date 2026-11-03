// Exercise the real route handlers and provider with offline dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative, overrides = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true} }).outputText;
  vm.runInNewContext(output, {exports, Request, Response, URL, Date, setTimeout, clearTimeout, localStorage: {getItem:()=>null,setItem(){}}, ...overrides.globals,
    require: name => {
      if (name in overrides) return overrides[name];
      if (name === '@/lib/lead-utils') return load('lib/lead-utils.ts');
      return require(name);
    }});
  return exports;
}
const u = load('lib/lead-utils.ts');
assert.equal(u.validDate('2026-02-30'), false);
assert.equal(u.validDate('2028-02-29'), true);
assert.equal(u.validDate(['2026-11-03']), false);
assert.equal(u.parsePostUrl('https://'), null);
assert.equal(u.parsePostUrl('javascript:alert(1)'), null);
assert.equal(u.parsePostUrl('https://user:password@example.com'), null);
assert.equal(u.postPlatform(new URL('https://x.com/a/status/123')), 'x');
assert.equal(u.postPlatform(new URL('https://evilx.com/a/status/123')), 'other');
assert.notEqual(u.leadId('https://evilx.com/a/status/123'), 'x_123');
assert.equal(u.leadId('https://example.com/😀'), 'url_16n07i7');
assert.equal(u.postPlatform(new URL('https://www.reddit.com/r/SaaS/comments/abc/')), 'reddit');
assert.equal(u.leadId('https://www.reddit.com/r/SaaS/comments/abc/?share=1'), 'reddit_abc');
assert.equal(u.median([60, 120]), 90);
assert.equal(u.median([90, 10, 20]), 20);
assert.equal(u.median([]), null);
assert.equal(u.isFollowUpDue({status:'won',followUp:'2026-11-01'},'2026-11-03'), false);
assert.equal(u.isFollowUpDue({status:'talking',followUp:'2026-11-01'},'2026-11-03'), true);
const csv = u.leadsCsv([{author:'=HYPERLINK("bad")',platform:'x',notes:'a,"b"\nnew line'}]);
assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
assert.ok(csv.includes('"a,""b""\nnew line"'));
const req = body => new Request('http://localhost/api/leads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

async function routes() {
  let writes = 0;
  const routes = load('app/api/leads/route.ts', {'@/lib/db':{insertLead:async l=>{writes++;return l.id!=='duplicate';},listLeads:async()=>[]}});
  assert.equal((await routes.POST(req({url:'https://',author:'a',text:'t'}))).status, 400);
  assert.equal(writes, 0);
  assert.equal((await routes.POST(req({url:'https://x.com/a/status/123',author:'a',text:'t'}))).status, 201);
  const updates = [];
  const patch = load('app/api/leads/[id]/route.ts', {'@/lib/db':{updateLead:async (id,p)=>{updates.push(p);return {id,...p};}}}).PATCH;
  assert.equal((await patch(req({followUp:'2026-02-30'}), {params:Promise.resolve({id:'a'})})).status, 400);
  assert.equal(updates.length, 0);
  const response = await patch(req({followUp:null}), {params:Promise.resolve({id:'a'})});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).lead.followUp, null);
  const sources = load('app/api/sources/route.ts', {'@/lib/db':{sourceHealth:async()=>{throw new Error('secret detail');}}});
  const health = await sources.GET();
  assert.equal(health.status,503);
  assert.ok(!(await health.text()).includes('secret detail'));
}

function providerHarness() {
  let leads = [{id:'a',notes:'old-a',excerpt:''},{id:'b',notes:'old-b',excerpt:''}];
  let index = 0;
  const requests = [];
  const hooks = {
    createContext:()=>({Provider:'provider'}),useContext:()=>null,useCallback:f=>f,useEffect(){},useMemo:f=>f(),useRef:v=>({current:v}),
    useState:initial=>{
      const first=index++===0;
      return first ? [leads, value=>{leads=typeof value==='function'?value(leads):value;}] : [typeof initial==='function'?initial():initial,()=>{}];
    },
  };
  const provider = load('components/leads-provider.tsx', {react:hooks,'sonner':{toast:Object.assign(()=>{}, {error(){},success(){}})},'react/jsx-runtime':{jsx:(_,props)=>({props})},globals:{fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))}});
  const value = provider.LeadsProvider({children:null}).props.value;
  return {value,requests,getLeads:()=>leads};
}
const tick = () => new Promise(resolve=>setImmediate(resolve));
async function saves() {
  let h=providerHarness();
  const a=h.value.patch('a',{notes:'new-a'}), b=h.value.patch('b',{notes:'new-b'});
  await tick();
  h.requests[1].resolve({ok:true,json:async()=>({lead:{id:'b',notes:'new-b'}})}); await b;
  h.requests[0].resolve({ok:false,json:async()=>({error:'failed'})}); await a;
  assert.equal(h.getLeads()[1].notes,'new-b');
  assert.equal(h.getLeads()[0].notes,'old-a');
  h=providerHarness();
  const first=h.value.patch('a',{notes:'one'}), second=h.value.patch('a',{notes:'two'});
  await tick(); assert.equal(h.requests.length,1);
  await h.value.reload(); assert.equal(h.requests.length,1); // no poll while writes are pending
  h.requests[0].resolve({ok:true,json:async()=>({lead:{id:'a',notes:'one'}})}); await first; await tick();
  assert.equal(h.requests.length,2);
  h.requests[1].resolve({ok:true,json:async()=>({lead:{id:'a',notes:'two'}})}); await second;
  assert.equal(h.getLeads()[0].notes,'two');
}
(async()=>{await routes();await saves();console.log('Regression checks passed: URLs, dates, CSV safety, metrics, source failures, concurrent saves and polling.');})().catch(e=>{console.error(e);process.exitCode=1;});
