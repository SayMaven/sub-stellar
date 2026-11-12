//! High-speed localhost WebSocket binary pipe & sparse RLE decoder for FFmpeg export.
//!
//! Eliminates WebView2 COM/HTTP `ipc.localhost` bottlenecks and redundant per-frame
//! heap allocations during video export by streaming tight dirty rectangles with
//! 32-bit transparent-run RLE over a single loopback WebSocket connection.

use std::io::{Read, Write};
use std::net::TcpStream;

const WS_GUID: &str = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/// Pure-Rust SHA-1 digest (RFC 3174) for RFC 6455 WebSocket handshake.
pub fn sha1_digest(input: &[u8]) -> [u8; 20] {
    let mut h0: u32 = 0x67452301;
    let mut h1: u32 = 0xEFCDAB89;
    let mut h2: u32 = 0x98BADCFE;
    let mut h3: u32 = 0x10325476;
    let mut h4: u32 = 0xC3D2E1F0;

    let bit_len = (input.len() as u64).wrapping_mul(8);
    let mut msg = Vec::with_capacity(input.len() + 72);
    msg.extend_from_slice(input);
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks_exact(64) {
        let mut w = [0u32; 80];
        for (i, word) in w.iter_mut().take(16).enumerate() {
            let off = i * 4;
            *word = u32::from_be_bytes([
                chunk[off],
                chunk[off + 1],
                chunk[off + 2],
                chunk[off + 3],
            ]);
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }

        let mut a = h0;
        let mut b = h1;
        let mut c = h2;
        let mut d = h3;
        let mut e = h4;

        for (i, &wi) in w.iter().enumerate() {
            let (f, k) = match i {
                0..=19 => ((b & c) | ((!b) & d), 0x5A827999u32),
                20..=39 => (b ^ c ^ d, 0x6ED9EBA1u32),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1BBCDCu32),
                _ => (b ^ c ^ d, 0xCA62C1D6u32),
            };
            let temp = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(wi);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = temp;
        }

        h0 = h0.wrapping_add(a);
        h1 = h1.wrapping_add(b);
        h2 = h2.wrapping_add(c);
        h3 = h3.wrapping_add(d);
        h4 = h4.wrapping_add(e);
    }

    let mut out = [0u8; 20];
    out[0..4].copy_from_slice(&h0.to_be_bytes());
    out[4..8].copy_from_slice(&h1.to_be_bytes());
    out[8..12].copy_from_slice(&h2.to_be_bytes());
    out[12..16].copy_from_slice(&h3.to_be_bytes());
    out[16..20].copy_from_slice(&h4.to_be_bytes());
    out
}

