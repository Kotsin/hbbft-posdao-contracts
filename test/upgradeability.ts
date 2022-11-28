import { ethers, network, upgrades } from "hardhat";

import {
    BlockRewardHbbftCoinsMock,
    AdminUpgradeabilityProxy,
    RandomHbbftMock,
    ValidatorSetHbbftMock,
    StakingHbbftCoinsMock,
    KeyGenHistory,
    BaseAdminUpgradeabilityProxy,
    ValidatorSetHbbftV2,
} from "../src/types";

import {
    hashBytecodeWithoutMetadata,
    Manifest,
} from "@openzeppelin/upgrades-core";

import fp from 'lodash/fp';
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { encodeMulti } from "ethers-multisend";
import { experimentalAddHardhatNetworkMessageTraceHook } from "hardhat/config";


require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BigNumber))
    .should();


// delegatecall are a problem for truffle debugger
// therefore it makes sense to use a proxy for automated testing to have the proxy testet.
// and to not use it if specific transactions needs to get debugged,
// like truffle `debug 0xabc`.
const useUpgradeProxy = !(process.env.CONTRACTS_NO_UPGRADE_PROXY == 'true');
console.log('useUpgradeProxy:', useUpgradeProxy);

//smart contracts
let blockRewardHbbft: BlockRewardHbbftCoinsMock;
let adminUpgradeabilityProxy: AdminUpgradeabilityProxy;
let randomHbbft: RandomHbbftMock;
let validatorSetHbbft: ValidatorSetHbbftMock;
let stakingHbbft: StakingHbbftCoinsMock;
let keyGenHistory: KeyGenHistory;

//addresses
let owner: SignerWithAddress;
let accounts: SignerWithAddress[];
let initialValidatorsPubKeys;
let initialValidatorsIpAddresses;
let validators;

//vars
let candidateMinStake: BigNumber;
let delegatorMinStake: BigNumber;
let stakingEpoch;
let nativeRewardUndistributed = BigNumber.from(0);

//consts
// one epoch in 1 day.
const STAKING_FIXED_EPOCH_DURATION = BigNumber.from(86400);

// the transition time window is 1 hour.
const STAKING_TRANSITION_WINDOW_LENGTH = BigNumber.from(3600);

//const STAKING_EPOCH_DURATION = BigNumber.from(120954 + 2);

const KEY_GEN_DURATION = BigNumber.from(2); // we assume that there is a fixed duration in blocks, in reality it varies.
const STAKE_WITHDRAW_DISALLOW_PERIOD = 2; // one less than EPOCH DURATION, therefore it meets the conditions.
const MIN_STAKE = BigNumber.from(ethers.utils.parseEther('1'));
const MAX_STAKE = BigNumber.from(ethers.utils.parseEther('100000'));


