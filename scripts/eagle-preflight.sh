#!/bin/zsh
set -u

# Read-only launch gate for the real Eagle installation.
# It never edits Eagle, plugins, hosts, Library data, or proxy configuration.

readonly DEFAULT_EAGLE_APP="/Applications/Eagle.app"
readonly DEFAULT_PLUGINS_ROOT="$HOME/Library/Application Support/Eagle/Plugins"
readonly DEFAULT_HOSTS_FILE="/etc/hosts"
readonly DEFAULT_CLASH_CONFIG="$HOME/Library/Application Support/com.follow.clash/config.json"

eagle_app="$DEFAULT_EAGLE_APP"
plugins_root="$DEFAULT_PLUGINS_ROOT"
hosts_file="$DEFAULT_HOSTS_FILE"
clash_config="$DEFAULT_CLASH_CONFIG"
profile_file=""
expected_asar_sha256=""
expected_hosts_sha256=""
skip_dns=0
fail_count=0
warn_count=0

usage() {
  cat <<'USAGE'
只读 Eagle 启动预检

用法：
  scripts/eagle-preflight.sh [选项]

选项：
  --eagle-app PATH              Eagle.app 路径
  --plugins-root PATH           Eagle 插件目录
  --hosts-file PATH             hosts 文件
  --clash-config PATH           FlClash 生成配置 JSON
  --profile PATH                FlClash 活跃 profile YAML（可选）
  --expected-asar-sha256 HASH   app.asar 预期 SHA-256
  --expected-hosts-sha256 HASH  hosts 预期 SHA-256
  --skip-dns                    跳过 dscacheutil Fake-IP 检查
  --help                        显示帮助
USAGE
}

fail() {
  print "FAIL $1"
  fail_count=$((fail_count + 1))
}

warn() {
  print "WARN $1"
  warn_count=$((warn_count + 1))
}

pass() {
  print "PASS $1"
}

while (( $# > 0 )); do
  case "$1" in
    --eagle-app) eagle_app="${2:-}"; shift 2 ;;
    --plugins-root) plugins_root="${2:-}"; shift 2 ;;
    --hosts-file) hosts_file="${2:-}"; shift 2 ;;
    --clash-config) clash_config="${2:-}"; shift 2 ;;
    --profile) profile_file="${2:-}"; shift 2 ;;
    --expected-asar-sha256) expected_asar_sha256="${2:-}"; shift 2 ;;
    --expected-hosts-sha256) expected_hosts_sha256="${2:-}"; shift 2 ;;
    --skip-dns) skip_dns=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) print -u2 "未知选项：$1"; usage >&2; exit 64 ;;
  esac
done

# A launch gate without immutable host baselines cannot establish that the
# process is running against the audited Eagle build and hosts policy.  Keep
# this check read-only and fail closed before any launch/install action.
if [[ -z "$expected_asar_sha256" ]]; then
  fail "缺少官方 Eagle app.asar 指纹基线：请提供 --expected-asar-sha256"
elif [[ ! "$expected_asar_sha256" =~ ^[[:xdigit:]]{64}$ ]]; then
  fail "官方 Eagle app.asar 指纹格式无效：应为 64 位 SHA-256"
fi
if [[ -z "$expected_hosts_sha256" ]]; then
  fail "缺少 /etc/hosts 指纹基线：请提供 --expected-hosts-sha256"
elif [[ ! "$expected_hosts_sha256" =~ ^[[:xdigit:]]{64}$ ]]; then
  fail "/etc/hosts 指纹格式无效：应为 64 位 SHA-256"
fi

asar="$eagle_app/Contents/Resources/app.asar"
if [[ ! -f "$asar" ]]; then
  fail "找不到 Eagle app.asar：$asar"
else
  actual_asar_sha256="$(shasum -a 256 "$asar" | awk '{print $1}')"
  if [[ -n "$expected_asar_sha256" && "$actual_asar_sha256" != "$expected_asar_sha256" ]]; then
    fail "app.asar 指纹不匹配：实际 $actual_asar_sha256，预期 $expected_asar_sha256"
  elif [[ -n "$expected_asar_sha256" ]]; then
    pass "app.asar 指纹匹配：$actual_asar_sha256"
  else
    warn "未提供 app.asar 指纹基线；当前指纹 $actual_asar_sha256"
  fi
