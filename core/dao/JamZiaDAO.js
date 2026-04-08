/**
 * JamZia DAO Governance System
 * JamZia Networks™ - Ad9x Holdings, LLC
 * 
 * Decentralized governance for the JamZia ecosystem
 * Powered by SkyIvy Coin (SKYIVY)
 */

const crypto = require('crypto');

class JamZiaDAO {
    constructor(config = {}) {
        this.name = 'JamZia DAO';
        this.token = 'SKYIVY';
        this.network = config.network || 'mainnet';
        
        // Governance parameters
        this.parameters = {
            // Voting thresholds
            proposalThreshold: 100000,      // Minimum SKYIVY to create proposal
            quorum: 0.10,                   // 10% of total supply must vote
            approvalThreshold: 0.51,        // 51% approval required
            
            // Timing
            votingPeriod: 7 * 24 * 60 * 60 * 1000,  // 7 days
            executionDelay: 2 * 24 * 60 * 60 * 1000, // 2 days after passing
            
            // Delegation
            delegationEnabled: true,
            maxDelegationDepth: 3
        };
        
        // Proposal types
        this.proposalTypes = {
            PARAMETER_CHANGE: {
                name: 'Parameter Change',
                description: 'Modify protocol parameters',
                execution: 'automatic',
                quorum: 0.10
            },
            TREASURY: {
                name: 'Treasury Allocation',
                description: 'Allocate funds from treasury',
                execution: 'manual',
                quorum: 0.15
            },
            UPGRADE: {
                name: 'Protocol Upgrade',
                description: 'Upgrade smart contracts',
                execution: 'timelock',
                quorum: 0.20
            },
            MEMBERSHIP: {
                name: 'Membership Change',
                description: 'Add/remove DAO members',
                execution: 'manual',
                quorum: 0.25
            },
            EMERGENCY: {
                name: 'Emergency Action',
                description: 'Critical protocol actions',
                execution: 'immediate',
                quorum: 0.30,
                votingPeriod: 24 * 60 * 60 * 1000 // 24 hours
            }
        };
        
        // DAO Treasury
        this.treasury = {
            balances: {
                XRP: 0,
                SKYIVY: 0,
                SKYLOCKR: 0,
                BTC: 0
            },
            allocations: {
                ecosystem: 0.30,
                development: 0.25,
                marketing: 0.15,
                reserves: 0.20,
                operations: 0.10
            },
            transactions: []
        };
        
        // Membership tiers
        this.membershipTiers = {
            CITIZEN: {
                name: 'Citizen',
                minTokens: 1000,
                votingPower: 1,
                benefits: ['voting', 'proposals_view']
            },
            COUNCIL: {
                name: 'Council Member',
                minTokens: 100000,
                votingPower: 5,
                benefits: ['voting', 'proposals_create', 'discussions', 'delegation']
            },
            GUARDIAN: {
                name: 'Guardian',
                minTokens: 1000000,
                votingPower: 25,
                benefits: ['voting', 'proposals_create', 'discussions', 'delegation', 'veto', 'emergency']
            },
            FOUNDER: {
                name: 'Founding Member',
                minTokens: 10000000,
                votingPower: 100,
                benefits: ['all_privileges', 'multisig', 'treasury_access']
            }
        };
        
        // Data stores
        this.members = new Map();
        this.proposals = new Map();
        this.votes = new Map();
        this.delegations = new Map();
        this.executions = new Map();
    }
    
    async initialize() {
        console.log('🏛️ Initializing JamZia DAO...');
        console.log(`   Token: ${this.token}`);
        console.log(`   Quorum: ${this.parameters.quorum * 100}%`);
        console.log(`   Voting Period: ${this.parameters.votingPeriod / (24 * 60 * 60 * 1000)} days`);
        console.log('✅ JamZia DAO initialized');
    }
    
    // Membership management
    async registerMember(config) {
        const memberId = crypto.randomUUID();
        
        const tier = this.calculateTier(config.tokenBalance);
        
        const member = {
            id: memberId,
            wallet: config.walletAddress,
            profile: {
                username: config.username,
                avatar: config.avatar,
                bio: config.bio
            },
            tokenBalance: config.tokenBalance,
            tier: tier.name,
            votingPower: tier.votingPower,
            benefits: tier.benefits,
            delegations: {
                received: [],
                given: null
            },
            proposalsCreated: 0,
            votesCast: 0,
            joinedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            status: 'active'
        };
        
        this.members.set(memberId, member);
        
        return {
            memberId,
            tier: tier.name,
            votingPower: tier.votingPower
        };
    }
    
