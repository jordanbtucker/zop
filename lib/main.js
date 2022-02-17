const {once} = require('events')
const {createWriteStream, createReadStream, existsSync} = require('fs')
const {stat, readdir} = require('fs').promises
const {join, normalize, relative, sep: posixSep} = require('path').posix
const {sep: win32Sep} = require('path').win32
const glob = require('fast-glob')
const JSZip = require('jszip')
const pkg = require('../package.json')

/**
 * @typedef Entry
 * @property {string} root
 * @property {string} dst
 * @property {string} src
 * @property {number} level
 */

async function main() {
  try {
    const {isHelp, isError, isExamples, outPath, entries} = parseCLI()

    if (isHelp) {
      displayUsage({isError})
      if (isError) {
        process.exitCode = 1
      }

      return
    }

    if (isExamples) {
      displayExamples()
      return
    }

    const outStream = createWriteStream(outPath)
    await once(outStream, 'ready')

    const archive = new JSZip()
    for (const entry of entries) {
      await addEntry(archive, entry)
    }

    archive.generateNodeStream().pipe(outStream)

    await once(outStream, 'close')
  } catch (err) {
    if (err instanceof ArgError) {
      console.error(err.message)
      console.error(`Run "${pkg.name} --help" for usage`)
      process.exitCode = 1
    } else {
      console.error(err.message)
      process.exitCode = 1
    }
  }
}

/**
 * @param {JSZip} archive
 * @param {Entry} entry
 */
async function addEntry(archive, {root, dst, level, src}) {
  if (existsSync(src)) {
    const stats = await stat(src)
    if (stats.isFile()) {
      const name = normalize(
        join(toPosix(dst), relative(toPosix(root), toPosix(src))),
      ).replace(/^\//, '')

      archive.file(name, createReadStream(src), {
        compression: level === 0 ? 'STORE' : 'DEFLATE',
        compressionOptions: {level},
      })
    } else if (stats.isDirectory()) {
      const names = await readdir(src)
      for (const name of names) {
        await addEntry(archive, {root, dst, level, src: join(src, name)})
      }
    }
  } else {
    const paths = await glob(src)
    for (const path of paths) {
      await addEntry(archive, {root, dst, level, src: path})
    }
  }
}

/**
 * @param {string} path
 */
function toPosix(path) {
  if (process.platform === 'win32') {
    return path.replaceAll(win32Sep, posixSep)
  } else {
    return path
  }
}

function parseCLI() {
  const cwd = process.cwd()
  let outPath
  let root = cwd
  let dst = '/'
  let level = 9
  let src
  const entries = []

  const args = process.argv.slice(2)
  if (args.length === 0) {
    return {isHelp: true, isError: true}
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--help':
      case '-h':
        return {isHelp: true}

      case '--examples':
        return {isExamples: true}

      case '--archive':
      case '-a':
        if (outPath != null) {
          throw new ArgError(
            'The "--archive" argument cannot be provided more than once',
          )
        }

        outPath = args[++i]
        if (outPath == null) {
          throw new ArgError(
            'A value for the "--archive" argument must be provided',
          )
        }
        break

      case '--root':
      case '-r':
        root = args[++i]
        if (root == null) {
          throw new ArgError(
            'A value for the "--root" argument must be provided',
          )
        }
        break

      case '--dst':
      case '-d':
        dst = args[++i]
        if (dst == null) {
          throw new ArgError(
            'A value for the "--dst" argument must be provided',
          )
        }
        break

      case '--level':
      case '-l':
        level = Number(args[++i])
        if (isNaN(level) || level < 0 || level > 9) {
          throw new ArgError(
            'The value for the "--level" argument must be a number between 0 and 9 inclusive',
          )
        }
        break

      case '--src':
      case '-s':
        src = args[++i]
        if (src == null) {
          throw new ArgError(
            'A value for the "--src" argument must be provided',
          )
        }

        entries.push({
          root,
          dst,
          src,
          level,
        })
        break

      case '--':
        root = cwd
        dst = '/'
        level = 9
        break
    }
  }

  if (outPath == null) {
    throw new ArgError(
      'The "--archive" argument cannot be provided more than once',
    )
  }

  if (entries.length === 0) {
    throw new ArgError('At least one "--src" argument must be provided')
  }

  return {
    outPath,
    entries,
  }
}

/**
 * @typedef DisplayMessageOptions
 * @property {boolean} [isError]
 */

/**
 *
 * @param {string} message
 * @param {DisplayMessageOptions} options
 */
function displayMessage(message, {isError} = {}) {
  if (isError) {
    console.error(message)
  } else {
    console.log(message)
  }
}

/**
 * @param {DisplayMessageOptions} options
 */
function displayUsage(options) {
  const message = `${pkg.name} v${pkg.version}
${pkg.description}
${pkg.homepage}

Usage:

${pkg.name} <options> <entry...>

options:
  --archive, -a  The filename of the archive to create.

entry:
  --root, -r    The directory to which --src paths will be relative in the
                archive. Must be provided before any --src arguments in the
                entry. Defaults to the current working directory.
  --dst, -d     The directory to which --src paths will be added in the archive
                Must be provided before any --src arguments in the entry.
                Defaults to "/".
  --level, -l   The compression level which with the --src files will be stored
                in the archive. "0" = store, "1" = best speed, "9" = best
                compression. Defaults to "9".
  --src, -s     A filename, directory, or glob pattern to add to the archive.
                Must be provided one or more times per entry.
  --            Resets the --root, --dst, and --level arguments to their
                default values.

For examples, run "${pkg.name} --examples"`

  displayMessage(message, options)
}

function displayExamples() {
  const message = `Examples:

${pkg.name} --archive out.zip --src dist
  Creates out.zip and adds the "dist" directory to the root of the archive.

${pkg.name} --archive out.zip --root dist --src dist
  Creates out.zip and adds the contents of the "dist" directory to root of the
  archive.

${pkg.name} --archive out.zip --dst info --src dist
  Creates out.zip and adds the "dist" directory to the "info" directory in the
  archive.

${pkg.name} --archive out.zip --root dist --dst info --src dist
  Creates out.zip and adds the contents of the "dist" directory to the "info"
  directory in the archive.

${pkg.name} --archive out.zip --src dist --src info.txt
  Creates out.zip and adds the "dist" directory and the "info.txt" file to the
  root of the archive.

${pkg.name} --archive out.zip --dst info --src dist --src info.txt
  Creates out.zip and adds the "dist" directory and the "info.txt" file to the
  "info" directory in the archive.

${pkg.name} --archive out.zip --dst info --src dist -- --src info.txt
  Creates out.zip and adds the "dist" directory to the "info" directory in the
  archive and adds the "info.txt" file to the root of the archive.`

  displayMessage(message)
}

class ArgError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ArgError'
  }
}

module.exports = main