fi

if [[ ! -d "$plugins_root" ]]; then
  fail "找不到 Eagle 插件目录：$plugins_root"
else
  plugins_root_real="$(realpath "$plugins_root" 2>/dev/null || true)"
  if [[ -z "$plugins_root_real" ]]; then
    fail "无法解析 Eagle 插件目录真实路径：$plugins_root"
    plugins_root_real="$plugins_root"
  fi
  plugin_escape=0
  while IFS= read -r link; do
    [[ -n "$link" ]] || continue
    target="$(realpath "$link" 2>/dev/null || true)"
    case "$target" in
      "$plugins_root_real"|"$plugins_root_real"/*) ;;
      *) fail "插件路径越界：$link -> $target"; plugin_escape=1 ;;
    esac
  done < <(find -P "$plugins_root" -type l -print 2>/dev/null)
  (( plugin_escape == 0 )) && pass "插件目录没有越界 symlink"
fi

if [[ ! -f "$hosts_file" ]]; then
  fail "找不到 hosts 文件：$hosts_file"
else
  actual_hosts_sha256="$(shasum -a 256 "$hosts_file" | awk '{print $1}')"
  if [[ -n "$expected_hosts_sha256" && "$actual_hosts_sha256" != "$expected_hosts_sha256" ]]; then
    fail "hosts 指纹不匹配：实际 $actual_hosts_sha256，预期 $expected_hosts_sha256"
  elif [[ -n "$expected_hosts_sha256" ]]; then
    pass "hosts 指纹匹配：$actual_hosts_sha256"
  else
    warn "未提供 hosts 指纹基线；当前指纹 $actual_hosts_sha256"
  fi
fi

if [[ ! -f "$clash_config" ]]; then
  fail "找不到 FlClash 配置：$clash_config"
else
  clash_result="$(python3 - "$clash_config" <<'PY'
import json, sys
path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
except Exception as exc:
    print(f"INVALID {exc}")
    raise SystemExit(0)
filters = data.get("dns", {}).get("fake-ip-filter", [])
values = {str(item).lower() for item in filters}
required = {"eagle.cool", "*.eagle.cool", "+.eagle.cool"}
if not (values & required):
    print("MISSING " + ",".join(sorted(required)))
else:
    print("OK " + ",".join(sorted(values & required)))
PY
  )"
  case "$clash_result" in
    OK*) pass "FlClash Fake-IP 已排除 Eagle 域名：${clash_result#OK }" ;;
    MISSING*) fail "FlClash Fake-IP 未排除 Eagle 域名：${clash_result#MISSING }" ;;
    *) fail "FlClash 配置无法读取：$clash_result" ;;
  esac
fi

if [[ -n "$profile_file" ]]; then
  if [[ ! -f "$profile_file" ]]; then
    fail "找不到 FlClash profile：$profile_file"
  elif rg -q "eagle\.cool" "$profile_file"; then
    pass "FlClash profile 含 Eagle 域名规则"
  else
    fail "FlClash profile 未包含 Eagle 域名规则：$profile_file"
  fi
fi

if [[ $skip_dns -eq 0 ]]; then
  if ! command -v dscacheutil >/dev/null 2>&1; then
    warn "当前系统没有 dscacheutil，跳过 Eagle DNS Fake-IP 检查"
  else
    dns_output="$(dscacheutil -q host -a name eagle.cool 2>/dev/null || true)"
    if print -r -- "$dns_output" | rg -q '198\.18\.'; then
      fail "eagle.cool 仍解析到 198.18.0.0/16 Fake-IP"
    elif print -r -- "$dns_output" | rg -q 'ip_address|ipv6_address'; then
      pass "eagle.cool 未解析到 198.18.0.0/16 Fake-IP"
    else
      warn "无法取得 eagle.cool DNS 结果"
    fi
  fi
fi

if [[ $fail_count -gt 0 ]]; then
  print "Eagle 预检失败：$fail_count 项失败，$warn_count 项警告。请停止安装或启动。"
  exit 1
fi

print "Eagle 预检通过：$warn_count 项警告；未修改任何宿主、插件、hosts 或 Library 文件。"
exit 0
