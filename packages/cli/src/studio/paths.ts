import path from "node:path";

import { Global } from "@/util/global";

export const REGISTRY_PATH = path.join(Global.Path.app, "studio.json");
export const SPAWN_LOCK_PATH = path.join(Global.Path.app, "studio.spawn.lock");
