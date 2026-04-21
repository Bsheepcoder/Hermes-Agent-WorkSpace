#!/usr/bin/env python3
"""Spirit Ink v4.0 — 一键启动本地服务器"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8765
DIR = os.path.dirname(os.path.abspath(__file__))

os.chdir(DIR)
handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), handler) as httpd:
    url = f"http://localhost:{PORT}/index.html"
    print(f"Spirit Ink v4.0 → {url}")
    print("按 Ctrl+C 停止")
    webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
