#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote
import socket
import html
import re

PORT = 8000
UPLOAD_DIR = Path.cwd()

def local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "localhost"
    finally:
        s.close()

def safe_filename(name):
    name = unquote(name).replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^a-zA-Z0-9._ -]", "_", name).strip()
    return name or "upload"

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()

        self.wfile.write(f"""
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ladda upp bilder</title>
  <style>
    body {{ font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }}
    input, button {{ font-size: 1.1rem; margin-top: 12px; }}
  </style>
</head>
<body>
  <h2>Ladda upp bilder till datorn</h2>
  <form method="POST" enctype="multipart/form-data">
    <input type="file" name="files" multiple>
    <br>
    <button type="submit">Ladda upp</button>
  </form>
  <p>Filer sparas i:<br><code>{html.escape(str(UPLOAD_DIR))}</code></p>
</body>
</html>
""".encode("utf-8"))

    def do_POST(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self.send_error(400, "Expected multipart/form-data")
            return

        boundary = content_type.split("boundary=")[-1].encode()
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        saved = 0
        parts = body.split(b"--" + boundary)

        for part in parts:
            if b"Content-Disposition" not in part:
                continue

            header, _, data = part.partition(b"\r\n\r\n")
            if not data:
                continue

            data = data.rstrip(b"\r\n")
            if data.endswith(b"--"):
                data = data[:-2]

            header_text = header.decode("utf-8", errors="ignore")
            match = re.search(r'filename="([^"]*)"', header_text)
            if not match or not match.group(1):
                continue

            filename = safe_filename(match.group(1))
            target = UPLOAD_DIR / filename

            counter = 1
            while target.exists():
                stem = target.stem
                suffix = target.suffix
                target = UPLOAD_DIR / f"{stem}_{counter}{suffix}"
                counter += 1

            target.write_bytes(data)
            saved += 1

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(f"""
<!doctype html>
<html>
<body style="font-family:sans-serif">
  <h2>Klart</h2>
  <p>Sparade {saved} fil(er).</p>
  <p><a href="/">Ladda upp fler</a></p>
</body>
</html>
""".encode("utf-8"))

if __name__ == "__main__":
    ip = local_ip()
    print(f"Server igång.")
    print(f"Öppna på telefonen: http://{ip}:{PORT}")
    print(f"Filer sparas i: {UPLOAD_DIR}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()