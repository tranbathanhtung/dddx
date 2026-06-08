import z from "zod";
import type { ZodType } from "zod";
import { EventEmitter } from "events";
import { Log } from "./log";

const log = Log.create({ name: "bus" });

/** Process-wide fan-out for bridges (WebSocket, file watchers, …). */
export const GlobalBus = new EventEmitter<{
  event: [
    {
      directory: string;
      payload: BusPayload;
    },
  ];
}>();

export type BusPayload<Type extends string = string, Properties = unknown> = {
  type: Type;
  properties: Properties;
};

export type EventDefinition<
  Type extends string = string,
  Properties extends ZodType = ZodType,
> = {
  readonly type: Type;
  readonly properties: Properties;
};

export type InferBusEvent<Def extends EventDefinition> = BusPayload<
  Def["type"],
  z.infer<Def["properties"]>
>;

type Subscription = (payload: BusPayload) => void;

const registry = new Map<string, EventDefinition>();

/** Subscription buckets keyed by {@link channelKey}. */
const subscriptionsByChannel = new Map<string, Map<string, Subscription[]>>();

function channelKey(directory: string, workspace?: string): string {
  return workspace ? `${directory}\0workspace:${workspace}` : directory;
}

function subscriptionsFor(channel: string): Map<string, Subscription[]> {
  let map = subscriptionsByChannel.get(channel);
  if (!map) {
    map = new Map();
    subscriptionsByChannel.set(channel, map);
  }
  return map;
}

export namespace Bus {
  const disposedEventType = "studio.server.disposed";

  /** Register an event type and its property schema. */
  export function define<Type extends string, Properties extends ZodType>(
    type: Type,
    properties: Properties,
  ): EventDefinition<Type, Properties> {
    const def = { type, properties } as const;
    registry.set(type, def);
    return def;
  }

  /** Emitted when a studio server instance is torn down for a project root. */
  export const ServerDisposed = define(
    disposedEventType,
    z.object({
      directory: z.string(),
    }),
  );

  /** Zod union of all registered event payloads (for docs / validation). */
  export function payloads() {
    const variants = [...registry.entries()].map(([type, def]) =>
      z.object({
        type: z.literal(type),
        properties: def.properties,
      }),
    );
    if (variants.length === 0) {
      return z.never();
    }
    return z.discriminatedUnion(
      "type",
      variants as [(typeof variants)[0], ...typeof variants],
    );
  }

  async function publishToChannel<Def extends EventDefinition>(
    channel: string,
    directory: string,
    def: Def,
    properties: z.infer<Def["properties"]>,
    workspace?: string,
  ): Promise<void> {
    const payload: InferBusEvent<Def> = {
      type: def.type,
      properties,
    };

    log.info("publish", { type: def.type, directory, workspace });

    const subs = subscriptionsFor(channel);
    const pending: Promise<unknown>[] = [];

    for (const key of [def.type, "*"] as const) {
      for (const callback of subs.get(key) ?? []) {
        pending.push(Promise.resolve(callback(payload)));
      }
    }

    GlobalBus.emit("event", { directory, payload });

    await Promise.all(pending);
  }

  export async function publish<Def extends EventDefinition>(
    directory: string,
    def: Def,
    properties: z.infer<Def["properties"]>,
  ): Promise<void> {
    return publishToChannel(channelKey(directory), directory, def, properties);
  }

  /** Publish only to listeners scoped to a design workspace. */
  export async function publishForWorkspace<Def extends EventDefinition>(
    directory: string,
    workspace: string,
    def: Def,
    properties: z.infer<Def["properties"]>,
  ): Promise<void> {
    return publishToChannel(
      channelKey(directory, workspace),
      directory,
      def,
      properties,
      workspace,
    );
  }

  export function subscribe<Def extends EventDefinition>(
    directory: string,
    def: Def,
    callback: (event: InferBusEvent<Def>) => void,
  ): () => void {
    return raw(channelKey(directory), def.type, callback as Subscription);
  }

  /** Subscribe to all events for a single design workspace. */
  export function subscribeWorkspace(
    directory: string,
    workspace: string,
    callback: (event: BusPayload) => void,
  ): () => void {
    return raw(channelKey(directory, workspace), "*", callback);
  }

  export function once<Def extends EventDefinition>(
    directory: string,
    def: Def,
    callback: (event: InferBusEvent<Def>) => "done" | undefined,
  ): () => void {
    let unsub: (() => void) | undefined;
    unsub = subscribe(directory, def, (event) => {
      if (callback(event) === "done") unsub?.();
    });
    return () => unsub?.();
  }

  /** Subscribe to every event for a project root (not workspace-scoped). */
  export function subscribeAll(
    directory: string,
    callback: (event: BusPayload) => void,
  ): () => void {
    return raw(channelKey(directory), "*", callback);
  }

  /**
   * Notify wildcard subscribers and drop in-memory listeners for `directory`
   * and any workspace channels under it.
   */
  export async function disposeDirectory(directory: string): Promise<void> {
    const prefix = `${directory}\0workspace:`;
    for (const channel of [...subscriptionsByChannel.keys()]) {
      if (channel !== directory && !channel.startsWith(prefix)) continue;
      await publishToChannel(channel, directory, ServerDisposed, { directory });
      subscriptionsByChannel.delete(channel);
    }
  }

  /** Tear down every subscription (e.g. on studio server stop). */
  export async function disposeAll(): Promise<void> {
    const roots = new Set<string>();
    for (const channel of subscriptionsByChannel.keys()) {
      roots.add(channel.split("\0")[0] ?? channel);
    }
    for (const directory of roots) {
      await disposeDirectory(directory);
    }
  }

  function raw(
    channel: string,
    type: string,
    callback: Subscription,
  ): () => void {
    log.info("subscribe", { type, channel });

    const subs = subscriptionsFor(channel);
    const match = subs.get(type) ?? [];
    match.push(callback);
    subs.set(type, match);

    return () => {
      log.info("unsubscribe", { type, channel });
      const list = subs.get(type);
      if (!list) return;
      const index = list.indexOf(callback);
      if (index === -1) return;
      list.splice(index, 1);
      if (list.length === 0) subs.delete(type);
    };
  }
}
