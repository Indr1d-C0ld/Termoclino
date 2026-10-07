#!/usr/bin/env python3
"""Unpacker for Microsoft EXEPACK (used on GAME.EXE, TITLE.EXE, CALLS.EXE of 688 Attack Sub).

Usage: unexepack.py IN.EXE OUT.EXE

EXEPACK is a backwards RLE: the packed image is followed (at CS:0 of the packed exe) by a
16/18-byte header {real_IP, real_CS, mem_start, exepack_size, real_SP, real_SS, dest_len,
[skip_len], 'RB'}, the unpacker stub and a packed relocation table (16 groups of
[count, offsets...], one per 0x1000-paragraph segment).
The packed data is read backwards from the end: command byte (0xB0/0xB1 = fill,
0xB2/0xB3 = copy, low bit = last block), preceded by a 16-bit little-endian length.
"""
import struct, sys


def unpack(data):
    hdr_size = struct.unpack_from('<H', data, 8)[0] * 16
    e_lastp, e_np = struct.unpack_from('<HH', data, 2)
    img_end = (e_np - 1) * 512 + (e_lastp or 512)
    img = data[hdr_size:img_end]
    e_ip, e_cs = struct.unpack_from('<HH', data, 0x14)
    xh = e_cs * 16
    sig = img[xh + 14:xh + 16]
    if sig == b'RB':
        hlen = 16
        real_ip, real_cs, mem_start, xsize, real_sp, real_ss, dest_len = struct.unpack_from('<7H', img, xh)
        skip_len = 1
    elif img[xh + 16:xh + 18] == b'RB':
        hlen = 18
        real_ip, real_cs, mem_start, xsize, real_sp, real_ss, dest_len, skip_len = struct.unpack_from('<8H', img, xh)
    else:
        raise ValueError('not an EXEPACK file')
    packed = bytearray(img[:xh])
    out_len = dest_len * 16
    buf = bytearray(max(out_len, len(packed)))
    buf[:len(packed)] = packed
    src = len(packed) - 1
    # skip up to 16 bytes of 0xFF padding
    n = 0
    while n < 16 and buf[src] == 0xFF:
        src -= 1
        n += 1
    dst = out_len - 1
    while True:
        cmd = buf[src]
        length = buf[src - 2] | (buf[src - 1] << 8)
        src -= 3
        op = cmd & 0xFE
        if op == 0xB0:
            val = buf[src]
            src -= 1
            for _ in range(length):
                buf[dst] = val
                dst -= 1
        elif op == 0xB2:
            for _ in range(length):
                buf[dst] = buf[src]
                dst -= 1
                src -= 1
        else:
            raise ValueError('bad EXEPACK command %02x at %x' % (cmd, src + 3))
        if cmd & 1:
            break
    out = bytes(buf[:out_len])
    # relocation table: located after the stub; find it by scanning for the error string
    stub = img[xh:]
    p = stub.find(b'Packed file is corrupt')
    if p < 0:
        raise ValueError('stub string not found')
    p += len(b'Packed file is corrupt')
    relocs = []
    for seg in range(16):
        cnt = struct.unpack_from('<H', stub, p)[0]
        p += 2
        for i in range(cnt):
            off = struct.unpack_from('<H', stub, p)[0]
            p += 2
            relocs.append((seg * 0x1000, off))
    return out, relocs, (real_cs, real_ip, real_ss, real_sp), hlen


def build_exe(image, relocs, regs):
    real_cs, real_ip, real_ss, real_sp = regs
    nrel = len(relocs)
    hdr_len = 0x1c + nrel * 4
    hdr_par = (hdr_len + 15) // 16
    hdr_len = hdr_par * 16
    total = hdr_len + len(image)
    hdr = bytearray(hdr_len)
    struct.pack_into('<2sHHHHHHHHHHHHH', hdr, 0, b'MZ', total % 512, (total + 511) // 512, nrel, hdr_par,
                     0x1000, 0xFFFF, real_ss, real_sp, 0, real_ip, real_cs, 0x1c, 0)
    for i, (s, o) in enumerate(relocs):
        struct.pack_into('<HH', hdr, 0x1c + i * 4, o, s)
    return bytes(hdr) + image


if __name__ == '__main__':
    d = open(sys.argv[1], 'rb').read()
    image, relocs, regs, hlen = unpack(d)
    open(sys.argv[2], 'wb').write(build_exe(image, relocs, regs))
    print('%s: unpacked image %d bytes, %d relocations, CS:IP=%04x:%04x SS:SP=%04x:%04x' %
          (sys.argv[1], len(image), len(relocs), regs[0], regs[1], regs[2], regs[3]))
