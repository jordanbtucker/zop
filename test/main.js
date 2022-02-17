const {readFile, unlink} = require('fs').promises
const {relative} = require('path').posix
const glob = require('fast-glob')
const JSZip = require('jszip')
const mockArgv = require('mock-argv')
const t = require('tap')
const main = require('../lib/main')

const ARCHIVE_PATH = 'test/fixtures/out/archive.zip'

t.test('--src only', async t => {
  await unlink(ARCHIVE_PATH)
  await mockArgv(
    ['--archive', ARCHIVE_PATH, '--src', 'test/fixtures/in/dir1'],
    async () => {
      await main()
      const archiveData = await readFile(ARCHIVE_PATH)
      const archive = await JSZip.loadAsync(archiveData)
      const archiveFiles = {}
      for (const name in archive.files) {
        const file = archive.files[name]
        if (!file.dir) {
          archiveFiles[name] = (await file.async('nodebuffer')).toString()
        }
      }

      const inFiles = {}
      const inFilenames = await glob('test/fixtures/in/**')
      for (const name of inFilenames) {
        inFiles[name] = await readFile(name, 'utf8')
      }

      t.strictSame(inFiles, archiveFiles, 'files')
    },
  )
})

t.test('--root and --src', async t => {
  await unlink(ARCHIVE_PATH)
  await mockArgv(
    [
      '--archive',
      ARCHIVE_PATH,
      '--root',
      'test/fixtures/in',
      '--src',
      'test/fixtures/in/dir1',
    ],
    async () => {
      await main()
      const archiveData = await readFile(ARCHIVE_PATH)
      const archive = await JSZip.loadAsync(archiveData)
      const archiveFiles = {}
      for (const name in archive.files) {
        const file = archive.files[name]
        if (!file.dir) {
          archiveFiles[name] = (await file.async('nodebuffer')).toString()
        }
      }

      const inFiles = {}
      const inFilenames = await glob('test/fixtures/in/**')
      for (const name of inFilenames) {
        inFiles[relative('test/fixtures/in', name)] = await readFile(
          name,
          'utf8',
        )
      }

      t.strictSame(inFiles, archiveFiles, 'files')
    },
  )
})
