#!/usr/bin/env python3
"""CPU-only image watermark toy. Requires: python -m pip install Pillow numpy

python image-watermark.py encode photo.jpg marked.png --id 173 --width 360 \
    --original original.png --difference difference.png
python image-watermark.py decode marked.png

This is our own demonstrator, not SynthID. It is not encryption, authentication,
or a robust forensic watermark. The decoder needs this public algorithm, but
neither the original photo nor its metadata. Resizing/cropping breaks alignment.
"""
import argparse
import binascii
import json
import math
from pathlib import Path
import time

import numpy as np
from PIL import Image, ImageOps

STEP = 24.0
REPEATS = 5
PACKET_BITS = 64
MAGIC = b"SM"
GAIN = 32
# Orthonormal 8x8 DCT basis at (vertical=2, horizontal=3).
y, x = np.mgrid[:8, :8]
BASIS = .25 * np.cos((2 * y + 1) * 2 * np.pi / 16) * np.cos((2 * x + 1) * 3 * np.pi / 16)


def positions(width, height):
    columns, rows = width // 8, height // 8
    total, count = columns * rows, PACKET_BITS * REPEATS
    if total < count:
        raise ValueError("Image needs at least 320 complete 8x8 blocks.")
    for i in range(count):
        block = ((2 * i + 1) * total) // (2 * count)
        yield (block // columns) * 8, (block % columns) * 8


def encode(rgb, identifier):
    if not 0 <= identifier <= 0xffffffff:
        raise ValueError("ID must fit in an unsigned 32-bit integer.")
    body = MAGIC + identifier.to_bytes(4, "big")
    packet = body + binascii.crc_hqx(body, 0xffff).to_bytes(2, "big")
    bits = np.unpackbits(np.frombuffer(packet, dtype=np.uint8))
    marked = rgb.copy()
    for i, (row, col) in enumerate(positions(rgb.shape[1], rgb.shape[0])):
        bit = int(bits[i % PACKET_BITS])
        block = rgb[row:row + 8, col:col + 8, 1].astype(float)
        coefficient = float(np.sum(block * BASIS))
        # Even multiples encode 0; odd multiples encode 1. Match JS rounding.
        quantized = 2 * math.floor((coefficient / STEP - bit) / 2 + .5) + bit
        block += (quantized * STEP - coefficient) * BASIS
        marked[row:row + 8, col:col + 8, 1] = np.clip(np.floor(block + .5), 0, 255).astype(np.uint8)
    if decode(marked)["id"] != identifier:
        raise ValueError("The mark did not survive rounding/clipping on this image.")
    return marked


def decode(rgb):
    votes = [0] * PACKET_BITS
    for i, (row, col) in enumerate(positions(rgb.shape[1], rgb.shape[0])):
        coefficient = float(np.sum(rgb[row:row + 8, col:col + 8, 1] * BASIS))
        votes[i % PACKET_BITS] += math.floor(coefficient / STEP + .5) & 1
    bits = [int(v > REPEATS // 2) for v in votes]
    packet = bytes(sum(bits[i + j] << (7 - j) for j in range(8)) for i in range(0, PACKET_BITS, 8))
    if packet[:2] != MAGIC or binascii.crc_hqx(packet[:6], 0xffff) != int.from_bytes(packet[6:], "big"):
        raise ValueError("No valid demo watermark: signature or checksum failed.")
    return {"id": int.from_bytes(packet[2:6], "big"), "packet_hex": packet.hex(),
            "checksum": "valid", "vote_agreement": sum(max(v, REPEATS - v) for v in votes) / (PACKET_BITS * REPEATS)}


def load_rgb(path, width=None):
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        if width is not None and image.width > width:
            image = image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)
        return np.array(image)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    embed = commands.add_parser("encode")
    embed.add_argument("input", type=Path)
    embed.add_argument("output", type=Path)
    embed.add_argument("--id", type=int, required=True)
    embed.add_argument("--width", type=int, help="Optionally downsize before embedding")
    embed.add_argument("--original", type=Path, help="Save the resized, unmarked comparison PNG")
    embed.add_argument("--difference", type=Path, help="Save signed green-channel differences amplified 32x")
    extract = commands.add_parser("decode")
    extract.add_argument("input", type=Path)
    args = parser.parse_args()
    try:
        started = time.perf_counter()
        if args.command == "decode":
            print(json.dumps(decode(load_rgb(args.input)), indent=2))
            return
        if args.width is not None and args.width < 8:
            raise ValueError("Width must be at least 8 pixels.")
        outputs = [p for p in (args.output, args.original, args.difference) if p is not None]
        paths = [args.input.resolve(), *(p.resolve() for p in outputs)]
        if len(set(paths)) != len(paths):
            raise ValueError("Input, output, original and difference paths must all be distinct.")
        if any(p.suffix.lower() != ".png" for p in outputs):
            raise ValueError("Save outputs as .png to preserve exact pixel values.")
        rgb = load_rgb(args.input, args.width)
        marked = encode(rgb, args.id)
        for path in outputs:
            path.parent.mkdir(parents=True, exist_ok=True)
        # Fresh images have no EXIF, ICC or textual payload. The ID lives in pixels.
        Image.fromarray(marked).save(args.output, optimize=True)
        if args.original:
            Image.fromarray(rgb).save(args.original, optimize=True)
        delta = marked.astype(np.int16) - rgb.astype(np.int16)
        if args.difference:
            difference = np.clip(128 + delta[:, :, 1] * GAIN, 0, 255).astype(np.uint8)
            Image.fromarray(difference).save(args.difference, optimize=True)
        # Decode the file we actually saved, not just the in-memory result.
        result = decode(load_rgb(args.output))
        if result["id"] != args.id:
            raise ValueError("Saved-file verification failed.")
        mse = float(np.mean(delta.astype(float) ** 2))
        result.update(width=rgb.shape[1], height=rgb.shape[0],
                      max_channel_change=int(np.abs(delta).max()),
                      changed_pixels=int(np.any(delta != 0, axis=2).sum()),
                      psnr_db=round(10 * math.log10(255 ** 2 / mse), 2) if mse else None,
                      seconds=round(time.perf_counter() - started, 3))
        print(json.dumps(result, indent=2))
    except (ValueError, OSError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
