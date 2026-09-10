#!/usr/bin/env python3
"""Dev-Server mit No-Cache-Headern — verhindert veraltete Module nach Code-Änderungen."""
import http.server
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def proxy_routing(self):
        path = urlsplit(self.path).path
        if not (path == '/brouter' or path.startswith('/ors/')):
            return False
        data = None
        if self.command == 'POST':
            data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        request = urllib.request.Request(
            'http://127.0.0.1:8086' + self.path,
            data=data,
            headers={'Content-Type': 'application/json'},
            method=self.command,
        )
        try:
            response = urllib.request.urlopen(request, timeout=310)
        except urllib.error.HTTPError as error:
            response = error
        except (urllib.error.URLError, TimeoutError):
            self.send_error(503, 'Lokaler Routing-Stack nicht erreichbar. Bitte make setup ausführen.')
            return True
        with response:
            body = response.read()
            self.send_response(response.code)
            self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        return True

    def do_GET(self):
        if not self.proxy_routing():
            super().do_GET()

    def do_POST(self):
        if not self.proxy_routing():
            self.send_error(404)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
        print(f"Gravel Planner: http://localhost:{PORT}")
        httpd.serve_forever()
