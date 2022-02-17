# zop

Command line interface for creating ZIP files

## Installation

```
npm install -g zop
```

## Usage

```
zop <options> <entry...>

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

For examples, run "zop --examples"
```
