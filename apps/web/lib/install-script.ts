/** Bash installer served at `/install` — `curl -fsSL …/install | bash`. */
export function installScript(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `#!/usr/bin/env bash
set -euo pipefail

APP=dddx
INSTALL_DIR="\${HOME}/.dddx/bin"
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

if command -v "\$APP" >/dev/null 2>&1; then
  installed_version=\$("\$APP" version 2>/dev/null || echo "")
  if [[ "\$installed_version" == "\$specific_version" ]]; then
    echo -e "\${MUTED}dddx \${NC}\${specific_version}\${MUTED} already installed\${NC}"
    exit 0
  fi
  if [[ -n "\$installed_version" ]]; then
    echo -e "\${MUTED}Installed version: \${NC}\${installed_version}\${MUTED} → \${NC}\${specific_version}"
  fi
fi

http_status=\$(curl -fsSL -o /dev/null -w "%{http_code}" -I "\$tarball_url" || echo "000")
if [[ "\$http_status" == "404" || "\$http_status" == "000" ]]; then
  echo -e "\${RED}Error: @dddx/cli@\${specific_version} not found on npm\${NC}" >&2
  echo -e "\${MUTED}Publish with: npm publish --access public\${NC}" >&2
  exit 1
fi

mkdir -p "\$INSTALL_DIR"
tmp_dir="\${TMPDIR:-/tmp}/dddx_install_\$\$"
rm -rf "\$tmp_dir"
mkdir -p "\$tmp_dir"
trap 'rm -rf "\$tmp_dir"' EXIT

echo -e "\${MUTED}Installing \${NC}dddx \${MUTED}v\${specific_version}\${NC}"
curl -fsSL "\$tarball_url" | tar -xzf - -C "\$tmp_dir"
mv "\$tmp_dir/package/bin/dddx" "\${INSTALL_DIR}/\${APP}"
chmod +x "\${INSTALL_DIR}/\${APP}"
trap - EXIT
rm -rf "\$tmp_dir"

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
    echo -e "\${MUTED}Add to your shell profile:\${NC} export PATH=\$INSTALL_DIR:\\\$PATH"
  else
    case "\$current_shell" in
      fish) add_to_path "\$config_file" "fish_add_path \$INSTALL_DIR" ;;
      *) add_to_path "\$config_file" "export PATH=\$INSTALL_DIR:\\\$PATH" ;;
    esac
  fi
fi

if [[ -n "\${GITHUB_ACTIONS-}" && "\${GITHUB_ACTIONS}" == "true" ]]; then
  echo "\$INSTALL_DIR" >> "\$GITHUB_PATH"
fi

echo -e "\${GREEN}✓ Installed dddx v\${specific_version}\${NC} → \${INSTALL_DIR}/\${APP}"
echo -e "\${MUTED}Run \${NC}dddx --help\${MUTED} to get started (open a new shell if \`dddx\` is not found)\${NC}"
`;
}
