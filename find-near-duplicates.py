#!/usr/bin/env python3
"""Find near-duplicate images in a directory using perceptual hashing.

Computes a pHash for every image, then groups images whose hashes are
within a Hamming-distance threshold of each other. Prints clusters of
2+ near-duplicates; optionally writes a JSON report.

The JSON report (--out) can be loaded directly into local.html's
"Duplicates" view to review each cluster and flag near-duplicates for
removal.
"""
import argparse
import json
import sys
from pathlib import Path

import imagehash
from PIL import Image

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def collect_images(src_dir: Path, recursive: bool) -> list[Path]:
    walker = src_dir.rglob("*") if recursive else src_dir.iterdir()
    return sorted(p for p in walker if p.is_file() and p.suffix.lower() in IMAGE_EXTS)


def compute_hashes(images: list[Path], hash_size: int = 8) -> dict[Path, imagehash.ImageHash]:
    hashes = {}
    for i, path in enumerate(images, 1):
        try:
            with Image.open(path) as img:
                hashes[path] = imagehash.phash(img, hash_size=hash_size)
        except Exception as e:
            print(f"  WARNING: could not hash {path.name} — {e}", file=sys.stderr)
        if i % 500 == 0:
            print(f"  hashed {i}/{len(images)}...")
    return hashes


def cluster(hashes: dict[Path, imagehash.ImageHash], threshold: int) -> list[list[Path]]:
    paths = list(hashes.keys())
    parent = {p: p for p in paths}

    def find(p):
        while parent[p] != p:
            parent[p] = parent[parent[p]]
            p = parent[p]
        return p

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    n = len(paths)
    for i in range(n):
        for j in range(i + 1, n):
            if hashes[paths[i]] - hashes[paths[j]] <= threshold:
                union(paths[i], paths[j])

    groups: dict[Path, list[Path]] = {}
    for p in paths:
        groups.setdefault(find(p), []).append(p)

    return [sorted(g, key=lambda p: p.name) for g in groups.values() if len(g) > 1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("src_dir", type=Path, help="Folder to scan for images")
    parser.add_argument("--recursive", action="store_true", help="Scan subfolders too")
    parser.add_argument("--threshold", type=int, default=6,
                         help="Max Hamming distance to consider a near-duplicate (default: 6)")
    parser.add_argument("--hash-size", type=int, default=8,
                         help="pHash grid size, higher = more precise/slower (default: 8)")
    parser.add_argument("--out", type=Path, default=None,
                         help="Optional path to write cluster report as JSON")
    args = parser.parse_args()

    if not args.src_dir.is_dir():
        print(f"Error: {args.src_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    images = collect_images(args.src_dir, args.recursive)
    if not images:
        print(f"No images found under {args.src_dir}", file=sys.stderr)
        return

    print(f"Found {len(images)} images. Computing perceptual hashes...")
    hashes = compute_hashes(images)

    print(f"Clustering with threshold={args.threshold}...")
    clusters = cluster(hashes, args.threshold)

    print(f"\nFound {len(clusters)} near-duplicate groups covering "
          f"{sum(len(g) for g in clusters)} images:\n")
    for group in clusters:
        print("  " + " == ".join(p.name for p in group))

    if args.out:
        report = [[str(p) for p in g] for g in clusters]
        args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nWrote report to {args.out}")


if __name__ == "__main__":
    main()
