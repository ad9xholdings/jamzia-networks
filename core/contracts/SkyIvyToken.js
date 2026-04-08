/**
 * SkyIvy Coin Token Contract
 * XRP Ledger Issued Currency
 * JamZia Networks™ - Ad9x Holdings, LLC
 * 
 * SkyIvy Coin: Governance & Utility Token for JamZia Ecosystem
 * Total Supply: 1,000,000,000 SKYIVY
 */

const crypto = require('crypto');

class SkyIvyToken {
    constructor(config = {}) {
        this.name = 'SkyIvy Coin';
        this.symbol = 'SKYIVY';
        this.currencyCode = '534B594956590000'; // SKYIVY in hex (20 bytes)
        this.decimals = 6;
        this.totalSupply = '1000000000'; // 1 Billion
        this.issuer = config.issuer || null;
        this.distribution = config.distribution || this.getDefaultDistribution();
        
        // Tokenomics
        this.tokenomics = {
            totalSupply: 1000000000,
            allocations: {
                ecosystem: 300000000,      // 30% - Ecosystem rewards, airdrops
                team: 150000000,           // 15% - Team & advisors (4-year vesting)
                treasury: 200000000,       // 20% - Treasury & DAO
                liquidity: 150000000,      // 15% - Liquidity pools
                marketing: 100000000,      // 10% - Marketing & partnerships
                reserves: 100000000        // 10% - Strategic reserves
            },
            vesting: {
                team: {
                    cliff: 365, // days
                    duration: 1460, // 4 years
                    interval: 30 // monthly
                }
            },
            burn: {
                enabled: true,
                rate: 0.01, // 1% of transaction fees burned
                totalBurned: 0
            }
        };
        
        // Governance
        this.governance = {
            votingPower: true,
            proposalThreshold: 100000, // Minimum to create proposal
            quorum: 0.51, // 51% quorum
            votingPeriod: 7 * 24 * 60 * 60 * 1000 // 7 days
        };
        
        // Utility functions
        this.utilities = [
            'dao_voting',
            'transaction_fee_discount',
            'staking_rewards',
            'premium_access',
            'governance_proposals',
            'nft_minting',
            'ar_airdrop_bonus'
        ];
        
        this.holders = new Map();
        this.transactions = [];
        this.proposals = new Map();
        this.stakingPools = new Map();
    }
    
    getDefaultDistribution() {
        return {
            ecosystem: { address: null, amount: 300000000, locked: false },
            team: { address: null, amount: 150000000, locked: true, vesting: true },
            treasury: { address: null, amount: 200000000, locked: true, dao: true },
            liquidity: { address: null, amount: 150000000, locked: false },
            marketing: { address: null, amount: 100000000, locked: false },
            reserves: { address: null, amount: 100000000, locked: true }
        };
    }
    
    // Initialize token on XRP Ledger
    async initialize(xrplClient, issuerWallet) {
        console.log('🌿 Initializing SkyIvy Coin...');
        
        this.issuer = issuerWallet.classicAddress;
        
        // Configure issuer settings
        const settingsTx = {
            TransactionType: 'AccountSet',
            Account: this.issuer,
            SetFlag: 8, // DefaultRipple - enable rippling
            Domain: Buffer.from('jamzia.network').toString('hex'),
            TransferRate: 0 // No transfer fee
        };
        
        // Create trust lines for distribution wallets
        for (const [category, config] of Object.entries(this.distribution)) {
            if (config.address) {
                console.log(`📋 Trust line prepared for ${category}: ${config.amount} SKYIVY`);
            }
        }
        
        console.log('✅ SkyIvy Coin initialized');
        console.log(`   Issuer: ${this.issuer}`);
        console.log(`   Total Supply: ${this.totalSupply} SKYIVY`);
        
        return {
            success: true,
            issuer: this.issuer,
            currencyCode: this.currencyCode,
            totalSupply: this.totalSupply
        };
    }
    
    // Mint tokens to distribution wallets
    async mint(xrplClient, distributionWallet, amount) {
        const paymentTx = {
            TransactionType: 'Payment',
            Account: this.issuer,
            Destination: distributionWallet,
            Amount: {
                currency: this.currencyCode,
                issuer: this.issuer,
                value: amount.toString()
            }
        };
        
        console.log(`💰 Minting ${amount} SKYIVY to ${distributionWallet}`);
        
        return {
            tx: paymentTx,
            amount,
            recipient: distributionWallet
        };
    }
    
    // Burn tokens
    async burn(xrplClient, amount) {
        // Send to black hole address (rrrrrrrrrrrrrrrrrrrrrhoLvTp)
        const burnTx = {
            TransactionType: 'Payment',
            Account: this.issuer,
            Destination: 'rrrrrrrrrrrrrrrrrrrrrhoLvTp',
            Amount: {
                currency: this.currencyCode,
                issuer: this.issuer,
                value: amount.toString()
            }
        };
        
        this.tokenomics.burn.totalBurned += parseFloat(amount);
        
        console.log(`🔥 Burning ${amount} SKYIVY`);
        console.log(`   Total Burned: ${this.tokenomics.burn.totalBurned}`);
        
        return burnTx;
    }
    
