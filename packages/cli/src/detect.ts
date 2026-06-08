#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { detect } from "package-manager-detector";

import { Log } from "./util/log";

const log = Log.create({ service: "detect" });

export interface Config {
  type: "node" | "python" | "rails";
  framework?: "nextjs" | "svelte" | "other"; // For node projects
  packageManager?: string; // Only for node projects
  pythonCommand?: string; // Only for python projects
  defaultScript: string;
  defaultPort: string;
  noProjectDetected?: boolean; // True if no valid project was found
}

function detectPythonCommand(debug = false): string {
  // Check if we're in a virtual environment
  if (process.env.VIRTUAL_ENV) {
    if (debug) {
      log.info("Virtual environment detected", {
        path: process.env.VIRTUAL_ENV,
      });
    }
    return "python";
  }

  // Check if python3 is available and prefer it
  try {
    execSync("python3 --version", { stdio: "ignore" });
    if (debug) {
      log.info("python3 is available, using python3");
    }
    return "python3";
  } catch {
    if (debug) {
      log.info("python3 not available, falling back to python");
    }
    return "python";
  }
}

async function detectProjectType(debug = false): Promise<Config> {
  // Helper to check if package.json has a dev script (indicates Node.js project)
  const hasNodeDevScript = (): boolean => {
    try {
      if (existsSync("package.json")) {
        const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
        return !!packageJson.scripts?.dev;
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  };

  // Check for Node.js project FIRST if package.json has a dev script
  // This takes priority over Python/Rails detection for hybrid projects
  const detected = await detect();
  if (detected && hasNodeDevScript()) {
    if (debug) {
      log.info(
        "Node.js project detected (package.json with dev script takes priority)",
      );
    }
    // Continue to Node.js detection below
  } else {
    // Check for Python project (only if no Node.js dev script)
    if (existsSync("requirements.txt") || existsSync("pyproject.toml")) {
      if (debug) {
        log.info(
          "Python project detected (found requirements.txt or pyproject.toml)",
        );
      }
      return {
        type: "python",
        defaultScript: "main.py",
        defaultPort: "8000", // Common Python web server port
        pythonCommand: detectPythonCommand(debug),
      };
    }

    // Check for Rails project
    if (existsSync("Gemfile") && existsSync("config/application.rb")) {
      if (debug) {
        log.info(
          "Rails project detected (found Gemfile and config/application.rb)",
        );
      }
      return {
        type: "rails",
        defaultScript: "server",
        defaultPort: "3000", // Rails default port
      };
    }
  }

  // Helper to detect framework for Node.js projects
  const detectFramework = (): "nextjs" | "svelte" | "other" => {
    // Check for Next.js
    const nextConfigFiles = [
      "next.config.js",
      "next.config.ts",
      "next.config.mjs",
      "next.config.cjs",
    ];
    if (nextConfigFiles.some((file) => existsSync(file))) {
      if (debug) {
        log.info("Next.js framework detected");
      }
      return "nextjs";
    }

    // Check for Svelte - look for svelte.config.js or svelte dependency
    if (existsSync("svelte.config.js")) {
      if (debug) {
        log.info("Svelte framework detected (svelte.config.js)");
      }
      return "svelte";
    }

    // Check package.json for svelte dependency
    try {
      if (existsSync("package.json")) {
        const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };
        if (deps.svelte || deps["@sveltejs/kit"]) {
          if (debug) {
            log.info("Svelte framework detected (package.json dependency)");
          }
          return "svelte";
        }
      }
    } catch {
      // Ignore parse errors
    }

    return "other";
  };

  if (detected) {
    const framework = detectFramework();
    if (debug) {
      log.info("Node.js project detected", {
        packageManager: detected.agent,
        framework,
      });
    }
    return {
      type: "node",
      framework,
      packageManager: detected.agent,
      defaultScript: "dev",
      defaultPort: "3000",
    };
  }

  // Check if this is a valid project directory
  // If we get here, no lock files or project markers were found
  // Check if package.json exists - if not, this isn't a valid project directory
  if (!existsSync("package.json")) {
    if (debug) {
      log.info("No project files detected - not a valid project directory");
    }
    return {
      type: "node",
      framework: "other",
      packageManager: "npm",
      defaultScript: "dev",
      defaultPort: "3000",
      noProjectDetected: true, // Flag to indicate no project was found
    };
  }

  // Fallback to npm for Node.js (package.json exists but no lock file)
  const framework = detectFramework();
  if (debug) {
    log.info("Node.js project detected (package.json exists, no lock file)", {
      framework,
    });
  }
  return {
    type: "node",
    framework,
    packageManager: "npm",
    defaultScript: "dev",
    defaultPort: "3000",
  };
}

export async function projectType(debug = false): Promise<Config> {
  return detectProjectType(debug);
}

/** Detect the package manager for a project directory (defaults to npm). */
export async function detectPackageManager(dir: string): Promise<string> {
  const detected = await detect({ cwd: dir });
  return detected?.agent ?? "npm";
}
