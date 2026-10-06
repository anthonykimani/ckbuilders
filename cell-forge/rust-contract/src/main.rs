#![no_std]
#![no_main]

use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::*,
    default_alloc, entry,
    error::SysError,
    high_level::{
        load_cell_capacity, load_cell_data, load_cell_lock_hash, load_input_out_point,
        load_script,
    },
};

entry!(main);
default_alloc!();

const CAPACITY: u64 = 20_000_000_000; // 200 CKB, in shannons.
const STATE: u8 = 0;
const ORE: u8 = 1;
const COAL: u8 = 4;
const BAR: u8 = 16;
const WOOD: u8 = 64;
const PICKAXE: u8 = 128;

#[derive(Clone, Copy)]
struct Cell {
    kind: u8,
    units: u64,
    turn: u64,
    capacity: u64,
    lock_hash: [u8; 32],
}

fn read_group<const N: usize>(source: Source) -> Result<([Option<Cell>; N], usize), i8> {
    let mut cells = [None; N];
    let mut count = 0;
    for index in 0..=N {
        let data = match load_cell_data(index, source) {
            Ok(data) => data,
            Err(SysError::IndexOutOfBound) => return Ok((cells, count)),
            Err(_) => return Err(1),
        };
        if index == N || data.len() != 17 {
            return Err(2);
        }
        let capacity = load_cell_capacity(index, source).map_err(|_| 3)?;
        let lock_hash = load_cell_lock_hash(index, source).map_err(|_| 4)?;
        let units = u64::from_le_bytes(data[1..9].try_into().map_err(|_| 2)?);
        let turn = u64::from_le_bytes(data[9..17].try_into().map_err(|_| 2)?);
        cells[index] = Some(Cell {
            kind: data[0],
            units,
            turn,
            capacity,
            lock_hash,
        });
        count += 1;
    }
    Err(2)
}

fn is(cell: Cell, kind: u8, units: u64, turn: u64, capacity: u64) -> bool {
    cell.kind == kind && cell.units == units && cell.turn == turn && cell.capacity == capacity
}

fn same_owner<const N: usize>(cells: &[Option<Cell>; N], count: usize, owner: &[u8; 32]) -> bool {
    cells[..count]
        .iter()
        .all(|cell| cell.is_some_and(|cell| &cell.lock_hash == owner))
}

fn has<const N: usize>(cells: &[Option<Cell>; N], count: usize, kind: u8, units: u64, turn: u64, capacity: u64) -> bool {
    cells[..count]
        .iter()
        .filter(|cell| cell.is_some_and(|cell| is(cell, kind, units, turn, capacity)))
        .count() == 1
}

fn validate() -> Result<(), i8> {
    let script = load_script().map_err(|_| 5)?;
    let args = script.args().raw_data();
    if args.len() != 36 {
        return Err(6);
    }

    let (inputs, input_count) = read_group::<3>(Source::GroupInput)?;
    let (outputs, output_count) = read_group::<4>(Source::GroupOutput)?;

    if input_count == 0 {
        // The first funding outpoint is a one-use run identifier. Its Lock
        // authorizes this transaction; all four game Cells inherit that Lock.
        let funding = load_input_out_point(0, Source::Input).map_err(|_| 7)?;
        if args.as_ref() != funding.as_slice() || output_count != 4 {
            return Err(8);
        }
        let owner = load_cell_lock_hash(0, Source::Input).map_err(|_| 9)?;
        if !same_owner(&outputs, output_count, &owner) {
            return Err(10);
        }
        for (index, kind) in [STATE, ORE, COAL, WOOD].iter().enumerate() {
            if !is(outputs[index].ok_or(11)?, *kind, 1, 0, CAPACITY) {
                return Err(11);
            }
        }
        return Ok(());
    }

    let owner = inputs[0].ok_or(12)?.lock_hash;
    if !same_owner(&inputs, input_count, &owner)
        || !same_owner(&outputs, output_count, &owner)
    {
        return Err(13);
    }

    if input_count == 3 && output_count == 2 {
        let state = outputs[0].ok_or(14)?;
        let product = outputs[1].ok_or(14)?;
        if has(&inputs, 3, STATE, 1, 0, CAPACITY)
            && has(&inputs, 3, ORE, 1, 0, CAPACITY)
            && has(&inputs, 3, COAL, 1, 0, CAPACITY)
            && is(state, STATE, 1, 1, CAPACITY)
            && is(product, BAR, 2, 0, CAPACITY * 2)
        {
            return Ok(());
        }
        if has(&inputs, 3, STATE, 1, 1, CAPACITY)
            && has(&inputs, 3, BAR, 2, 0, CAPACITY * 2)
            && has(&inputs, 3, WOOD, 1, 0, CAPACITY)
            && is(state, STATE, 1, 2, CAPACITY)
            && is(product, PICKAXE, 3, 0, CAPACITY * 3)
        {
            return Ok(());
        }
        return Err(15);
    }

    if input_count == 2 && output_count == 0
        && has(&inputs, 2, STATE, 1, 2, CAPACITY)
        && has(&inputs, 2, PICKAXE, 3, 0, CAPACITY * 3)
    {
        return Ok(());
    }

    Err(16)
}

fn main() -> i8 {
    match validate() {
        Ok(()) => 0,
        Err(code) => code,
    }
}
