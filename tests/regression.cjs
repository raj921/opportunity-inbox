// Exercise pure helpers and browser-local state without network dependencies.
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
  vm.runInNewContext(output, {exports, URL, Date, setTimeout, clearTimeout, setInterval:()=>0, clearInterval(){}, ...overrides.globals,
    require: name => {
      if (name in overrides) return overrides[name];
      if (name === '@/lib/lead-utils' || name === './lead-utils') return load('lib/lead-utils.ts');
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

const {parseDemoCsv} = load('lib/demo-data.ts');
const seed = {
  id:'x_123', url:'https://x.com/a/status/123', platform:'x', author:'Zoë, "Buyer"',
  kind:'product', priority:'hot', status:'new', foundAt:'2026-11-10T07:39:08.000Z',
  followUp:null, why:'First line\nSecond, "quoted" line', reply:'Let’s discuss it.', notes:'',
  excerpt:'', query:null, source:'csv', postedDate:null, statusAt:null, repliedAt:null,
};
const commented = {...seed,status:'replied',repliedAt:'2026-11-10T08:04:08.000Z',statusAt:'2026-11-10T08:04:08.000Z'};
const parsed = parseDemoCsv("\uFEFF" + u.leadsCsv([commented]) + '\r\n');
assert.deepEqual(JSON.parse(JSON.stringify(parsed)), [commented]);
assert.throws(() => parseDemoCsv('"Author"\n"unfinished'), /Unclosed quote/);

function storage() {
  const values = new Map();
  return {fail:false, getItem:k=>values.get(k) ?? null, setItem(k,v) {
    if (this.fail) throw new Error('Storage unavailable');
    values.set(k,v);
  }};
}
function providerHarness(localStorage) {
  let leads;
  let index = 0;
  const effects = [];
  const hooks = {
    createContext:()=>({Provider:'provider'}), useContext:()=>null, useCallback:f=>f,
    useEffect:f=>effects.push(f), useMemo:f=>f(), useRef:v=>({current:v}),
    useState:initial=>{
      const value = typeof initial === 'function' ? initial() : initial;
      if (index++ !== 0) return [value,()=>{}];
      leads = value;
      return [leads,next=>{leads=typeof next==='function'?next(leads):next;}];
    },
  };
  const provider = load('components/leads-provider.tsx', {
    react:hooks, sonner:{toast:{error(){},success(){}}},
    'react/jsx-runtime':{jsx:(_,props)=>({props})}, globals:{localStorage},
  });
  const value = provider.LeadsProvider({children:null,initialLeads:[seed]}).props.value;
  effects.forEach(effect=>effect());
  return {value,getLeads:()=>leads};
}
async function saves() {
  const local = storage();
  let h = providerHarness(local);
  await Promise.all([h.value.patch(seed.id,{notes:'Saved note'}), h.value.patch(seed.id,{reply:'Edited draft'})]);
  assert.equal(h.getLeads()[0].notes,'Saved note');
  assert.equal(h.getLeads()[0].reply,'Edited draft');
  await h.value.patch(seed.id,{status:'replied',followUp:'2026-11-12'});
  const repliedAt = h.getLeads()[0].repliedAt;
  assert.ok(Number.isFinite(Date.parse(repliedAt)));
  await h.value.patch(seed.id,{status:'talking'});
  assert.equal(h.getLeads()[0].repliedAt,repliedAt);
  h = providerHarness(local);
  assert.equal(h.getLeads()[0].status,'talking');
  assert.equal(h.getLeads()[0].followUp,'2026-11-12');
  assert.equal(h.getLeads()[0].notes,'Saved note');
  const manual = {...seed,id:'manual',source:'manual',url:'https://x.com/smoke/status/456'};
  assert.equal(await h.value.add(manual),true);
  assert.equal(await h.value.add(manual),false);
  assert.equal(providerHarness(local).getLeads().filter(l=>l.id==='manual').length,1);
  assert.equal(await h.value.add({...manual,id:'reddit',platform:'reddit',url:'https://www.reddit.com/r/test/comments/abc/'}),false);
  local.fail = true;
  assert.equal(await h.value.patch(seed.id,{notes:'Unsaved'}),false);
  assert.equal(h.getLeads().find(l=>l.id===seed.id).notes,'Saved note');
  assert.equal(await h.value.add({...manual,id:'unsaved'}),false);
  assert.equal(h.getLeads().some(l=>l.id==='unsaved'),false);
}
saves().then(()=>console.log('Regression checks passed: URLs, dates, CSV quoting/safety, metrics, local persistence and save failures.')).catch(e=>{console.error(e);process.exitCode=1;});
