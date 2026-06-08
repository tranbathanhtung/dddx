import { router } from "@/trpc";

import { project } from "./project";
import { chat } from "./chat";
import { agent } from "./agent";
import { plugin } from "./plugin";
import { auth } from "./auth";
import { image } from "./image";

const appRouter = router({
  project,
  chat,
  agent,
  plugin,
  auth,
  image,
});

export { appRouter };

export type AppRouter = typeof appRouter;
