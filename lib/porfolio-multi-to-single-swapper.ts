import { BigNumberish } from '@ethersproject/bignumber';
import { ContractReceipt } from '@ethersproject/contracts';
import { HasOrdersImpl } from './has-orders';
import { CallData, HexString, TokenOrder, INestedContracts, MultiToSingleSwapper, ExecOptions } from './public-types';
import { TokenOrderImpl } from './token-order';
import { as, BatchedOutputOrders, safeMult, wrap } from './utils';

export class MultiToSingleSwapperImpl extends HasOrdersImpl implements MultiToSingleSwapper {
    constructor(parent: INestedContracts, private nftId: BigNumberish, readonly toToken: HexString) {
        super(parent);
        this.toToken = wrap(this.parent.chain, this.toToken);
    }

    swapFrom(sellToken: HexString, slippage: number): TokenOrder {
        sellToken = wrap(this.parent.chain, sellToken);
        if (sellToken === this.toToken) {
            throw new Error('You cannot swap a token to itself');
        }
        const ret = new TokenOrderImpl(this, sellToken, this.toToken, slippage, 'output', 'entry');
        this._orders.push(ret);
        return ret;
    }

    buildCallData(): CallData {
        const soldAmounts = this._orders.map(x => x.inputQty);
        if (!soldAmounts.length) {
            throw new Error('Nothing to swap');
        }
        return {
            to: this.parent.tools.factoryContract.address as HexString,
            data: this.parent.tools.factoryInterface.encodeFunctionData('processOutputOrders', [
                this.nftId,
                [
                    as<BatchedOutputOrders>({
                        outputToken: this.toToken,
                        amounts: soldAmounts,
                        orders: this._ordersData,
                        toReserve: true,
                    }),
                ],
            ]) as HexString,
        };
    }

    async execute(options?: ExecOptions): Promise<ContractReceipt> {
        // actual transaction
        const callData = this.buildCallData();
        await this.parent.tools.prepareCalldata(callData, options);
        const tx = await this.parent.signer.sendTransaction(callData);
        const receipt = await tx.wait();
        return receipt;
    }
}