    // Staking functionality
    async createStakingPool(config) {
        const poolId = crypto.randomUUID();
        
        const pool = {
            id: poolId,
            name: config.name,
            minStake: config.minStake || 1000,
            maxStake: config.maxStake || 10000000,
            duration: config.duration || 30, // days
            apy: config.apy || 0.15, // 15% APY
            totalStaked: 0,
            stakers: new Map(),
            rewardsDistributed: 0,
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        
        this.stakingPools.set(poolId, pool);
        
        return pool;
    }
    
    async stake(walletId, poolId, amount) {
        const pool = this.stakingPools.get(poolId);
        if (!pool) throw new Error('Staking pool not found');
        
        if (parseFloat(amount) < pool.minStake) {
            throw new Error(`Minimum stake is ${pool.minStake} SKYIVY`);
        }
        
        const stakeId = crypto.randomUUID();
        
        const stake = {
            id: stakeId,
            walletId,
            poolId,
            amount,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + pool.duration * 24 * 60 * 60 * 1000).toISOString(),
            apy: pool.apy,
            rewards: 0,
            status: 'active'
        };
        
        pool.stakers.set(stakeId, stake);
        pool.totalStaked += parseFloat(amount);
        
        return stake;
    }
    
    async calculateRewards(stakeId) {
        const pool = Array.from(this.stakingPools.values())
            .find(p => p.stakers.has(stakeId));
        
        if (!pool) throw new Error('Stake not found');
        
        const stake = pool.stakers.get(stakeId);
        const daysStaked = (Date.now() - new Date(stake.startDate).getTime()) / (1000 * 60 * 60 * 24);
        const dailyReward = (parseFloat(stake.amount) * stake.apy) / 365;
        
        return {
            daysStaked: Math.floor(daysStaked),
            accumulatedRewards: dailyReward * daysStaked,
            dailyReward
        };
    }
    
    // Governance - Create proposal
    async createProposal(proposerWallet, config) {
        // Check voting power
        const balance = this.holders.get(proposerWallet)?.balance || 0;
        if (balance < this.governance.proposalThreshold) {
            throw new Error(`Need ${this.governance.proposalThreshold} SKYIVY to create proposal`);
        }
        
        const proposalId = crypto.randomUUID();
        
        const proposal = {
            id: proposalId,
            title: config.title,
            description: config.description,
            proposer: proposerWallet,
            type: config.type, // 'parameter_change', 'treasury', 'upgrade', etc.
            parameters: config.parameters || {},
            votes: {
                for: 0,
                against: 0,
                abstain: 0
            },
            voters: new Map(),
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + this.governance.votingPeriod).toISOString(),
            status: 'active',
            executed: false
        };
        
        this.proposals.set(proposalId, proposal);
        
        return proposal;
    }
    
    // Vote on proposal
    async vote(walletId, proposalId, voteType) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        
        if (new Date() > new Date(proposal.endTime)) {
            throw new Error('Voting period has ended');
        }
        
        const balance = parseFloat(this.holders.get(walletId)?.balance || 0);
        
        // Remove previous vote if exists
        if (proposal.voters.has(walletId)) {
            const prevVote = proposal.voters.get(walletId);
            proposal.votes[prevVote.type] -= prevVote.weight;
        }
        
        // Add new vote
        proposal.votes[voteType] += balance;
        proposal.voters.set(walletId, {
            type: voteType,
            weight: balance,
            timestamp: new Date().toISOString()
        });
        
        return {
            proposalId,
            voteType,
            votingPower: balance,
            totalVotes: proposal.votes.for + proposal.votes.against + proposal.votes.abstain
        };
    }
    
    // Execute passed proposal
    async executeProposal(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        
        if (proposal.executed) {
            throw new Error('Proposal already executed');
        }
        
        const totalVotes = proposal.votes.for + proposal.votes.against;
        const forPercentage = proposal.votes.for / totalVotes;
        
        // Check quorum
        const totalSupply = parseFloat(this.totalSupply);
        const quorumReached = (totalVotes / totalSupply) >= this.governance.quorum;
        
        if (!quorumReached) {
            throw new Error('Quorum not reached');
        }
        
        if (forPercentage <= 0.5) {
            throw new Error('Proposal did not pass');
        }
        
        proposal.executed = true;
        proposal.status = 'executed';
        proposal.executedAt = new Date().toISOString();
        
        // Execute the proposal action
        await this.executeProposalAction(proposal);
        
        return proposal;
    }
    
    async executeProposalAction(proposal) {
        console.log(`⚡ Executing proposal: ${proposal.title}`);
        
        switch (proposal.type) {
            case 'parameter_change':
                console.log('   Updating protocol parameters...');
                break;
            case 'treasury':
                console.log('   Executing treasury action...');
                break;
            case 'upgrade':
                console.log('   Scheduling protocol upgrade...');
                break;
            default:
                console.log('   Executing custom action...');
        }
    }
    
    // Get token info
    getTokenInfo() {
        return {
            name: this.name,
            symbol: this.symbol,
            currencyCode: this.currencyCode,
            decimals: this.decimals,
            totalSupply: this.totalSupply,
            circulatingSupply: this.getCirculatingSupply(),
            issuer: this.issuer,
            tokenomics: this.tokenomics,
            governance: this.governance,
            utilities: this.utilities,
            holders: this.holders.size,
            totalBurned: this.tokenomics.burn.totalBurned
        };
    }
    
    getCirculatingSupply() {
        let circulating = 0;
        for (const holder of this.holders.values()) {
            circulating += parseFloat(holder.balance);
        }
        return circulating.toString();
    }
    
    // Get holder info
    getHolderInfo(walletId) {
        const holder = this.holders.get(walletId);
        if (!holder) return null;
        
        const balance = parseFloat(holder.balance);
        const totalSupply = parseFloat(this.totalSupply);
        
        return {
            walletId,
            balance: holder.balance,
            percentage: ((balance / totalSupply) * 100).toFixed(4) + '%',
            votingPower: balance,
            stakingPositions: Array.from(this.stakingPools.values())
                .flatMap(p => Array.from(p.stakers.values()))
                .filter(s => s.walletId === walletId),
            proposalsCreated: Array.from(this.proposals.values())
                .filter(p => p.proposer === walletId).length
        };
    }
}

module.exports = SkyIvyToken;
