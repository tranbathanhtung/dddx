/** Bash installer served at `/install` — `curl -fsSL …/install | bash`. */
export function installScript(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `#!/usr/bin/env bash
set -euo pipefail

APP=dddx
INSTALL_DIR="\${HOME}/.dddx/bin"
VERSION_FILE="\${INSTALL_DIR}/.version"
NPM_TARBALL="https://registry.npmjs.org/@dddx/cli/-/cli"

MUTED='\\033[0;2m'
RED='\\033[0;31m'
GREEN='\\033[0;32m'
NC='\\033[0m'

usage() {
  cat <<EOF
Usage: install.sh [options]

Options:
  -h, --help              Show this help message
  -v, --version VERSION   Install a specific version (e.g. 0.1.0)
  --no-modify-path        Don't modify shell config files (.zshrc, .bashrc, etc.)

Examples:
  curl -fsSL ${base}/install | bash
  curl -fsSL ${base}/install | bash -s -- --version 0.1.0
EOF
}

requested_version=\${VERSION:-}
no_modify_path=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    -v|--version)
      if [[ -n "\${2:-}" ]]; then
        requested_version="$2"
        shift 2
      else
        echo -e "\${RED}Error: --version requires a version argument\${NC}" >&2
        exit 1
      fi
      ;;
    --no-modify-path)
      no_modify_path=true
      shift
      ;;
    *)
      echo -e "\${RED}Error: Unknown option '$1'\${NC}" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  echo -e "\${RED}Error: curl is required but not installed.\${NC}" >&2
  exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
  echo -e "\${RED}Error: tar is required but not installed.\${NC}" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo -e "\${RED}Error: Node.js is required for the dev proxy.\${NC}" >&2
  echo -e "\${MUTED}Install Node.js 18+ from https://nodejs.org\${NC}" >&2
  exit 1
fi

resolve_latest() {
  curl -fsSL "https://registry.npmjs.org/@dddx/cli/latest" \\
    | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' \\
    | head -1
}

if [[ -z "\$requested_version" ]]; then
  requested_version=\$(resolve_latest)
  if [[ -z "\$requested_version" ]]; then
    echo -e "\${RED}Failed to resolve latest @dddx/cli version\${NC}" >&2
    exit 1
  fi
fi

specific_version="\${requested_version#v}"
tarball_url="\${NPM_TARBALL}-\${specific_version}.tgz"

read_installed_version() {
  if [[ -f "\$VERSION_FILE" ]]; then
    tr -d '[:space:]' < "\$VERSION_FILE"
    return
  fi
  if [[ -x "\${INSTALL_DIR}/\${APP}" ]]; then
    "\${INSTALL_DIR}/\${APP}" version 2>/dev/null || true
  fi
}

if [[ -x "\${INSTALL_DIR}/\${APP}" || -f "\$VERSION_FILE" ]]; then
  installed_version=\$(read_installed_version)
  if [[ "\$installed_version" == "\$specific_version" ]]; then
    echo -e "\${MUTED}dddx \${NC}\${specific_version}\${MUTED} already installed\${NC}"
    exit 0
  fi
  if [[ -n "\$installed_version" ]]; then
    echo -e "\${MUTED}Installed version: \${NC}\${installed_version}\${MUTED} → \${NC}\${specific_version}"
  fi
fi

http_status=\$(curl -sS -o /dev/null -w "%{http_code}" -I "\$tarball_url" 2>/dev/null || echo "000")
if [[ "\$http_status" != "200" ]]; then
  echo -e "\${RED}Error: @dddx/cli@\${specific_version} not found on npm (HTTP \${http_status})\${NC}" >&2
  exit 1
fi

DDDX_HOME="\$(dirname "\$INSTALL_DIR")"
mkdir -p "\$INSTALL_DIR"
tmp_dir="\${TMPDIR:-/tmp}/dddx_install_\$\$"
rm -rf "\$tmp_dir"
mkdir -p "\$tmp_dir"
trap 'rm -rf "\$tmp_dir"' EXIT

detect_platform() {
  local os arch
  os="\$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="\$(uname -m)"
  case "\$arch" in
    arm64|aarch64) arch="arm64" ;;
    x86_64|amd64) arch="x64" ;;
    *) echo -e "\${RED}Error: unsupported CPU architecture: \${arch}\${NC}" >&2; exit 1 ;;
  esac
  case "\$os" in
    darwin) echo "darwin-\${arch}" ;;
    linux) echo "linux-\${arch}" ;;
    mingw*|msys*|cygwin*|windows*) echo "win32-\${arch}" ;;
    *) echo -e "\${RED}Error: unsupported OS: \${os}\${NC}" >&2; exit 1 ;;
  esac
}

install_curl_deps() {
  local manifest="\$1"
  local modules_root="\$DDDX_HOME/node_modules"
  export DDDX_MANIFEST="\$manifest"
  export DDDX_MODULES_ROOT="\$modules_root"
  export DDDX_MANIFEST_META="\$DDDX_HOME/manifest-meta.json"
  export DDDX_CACHE_DIR="\$DDDX_HOME/cache/tarballs"
  export DDDX_PLATFORM="\$platform_id"
  export DDDX_DEP_TMP="\${TMPDIR:-/tmp}/dddx_dep_\$\$"
  mkdir -p "\$DDDX_CACHE_DIR" "\$modules_root"

  node <<'NODE'
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const manifestPath = process.env.DDDX_MANIFEST;
const modulesRoot = process.env.DDDX_MODULES_ROOT;
const manifestMetaPath = process.env.DDDX_MANIFEST_META;
const cacheDir = process.env.DDDX_CACHE_DIR;
const platformId = process.env.DDDX_PLATFORM;
const depTmp = process.env.DDDX_DEP_TMP;
const CONCURRENCY = Math.min(16, Math.max(4, os.cpus().length));

const deps = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function manifestHash(items) {
  const normalized = [...items].sort((a, b) => a.path.localeCompare(b.path));
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function cacheFileName(name, version) {
  const safe = name.replace(/^@/, "").replace(/\\//g, "+");
  return safe + "@" + version + ".tgz";
}

function chmodBinaries(packageDir) {
  const pkgJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return;

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  } catch {
    return;
  }

  const targets = new Set();
  if (typeof pkg.bin === "string") {
    targets.add(path.join(packageDir, pkg.bin));
  } else if (pkg.bin && typeof pkg.bin === "object") {
    for (const rel of Object.values(pkg.bin)) {
      if (typeof rel === "string") targets.add(path.join(packageDir, rel));
    }
  }

  const binDir = path.join(packageDir, "bin");
  if (fs.existsSync(binDir)) {
    for (const entry of fs.readdirSync(binDir)) {
      if (!entry.startsWith(".")) targets.add(path.join(binDir, entry));
    }
  }

  for (const file of targets) {
    try {
      if (fs.statSync(file).isFile()) fs.chmodSync(file, 0o755);
    } catch {
      // ignore chmod failures
    }
  }
}

function curlTarball(url) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn("curl", [
      "-fsSL",
      "--connect-timeout",
      "15",
      "--max-time",
      "300",
      url,
    ]);
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) resolve(null);
      else resolve(Buffer.concat(chunks));
    });
  });
}

async function downloadTarball(dep) {
  const cached = path.join(cacheDir, cacheFileName(dep.name, dep.version));
  if (fs.existsSync(cached)) {
    return { buffer: fs.readFileSync(cached), fromCache: true };
  }

  const buffer = await curlTarball(dep.tarball);
  if (!buffer) return null;

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cached, buffer);
  return { buffer, fromCache: false };
}

function extractTarball(buffer, dest, depTmpDir) {
  return new Promise((resolve) => {
    fs.rmSync(depTmpDir, { recursive: true, force: true });
    fs.mkdirSync(depTmpDir, { recursive: true });

    const child = spawn("tar", ["-xzf", "-", "-C", depTmpDir], {
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(false);
        return;
      }
      try {
        fs.rmSync(dest, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.renameSync(path.join(depTmpDir, "package"), dest);
        chmodBinaries(dest);
        resolve(true);
      } catch {
        resolve(false);
      }
    });
    child.stdin.end(buffer);
  });
}

async function runPool(items, worker) {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, items.length) },
    async () => {
      while (true) {
        const i = index++;
        if (i >= items.length) break;
        await worker(items[i], i);
      }
    },
  );
  await Promise.all(workers);
}

(async () => {
  const hash = manifestHash(deps);
  if (fs.existsSync(manifestMetaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(manifestMetaPath, "utf8"));
      const probe = path.join(modulesRoot, "@parcel/watcher/package.json");
      if (meta.platform === platformId && meta.hash === hash && fs.existsSync(probe)) {
        process.stderr.write("Runtime dependencies up to date\\n");
        return;
      }
    } catch {
      // Reinstall if metadata is unreadable.
    }
  }

  fs.rmSync(modulesRoot, { recursive: true, force: true });
  fs.mkdirSync(modulesRoot, { recursive: true });

  let downloaded = 0;
  let cached = 0;
  let completed = 0;
  let failed = null;

  await runPool(deps, async (dep, index) => {
    if (failed) return;

    const dest = path.join(modulesRoot, dep.path);
    const depTmpDir = path.join(depTmp, String(index));
    const result = await downloadTarball(dep);
    if (!result) {
      failed = "download " + dep.name + "@" + dep.version;
      return;
    }
    if (result.fromCache) cached++;
    else downloaded++;

    if (!(await extractTarball(result.buffer, dest, depTmpDir))) {
      failed = "extract " + dep.name + "@" + dep.version;
      return;
    }

    completed++;
    process.stderr.write("\\r[" + completed + "/" + deps.length + "]");
  });

  if (failed) {
    console.error("Failed to " + failed);
    process.exit(1);
  }

  const keep = new Set(deps.map((dep) => cacheFileName(dep.name, dep.version)));
  for (const file of fs.readdirSync(cacheDir)) {
    if (!keep.has(file)) {
      fs.rmSync(path.join(cacheDir, file), { force: true });
    }
  }

  fs.mkdirSync(path.dirname(manifestMetaPath), { recursive: true });
  fs.writeFileSync(
    manifestMetaPath,
    JSON.stringify({ platform: platformId, hash, packageCount: deps.length }, null, 2) + "\\n",
  );

  process.stderr.write(
    "\\nInstalled " +
      deps.length +
      " packages (" +
      cached +
      " from cache, " +
      downloaded +
      " downloaded)\\n",
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE
}

platform_id="\$(detect_platform)"
echo -e "\${MUTED}Installing \${NC}dddx \${MUTED}v\${specific_version}\${NC} \${MUTED}(\${platform_id})\${NC}"
if ! curl -fsSL --connect-timeout 15 --max-time 300 "\$tarball_url" | tar -xzf - -C "\$tmp_dir"; then
  echo -e "\${RED}Error: failed to download @dddx/cli@\${specific_version}\${NC}" >&2
  exit 1
fi

manifest_file="\$tmp_dir/package/curl-deps/\${platform_id}.json"
if [[ ! -f "\$manifest_file" ]]; then
  echo -e "\${RED}Error: no curl-deps manifest for platform \${platform_id}\${NC}" >&2
  exit 1
fi

mv "\$tmp_dir/package/bin/dddx.mjs" "\${INSTALL_DIR}/\${APP}.mjs"
chmod +x "\${INSTALL_DIR}/\${APP}.mjs"
ln -sf "\${APP}.mjs" "\${INSTALL_DIR}/\${APP}"
echo "\$specific_version" > "\$VERSION_FILE"
rm -f "\$DDDX_HOME/package.json"

echo -e "\${MUTED}Syncing runtime dependencies for \${platform_id}…\${NC}"
install_curl_deps "\$manifest_file"

trap - EXIT
rm -rf "\$tmp_dir" "\${TMPDIR:-/tmp}/dddx_dep_\$\$"

ENV_FILE="\${HOME}/.dddx/env"
mkdir -p "\$(dirname "\$ENV_FILE")"
cat > "\$ENV_FILE" <<EOF
# dddx — source this file: source ~/.dddx/env
export PATH="\${INSTALL_DIR}:\\\$PATH"
EOF

add_to_path() {
  local config_file=$1
  local command=$2

  if grep -Fxq "\$command" "\$config_file" 2>/dev/null; then
    return 0
  fi
  if [[ -w "\$config_file" ]]; then
    echo "" >> "\$config_file"
    echo "# dddx" >> "\$config_file"
    echo "\$command" >> "\$config_file"
    echo -e "\${MUTED}Added \${NC}dddx \${MUTED}to \\\$PATH in \${NC}\$config_file"
  else
    echo -e "\${MUTED}Add to \$config_file:\${NC} \$command"
  fi
}

XDG_CONFIG_HOME=\${XDG_CONFIG_HOME:-\$HOME/.config}
current_shell=\$(basename "\$SHELL")

case "\$current_shell" in
  fish) config_files="\$HOME/.config/fish/config.fish" ;;
  zsh) config_files="\${ZDOTDIR:-\$HOME}/.zshrc \${ZDOTDIR:-\$HOME}/.zshenv \$XDG_CONFIG_HOME/zsh/.zshrc" ;;
  bash) config_files="\$HOME/.bashrc \$HOME/.bash_profile \$HOME/.profile" ;;
  *) config_files="\$HOME/.bashrc \$HOME/.bash_profile" ;;
esac

if [[ "\$no_modify_path" != "true" && ":$PATH:" != *":\$INSTALL_DIR:"* ]]; then
  config_file=""
  for file in \$config_files; do
    if [[ -f "\$file" ]]; then
      config_file="\$file"
      break
    fi
  done

  if [[ -z "\$config_file" ]]; then
    echo -e "\${MUTED}Add to your shell profile:\${NC} source ~/.dddx/env"
  else
    case "\$current_shell" in
      fish) add_to_path "\$config_file" "fish_add_path \$INSTALL_DIR" ;;
      *) add_to_path "\$config_file" '[ -f "\$HOME/.dddx/env" ] && . "\$HOME/.dddx/env"' ;;
    esac
  fi
fi

if [[ ":$PATH:" != *":\$INSTALL_DIR:"* ]]; then
  export PATH="\$INSTALL_DIR:\$PATH"
fi

if [[ -n "\${GITHUB_ACTIONS-}" && "\${GITHUB_ACTIONS}" == "true" ]]; then
  echo "\$INSTALL_DIR" >> "\$GITHUB_PATH"
fi

echo -e "\${GREEN}✓ Installed dddx v\${specific_version}\${NC} → \${INSTALL_DIR}/\${APP}"
if [[ "\$current_shell" == "fish" ]]; then
  echo -e "\${MUTED}In this terminal run \${NC}fish_add_path \$INSTALL_DIR\${MUTED}, then \${NC}dddx help\${MUTED} to get started\${NC}"
else
  echo -e "\${MUTED}In this terminal run \${NC}source ~/.dddx/env\${MUTED}, then \${NC}dddx help\${MUTED} to get started\${NC}"
fi
`;
}
