import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.prompts import load_prompt_bundle


class PromptCatalogTests(unittest.TestCase):
    def test_required_prompt_bundles_exist(self):
        prompts_dir = ROOT / "prompts"
        for name in ["discover", "extract_program", "extract_commercial"]:
            bundle = load_prompt_bundle(prompts_dir, name)
            self.assertTrue(bundle.system)
            self.assertTrue(bundle.user)
            self.assertIsInstance(bundle.schema, dict)


if __name__ == "__main__":
    unittest.main()
