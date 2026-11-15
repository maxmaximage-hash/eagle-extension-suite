#!/usr/bin/env python3
import json
import plistlib
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))
import eagle_network_preflight as preflight  # noqa: E402


class EagleNetworkPreflightTests(unittest.TestCase):
    def write_fixture(self, *, fake_filter, dns_addresses):
        root = Path(self.tmp.name) / "clash"
        profiles = root / "profiles"
        profiles.mkdir(parents=True)
        profile_id = "fixture"
        (profiles / f"{profile_id}.yaml").write_text(
            "dns:\n    enhanced-mode: fake-ip\n"
            f"    fake-ip-filter: [{', '.join(fake_filter)}]\n",
            encoding="utf-8",
        )
        generated = {
            "dns": {"enhanced-mode": "fake-ip", "fake-ip-filter": fake_filter},
        }
        (root / "config.json").write_text(json.dumps(generated), encoding="utf-8")
        prefs = Path(self.tmp.name) / "com.follow.clash.plist"
        config = {
            "currentProfileId": profile_id,
            "networkProps": {"systemProxy": True},
            "vpnProps": {"enable": True},
        }
        prefs.write_bytes(plistlib.dumps({"flutter.config": json.dumps(config)}))
        return root, prefs, dns_addresses

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def test_accepts_real_dns_and_eagle_fake_ip_exclusion(self):
        root, prefs, addresses = self.write_fixture(
            fake_filter=["'eagle.cool'", "'*.eagle.cool'"],
            dns_addresses=["104.26.14.242"],
        )
        result = preflight.run(root=root, prefs=prefs, resolver=lambda _: addresses)
        self.assertTrue(result.ok)
        self.assertEqual(result.errors, [])

    def test_rejects_missing_fake_ip_exclusion(self):
        root, prefs, addresses = self.write_fixture(
            fake_filter=["'*.lan'"],
            dns_addresses=["104.26.14.242"],
        )
        result = preflight.run(root=root, prefs=prefs, resolver=lambda _: addresses)
        self.assertFalse(result.ok)
        self.assertTrue(any("fake-ip" in error.lower() for error in result.errors))

    def test_rejects_synthetic_fake_ip_resolution(self):
        root, prefs, addresses = self.write_fixture(
            fake_filter=["'eagle.cool'", "'*.eagle.cool'"],
            dns_addresses=["198.18.0.4"],
        )
        result = preflight.run(root=root, prefs=prefs, resolver=lambda _: addresses)
        self.assertFalse(result.ok)
        self.assertTrue(any("198.18" in error for error in result.errors))


if __name__ == "__main__":
    unittest.main()
