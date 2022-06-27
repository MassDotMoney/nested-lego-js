import { BigNumber } from 'ethers';
import { parseUnits } from 'ethers/lib/utils';
import { ParaSwap, APIError, SwapSide } from 'paraswap';
import { OptimalRate } from 'paraswap-core';
import { defaultContracts } from './default-contracts';
import { AggregatorQuoteResponse, AggregatorRequest } from './dex-aggregator-types';
import { ParaSwapAnswer } from './paraswap-types';
import { Chain, HexString, ZERO_ADDRESS } from './public-types';
import { divideBigNumbers, safeMult } from './utils';

export async function defaultParaSwapFetcher(config: AggregatorRequest): Promise<ParaSwapAnswer | null> {
    switch (config.chain) {
        case Chain.celo:
        case Chain.ftm:
        case Chain.opti:
            return null;
    }

    const networkId = defaultContracts[config.chain].chainId as 1 | 56 | 137 | 43114;

    const paraSwap = new ParaSwap(networkId);
    let spendQty = 'spendQty' in config ? config.spendQty : config.boughtQty;
    const swapSide = 'spendQty' in config ? SwapSide.SELL : SwapSide.BUY;
    const priceRoute: OptimalRate | APIError = await paraSwap.getRate(
        config.spendToken,
        config.buyToken,
        spendQty.toString(),
        config.userAddress,
        swapSide,
        { excludeDEXS: '0x' },
    );
    if ('message' in priceRoute) {
        throw new Error(`Failed to fetch ParaSwap quote: ${priceRoute.message} (${priceRoute.status})`);
    }

    const minAmount = safeMult(BigNumber.from(priceRoute.destAmount), 1 - config.slippage);

    const transaction = await paraSwap.buildTx(
        config.spendToken,
        config.buyToken,
        spendQty.toString(),
        minAmount.toString(),
        priceRoute,
        config.userAddress ?? ZERO_ADDRESS,
        undefined,
        undefined,
        undefined,
        undefined,
        { ignoreChecks: true, ignoreGasEstimate: true },
        config.spendTokenDecimals,
        config.buyTokenDecimals,
    );

    if ('message' in transaction) {
        throw new Error(`Failed to fetch ParaSwap transaction: ${transaction.message} (${transaction.status})`);
    }
    return {
        priceRoute: priceRoute,
        transaction: transaction,
    };
}

// convert from the ParaSwap specific quote response to a more generic dex aggregator response type
export function paraSwapRespToQuoteResp(answer: ParaSwapAnswer): AggregatorQuoteResponse {
    const priceImpact = parseFloat(answer.priceRoute.srcUSD) / parseFloat(answer.priceRoute.destUSD) - 1;
    const price = divideBigNumbers(
        BigNumber.from(answer.priceRoute.destAmount),
        BigNumber.from(answer.priceRoute.srcAmount),
    );

    return {
        aggregator: 'ParaSwap',
        chainId: answer.priceRoute.network,
        price: parseUnits(price.toString(), answer.priceRoute.srcDecimals).toString(),
        to: answer.transaction.to as HexString,
        data: answer.transaction.data as HexString,
        value: answer.transaction.value,
        protocolFee: answer.priceRoute.partnerFee.toString(),
        buyTokenAddress: answer.priceRoute.destToken as HexString,
        sellTokenAddress: answer.priceRoute.srcToken as HexString,
        buyAmount: answer.priceRoute.destAmount,
        sellAmount: answer.priceRoute.srcAmount,
        allowanceTarget: answer.priceRoute.tokenTransferProxy as HexString,
        estimatedPriceImpact: priceImpact.toString(),
        guaranteedPrice: '0',
    };
}