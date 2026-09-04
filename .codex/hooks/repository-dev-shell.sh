#!/usr/bin/env bash

repository_dev_shell_guarded_envrc() {
  local path="${1-}"
  local content=""
  local expected=$'if command -v nix >/dev/null 2>&1; then\n  use flake\nfi'

  [[ -f "$path" ]] || return 1
  content="$(<"$path")" || return 1
  [[ "$content" == "$expected" ]]
}

repository_dev_shell_guidance() {
  local root="${1-}"
  local marker=""
  local shell_kind=""
  local shell_command=""
  local flake_content=""
  local host_system=""
  local host_os="${OSTYPE-}"
  local host_arch="${HOSTTYPE-}"
  local browser_runtime_shell=0

  [[ -n "$root" && -d "$root" ]] || return 0

  if [[ -f "$root/flake.nix" ]]; then
    marker="flake.nix"
    shell_kind="flake"
    shell_command="nix develop --command <command>"
    flake_content="$(<"$root/flake.nix")" || flake_content=""
    if [[ "$flake_content" == *"PLAYWRIGHT_BROWSERS_PATH"* && "$flake_content" == *"PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD"* ]]; then
      browser_runtime_shell=1
    fi
  elif [[ -f "$root/shell.nix" ]]; then
    marker="shell.nix"
    shell_kind="shell"
    shell_command="nix-shell --command <command>"
  fi

  if repository_dev_shell_guarded_envrc "$root/.envrc"; then
    if [[ -n "$marker" ]]; then
      marker="$marker + guarded .envrc"
    else
      marker=".envrc"
      shell_kind="envrc"
      shell_command="nix develop --command <command>"
    fi
  fi

  [[ -n "$marker" ]] || return 0

  if [[ -n "${IN_NIX_SHELL-}" || -n "${DIRENV_DIR-}" ]]; then
    printf '%s\n' "- Repository dev shell marker ($marker) found; a Nix/direnv environment is already active. Avoid nesting another shell and verify it belongs to this checkout."
    return 0
  fi

  if ! command -v nix >/dev/null 2>&1; then
    printf '%s\n' "- Repository dev shell marker ($marker) found, but Nix is unavailable here; continue with the host environment. The hook does not install or activate it."
    return 0
  fi

  case "$host_os:$host_arch" in
    linux-gnu:x86_64|linux-gnu:amd64) host_system="x86_64-linux" ;;
    linux-gnu:aarch64|linux-gnu:arm64) host_system="aarch64-linux" ;;
    darwin*:x86_64|darwin*:amd64) host_system="x86_64-darwin" ;;
    darwin*:arm64|darwin*:aarch64) host_system="aarch64-darwin" ;;
  esac

  if [[ "$shell_kind" == "flake" && -n "$host_system" && "$flake_content" == *"\"$host_system\""* ]]; then
    printf '%s\n' "- Compatible repository dev shell detected ($marker, $host_system). Consider $shell_command for browser/runtime-sensitive checks."
    if [[ "$browser_runtime_shell" -eq 1 ]]; then
      printf '%s\n' "- This shell supplies Playwright/browser runtime support only; it does not provide Node/npm/Python/Pipenv. Keep ordinary workspace commands in the host environment."
    fi
    return 0
  fi

  local compatibility_subject="$host_system"
  if [[ -z "$compatibility_subject" ]]; then
    compatibility_subject="the current host"
  fi
  printf '%s\n' "- Repository dev shell marker ($marker) found and Nix is available, but compatibility with $compatibility_subject is unconfirmed by this lightweight check; continue with host commands unless checked manually."
}

if [[ "${BASH_SOURCE[0]-}" == "$0" ]]; then
  repository_dev_shell_guidance "${1-$(pwd)}"
fi

