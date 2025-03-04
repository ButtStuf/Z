import { Connection, PublicKey, Transaction, clusterApiUrl } from '@solana/web3.js';
import { AaveLendingPool, FlashLoanReceiver } from './aave';
import { getSwapPrice, executeSwap } from './dex';
import { PROFIT_THRESHOLD, FLASHLOAN_AMOUNT, SLEEP_INTERVAL } from './config';
import { sleep, sendTransactionWithRetries } from './utils';
import { logger } from './logger';

const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

async function main() {
  while (true) {
    try {
      logger.info('Checking for arbitrage opportunities...');
      const profit = await checkForArbitrageOpportunity();
      if (profit >= PROFIT_THRESHOLD) {
        logger.info(`Arbitrage opportunity found! Expected profit: ${profit}`);
        await executeFlashLoanAndTrade();
      } else {
        logger.info('No profitable arbitrage opportunities found.');
      }
    } catch (error) {
      logger.error('Error in main loop:', error);
    }
    await sleep(SLEEP_INTERVAL);
  }
}

async function checkForArbitrageOpportunity(): Promise<number> {
  try {
    const solToWbtcPrice = await getSwapPrice('SOL', 'WBTC');
    const wbtcToDaiPrice = await getSwapPrice('WBTC', 'DAI');
    const daiToSolPrice = await getSwapPrice('DAI', 'SOL');

    const potentialProfit = (solToWbtcPrice * wbtcToDaiPrice * daiToSolPrice) - 1;
    return potentialProfit * FLASHLOAN_AMOUNT;
  } catch (error) {
    logger.error('Error checking arbitrage opportunity:', error);
    return 0;
  }
}

async function executeFlashLoanAndTrade() {
  try {
    const transaction = new Transaction();
    const aaveLendingPool = new AaveLendingPool(connection);

    transaction.add(aaveLendingPool.borrow('SOL', FLASHLOAN_AMOUNT, 2, 0, FlashLoanReceiver));

    const swap1 = await executeSwap('SOL', 'WBTC', FLASHLOAN_AMOUNT);
    const swap2 = await executeSwap('WBTC', 'DAI', swap1);
    const swap3 = await executeSwap('DAI', 'SOL', swap2);

    transaction.add(aaveLendingPool.repay('SOL', FLASHLOAN_AMOUNT, 2, FlashLoanReceiver));

    await sendTransactionWithRetries(connection, transaction);
    logger.info('Flash loan and trade executed successfully.');
  } catch (error) {
    logger.error('Error executing flash loan and trade:', error);
  }
}

main().catch(error => logger.error('Error starting bot:', error));