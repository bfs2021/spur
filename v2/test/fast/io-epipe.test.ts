import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeLine } from "../../src/io.js";

type ErrorListener = (err: NodeJS.ErrnoException) => void;

function errWithCode(code: string, message: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(message);
  err.code = code;
  if (code === "EPIPE") err.errno = -32;
  return err;
}

function quietStream(): Writable {
  return new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
}

function installedListener(stream: Writable): ErrorListener {
  expect(stream.listenerCount("error")).toBe(1);
  return stream.listeners("error")[0] as ErrorListener;
}

describe("writeLine EPIPE handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("installs one error guard per stream and exits with the SIGPIPE status on EPIPE", () => {
    const stream = quietStream();
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    expect(() => writeLine(stream as unknown as NodeJS.WriteStream, "line")).not.toThrow();

    const listener = installedListener(stream);
    expect(() => listener(errWithCode("EPIPE", "write EPIPE"))).not.toThrow();
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(141);
  });

  it("does not install a second guard when the stream already has one", () => {
    const stream = quietStream();
    stream.on("error", () => {});

    writeLine(stream as unknown as NodeJS.WriteStream, "line");

    expect(stream.listenerCount("error")).toBe(1);
  });

  it("rethrows errors that are not EPIPE", () => {
    const stream = quietStream();
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    expect(() => writeLine(stream as unknown as NodeJS.WriteStream, "line")).not.toThrow();

    const listener = installedListener(stream);
    expect(() => listener(errWithCode("EBADF", "EBADF: bad file descriptor"))).toThrow(
      "EBADF: bad file descriptor",
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("skips the write once the stream is no longer writable", () => {
    const stream = quietStream();
    const writeSpy = vi.spyOn(stream, "write");
    Object.defineProperty(stream, "writable", { value: false });

    writeLine(stream as unknown as NodeJS.WriteStream, "line");

    expect(writeSpy).not.toHaveBeenCalled();
  });
});