    calculateTier(balance) {
        const tiers = Object.entries(this.membershipTiers)
            .sort((a, b) => b[1].minTokens - a[1].minTokens);
        
        for (const [name, tier] of tiers) {
            if (balance >= tier.minTokens) {
                return { name, ...tier };
            }
        }
        
        return { name: 'Observer', votingPower: 0, benefits: [] };
    }
    
    async updateMemberBalance(memberId, newBalance) {
        const member = this.members.get(memberId);
        if (!member) throw new Error('Member not found');
        
        member.tokenBalance = newBalance;
        
        const newTier = this.calculateTier(newBalance);
        member.tier = newTier.name;
        member.votingPower = newTier.votingPower;
        member.benefits = newTier.benefits;
        
        return member;
    }
    
    // Delegation system
    async delegate(fromMemberId, toMemberId) {
        const fromMember = this.members.get(fromMemberId);
        const toMember = this.members.get(toMemberId);
        
        if (!fromMember || !toMember) {
            throw new Error('Invalid member(s)');
        }
        
        // Remove previous delegation
        if (fromMember.delegations.given) {
            const prevDelegate = this.members.get(fromMember.delegations.given);
            if (prevDelegate) {
                prevDelegate.delegations.received = prevDelegate.delegations.received
                    .filter(id => id !== fromMemberId);
            }
        }
        
        // Set new delegation
        fromMember.delegations.given = toMemberId;
        toMember.delegations.received.push(fromMemberId);
        
        // Calculate effective voting power
        const effectivePower = this.calculateEffectiveVotingPower(toMemberId);
        
        return {
            from: fromMemberId,
            to: toMemberId,
            delegatedPower: fromMember.votingPower,
            effectivePower
        };
    }
    
    calculateEffectiveVotingPower(memberId) {
        const member = this.members.get(memberId);
        if (!member) return 0;
        
        let power = member.votingPower;
        
        // Add delegated power
        for (const delegatorId of member.delegations.received) {
            const delegator = this.members.get(delegatorId);
            if (delegator) {
                power += delegator.votingPower;
            }
        }
        
        return power;
    }
    
    // Proposal creation
    async createProposal(config) {
        const proposer = this.members.get(config.proposerId);
        if (!proposer) throw new Error('Proposer not found');
        
        // Check if proposer can create proposals
        if (!proposer.benefits.includes('proposals_create')) {
            throw new Error('Insufficient privileges to create proposals');
        }
        
        // Check minimum balance
        if (proposer.tokenBalance < this.parameters.proposalThreshold) {
            throw new Error(`Need ${this.parameters.proposalThreshold} SKYIVY to create proposal`);
        }
        
        const proposalType = this.proposalTypes[config.type];
        if (!proposalType) throw new Error('Invalid proposal type');
        
        const proposalId = crypto.randomUUID();
        
        const proposal = {
            id: proposalId,
            type: config.type,
            title: config.title,
            description: config.description,
            proposer: config.proposerId,
            parameters: config.parameters || {},
            
            // Voting
            votes: {
                for: 0,
                against: 0,
                abstain: 0
            },
            voters: new Map(),
            
            // Timing
            createdAt: new Date().toISOString(),
            votingEnds: new Date(Date.now() + 
                (proposalType.votingPeriod || this.parameters.votingPeriod)).toISOString(),
            
            // Status
            status: 'active',
            executed: false,
            executionTx: null,
            
            // Results
            result: null,
            quorumReached: false
        };
        
        this.proposals.set(proposalId, proposal);
        
        // Update proposer stats
        proposer.proposalsCreated += 1;
        
        return proposal;
    }
    
