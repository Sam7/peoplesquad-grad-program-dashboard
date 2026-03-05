import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.build import build_prompt_variables


class BuildPromptVariableTests(unittest.TestCase):
    def test_build_prompt_variables_json_encodes_complex_fields(self):
        record = {
            "name": "Coles Group",
            "entity_type": "company",
            "official_domains": ["colesgroup.com.au"],
            "urls": {"careers_url": "https://example.com"},
            "classification": {"industry_bucket": "Retail"},
        }
        vars_out = build_prompt_variables(record)
        self.assertEqual(vars_out["company_name"], "Coles Group")
        self.assertEqual(json.loads(vars_out["official_domains_json"])[0], "colesgroup.com.au")
        self.assertEqual(json.loads(vars_out["known_urls_json"])["careers_url"], "https://example.com")


if __name__ == "__main__":
    unittest.main()
