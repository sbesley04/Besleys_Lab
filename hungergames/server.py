#!/usr/bin/env python3
"""
Arena Sim API Server
====================
Minimal HTTP server — no dependencies beyond the stdlib.
Accepts POST /api/run { "seed": N } and returns the simulation JSON.

Usage:
    python3 server.py          # port 5001
    python3 server.py 5002     # custom port
"""

import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
SIM  = os.path.join(ROOT, "arena_sim.py")
OUT  = os.path.join(ROOT, "sim_output.json")


class Handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/run":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length))
            seed = max(0, int(body.get("seed", 42)))
        except (ValueError, KeyError):
            self.send_error(400, "Invalid JSON body — expected {\"seed\": N}")
            return

        print(f"[arena] running seed {seed} …", flush=True)
        result = subprocess.run(
            [sys.executable, SIM, str(seed)],
            capture_output=True, text=True, cwd=ROOT,
        )
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "unknown error")[:500]
            print(f"[arena] sim error: {err}", flush=True)
            self._json_error(500, f"Simulation failed: {err}")
            return

        try:
            with open(OUT, encoding="utf-8") as f:
                data = f.read().encode()
        except OSError as e:
            self._json_error(500, f"Could not read output: {e}")
            return

        print(f"[arena] seed {seed} complete — {len(data)//1024}KB", flush=True)
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json_error(self, code, msg):
        body = json.dumps({"error": msg}).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # silence default request log spam
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
    httpd = HTTPServer(("localhost", port), Handler)
    print(f"Arena sim server  →  http://localhost:{port}")
    print(f"POST /api/run  {{\"seed\": N}}")
    print()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[arena] server stopped.")
