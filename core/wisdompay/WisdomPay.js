/**
 * WisdomPay Payment System
 * JamZia Networks™ - Ad9x Holdings, LLC
 * 
 * Cross-border payment solution built on XRP Ledger
 * Features: Instant settlements, multi-currency, debit cards, cash back
 * Exclusive for JamZia white-label platforms
 */

const crypto = require('crypto');

class WisdomPay {
    constructor(config = {}) {
        this.name = 'WisdomPay';
        this.version = '1.0.0';
        this.network = config.network || 'mainnet';
        this.xrplClient = config.xrplClient || null;
        
        // Supported currencies
        this.currencies = {
            crypto: ['XRP', 'BTC', 'SKYIVY', 'SKYLOCKR'],
            fiat: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SGD', 'HKD'],
            stablecoins: ['USDC', 'USDT', 'RLUSD']
        };
        
        // Exchange rates (would be fetched from oracle in production)
        this.exchangeRates = new Map();
        
        // Fee structure - No tax income structure
        this.fees = {
            domestic: {
                percentage: 0.005,  // 0.5%
                minimum: 0.10,      // $0.10
                maximum: 25.00      // $25.00
            },
            international: {
                percentage: 0.01,   // 1%
                minimum: 0.50,      // $0.50
                maximum: 100.00     // $100.00
            },
            crypto: {
                percentage: 0.002,  // 0.2%
                minimum: 0.001,     // Min crypto amount
                maximum: 50.00      // $50 equivalent
            },
            conversion: {
                percentage: 0.005,  // 0.5% conversion fee
                spread: 0.002       // 0.2% spread
            }
        };
        
        // Cross-border corridors
        this.corridors = {
            'USD-EUR': { rate: 0.92, fee: 0.005, speed: 'instant' },
            'USD-GBP': { rate: 0.79, fee: 0.005, speed: 'instant' },
            'USD-JPY': { rate: 150.25, fee: 0.006, speed: 'instant' },
            'EUR-GBP': { rate: 0.86, fee: 0.004, speed: 'instant' },
            'EUR-JPY': { rate: 163.50, fee: 0.006, speed: 'instant' },
            'GBP-JPY': { rate: 190.20, fee: 0.006, speed: 'instant' },
            'XRP-USD': { rate: null, fee: 0.002, speed: '3-5s' },
            'BTC-USD': { rate: null, fee: 0.005, speed: '10-60m' }
        };
        
        // Payment methods
        this.paymentMethods = {
            bank_transfer: {
                name: 'Bank Transfer (ACH/SEPA)',
                processingTime: '1-3 business days',
                fee: 0
            },
            wire: {
                name: 'Wire Transfer',
                processingTime: 'Same day',
                fee: 15
            },
            card: {
                name: 'Debit/Credit Card',
                processingTime: 'Instant',
                fee: 0.025
            },
            crypto: {
                name: 'Cryptocurrency',
                processingTime: '3-5 seconds (XRP)',
                fee: 0.002
            },
            instant: {
                name: 'WisdomPay Instant',
                processingTime: 'Instant',
                fee: 0.005
            }
        };
        
        // Accounts
        this.accounts = new Map();
        this.transactions = new Map();
        this.invoices = new Map();
        this.subscriptions = new Map();
        
        // Cash back program
        this.cashback = {
            enabled: true,
            rates: {
                standard: 0.01,    // 1% for standard users
                premium: 0.025,    // 2.5% for premium
                business: 0.015    // 1.5% for business
            },
            tiers: {
                bronze: { minSpend: 0, rate: 0.01 },
                silver: { minSpend: 1000, rate: 0.015 },
                gold: { minSpend: 5000, rate: 0.02 },
                platinum: { minSpend: 20000, rate: 0.03 }
            }
        };
        
        // Debit card program
        this.debitCards = new Map();
        
        // White label configurations
        this.whiteLabels = new Map();
    }
    
    async initialize() {
        console.log('💳 Initializing WisdomPay...');
        console.log(`   Network: ${this.network}`);
        console.log(`   Supported Currencies: ${[...this.currencies.crypto, ...this.currencies.fiat].join(', ')}`);
        console.log('✅ WisdomPay initialized');
    }
    