describe('BlockRewardHbbft', () => {
    const useUpgradeProxy = !(process.env.CONTRACTS_NO_UPGRADE_PROXY == 'true');

    it('network started', async () => {
        //ADDRESSES
        [owner, ...accounts] = await ethers.getSigners();
        const accountAddresses = accounts.map(item => item.address);
        const initialValidators = accountAddresses.slice(1, 3 + 1); // accounts[1...3]
        const initialStakingAddresses = accountAddresses.slice(4, 6 + 1); // accounts[4...6]
        initialStakingAddresses.length.should.be.equal(3);
        initialStakingAddresses[0].should.not.be.equal('0x0000000000000000000000000000000000000000');
        initialStakingAddresses[1].should.not.be.equal('0x0000000000000000000000000000000000000000');
        initialStakingAddresses[2].should.not.be.equal('0x0000000000000000000000000000000000000000');

        //DEPLOY MULTISEND
        const MultiSendFactory = await ethers.getContractFactory("MultiSend");
        const multisend = await MultiSendFactory.deploy();

        //DEPLOY UPGRADER
        const UpgraderFactory = await ethers.getContractFactory("Upgrader");
        const upgrader = await UpgraderFactory.deploy();

        //DEPLOY USELESS PROXY ACCOUNT JUST IN CASE
        const AdminUpgradeabilityProxyFactory = await ethers.getContractFactory("AdminUpgradeabilityProxy");
        adminUpgradeabilityProxy = await AdminUpgradeabilityProxyFactory.deploy(upgrader.address, owner.address, []);


        // CREATE V1 CONTRACT FACTORIES
        const ValidatorSetFactory = await ethers.getContractFactory("ValidatorSetHbbftMock");
        const BlockRewardHbbftFactory = await ethers.getContractFactory("BlockRewardHbbftCoinsMock");
        //CREATE V2 CONTRACT FACTORIES
        const ValidatorSetFactoryV2 = await ethers.getContractFactory("ValidatorSetHbbftV2");
        const BlockRewardHbbftFactoryV2 = await ethers.getContractFactory("BlockRewardHbbftV2");
        //DEPLOY PROXIES
        let validatorSetHbbft = await upgrades.deployProxy(ValidatorSetFactory, ['0x2000000000000000000000000000000000000001', // _blockRewardContract
            '0x3000000000000000000000000000000000000001', // _randomContract
            '0x4000000000000000000000000000000000000001', // _stakingContract
            '0x8000000000000000000000000000000000000001', //_keyGenHistoryContract
            initialValidators, initialStakingAddresses], { kind: "transparent" }) as ValidatorSetHbbftMock;
        await validatorSetHbbft.deployed();
        let blockRewardHbbft = await upgrades.deployProxy(BlockRewardHbbftFactory, [validatorSetHbbft.address], { kind: "transparent" }) as BlockRewardHbbftCoinsMock;
        await blockRewardHbbft.deployed();

        //CHANGE PROXY ADMINS
        await upgrades.admin.changeProxyAdmin(validatorSetHbbft.address, upgrader.address)
        await upgrades.admin.changeProxyAdmin(blockRewardHbbft.address, upgrader.address)

        //PREPARE UPGRADES
        const BlockRewardImplAddress = await upgrades.prepareUpgrade(blockRewardHbbft.address, BlockRewardHbbftFactoryV2);
        const ValidatorSetImplAddress = await upgrades.prepareUpgrade(validatorSetHbbft.address, ValidatorSetFactoryV2);

        //ENCODE UPGRADE CALLS
        let upgradeDataBlockReward = adminUpgradeabilityProxy.interface.encodeFunctionData('upgradeTo', [BlockRewardImplAddress.toString()]);
        let upgradeDataValidatorSet = adminUpgradeabilityProxy.interface.encodeFunctionData('upgradeTo', [ValidatorSetImplAddress.toString()]);

        //CREATE BOTH MULTISENDS
        let multiSendTx = encodeMulti([{
            to: blockRewardHbbft.address,
            value: '0',
            data: upgradeDataBlockReward,
        }, {
            to: validatorSetHbbft.address,
            value: '0',
            data: upgradeDataValidatorSet,
        },
        ], multisend.address);

        console.log(`test upgraded`);
        await upgrader.execTransaction(multiSendTx.to,
            multiSendTx.value,
            multiSendTx.data,
            multiSendTx.operation || 0);

        let blockRewardHbbftV2 = await ethers.getContractAt("BlockRewardHbbftV2", blockRewardHbbft.address);
        console.log(`function called with the result: ${await blockRewardHbbftV2.testValue()}`);
        await blockRewardHbbftV2.test();
        console.log(`function called with the result: ${await blockRewardHbbftV2.testValue()}`);

        let validatorSetV2 = await ethers.getContractAt("ValidatorSetHbbftV2", validatorSetHbbft.address);
        console.log(`function called with the result: ${await validatorSetV2.testValue()}`);
        await validatorSetV2.test();
        console.log(`function called with the result: ${await validatorSetV2.testValue()}`);
    });
});
