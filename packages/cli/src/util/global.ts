import fs from "fs/promises";
import path from "path";
import os from "os";

export const app = "dddx";
export const appDir = `.${app}`;

const home = os.homedir();

export namespace Global {
  export const Path = {
    home,
    app: path.join(home, appDir),
  };
}

await Promise.all([fs.mkdir(Global.Path.app, { recursive: true })]);
