
A Cell is the basic unit of CKB, similiar to the human body. A transaction on the blockchain ( a state change is spending some cells while creating new ones). This is similiar to the Bitcoin UTXO model.

Unspent cells are live cell while spent cells are dead cells, but unlike the traditional UTXO model, a cell can store any type of data. Each cell has a field called data that stores an unformatted string. This can be a hash, a text, a date or even a piece of binary code to be referenced by other cells and run on-chain through the CKB virtual machine, (CKB-VM). This are the **smart contracts**.

### What does a Cell contain?

In Nervos 1 CKB is equal to 1 byte of storage space. with hundreds of ckb you can potentially store data on-chain, this enables anyone to upload valuable and neccesary data to the consensus. a knowledge base owned by all of humanity, *Common Knowledge Base*

> [!The entire cell data structure looks like this:]
> Cell: {
> 	capacity: HexString; - the space size of the cell, i.e. the integer number of native tokens represented by this cell, usually expressed in hexadecimal. The basic unit for capacity is shannon, 1 CKB equals 10**8 shannon.
> 	lock: Script; -  script, which is essentially the equivalent of a lock
> 	type: Script; - a script, same as the lock but for a different purpose
> 	data: HexString; - this field can store arbitrary bytes, which means any type of data
> }

A cell's total size for all four fields above must be less than or equal to the capacity of the cell.

### How to tell that you own a cell?

the only way to possess cells is by owning native tokens. The scripts are pieces of code and parameters. The lock script is the default lock and type script is an optional lock. when we try to consume a cell, the scripts run automatically and take the parameters and proof we submit(such as the signature) to determine if the locks of the cell can be unlocked. Once unlocked, it proves that we own and control the cell.

Script: {
	code_hash: HexString, - the hash of a certain piece of code
	args: HexString, - the arguments that will be transferred to the code
	hash_type: Uint8, there are three allowed values: {
		0: "data",
		1: "type",
		2: "data1"
	}
}