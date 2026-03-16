#!/bin/bash
# Generate PWA icons from favicon.svg
# Run this after npm install if you have sharp or similar tools,
# or use any online SVG-to-PNG converter.
#
# Needed files:
#   public/pwa-192.png  (192x192)
#   public/pwa-512.png  (512x512)
#   public/apple-touch-icon.png (180x180)
#
# Quick option using Inkscape (if installed):
#   inkscape -w 192 -h 192 public/favicon.svg -o public/pwa-192.png
#   inkscape -w 512 -h 512 public/favicon.svg -o public/pwa-512.png
#   inkscape -w 180 -h 180 public/favicon.svg -o public/apple-touch-icon.png
#
# Or use https://realfavicongenerator.net — upload favicon.svg and download the pack.

echo "Please generate PWA icons from public/favicon.svg:"
echo "  - public/pwa-192.png (192x192)"
echo "  - public/pwa-512.png (512x512)"
echo "  - public/apple-touch-icon.png (180x180)"
