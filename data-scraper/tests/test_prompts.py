import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.prompts import extract_fenced_json, render_template


class PromptTests(unittest.TestCase):
    def test_extract_fenced_json(self):
        schema = extract_fenced_json("""
# Schema
```json
{"type": "object"}
```
""")
        self.assertEqual(schema["type"], "object")

    def test_render_template_missing_value_raises(self):
        with self.assertRaises(ValueError):
            render_template("Hello {{name}} {{missing}}", {"name": "Sam"})


if __name__ == "__main__":
    unittest.main()
