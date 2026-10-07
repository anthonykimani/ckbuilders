#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::*,
    default_alloc, entry,
    error::SysError,
    high_level::{
        load_cell_capacity, load_cell_data, load_cell_lock_hash, load_input_out_point, load_script,
    },
};

entry!(main);
default_alloc!();

const FORMAT: u8 = 1;
const MINT: u8 = 0;
const REPAIR: u8 = 1;
const TRANSFER: u8 = 2;
const HEADER_LEN: usize = 102;
const EVENT_PREFIX_LEN: usize = 102;
const MAX_DETAIL_LEN: usize = 160;
const MIN_CAPACITY: u64 = 60_000_000_000; // 600 CKB covers the largest permitted data and both scripts.

struct Passport {
    action: u8,
    sequence: u32,
    item_id: [u8; 32],
    history_root: [u8; 32],
    event_hash: [u8; 32],
    capacity: u64,
    lock_hash: [u8; 32],
    actor_hash: [u8; 32],
    recipient_hash: [u8; 32],
}

fn hash(parts: &[&[u8]]) -> [u8; 32] {
    let mut result = [0u8; 32];
    let mut hasher = blake2b_ref::Blake2bBuilder::new(32)
        .personal(b"ckb-default-hash")
        .build();
    for part in parts { hasher.update(part); }
    hasher.finalize(&mut result);
    result
}

fn read(index: usize, source: Source) -> Result<Option<Passport>, i8> {
    let data = match load_cell_data(index, source) {
        Ok(data) => data,
        Err(SysError::IndexOutOfBound) => return Ok(None),
        Err(_) => return Err(1),
    };
    if data.len() < HEADER_LEN + EVENT_PREFIX_LEN || data[0] != FORMAT {
        return Err(2);
    }
    let sequence = u32::from_le_bytes(data[2..6].try_into().map_err(|_| 2)?);
    let item_id = data[6..38].try_into().map_err(|_| 2)?;
    let history_root = data[38..70].try_into().map_err(|_| 2)?;
    let event_hash = data[70..102].try_into().map_err(|_| 2)?;
    let event = &data[HEADER_LEN..];
    let detail_len = event[101] as usize;
    if detail_len == 0 || detail_len > MAX_DETAIL_LEN || event.len() != EVENT_PREFIX_LEN + detail_len
        || core::str::from_utf8(&event[102..]).is_err()
        || event[0] != data[1] || event[1..5] != data[2..6]
        || event[5..37] != data[6..38] || hash(&[event]) != event_hash
    {
        return Err(24);
    }
    let actor_hash = event[37..69].try_into().map_err(|_| 24)?;
    let recipient_hash = event[69..101].try_into().map_err(|_| 24)?;
    Ok(Some(Passport {
        action: data[1],
        sequence,
        item_id,
        history_root,
        event_hash,
        capacity: load_cell_capacity(index, source).map_err(|_| 3)?,
        lock_hash: load_cell_lock_hash(index, source).map_err(|_| 4)?,
        actor_hash,
        recipient_hash,
    }))
}

fn root(previous: &[u8; 32], event: &[u8; 32]) -> [u8; 32] {
    hash(&[previous, event])
}

fn validate() -> Result<(), i8> {
    let script = load_script().map_err(|_| 5)?;
    let args = script.args().raw_data();
    // One-use funding OutPoint, then the trusted repair-attester Lock hash.
    if args.len() != 68 {
        return Err(6);
    }
    let previous = read(0, Source::GroupInput)?;
    let next = read(0, Source::GroupOutput)?.ok_or(7)?;
    if read(1, Source::GroupInput)?.is_some() || read(1, Source::GroupOutput)?.is_some() {
        return Err(8);
    }
    if next.capacity < MIN_CAPACITY || next.event_hash == [0u8; 32] {
        return Err(9);
    }
    match previous {
        None => {
            let funding = load_input_out_point(0, Source::Input).map_err(|_| 10)?;
            if &args[..36] != funding.as_slice() || next.action != MINT || next.sequence != 0 {
                return Err(11);
            }
            let owner = load_cell_lock_hash(0, Source::Input).map_err(|_| 12)?;
            if next.lock_hash != owner || next.actor_hash != owner || next.recipient_hash != owner
                || next.item_id == [0u8; 32]
                || next.history_root != root(&next.item_id, &next.event_hash)
            {
                return Err(13);
            }
        }
        Some(old) => {
            if old.item_id != next.item_id {
                return Err(20);
            }
            if old.sequence == u32::MAX || next.sequence != old.sequence + 1 {
                return Err(21);
            }
            if next.capacity != old.capacity {
                return Err(22);
            }
            if next.history_root != root(&old.history_root, &next.event_hash) {
                return Err(23);
            }
            match next.action {
                REPAIR => {
                    if old.lock_hash != next.lock_hash || next.recipient_hash != next.lock_hash
                        || next.actor_hash != args[36..68] {
                        return Err(15);
                    }
                    let attester = &args[36..68];
                    let mut found = false;
                    for index in 0..64 {
                        match load_cell_lock_hash(index, Source::Input) {
                            Ok(lock_hash) if lock_hash == attester => {
                                found = true;
                                break;
                            }
                            Ok(_) => (),
                            Err(SysError::IndexOutOfBound) => break,
                            Err(_) => return Err(16),
                        }
                    }
                    if !found {
                        return Err(17);
                    }
                }
                TRANSFER => {
                    if old.lock_hash == next.lock_hash || next.actor_hash != old.lock_hash
                        || next.recipient_hash != next.lock_hash {
                        return Err(18);
                    }
                }
                _ => return Err(19),
            }
        }
    }
    Ok(())
}

fn main() -> i8 {
    match validate() {
        Ok(()) => 0,
        Err(code) => code,
    }
}
