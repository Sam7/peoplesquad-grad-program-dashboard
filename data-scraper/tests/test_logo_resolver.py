import io
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from recon.logo_resolver import (
    build_logo_filename,
    extract_logo_candidates_from_html,
    is_official_logo_url,
    resolve_logo_asset,
    select_best_logo_candidate,
)


class LogoResolverTests(unittest.TestCase):
    def test_extract_logo_candidates_from_html(self):
        html = """
        <html><head>
          <meta property="og:image" content="/assets/logo.svg" />
          <link rel="icon" href="https://www.csl.com/favicon.png" />
        </head><body>
          <img class="site-logo" src="/images/header-logo.png" />
        </body></html>
        """
        candidates = extract_logo_candidates_from_html("https://www.csl.com/careers", html)
        self.assertIn("https://www.csl.com/assets/logo.svg", candidates)
        self.assertIn("https://www.csl.com/favicon.png", candidates)
        self.assertIn("https://www.csl.com/images/header-logo.png", candidates)

    def test_is_official_logo_url_accepts_subdomain(self):
        self.assertTrue(is_official_logo_url("https://assets.csl.com/logo.svg", ["csl.com"]))
        self.assertFalse(is_official_logo_url("https://cdn.example.com/logo.svg", ["csl.com"]))

    def test_select_best_logo_candidate_prefers_svg(self):
        selected = select_best_logo_candidate(
            [
                "https://assets.csl.com/logo.png",
                "https://assets.csl.com/logo.svg",
            ],
            ["csl.com"],
        )
        self.assertEqual(selected, "https://assets.csl.com/logo.svg")

    def test_select_best_logo_candidate_avoids_favicon(self):
        selected = select_best_logo_candidate(
            [
                "https://www.colesgroup.com.au/favicon-32x32.png",
                "https://www.colesgroup.com.au/content/brand/coles-logo.png",
            ],
            ["colesgroup.com.au"],
        )
        self.assertEqual(selected, "https://www.colesgroup.com.au/content/brand/coles-logo.png")

    def test_build_logo_filename_uses_template(self):
        name = build_logo_filename("csl", "svg", "{id}-peoplesquad-logo.{ext}")
        self.assertEqual(name, "csl-peoplesquad-logo.svg")

    def test_resolve_logo_asset_rejects_tiny_logo(self):
        tiny = io.BytesIO()
        Image.new("RGBA", (32, 32), (255, 0, 0, 255)).save(tiny, format="PNG")
        tiny_bytes = tiny.getvalue()

        def fake_fetch(url: str, timeout_seconds: int):
            return tiny_bytes, "image/png"

        with tempfile.TemporaryDirectory() as td:
            logo = resolve_logo_asset(
                company_id="coles-group",
                company_name="Coles Group",
                official_domains=["colesgroup.com.au"],
                logo_candidates=["https://www.colesgroup.com.au/content/logo.png"],
                output_dir=Path(td),
                public_prefix="assets/logos",
                filename_template="{id}-peoplesquad-logo.{ext}",
                min_source_size=96,
                fetcher=fake_fetch,
            )
            self.assertIsNone(logo)

    def test_resolve_logo_asset_downloads_and_returns_metadata(self):
        buf = io.BytesIO()
        Image.new("RGBA", (1200, 400), (0, 128, 255, 255)).save(buf, format="PNG")
        data = buf.getvalue()

        def fake_fetch(url: str, timeout_seconds: int):
            return data, "image/png"

        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td)
            logo = resolve_logo_asset(
                company_id="csl",
                company_name="CSL",
                official_domains=["csl.com"],
                logo_candidates=["https://www.csl.com/content/logo.png"],
                output_dir=out_dir,
                public_prefix="assets/logos",
                filename_template="{id}-peoplesquad-logo.{ext}",
                fetcher=fake_fetch,
            )
            self.assertIsNotNone(logo)
            assert logo is not None
            self.assertEqual(logo["local_path"], "assets/logos/csl-peoplesquad-logo.webp")
            self.assertEqual(logo["filename"], "csl-peoplesquad-logo.webp")
            self.assertEqual(logo["format"], "webp")
            self.assertEqual(logo["output_width"], 512)
            self.assertEqual(logo["output_height"], 512)
            path = out_dir / "csl-peoplesquad-logo.webp"
            self.assertTrue(path.exists())
            with Image.open(path) as img:
                self.assertEqual(img.size, (512, 512))

    def test_resolve_logo_asset_falls_back_to_known_page_urls(self):
        def fake_fetch(url: str, timeout_seconds: int):
            if url.endswith("/careers"):
                html = '<html><head><meta property="og:image" content="/brand/logo.svg"></head></html>'
                return html.encode("utf-8"), "text/html"
            buf = io.BytesIO()
            Image.new("RGBA", (256, 256), (255, 0, 0, 255)).save(buf, format="PNG")
            return buf.getvalue(), "image/png"

        with tempfile.TemporaryDirectory() as td:
            out_dir = Path(td)
            logo = resolve_logo_asset(
                company_id="csl",
                company_name="CSL",
                official_domains=["csl.com"],
                logo_candidates=[],
                known_page_urls=["https://www.csl.com/careers"],
                output_dir=out_dir,
                public_prefix="assets/logos",
                filename_template="{id}-peoplesquad-logo.{ext}",
                fetcher=fake_fetch,
            )
            self.assertIsNotNone(logo)
            assert logo is not None
            self.assertEqual(logo["source_url"], "https://www.csl.com/brand/logo.svg")


if __name__ == "__main__":
    unittest.main()