    // Voting
    async vote(memberId, proposalId, voteType, votingPower = null) {
        const member = this.members.get(memberId);
        if (!member) throw new Error('Member not found');
        
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        
        // Check if voting is still open
        if (new Date() > new Date(proposal.votingEnds)) {
            throw new Error('Voting period has ended');
        }
        
        if (proposal.status !== 'active') {
            throw new Error('Proposal is not active');
        }
        
        // Calculate voting power
        const power = votingPower || this.calculateEffectiveVotingPower(memberId);
        
        // Remove previous vote if exists
        if (proposal.voters.has(memberId)) {
            const prevVote = proposal.voters.get(memberId);
            proposal.votes[prevVote.type] -= prevVote.power;
        }
        
        // Record new vote
        proposal.votes[voteType] += power;
        proposal.voters.set(memberId, {
            type: voteType,
            power,
            timestamp: new Date().toISOString()
        });
        
        // Update member stats
        member.votesCast += 1;
        member.lastActive = new Date().toISOString();
        
        // Check if quorum reached
        const totalSupply = 1000000000; // 1 Billion SKYIVY
        const totalVotes = proposal.votes.for + proposal.votes.against + proposal.votes.abstain;
        proposal.quorumReached = (totalVotes / totalSupply) >= this.parameters.quorum;
        
        return {
            proposalId,
            voteType,
            votingPower: power,
            totalFor: proposal.votes.for,
            totalAgainst: proposal.votes.against,
            quorumReached: proposal.quorumReached
        };
    }
    
    // Finalize proposal
    async finalizeProposal(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        
        if (proposal.status !== 'active') {
            throw new Error('Proposal already finalized');
        }
        
        // Check if voting period ended
        if (new Date() < new Date(proposal.votingEnds)) {
            throw new Error('Voting period still active');
        }
        
        const totalVotes = proposal.votes.for + proposal.votes.against;
        const forPercentage = totalVotes > 0 ? proposal.votes.for / totalVotes : 0;
        
        // Determine result
        let result = 'rejected';
        
        if (proposal.quorumReached && forPercentage >= this.parameters.approvalThreshold) {
            result = 'passed';
            proposal.status = 'passed';
        } else {
            proposal.status = 'rejected';
        }
        
        proposal.result = result;
        proposal.finalizedAt = new Date().toISOString();
        
        // Schedule execution if passed
        if (result === 'passed') {
            const proposalType = this.proposalTypes[proposal.type];
            
            if (proposalType.execution === 'automatic') {
                await this.executeProposal(proposalId);
            } else if (proposalType.execution === 'timelock') {
                proposal.executionScheduled = new Date(Date.now() + 
                    this.parameters.executionDelay).toISOString();
            }
        }
        
        return {
            proposalId,
            result,
            votesFor: proposal.votes.for,
            votesAgainst: proposal.votes.against,
            quorumReached: proposal.quorumReached,
            approvalPercentage: (forPercentage * 100).toFixed(2) + '%'
        };
    }
    
    // Execute proposal
    async executeProposal(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        
        if (proposal.executed) {
            throw new Error('Proposal already executed');
        }
        
        if (proposal.result !== 'passed') {
            throw new Error('Proposal did not pass');
        }
        
        console.log(`⚡ Executing proposal: ${proposal.title}`);
        
        let executionResult;
        
        switch (proposal.type) {
            case 'PARAMETER_CHANGE':
                executionResult = await this.executeParameterChange(proposal);
                break;
            case 'TREASURY':
                executionResult = await this.executeTreasuryAllocation(proposal);
                break;
            case 'UPGRADE':
                executionResult = await this.executeProtocolUpgrade(proposal);
                break;
            case 'MEMBERSHIP':
                executionResult = await this.executeMembershipChange(proposal);
                break;
            case 'EMERGENCY':
                executionResult = await this.executeEmergencyAction(proposal);
                break;
            default:
                throw new Error('Unknown proposal type');
        }
        
        proposal.executed = true;
        proposal.executedAt = new Date().toISOString();
        proposal.executionResult = executionResult;
        
        this.executions.set(proposalId, {
            proposalId,
            executedAt: proposal.executedAt,
            result: executionResult
        });
        
        return executionResult;
    }
    
    async executeParameterChange(proposal) {
        const { parameter, value } = proposal.parameters;
        
        if (this.parameters[parameter] !== undefined) {
            this.parameters[parameter] = value;
            console.log(`   Updated parameter: ${parameter} = ${value}`);
        }
        
        return { parameter, newValue: value };
    }
    
    async executeTreasuryAllocation(proposal) {
        const { recipient, amount, token, purpose } = proposal.parameters;
        
        if (this.treasury.balances[token] < amount) {
            throw new Error('Insufficient treasury balance');
        }
        
        this.treasury.balances[token] -= amount;
        
        const allocation = {
            id: crypto.randomUUID(),
            proposalId: proposal.id,
            recipient,
            amount,
            token,
            purpose,
            executedAt: new Date().toISOString()
        };
        
        this.treasury.transactions.push(allocation);
        
        console.log(`   Allocated ${amount} ${token} to ${recipient}`);
        
        return allocation;
    }
    
