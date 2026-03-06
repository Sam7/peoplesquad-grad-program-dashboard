import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.prompts import load_prompt_bundle


class PromptLanguageStyleTests(unittest.TestCase):
    def test_extract_program_prompts_require_student_friendly_plain_english(self):
        bundle = load_prompt_bundle(ROOT / "prompts", "extract_program")
        combined = f"{bundle.system}\n{bundle.user}".lower()
        self.assertIn("student", combined)
        self.assertIn("plain english", combined)
        self.assertIn("jargon", combined)
        self.assertIn("readable", combined)
        self.assertIn("date", combined)
        self.assertIn("yyyy-mm-dd", combined)
        self.assertIn("open_date_precision", combined)
        self.assertIn("close_date_precision", combined)

    def test_extract_commercial_prompts_require_student_friendly_plain_english(self):
        bundle = load_prompt_bundle(ROOT / "prompts", "extract_commercial")
        combined = f"{bundle.system}\n{bundle.user}".lower()
        self.assertIn("student", combined)
        self.assertIn("plain english", combined)
        self.assertIn("jargon", combined)
        self.assertIn("readable", combined)


if __name__ == "__main__":
    unittest.main()
