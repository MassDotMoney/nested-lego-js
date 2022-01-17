import { Networkish } from '@ethersproject/networks';
import { Chain, HexString } from './public-types';

export interface ConnectionConfig {
    providerConfig: Networkish;
    wrappedToken: HexString | null;
    factoryAddress: HexString | null;
    chainId: number | null;
}

export const FIXED_FEE = 0.01;

/** Last version of the nested factory that has been deployed */
export const defaultContracts: { [key in keyof typeof Chain]: ConnectionConfig } = {
    eth: {
        providerConfig: 'homestead',
        factoryAddress: null,
        wrappedToken: null,
        chainId: null,
    },
    bsc: {
        providerConfig: 'https://bsc-dataseed.binance.org/',
        factoryAddress: '0x1dB81116467789b7dCC3B070ee8f5aA4d90D6940',
        wrappedToken: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        chainId: 56,
    },
    avax: {
        providerConfig: 'https://api.avax.network/ext/bc/C/rpc',
        factoryAddress: '0x1dB81116467789b7dCC3B070ee8f5aA4d90D6940',
        wrappedToken: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
        chainId: 43114,
    },
    poly: {
        providerConfig: 'https://polygon-rpc.com',
        factoryAddress: '0xD6D813e31558b45769B83E33Fe10cDef76128Ffc',
        wrappedToken: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
        chainId: 137,
    },
    // Ropsten config
    rop: {
        providerConfig: 'ropsten',
        factoryAddress: null,
        wrappedToken: null,
        chainId: null,
    },
};

export const chainByChainId: Record<number, Chain> = Object.fromEntries(
    Object.entries(defaultContracts)
        .filter(([_, { chainId }]) => !!chainId)
        .map(([chain, { chainId }]) => [chainId, chain]),
);

export const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address _owner) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
];