    async executeProtocolUpgrade(proposal) {
        const { contract, newImplementation } = proposal.parameters;
        
        console.log(`   Upgrading ${contract} to ${newImplementation}`);
        
        // In production: Would execute actual contract upgrade
        
        return {
            contract,
            newImplementation,
            upgradeScheduled: new Date(Date.now() + this.parameters.executionDelay).toISOString()
        };
    }
    
    async executeMembershipChange(proposal) {
        const { action, memberId, newTier } = proposal.parameters;
        
        if (action === 'promote') {
            const member = this.members.get(memberId);
            if (member) {
                member.tier = newTier;
                console.log(`   Promoted member ${memberId} to ${newTier}`);
            }
        } else if (action === 'remove') {
            this.members.delete(memberId);
            console.log(`   Removed member ${memberId}`);
        }
        
        return { action, memberId, newTier };
    }
    
    async executeEmergencyAction(proposal) {
        const { action, parameters } = proposal.parameters;
        
        console.log(`   Executing emergency action: ${action}`);
        
        // Emergency actions execute immediately
        
        return { action, parameters, executed: true };
    }
    
    // Treasury management
    async depositToTreasury(token, amount, from) {
        this.treasury.balances[token] = (this.treasury.balances[token] || 0) + amount;
        
        this.treasury.transactions.push({
            id: crypto.randomUUID(),
            type: 'deposit',
            token,
            amount,
            from,
            timestamp: new Date().toISOString()
        });
        
        return {
            token,
            amount,
            newBalance: this.treasury.balances[token]
        };
    }
    
    // Get DAO stats
    getDAOStats() {
        const members = Array.from(this.members.values());
        const proposals = Array.from(this.proposals.values());
        
        return {
            totalMembers: members.length,
            byTier: {
                citizen: members.filter(m => m.tier === 'Citizen').length,
                council: members.filter(m => m.tier === 'Council Member').length,
                guardian: members.filter(m => m.tier === 'Guardian').length,
                founder: members.filter(m => m.tier === 'Founding Member').length
            },
            totalProposals: proposals.length,
            activeProposals: proposals.filter(p => p.status === 'active').length,
            passedProposals: proposals.filter(p => p.status === 'passed').length,
            executedProposals: proposals.filter(p => p.executed).length,
            treasury: this.treasury.balances,
            parameters: this.parameters,
            totalVotingPower: members.reduce((sum, m) => sum + m.votingPower, 0)
        };
    }
    
    // Get member dashboard
    getMemberDashboard(memberId) {
        const member = this.members.get(memberId);
        if (!member) throw new Error('Member not found');
        
        const memberProposals = Array.from(this.proposals.values())
            .filter(p => p.proposer === memberId);
        
        const memberVotes = Array.from(this.proposals.values())
            .filter(p => p.voters.has(memberId));
        
        return {
            profile: member.profile,
            tier: member.tier,
            votingPower: member.votingPower,
            effectiveVotingPower: this.calculateEffectiveVotingPower(memberId),
            tokenBalance: member.tokenBalance,
            delegations: member.delegations,
            stats: {
                proposalsCreated: member.proposalsCreated,
                votesCast: member.votesCast,
                joinedAt: member.joinedAt
            },
            proposals: memberProposals,
            votes: memberVotes.map(p => ({
                proposalId: p.id,
                vote: p.voters.get(memberId)
            }))
        };
    }
    
    // Get proposal details
    getProposal(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        
        const totalVotes = proposal.votes.for + proposal.votes.against + proposal.votes.abstain;
        const forPercentage = totalVotes > 0 ? (proposal.votes.for / totalVotes * 100).toFixed(2) : 0;
        const againstPercentage = totalVotes > 0 ? (proposal.votes.against / totalVotes * 100).toFixed(2) : 0;
        
        return {
            ...proposal,
            results: {
                totalVotes,
                for: proposal.votes.for,
                against: proposal.votes.against,
                abstain: proposal.votes.abstain,
                forPercentage: forPercentage + '%',
                againstPercentage: againstPercentage + '%',
                quorumReached: proposal.quorumReached
            },
            voterCount: proposal.voters.size,
            timeRemaining: proposal.status === 'active' 
                ? Math.max(0, new Date(proposal.votingEnds) - new Date())
                : 0
        };
    }
}

module.exports = JamZiaDAO;