    // Account Management
    async createAccount(config) {
        const accountId = crypto.randomUUID();
        
        const account = {
            id: accountId,
            type: config.type || 'personal', // personal, business, enterprise
            email: config.email,
            profile: {
                firstName: config.firstName,
                lastName: config.lastName,
                businessName: config.businessName,
                country: config.country,
                timezone: config.timezone || 'UTC'
            },
            wallets: {
                xrp: config.xrpAddress || null,
                btc: config.btcAddress || null
            },
            balances: {
                USD: 0,
                EUR: 0,
                GBP: 0,
                XRP: 0,
                SKYIVY: 0,
                SKYLOCKR: 0
            },
            limits: this.getAccountLimits(config.type),
            verification: {
                level: 0, // 0-3 (0=email, 1=identity, 2=address, 3=enhanced)
                status: 'pending'
            },
            cashbackTier: 'bronze',
            totalCashbackEarned: 0,
            totalVolume: 0,
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        
        this.accounts.set(accountId, account);
        
        return {
            accountId,
            apiKey: crypto.randomBytes(32).toString('hex'),
            apiSecret: crypto.randomBytes(64).toString('hex')
        };
    }
    
    getAccountLimits(type) {
        const limits = {
            personal: {
                daily: 10000,
                monthly: 50000,
                single: 5000,
                crypto: 25000
            },
            business: {
                daily: 100000,
                monthly: 500000,
                single: 50000,
                crypto: 250000
            },
            enterprise: {
                daily: 1000000,
                monthly: 10000000,
                single: 500000,
                crypto: 5000000
            }
        };
        return limits[type] || limits.personal;
    }
    
    // Payment Processing
    async createPayment(config) {
        const {
            fromAccountId,
            toAccountId,
            amount,
            currency,
            destinationCurrency,
            paymentMethod,
            memo = '',
            metadata = {}
        } = config;
        
        const fromAccount = this.accounts.get(fromAccountId);
        if (!fromAccount) throw new Error('Sender account not found');
        
        const paymentId = crypto.randomUUID();
        
        // Calculate fees
        const isInternational = fromAccount.profile.country !== 
            (this.accounts.get(toAccountId)?.profile.country || fromAccount.profile.country);
        
        const feeStructure = isInternational ? this.fees.international : this.fees.domestic;
        const fee = Math.min(
            Math.max(amount * feeStructure.percentage, feeStructure.minimum),
            feeStructure.maximum
        );
        
        // Currency conversion if needed
        let convertedAmount = amount;
        let conversionFee = 0;
        
        if (destinationCurrency && destinationCurrency !== currency) {
            const rate = this.getExchangeRate(currency, destinationCurrency);
            convertedAmount = amount * rate;
            conversionFee = amount * this.fees.conversion.percentage;
        }
        
        const totalFee = fee + conversionFee;
        const netAmount = convertedAmount - totalFee;
        
        // Calculate cashback
        const cashbackRate = this.getCashbackRate(fromAccount);
        const cashback = netAmount * cashbackRate;
        
        const payment = {
            id: paymentId,
            type: 'payment',
            from: fromAccountId,
            to: toAccountId,
            amount,
            currency,
            destinationAmount: convertedAmount,
            destinationCurrency: destinationCurrency || currency,
            fee: totalFee.toFixed(6),
            netAmount: netAmount.toFixed(6),
            cashback: cashback.toFixed(6),
            paymentMethod,
            status: 'pending',
            memo,
            metadata: {
                ...metadata,
                isInternational,
                exchangeRate: destinationCurrency && destinationCurrency !== currency 
                    ? this.getExchangeRate(currency, destinationCurrency)
                    : 1
            },
            createdAt: new Date().toISOString(),
            processedAt: null,
            completedAt: null
        };
        
        this.transactions.set(paymentId, payment);
        
        return payment;
    }
    
    async processPayment(paymentId) {
        const payment = this.transactions.get(paymentId);
        if (!payment) throw new Error('Payment not found');
        
        const fromAccount = this.accounts.get(payment.from);
        
        // Check balance
        if (fromAccount.balances[payment.currency] < parseFloat(payment.amount)) {
            payment.status = 'failed';
            payment.failureReason = 'Insufficient balance';
            return payment;
        }
        
        // Deduct from sender
        fromAccount.balances[payment.currency] -= parseFloat(payment.amount);
        
        // Add to recipient
        const toAccount = this.accounts.get(payment.to);
        if (toAccount) {
            const destCurrency = payment.destinationCurrency;
            toAccount.balances[destCurrency] = (toAccount.balances[destCurrency] || 0) 
                + parseFloat(payment.netAmount);
        }
        
        // Update payment status
        payment.status = 'completed';
        payment.processedAt = new Date().toISOString();
        payment.completedAt = new Date().toISOString();
        
        // Award cashback
        fromAccount.totalCashbackEarned += parseFloat(payment.cashback);
        fromAccount.balances.SKYLOCKR = (fromAccount.balances.SKYLOCKR || 0) 
            + parseFloat(payment.cashback);
        
        // Update volume stats
        fromAccount.totalVolume += parseFloat(payment.amount);
        this.updateCashbackTier(fromAccount);
        
        return payment;
    }
    
    // Cross-border payment
    async createCrossBorderPayment(config) {
        const {
            fromAccountId,
            recipient,
            sendAmount,
            sendCurrency,
            receiveCurrency,
            recipientBank
        } = config;
        
        const account = this.accounts.get(fromAccountId);
        if (!account) throw new Error('Account not found');
        
        const paymentId = crypto.randomUUID();
        
        // Get corridor info
        const corridorKey = `${sendCurrency}-${receiveCurrency}`;
        const corridor = this.corridors[corridorKey] || {
            rate: this.getExchangeRate(sendCurrency, receiveCurrency),
            fee: this.fees.international.percentage,
            speed: 'instant'
        };
        
        const exchangeRate = corridor.rate;
        const receiveAmount = sendAmount * exchangeRate * (1 - corridor.fee);
        const fee = sendAmount * corridor.fee;
        
        const payment = {
            id: paymentId,
            type: 'cross_border',
            from: fromAccountId,
            recipient: {
                name: recipient.name,
                accountNumber: recipient.accountNumber,
                bank: recipientBank,
                country: recipient.country
            },
            sendAmount,
            sendCurrency,
            receiveAmount: receiveAmount.toFixed(2),
            receiveCurrency,
            exchangeRate,
            fee: fee.toFixed(2),
            feeCurrency: sendCurrency,
            settlementTime: corridor.speed,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        this.transactions.set(paymentId, payment);
        
        return payment;
    }
    
    // Crypto payment via XRP Ledger
    async createCryptoPayment(config) {
        const {
            fromWallet,
            toAddress,
            amount,
            token,
            memo = ''
        } = config;
        
        const paymentId = crypto.randomUUID();
        
        let transaction;
        
        if (token === 'XRP') {
            transaction = {
                TransactionType: 'Payment',
                Account: fromWallet,
                Destination: toAddress,
                Amount: (amount * 1000000).toString(), // drops
                Memos: memo ? [{
                    Memo: {
                        MemoData: Buffer.from(memo).toString('hex')
                    }
                }] : undefined
            };
        } else {
            // Issued currency
            const currencyCodes = {
                SKYIVY: '534B594956590000',
                SKYLOCKR: '534B594C4F434B52'
            };
            
            transaction = {
                TransactionType: 'Payment',
                Account: fromWallet,
                Destination: toAddress,
                Amount: {
                    currency: currencyCodes[token],
                    issuer: this.getIssuer(token),
                    value: amount.toString()
                }
            };
        }
        
        const payment = {
            id: paymentId,
            type: 'crypto',
            from: fromWallet,
            to: toAddress,
            amount,
            token,
            fee: (token === 'XRP' ? 0.000012 : 0.0001), // XRP drops or IOU fee
            xrplTransaction: transaction,
            status: 'pending',
            memo,
            createdAt: new Date().toISOString()
        };
        
        this.transactions.set(paymentId, payment);
        
        return payment;
    }
    
    // Invoice system
    async createInvoice(config) {
        const invoiceId = crypto.randomUUID();
        
        const invoice = {
            id: invoiceId,
            merchantId: config.merchantId,
            customerEmail: config.customerEmail,
            items: config.items || [],
            subtotal: config.amount,
            tax: config.tax || 0,
            total: config.amount + (config.tax || 0),
            currency: config.currency,
            description: config.description,
            dueDate: config.dueDate,
            status: 'pending',
            paymentLink: `https://pay.wisdompay.io/invoice/${invoiceId}`,
            qrCode: this.generateInvoiceQR(invoiceId),
            createdAt: new Date().toISOString(),
            paidAt: null
        };
        
        this.invoices.set(invoiceId, invoice);
        
        return invoice;
    }
    
    generateInvoiceQR(invoiceId) {
        // Would generate actual QR code in production
        return `wisdompay://invoice/${invoiceId}`;
    }
    
    // Subscription management
    async createSubscription(config) {
        const subscriptionId = crypto.randomUUID();
        
        const subscription = {
            id: subscriptionId,
            merchantId: config.merchantId,
            customerId: config.customerId,
            plan: {
                name: config.planName,
                amount: config.amount,
                currency: config.currency,
                interval: config.interval // daily, weekly, monthly, yearly
            },
            status: 'active',
            startDate: new Date().toISOString(),
            nextBillingDate: this.calculateNextBillingDate(config.interval),
            totalPayments: 0,
            totalAmount: 0,
            payments: []
        };
        
        this.subscriptions.set(subscriptionId, subscription);
        
        return subscription;
    }
    
    calculateNextBillingDate(interval) {
        const date = new Date();
        switch (interval) {
            case 'daily': date.setDate(date.getDate() + 1); break;
            case 'weekly': date.setDate(date.getDate() + 7); break;
            case 'monthly': date.setMonth(date.getMonth() + 1); break;
            case 'yearly': date.setFullYear(date.getFullYear() + 1); break;
        }
        return date.toISOString();
    }
    
    // Debit Card Management
    async issueDebitCard(accountId, tier = 'standard') {
        const account = this.accounts.get(accountId);
        if (!account) throw new Error('Account not found');
        
        const cardId = crypto.randomUUID();
        
        const tiers = {
            standard: {
                name: 'WisdomPay Blue',
                cashback: 0.01,
                monthlyFee: 0,
                atmFee: 2.50,
                fxFee: 0.015,
                color: '#1877F2'
            },
            premium: {
                name: 'WisdomPay Gold',
                cashback: 0.025,
                monthlyFee: 9.99,
                atmFee: 0,
                fxFee: 0,
                color: '#FFD700',
                perks: ['lounge_access', 'travel_insurance']
            },
            black: {
                name: 'WisdomPay Black',
                cashback: 0.05,
                monthlyFee: 29.99,
                atmFee: 0,
                fxFee: 0,
                color: '#000000',
                perks: ['unlimited_lounge', 'concierge', 'crypto_rewards']
            }
        };
        
        const cardConfig = tiers[tier];
        
        const card = {
            id: cardId,
            accountId,
            tier,
            ...cardConfig,
            number: this.generateCardNumber(),
            expiry: this.generateCardExpiry(),
            cvv: this.generateCVV(),
            pin: null, // Set on activation
            status: 'issued',
            limits: {
                daily: tier === 'black' ? 100000 : tier === 'premium' ? 50000 : 10000,
                monthly: tier === 'black' ? 500000 : tier === 'premium' ? 200000 : 50000,
                atm: tier === 'black' ? 5000 : tier === 'premium' ? 3000 : 1000
            },
            transactions: [],
            totalSpent: 0,
            totalCashback: 0,
            issuedAt: new Date().toISOString(),
            activatedAt: null
        };
        
        this.debitCards.set(cardId, card);
        
        return {
            cardId,
            last4: card.number.slice(-4),
            expiry: card.expiry,
            tier: card.name
        };
    }
    
    generateCardNumber() {
        return '4' + Array(15).fill(0).map(() => Math.floor(Math.random() * 10)).join('');
    }
    
    generateCardExpiry() {
        const date = new Date();
        date.setFullYear(date.getFullYear() + 3);
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
    }
    
    generateCVV() {
        return String(Math.floor(Math.random() * 900) + 100);
    }
    
    // Cashback system
    getCashbackRate(account) {
        const tier = this.cashback.tiers[account.cashbackTier];
        return tier ? tier.rate : this.cashback.tiers.bronze.rate;
    }
    
    updateCashbackTier(account) {
        const tiers = Object.entries(this.cashback.tiers)
            .sort((a, b) => b[1].minSpend - a[1].minSpend);
        
        for (const [tierName, tier] of tiers) {
            if (account.totalVolume >= tier.minSpend) {
                account.cashbackTier = tierName;
                break;
            }
        }
    }
    
    // Exchange rate
    getExchangeRate(from, to) {
        const key = `${from}-${to}`;
        if (this.corridors[key]) {
            return this.corridors[key].rate;
        }
        
        // Reverse rate
        const reverseKey = `${to}-${from}`;
        if (this.corridors[reverseKey]) {
            return 1 / this.corridors[reverseKey].rate;
        }
        
        // Default: would fetch from oracle
        return 1;
    }
    
    getIssuer(token) {
        const issuers = {
            SKYIVY: process.env.SKYIVY_ISSUER,
            SKYLOCKR: process.env.SKYLOCKR_ISSUER
        };
        return issuers[token];
    }
    
    // White label integration
    registerWhiteLabel(config) {
        const whiteLabelId = crypto.randomUUID();
        
        const whiteLabel = {
            id: whiteLabelId,
            name: config.name,
            domain: config.domain,
            branding: {
                logo: config.logo,
                colors: config.colors,
                fonts: config.fonts
            },
            supportedCurrencies: config.supportedCurrencies || ['USD', 'EUR', 'XRP'],
            feeOverride: config.feeOverride || null,
            webhookUrl: config.webhookUrl,
            apiKey: crypto.randomBytes(32).toString('hex'),
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        
        this.whiteLabels.set(whiteLabelId, whiteLabel);
        
        return {
            ...whiteLabel,
            apiSecret: crypto.randomBytes(64).toString('hex')
        };
    }
    
    // Analytics
    getDashboard(accountId) {
        const account = this.accounts.get(accountId);
        if (!account) throw new Error('Account not found');
        
        const accountTxs = Array.from(this.transactions.values())
            .filter(t => t.from === accountId || t.to === accountId);
        
        return {
            account,
            balances: account.balances,
            stats: {
                totalTransactions: accountTxs.length,
                totalVolume: account.totalVolume.toFixed(2),
                totalCashback: account.totalCashbackEarned.toFixed(6),
                cashbackTier: account.cashbackTier,
                volumeToNextTier: this.getVolumeToNextTier(account)
            },
            recentTransactions: accountTxs.slice(-10).reverse(),
            cards: Array.from(this.debitCards.values())
                .filter(c => c.accountId === accountId),
            subscriptions: Array.from(this.subscriptions.values())
                .filter(s => s.customerId === accountId)
        };
    }
    
    getVolumeToNextTier(account) {
        const tiers = Object.entries(this.cashback.tiers)
            .sort((a, b) => a[1].minSpend - b[1].minSpend);
        
        const currentIndex = tiers.findIndex(t => t[0] === account.cashbackTier);
        const nextTier = tiers[currentIndex + 1];
        
        if (!nextTier) return 0;
        
        return nextTier[1].minSpend - account.totalVolume;
    }
    
    // Network stats
    getNetworkStats() {
        const allTxs = Array.from(this.transactions.values());
        
        return {
            totalAccounts: this.accounts.size,
            totalTransactions: allTxs.length,
            totalVolume: allTxs.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0).toFixed(2),
            totalCashbackDistributed: Array.from(this.accounts.values())
                .reduce((sum, a) => sum + a.totalCashbackEarned, 0).toFixed(6),
            activeDebitCards: Array.from(this.debitCards.values())
                .filter(c => c.status === 'active').length,
            supportedCurrencies: {
                crypto: this.currencies.crypto.length,
                fiat: this.currencies.fiat.length
            },
            corridors: Object.keys(this.corridors).length
        };
    }
}

module.exports = WisdomPay;
