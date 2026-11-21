const SIGPIPE_EXIT_CODE = 141;

function writeLine(stream: NodeJS.WriteStream, message: string): void {
  if (!stream.writable) return;
  if (stream.listenerCount("error") === 0) {
    stream.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EPIPE") {
        process.exit(SIGPIPE_EXIT_CODE);
        return;
      }
      throw err;
    });
  }
  stream.write(`${message}\n`);
}

export function writeStdout(message: string): void {
  writeLine(process.stdout, message);
}

export function writeStderr(message: string): void {
  writeLine(process.stderr, message);
}

export { writeLine };
