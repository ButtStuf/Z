import { Connection, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendTransactionWithRetries(connection: Connection, transaction: Transaction, retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await sendAndConfirmTransaction(connection, transaction, []);
      return;
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      await sleep(2000);
    }
  }
}