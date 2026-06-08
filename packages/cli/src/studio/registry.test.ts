import { describe, expect, test } from "bun:test";

import { workerExecArgv } from "./registry";

describe("workerExecArgv", () => {
  test("strips bun hot/watch flags from worker spawn args", () => {
    expect(
      workerExecArgv([
        "--hot",
        "--watch",
        "--watch-path",
        "./src",
        "-hot",
        "--hot=1",
        "--watch=src",
        "--smol",
      ]),
    ).toEqual(["--smol"]);
  });
});
