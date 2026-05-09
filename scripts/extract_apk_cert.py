"""Extract X.509 signing certificate from APK Signing Block v2 -> DER + PEM.

Usage:
    python scripts/extract_apk_cert.py <apk_path> [--out-dir <dir>]

Defaults output to the same directory as the APK with names
    <apk_basename>-public-key.der
    <apk_basename>-public-key.pem
"""
import argparse
import base64
import os
import struct
import sys


def extract_cert(apk_path: str, out_dir: str | None = None) -> int:
    if not os.path.isfile(apk_path):
        print(f"APK not found: {apk_path}")
        return 2

    apk_dir = out_dir or os.path.dirname(os.path.abspath(apk_path))
    base = os.path.splitext(os.path.basename(apk_path))[0]
    der_out = os.path.join(apk_dir, f"{base}-public-key.der")
    pem_out = os.path.join(apk_dir, f"{base}-public-key.pem")

    with open(apk_path, "rb") as f:
        data = f.read()

    eocd_sig = b"\x50\x4b\x05\x06"
    eocd_offset = data.rfind(eocd_sig)
    if eocd_offset <= 0:
        print("EOCD not found")
        return 1

    cd_offset = struct.unpack("<I", data[eocd_offset + 16:eocd_offset + 20])[0]

    magic_end = cd_offset
    sig_block_size_with_magic_offset = magic_end - 24
    sig_block_total_size = struct.unpack(
        "<Q", data[sig_block_size_with_magic_offset:sig_block_size_with_magic_offset + 8]
    )[0]
    sig_block_start = magic_end - sig_block_total_size - 8

    ptr = sig_block_start + 8
    end = magic_end - 24

    while ptr < end:
        pair_len = struct.unpack("<Q", data[ptr:ptr + 8])[0]
        pair_id = struct.unpack("<I", data[ptr + 8:ptr + 12])[0]
        pair_value = data[ptr + 12:ptr + 8 + pair_len]
        if pair_id == 0x7109871a:
            signers_len = struct.unpack("<I", pair_value[0:4])[0]
            signers = pair_value[4:4 + signers_len]
            signer_len = struct.unpack("<I", signers[0:4])[0]
            signer = signers[4:4 + signer_len]
            sd_len = struct.unpack("<I", signer[0:4])[0]
            sd = signer[4:4 + sd_len]
            dp = 0
            digests_len = struct.unpack("<I", sd[dp:dp + 4])[0]
            dp += 4 + digests_len
            certs_len = struct.unpack("<I", sd[dp:dp + 4])[0]
            certs = sd[dp + 4:dp + 4 + certs_len]
            cert_len = struct.unpack("<I", certs[0:4])[0]
            cert_der = certs[4:4 + cert_len]

            with open(der_out, "wb") as out:
                out.write(cert_der)

            b64 = base64.b64encode(cert_der).decode()
            pem = "-----BEGIN CERTIFICATE-----\n"
            for i in range(0, len(b64), 64):
                pem += b64[i:i + 64] + "\n"
            pem += "-----END CERTIFICATE-----\n"
            with open(pem_out, "w") as out:
                out.write(pem)

            print(f"Extracted certificate: {len(cert_der)} bytes")
            print(f"  DER: {der_out}")
            print(f"  PEM: {pem_out}")
            return 0
        ptr += 8 + pair_len

    print("APK Signature Scheme v2 block not found")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", help="Path to .apk file")
    parser.add_argument("--out-dir", default=None, help="Output directory (defaults to APK dir)")
    args = parser.parse_args()
    return extract_cert(args.apk, args.out_dir)


if __name__ == "__main__":
    sys.exit(main())
