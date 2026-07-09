#!/usr/bin/env python3
"""Dev-Server mit No-Cache-Headern — verhindert veraltete Module nach Code-Änderungen."""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Gravel Planner: http://localhost:{PORT}")
        httpd.serve_forever()
