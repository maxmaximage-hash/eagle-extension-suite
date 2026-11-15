#!/usr/bin/env python3
"""Fail-closed Eagle network preflight for FlClash Fake-IP environments.

This checker is intentionally read-only. It never toggles the proxy, edits hosts,
or rewrites a subscription profile. It verifies that the active profile and the
currently generated config exclude Eagle domains from Fake-IP and that the local
resolver returns a real address instead of FlClash's 198.18.0.0/16 range.
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import plistlib
import socket
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable

DEFAULT_ROOT = Path.home() / "Library/Application Support/com.follow.clash"
DEFAULT_PREFS = Path.home() / "Library/Preferences/com.follow.clash.plist"
EAGLE_DOMAINS = ("eagle.cool", "*.eagle.cool", "+.eagle.cool")
WILDCARD_EAGLE_DOMAINS = ("*.eagle.cool", "+.eagle.cool")
FAKE_IP_NETWORK = ipaddress.ip_network("198.18.0.0/16")


@dataclass
class Result:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    profile: str | None = None
    addresses: list[str] = field(default_factory=list)
    system_proxy: bool | None = None
    vpn_enabled: bool | None = None


def _load_flutter_config(prefs: Path) -> dict:
    raw = plistlib.loads(prefs.read_bytes()).get("flutter.config")
    if not isinstance(raw, str):
        raise ValueError("FlClash prefs missing flutter.config")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("FlClash flutter.config is not an object")
    return value


def _normalise_filter(values: Iterable[object]) -> set[str]:
    result: set[str] = set()
    for value in values:
        if isinstance(value, str):
            result.add(value.strip().strip("'\""))
    return result


def _extract_profile_filter(profile: Path) -> set[str]:
    text = profile.read_text(encoding="utf-8")
    for line in text.splitlines():
        if "fake-ip-filter:" not in line:
            continue
        payload = line.split("fake-ip-filter:", 1)[1].strip()
        if payload.startswith("[") and "]" in payload:
            payload = payload[1 : payload.find("]")]
            return _normalise_filter(payload.split(","))
    return set()


def _resolve(host: str) -> list[str]:
    addresses: set[str] = set()
    for family, _, _, _, sockaddr in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM):
        if family in (socket.AF_INET, socket.AF_INET6):
            addresses.add(sockaddr[0])
    return sorted(addresses)


def run(
    *,
    root: Path = DEFAULT_ROOT,
    prefs: Path = DEFAULT_PREFS,
    resolver: Callable[[str], Iterable[str]] = _resolve,
) -> Result:
    result = Result(ok=False)
    errors = result.errors
    try:
        config = _load_flutter_config(prefs)
    except (OSError, ValueError, json.JSONDecodeError, plistlib.InvalidFileException) as exc:
        errors.append(f"无法读取 FlClash 持久配置: {exc}")
        return result

    result.system_proxy = config.get("networkProps", {}).get("systemProxy")
    result.vpn_enabled = config.get("vpnProps", {}).get("enable")
    profile_id = config.get("currentProfileId")
    if not isinstance(profile_id, str) or not profile_id:
        errors.append("FlClash 未提供 currentProfileId")
        return result
    result.profile = profile_id

    profile = root / "profiles" / f"{profile_id}.yaml"
    if not profile.is_file():
        errors.append(f"当前 FlClash profile 不存在: {profile}")
    else:
        profile_filter = _extract_profile_filter(profile)
        missing = []
        if "eagle.cool" not in profile_filter:
            missing.append("eagle.cool")
        if not any(item in profile_filter for item in WILDCARD_EAGLE_DOMAINS):
            missing.append("*.eagle.cool 或 +.eagle.cool")
        if missing:
            errors.append("当前 profile 未将 Eagle 域名排除 Fake-IP: " + ", ".join(missing))

    generated = root / "config.json"
    if not generated.is_file():
        errors.append(f"FlClash 当前生成配置不存在: {generated}")
    else:
        try:
            generated_data = json.loads(generated.read_text(encoding="utf-8"))
            generated_filter = _normalise_filter(generated_data.get("dns", {}).get("fake-ip-filter", []))
            missing = []
            if "eagle.cool" not in generated_filter:
                missing.append("eagle.cool")
            if not any(item in generated_filter for item in WILDCARD_EAGLE_DOMAINS):
                missing.append("*.eagle.cool 或 +.eagle.cool")
            if missing:
                errors.append("当前生成配置未将 Eagle 域名排除 Fake-IP: " + ", ".join(missing))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"无法读取 FlClash 当前生成配置: {exc}")

    try:
        addresses = sorted(set(str(item) for item in resolver("eagle.cool")))
    except OSError as exc:
        addresses = []
        errors.append(f"eagle.cool DNS 查询失败: {exc}")
    result.addresses = addresses
    if not addresses:
        errors.append("eagle.cool 没有返回任何地址")
    else:
        synthetic = []
        invalid = []
        for address in addresses:
            try:
                parsed = ipaddress.ip_address(address)
            except ValueError:
                invalid.append(address)
                continue
            if parsed in FAKE_IP_NETWORK:
                synthetic.append(address)
        if synthetic:
            errors.append("eagle.cool 仍解析到 FlClash Fake-IP: " + ", ".join(synthetic))
        if invalid:
            errors.append("eagle.cool 返回了无效 IP: " + ", ".join(invalid))

    if result.system_proxy is not True:
        result.warnings.append("FlClash systemProxy 当前不是开启状态；检查器未修改它")
    if result.vpn_enabled is not True:
        result.warnings.append("FlClash VPN/TUN 当前不是开启状态；检查器未修改它")
    result.ok = not errors
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clash-root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--prefs", type=Path, default=DEFAULT_PREFS)
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args(argv)
    result = run(root=args.clash_root, prefs=args.prefs)
    payload = {
        "ok": result.ok,
        "profile": result.profile,
        "addresses": result.addresses,
        "systemProxy": result.system_proxy,
        "vpnEnabled": result.vpn_enabled,
        "errors": result.errors,
        "warnings": result.warnings,
    }
    if args.as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print("Eagle 网络预检: " + ("PASS" if result.ok else "BLOCK"))
        if result.profile:
            print(f"profile: {result.profile}")
        if result.addresses:
            print("eagle.cool: " + ", ".join(result.addresses))
        for warning in result.warnings:
            print("WARN: " + warning)
        for error in result.errors:
            print("ERROR: " + error)
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
