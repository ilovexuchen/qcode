const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../core.js');
const id = 'affe77ffa62a6dae1c323b2e76d541b1';
const activity = A.parseActivity(A.EXAMPLE);

test('两个码保留输入的活动 ID，并设置固定参数', () => {
  for (const type of ['in', 'out']) {
    const url = new URL(activity[type]);
    assert.equal(url.origin, 'https://dekt.scu.edu.cn');
    assert.equal(url.pathname, '/ccylmp/pages/main/index/signing');
    assert.equal(url.search, `?id=${id}&type=${type}&state=1`);
  }
});
test('接受空白、附加参数、尾部斜线以及已生成的签到链接', () => {
  assert.equal(A.parseActivity('  ' + A.EXAMPLE + '&from=share \n').id, id);
  assert.equal(A.parseActivity(A.EXAMPLE.replace('activity-detail?', 'activity-detail/?')).id, id);
  assert.equal(A.parseActivity(activity.out).id, id);
});
test('不会把示例中的另一个签到 ID 写入输出', () => {
  const second = 'cf0059545641f8f20ce6b9e5fc89cf93';
  const result = A.parseActivity(A.EXAMPLE.replace(id, second));
  assert.match(result.in, new RegExp(second)); assert.match(result.out, new RegExp(second));
});
for (const [name, input] of [
  ['空值', ''], ['非网址', 'hello'], ['错误域名', A.EXAMPLE.replace('dekt.scu.edu.cn', 'example.com')],
  ['伪造子域名', A.EXAMPLE.replace('dekt.scu.edu.cn', 'dekt.scu.edu.cn.example.com')],
  ['错误路径', A.EXAMPLE.replace('activity-detail', 'other')], ['HTTP', A.EXAMPLE.replace('https:', 'http:')],
  ['缺少 ID', A.EXAMPLE.split('?')[0]], ['重复 ID', A.EXAMPLE + '&id=' + id],
  ['短 ID', A.EXAMPLE.replace(id, '123')], ['非法 ID', A.EXAMPLE.replace(id, 'z'.repeat(32))],
  ['认证信息', A.EXAMPLE.replace('https://', 'https://user:pass@')], ['不符端口', A.EXAMPLE.replace('.cn/', '.cn:8443/')]
]) test('拒绝：' + name, () => assert.throws(() => A.parseActivity(input)));
test('类型校验与 ID 校验', () => {
  assert.throws(() => A.makeSigningUrl(id, 'other'));
  assert.throws(() => A.makeSigningUrl('123', 'in'));
});
test('历史去重并恢复原活动名称', () => {
  const first = A.upsertHistory([], { id, title: '第一场活动' }, 100);
  const next = A.upsertHistory(first, { id, title: '' }, 200);
  assert.equal(next.length, 1); assert.equal(next[0].title, '第一场活动'); assert.equal(next[0].createdAt, 200);
});
test('历史只保留最近 50 条', () => {
  let history = [];
  for (let i = 1; i <= 60; i++) history = A.upsertHistory(history, { id: i.toString(16).padStart(32, '0'), title: '活动' + i }, i);
  assert.equal(history.length, 50); assert.equal(history[0].createdAt, 60); assert.equal(history.at(-1).createdAt, 11);
});
test('损坏或禁用存储时返回空历史', () => {
  assert.deepEqual(A.readHistory({ getItem: () => '{bad json' }), []);
  assert.deepEqual(A.readHistory({ getItem: () => { throw new Error('blocked'); } }), []);
  assert.deepEqual(A.sanitizeHistory([null, { id, createdAt: NaN }, { id, createdAt: 1e30 }, { id: 'bad', createdAt: 10 }]), []);
});
test('名称去空白并限制长度，输入不被当作 HTML', () => {
  assert.equal(A.normalizeTitle('  hello  '), 'hello'); assert.equal(A.normalizeTitle('x'.repeat(100)).length, 40);
  assert.equal(A.displayTitle({ title: '<img src=x>' }), '<img src=x>');
});