/// Standard Base64 encoder for RFC 6455 Sec-WebSocket-Accept.
pub fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((n >> 18) & 0x3F) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[((n >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(n & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

pub fn compute_ws_accept_key(sec_key: &str) -> String {
    let mut combined = String::with_capacity(sec_key.len() + WS_GUID.len());
    combined.push_str(sec_key.trim());
    combined.push_str(WS_GUID);
    let digest = sha1_digest(combined.as_bytes());
    base64_encode(&digest)
}

/// Performs RFC 6455 HTTP -> WebSocket upgrade and validates the per-session query token.
pub fn perform_ws_handshake(stream: &mut TcpStream, expected_token: &str) -> Result<(), String> {
    let mut req_buf = [0u8; 4096];
    let mut total = 0usize;
    loop {
        if total >= req_buf.len() {
            return Err("WebSocket handshake header too large".to_string());
        }
        let n = stream
            .read(&mut req_buf[total..])
            .map_err(|e| format!("Failed reading handshake: {}", e))?;
        if n == 0 {
            return Err("Connection closed during WebSocket handshake".to_string());
        }
        total += n;
        if req_buf[..total].windows(4).any(|w| w == b"\r\n\r\n") {
            break;
        }
    }

    let req_str = String::from_utf8_lossy(&req_buf[..total]);
    let first_line = req_str.lines().next().unwrap_or("");
    let token_param = format!("token={}", expected_token);
    if !first_line.contains(&token_param) {
        let _ = stream.write_all(b"HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        return Err("Unauthorized WebSocket token".to_string());
    }

    let mut sec_key: Option<String> = None;
    for line in req_str.lines().skip(1) {
        if let Some((name, val)) = line.split_once(':') {
            if name.trim().eq_ignore_ascii_case("sec-websocket-key") {
                sec_key = Some(val.trim().to_string());
                break;
            }
        }
    }

    let Some(key) = sec_key else {
        let _ = stream.write_all(b"HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
        return Err("Missing Sec-WebSocket-Key header".to_string());
    };

    let accept = compute_ws_accept_key(&key);
    let response = format!(
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {}\r\n\r\n",
        accept
    );
    stream
        .write_all(response.as_bytes())
        .map_err(|e| format!("Failed writing WebSocket handshake: {}", e))?;
    Ok(())
}

/// Fast 4-byte XOR unmasking into `buf`.
#[inline]
fn unmask_in_place(buf: &mut [u8], mask: [u8; 4]) {
    let mask_u32 = u32::from_ne_bytes(mask);
    let (prefix, aligned, suffix) = unsafe { buf.align_to_mut::<u32>() };
    let mut offset = 0usize;
    for b in prefix.iter_mut() {
        *b ^= mask[offset & 3];
        offset += 1;
    }
    let aligned_mask = mask_u32.rotate_right(((offset & 3) * 8) as u32);
    for w in aligned.iter_mut() {
        *w ^= aligned_mask;
    }
    offset += aligned.len() * 4;
    for b in suffix.iter_mut() {
        *b ^= mask[offset & 3];
        offset += 1;
    }
}

pub enum WsFrame<'a> {
    Binary(&'a [u8]),
    Text(&'a [u8]),
    Close,
}

/// Reads a single WebSocket message into `scratch`, reusing its backing memory to avoid per-frame allocations.
pub fn read_ws_message<'a>(
    stream: &mut TcpStream,
    scratch: &'a mut Vec<u8>,
) -> std::io::Result<WsFrame<'a>> {
    scratch.clear();
    let mut message_opcode: Option<u8> = None;

    loop {
        let mut hdr = [0u8; 2];
        stream.read_exact(&mut hdr)?;
        let fin = (hdr[0] & 0x80) != 0;
        let opcode = hdr[0] & 0x0F;
        let masked = (hdr[1] & 0x80) != 0;
        let len7 = (hdr[1] & 0x7F) as u64;

        let payload_len: usize = if len7 <= 125 {
            len7 as usize
        } else if len7 == 126 {
            let mut ext = [0u8; 2];
            stream.read_exact(&mut ext)?;
            u16::from_be_bytes(ext) as usize
        } else {
            let mut ext = [0u8; 8];
            stream.read_exact(&mut ext)?;
            let raw = u64::from_be_bytes(ext);
            if raw > 64 * 1024 * 1024 {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "WebSocket frame exceeds 64MB safety limit",
                ));
            }
            raw as usize
        };

        let mut mask = [0u8; 4];
        if masked {
            stream.read_exact(&mut mask)?;
        }

        // Control frames (Close, Ping, Pong)
        if opcode >= 0x8 {
            let mut ctrl = vec![0u8; payload_len];
            if payload_len > 0 {
                stream.read_exact(&mut ctrl)?;
                if masked {
                    unmask_in_place(&mut ctrl, mask);
                }
            }
            match opcode {
                0x8 => {
                    // Close
                    return Ok(WsFrame::Close);
                }
                0x9 => {
                    // Ping -> send Pong
                    send_ws_frame(stream, 0xA, &ctrl)?;
                    continue;
                }
                _ => {
                    // Pong / other control
                    continue;
                }
            }
        }

        if message_opcode.is_none() {
            message_opcode = Some(opcode);
        }

        let start = scratch.len();
        scratch.resize(start + payload_len, 0);
        if payload_len > 0 {
            stream.read_exact(&mut scratch[start..start + payload_len])?;
            if masked {
                unmask_in_place(&mut scratch[start..start + payload_len], mask);
            }
        }

        if fin {
            break;
        }
    }

    match message_opcode.unwrap_or(2) {
        1 => Ok(WsFrame::Text(scratch.as_slice())),
        _ => Ok(WsFrame::Binary(scratch.as_slice())),
    }
}

pub fn send_ws_frame(stream: &mut TcpStream, opcode: u8, data: &[u8]) -> std::io::Result<()> {
    let mut header = [0u8; 10];
    header[0] = 0x80 | (opcode & 0x0F);
    let len = data.len();
    let hdr_len = if len <= 125 {
        header[1] = len as u8;
        2
    } else if len <= 65535 {
        header[1] = 126;
        header[2..4].copy_from_slice(&(len as u16).to_be_bytes());
        4
    } else {
        header[1] = 127;
        header[2..10].copy_from_slice(&(len as u64).to_be_bytes());
        10
    };
    stream.write_all(&header[..hdr_len])?;
    if !data.is_empty() {
        stream.write_all(data)?;
    }
    Ok(())
}

/// Clears a rectangular RGBA region `[x..x+w, y..y+h]` inside `canvas` back to `blank_pixel`.
#[inline]
pub fn clear_rgba_rect(
    canvas: &mut [u8],
    frame_width: usize,
    x: usize,
    y: usize,
    w: usize,
    h: usize,
    blank_pixel: [u8; 4],
) {
    if w == 0 || h == 0 || frame_width == 0 {
        return;
    }
    let stride = frame_width * 4;
    let total_rows = canvas.len() / stride;
    let x0 = x.min(frame_width);
    let x1 = (x + w).min(frame_width);
    if x0 >= x1 {
        return;
    }
    let y0 = y.min(total_rows);
    let y1 = (y + h).min(total_rows);
    let row_byte_start = x0 * 4;
    let row_byte_end = x1 * 4;
    let is_zero = blank_pixel == [0, 0, 0, 0];

    for row_idx in y0..y1 {
        let off = row_idx * stride;
        let slice = &mut canvas[off + row_byte_start..off + row_byte_end];
        if is_zero {
            slice.fill(0);
        } else {
            for px in slice.chunks_exact_mut(4) {
                px.copy_from_slice(&blank_pixel);
            }
        }
    }
}

/// Copies a raw uncompressed dirty rect into `canvas` at `(dst_x, dst_y)`.
pub fn blit_raw_rgba_rect(
    canvas: &mut [u8],
    frame_width: usize,
    dst_x: usize,
    dst_y: usize,
    w: usize,
    h: usize,
    src: &[u8],
) {
    if w == 0 || h == 0 || frame_width == 0 {
        return;
    }
    let stride = frame_width * 4;
    let total_rows = canvas.len() / stride;
    let src_stride = w * 4;
    let copy_w = w.min(frame_width.saturating_sub(dst_x));
    let copy_h = h.min(total_rows.saturating_sub(dst_y));
    let copy_bytes = copy_w * 4;

    for row in 0..copy_h {
        let src_off = row * src_stride;
        let dst_off = (dst_y + row) * stride + dst_x * 4;
        if src_off + copy_bytes <= src.len() && dst_off + copy_bytes <= canvas.len() {
            canvas[dst_off..dst_off + copy_bytes]
                .copy_from_slice(&src[src_off..src_off + copy_bytes]);
        }
    }
}

/// Decodes a sparse 32-bit RLE stream directly into `canvas` at rectangle `(dst_x, dst_y, w, h)`.
///
/// Format of `payload`: sequence of little-endian `u32` words:
/// - Bit 31 == 0 (`(tok & 0x8000_0000) == 0`): skip `tok` transparent pixels.
/// - Bit 31 == 1 (`(tok & 0x8000_0000) != 0`): copy `count = tok & 0x7FFF_FFFF` literal `u32` pixels immediately following.
pub fn unpack_sparse_rgba_rect(
    canvas: &mut [u8],
    frame_width: usize,
    dst_x: usize,
    dst_y: usize,
    w: usize,
    h: usize,
    payload: &[u8],
) {
    if w == 0 || h == 0 || frame_width == 0 {
        return;
    }
    let total_pixels = w * h;
    let stride = frame_width * 4;
    let total_rows = canvas.len() / stride;
    let mut pixel_idx = 0usize;
    let mut byte_pos = 0usize;

    while byte_pos + 4 <= payload.len() && pixel_idx < total_pixels {
        let tok = u32::from_le_bytes([
            payload[byte_pos],
            payload[byte_pos + 1],
            payload[byte_pos + 2],
            payload[byte_pos + 3],
        ]);
        byte_pos += 4;

        if (tok & 0x8000_0000) == 0 {
            // Skip transparent pixels
            pixel_idx = pixel_idx.saturating_add(tok as usize);
        } else {
            let run_len = (tok & 0x7FFF_FFFF) as usize;
            let bytes_needed = run_len.saturating_mul(4);
            if byte_pos + bytes_needed > payload.len() {
                break;
            }
            let mut remaining = run_len.min(total_pixels - pixel_idx);
            let mut src_off = byte_pos;

            while remaining > 0 {
                let row = pixel_idx / w;
                let col = pixel_idx % w;
                let row_avail = w - col;
                let chunk_px = remaining.min(row_avail);

                let target_y = dst_y + row;
                let target_x = dst_x + col;
                if target_y < total_rows && target_x < frame_width {
                    let safe_px = chunk_px.min(frame_width - target_x);
                    let dst_off = target_y * stride + target_x * 4;
                    let byte_cnt = safe_px * 4;
                    if dst_off + byte_cnt <= canvas.len() {
                        canvas[dst_off..dst_off + byte_cnt]
                            .copy_from_slice(&payload[src_off..src_off + byte_cnt]);
                    }
                }

                pixel_idx += chunk_px;
                src_off += chunk_px * 4;
                remaining -= chunk_px;
            }

            byte_pos += bytes_needed;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_ws_accept_key_rfc6455_vector() {
        // Standard RFC 6455 Section 1.3 test vector
        let accept = compute_ws_accept_key("dGhlIHNhbXBsZSBub25jZQ==");
        assert_eq!(accept, "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
    }

    #[test]
    fn test_sparse_rle_unpack_and_clear_rect() {
        // 8x6 frame canvas
        let width = 8;
        let height = 6;
        let mut canvas = vec![0u8; width * height * 4];

        // Dirty rect at (2, 1), size 4x2 (8 pixels total)
        // Pattern: skip 1, literal 2 ([10,20,30,255], [40,50,60,255]), skip 4, literal 1 ([70,80,90,255])
        let mut rle = Vec::new();
        rle.extend_from_slice(&1u32.to_le_bytes()); // skip 1
        rle.extend_from_slice(&(0x8000_0000u32 | 2).to_le_bytes()); // literal 2
        rle.extend_from_slice(&[10, 20, 30, 255]);
        rle.extend_from_slice(&[40, 50, 60, 255]);
        rle.extend_from_slice(&4u32.to_le_bytes()); // skip 4
        rle.extend_from_slice(&(0x8000_0000u32 | 1).to_le_bytes()); // literal 1
        rle.extend_from_slice(&[70, 80, 90, 255]);

        unpack_sparse_rgba_rect(&mut canvas, width, 2, 1, 4, 2, &rle);

        // Pixel (3, 1) -> idx 1 (row 0 col 1 of dirty rect)
        let off1 = (1 * width + 3) * 4;
        assert_eq!(&canvas[off1..off1 + 4], &[10, 20, 30, 255]);
        // Pixel (4, 1) -> idx 2 (row 0 col 2 of dirty rect)
        let off2 = (1 * width + 4) * 4;
        assert_eq!(&canvas[off2..off2 + 4], &[40, 50, 60, 255]);
        // Pixel (5, 2) -> idx 7 (row 1 col 3 of dirty rect)
        let off3 = (2 * width + 5) * 4;
        assert_eq!(&canvas[off3..off3 + 4], &[70, 80, 90, 255]);

        // Clear dirty rect back to 0
        clear_rgba_rect(&mut canvas, width, 2, 1, 4, 2, [0, 0, 0, 0]);
        assert!(canvas.iter().all(|&b| b == 0));
    }
}

