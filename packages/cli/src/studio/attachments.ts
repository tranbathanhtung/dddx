export type StudioAttachment = {
  projectDir: string;
  cliPid: number;
};

export type StudioRegistry = {
  port: number;
  pid: number;
  attachments: StudioAttachment[];
};

export function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function hasAttachment(
  registry: StudioRegistry,
  projectDir: string,
  cliPid: number,
): boolean {
  return registry.attachments.some(
    (entry) => entry.projectDir === projectDir && entry.cliPid === cliPid,
  );
}

export function addAttachment(
  registry: StudioRegistry,
  projectDir: string,
  cliPid: number,
): StudioRegistry {
  if (hasAttachment(registry, projectDir, cliPid)) return registry;
  return {
    ...registry,
    attachments: [...registry.attachments, { projectDir, cliPid }],
  };
}

export function removeAttachment(
  registry: StudioRegistry,
  projectDir: string,
  cliPid: number,
): StudioRegistry {
  let removed = false;
  const attachments = registry.attachments.filter((entry) => {
    if (entry.projectDir === projectDir && entry.cliPid === cliPid) {
      removed = true;
      return false;
    }
    return true;
  });
  if (!removed) return registry;
  return { ...registry, attachments };
}

export function liveAttachments(registry: StudioRegistry): StudioAttachment[] {
  return registry.attachments.filter((entry) => isPidRunning(entry.cliPid));
}

export function countProjectAttachments(
  attachments: StudioAttachment[],
  projectDir: string,
): number {
  return attachments.filter((entry) => entry.projectDir === projectDir).length;
}
