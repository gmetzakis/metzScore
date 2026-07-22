import importlib
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


class FetchServiceImportTests(unittest.TestCase):
    def test_import_without_env_does_not_crash(self):
        os.environ.pop("API_URL", None)
        os.environ.pop("DEFAULT_HEADERS", None)
        sys.modules.pop("services.fetch_service", None)

        import services.fetch_service as fetch_service

        self.assertEqual(fetch_service.API_URL, "")
        self.assertEqual(fetch_service.DEFAULT_HEADERS, {})


if __name__ == "__main__":
    unittest.main()
