import { BigNumber, BigNumberish, Contract, ContractTransaction, ethers } from 'ethers';
import { ERC20_ABI } from './default-contracts';
import { HasOrdersImpl } from './has-horders';
import { _HasOrder, _TokenOrder } from './internal-types';
import {
    CallData,
    CanAddTokensOperation,
    HexString,
    INestedContracts,
    NATIVE_TOKEN,
    PorfolioTokenAdder,
    TokenOrder,
} from './public-types';
import { TokenOrderImpl } from './token-order';
import { lazySync, NestedOrder } from './utils';

export abstract class PorfolioTokenAdderBase extends HasOrdersImpl implements CanAddTokensOperation, _HasOrder {
    private tokenContract = lazySync(() => new Contract(this.spentToken, ERC20_ABI, this.parent.signer));

    constructor(parent: INestedContracts, readonly spentToken: HexString) {
        super(parent);
    }

    async isApproved(): Promise<boolean> {
        if (this.spentToken === NATIVE_TOKEN) {
            return true;
        }
        const user = await this.parent.signer.getAddress();
        const allowance = await this.tokenContract().allowance(user, this.tools.factoryContract.address);
        return allowance.gte(BigNumber.from(this.totalBudget));
    }

    async approve(amount?: BigNumberish): Promise<void> {
        if (this.spentToken === NATIVE_TOKEN) {
            return;
        }
        const toApprove = amount ? await this.toBudget(amount) : ethers.constants.MaxUint256;
        await this.tokenContract().approve(this.tools.factoryContract.address, toApprove);
    }

    private toBudget(amt: BigNumberish) {
        return this.tools.toTokenAmount(this.spentToken, amt);
    }

    async addToken(token: HexString, forBudgetAmount: BigNumberish, slippage: number): Promise<TokenOrder> {
        const ret = new TokenOrderImpl(this, this.spentToken, token, slippage, true);
        await ret.changeBudgetAmount(forBudgetAmount);
        this._orders.push(ret);
        return ret;
    }
}

export class PorfolioTokenAdderImpl extends PorfolioTokenAdderBase implements PorfolioTokenAdder {
    nftId!: BigNumber;

    buildCallData(): CallData {
        const total = this.totalBudget;
        return {
            to: this.parent.tools.factoryContract.address as HexString,
            data: this.parent.tools.factoryInterface.encodeFunctionData('addTokens', [
                this.nftId,
                this.spentToken,
                total,
                this._ordersData,
            ]) as HexString,
            // compute how much native token we need as input:
            value: this.spentToken === NATIVE_TOKEN ? total : BigNumber.from(0),
        };
    }

    async execute(): Promise<ethers.ContractReceipt> {
        // actual transaction
        const callData = this.buildCallData();
        const tx = await this.parent.signer.sendTransaction(callData);
        const receipt = await tx.wait();
        return receipt;
    }
}
