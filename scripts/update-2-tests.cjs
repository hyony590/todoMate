// Isolated repository regression checks: never access the user's browser or cloud.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const memory = new Map()
const localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
async function load(relative, mocks = {}) {
  const { transformSync } = await import('rolldown/utils')
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8')
  let output = transformSync(relative, source, { lang: 'ts' }).code
  output = output.replace(/import \{([^}]+)\} from ["']([^"']+)["'];?/g, (_, names, name) => 'const {' + names.replace(/ as /g, ': ') + '} = require(' + JSON.stringify(name) + ');')
  const exports = [...output.matchAll(/export (?:class|const) (\w+)/g)].map(match => match[1])
  output = output.replace(/export (class|const) /g, '$1 ') + '\nmodule.exports = {' + exports.join(',') + '}'
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, require: name => { if (name in mocks) return mocks[name]; throw new Error('Unexpected dependency: ' + name) }, localStorage, crypto: require('node:crypto').webcrypto, Date, JSON })
  return module.exports
}
async function main() {
  const { LocalTaskRepository } = await load('src/data/taskRepository.ts')
  const tasks = new LocalTaskRepository([])
  const task = await tasks.create({ title: 'Before', categoryId: 'one', date: '2026-10-01' })
  await tasks.toggle(task.id)
  await tasks.update(task.id, 'After')
  const updated = (await tasks.list())[0]
  assert.equal(updated.title, 'After')
  assert.equal(updated.completed, true)
  assert.equal(updated.date, '2026-10-01')
  assert.equal(updated.categoryId, 'one')
  await assert.rejects(() => tasks.update('missing', 'No orphan'))
  const { LocalCategoryRepository } = await load('src/data/categoryRepository.ts', { './seed': { categories: [{ id: 'one', name: 'One', color: '#555555' }, { id: 'two', name: 'Two', color: '#333333' }] } })
  const categories = new LocalCategoryRepository()
  await tasks.create({ title: 'Keep', categoryId: 'two', date: '2026-10-02' })
  await categories.remove('one')
  assert.equal((await categories.list()).length, 1)
  assert.equal((await tasks.list()).length, 1)
  assert.equal((await tasks.list())[0].title, 'Keep')
  const { habitRepository } = await load('src/data/habitRepository.ts', { './supabase': { supabase: null } })
  const habit = await habitRepository.create('Daily', [0, 1, 2, 3, 4, 5, 6])
  const weekly = await habitRepository.create('Weekly', [1, 3, 5])
  await habitRepository.setCompleted(habit.id, '2026-10-01', true)
  await habitRepository.setCompleted(habit.id, '2026-10-02', true)
  await habitRepository.setCompleted(habit.id, '2026-10-01', false)
  const result = await habitRepository.list()
  assert.equal(result.habits.length, 2)
  assert.equal(weekly.weekdays.includes(4), false)
  assert.equal(result.completions.length, 1)
  assert.equal(result.completions[0].date, '2026-10-02')
  assert.equal((await tasks.list())[0].title, 'Keep')
  console.log('PASS: task edits preserve metadata; category deletion removes only linked tasks; daily/weekly habits and independent date records; task/habit isolation.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
