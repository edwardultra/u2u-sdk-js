import AccountId from "../account/AccountId.js";
import AccountBalanceQuery from "../account/AccountBalanceQuery.js";
import Hbar from "../Hbar.js";
import Network from "./Network.js";
import MirrorNetwork from "./MirrorNetwork.js";
import PublicKey from "../PublicKey.js";
import PrivateKey from "../PrivateKey.js";
import LedgerId from "../LedgerId.js";

/**
 * @typedef {import("../channel/Channel.js").default} Channel
 * @typedef {import("../channel/MirrorChannel.js").default} MirrorChannel
 */

/**
 * @typedef {object} Operator
 * @property {string | PrivateKey} privateKey
 * @property {string | AccountId} accountId
 */

/**
 * @typedef {object} ClientOperator
 * @property {PublicKey} publicKey
 * @property {AccountId} accountId
 * @property {(message: Uint8Array) => Promise<Uint8Array>} transactionSigner
 */

/**
 * @typedef {object} ClientConfiguration
 * @property {{[key: string]: (string | AccountId)} | string} network
 * @property {string[] | string} [mirrorNetwork]
 * @property {Operator} [operator]
 */

/**
 * @typedef {"mainnet" | "testnet" | "previewnet"} NetworkName
 */

/**
 * @abstract
 * @template {Channel} ChannelT
 * @template {MirrorChannel} MirrorChannelT
 */
export default class Client {
    /**
     * @protected
     * @hideconstructor
     * @param {ClientConfiguration} [props]
     */
    constructor(props) {
        /**
         * List of mirror network URLs.
         *
         * @internal
         * @type {MirrorNetwork}
         */
        this._mirrorNetwork = new MirrorNetwork(
            this._createMirrorNetworkChannel()
        );

        /**
         * Map of node account ID (as a string)
         * to the node URL.
         *
         * @internal
         * @type {Network}
         */
        this._network = new Network(this._createNetworkChannel());

        /**
         * @internal
         * @type {?ClientOperator}
         */
        this._operator = null;

        /**
         * @private
         * @type {?Hbar}
         */
        this._defaultMaxTransactionFee = null;

        /**
         * @private
         * @type {Hbar}
         */
        this._maxQueryPayment = new Hbar(1);

        if (props != null) {
            if (props.operator != null) {
                this.setOperator(
                    props.operator.accountId,
                    props.operator.privateKey
                );
            }
        }

        this._signOnDemand = false;

        this._autoValidateChecksums = false;

        /** @type {number | null} */
        this._maxAttempts = null;

        /** @type {number} */
        this._minBackoff = 250;

        /** @type {number} */
        this._maxBackoff = 8000;

        this._defaultRegenerateTransactionId = true;

        this._requestTimeout = null;
    }

    /**
     * @deprecated
     * @param {NetworkName} networkName
     * @returns {this}
     */
    setNetworkName(networkName) {
        // uses custom NetworkName type
        // remove if phasing out set|get NetworkName
        console.warn("Deprecated: Use `setLedgerId` instead");
        return this.setLedgerId(networkName);
    }

    /**
     * @deprecated
     * @returns {string | null}
     */
    get networkName() {
        console.warn("Deprecated: Use `ledgerId` instead");
        return this.ledgerId != null ? this.ledgerId.toString() : null;
    }

    /**
     * @param {string|LedgerId} ledgerId
     * @returns {this}
     */
    setLedgerId(ledgerId) {
        this._network.setLedgerId(
            typeof ledgerId === "string"
                ? LedgerId.fromString(ledgerId)
                : ledgerId
        );

        return this;
    }

    /**
     * @returns {LedgerId | null}
     */
    get ledgerId() {
        return this._network._ledgerId != null ? this._network.ledgerId : null;
    }

    /**
     * @param {{[key: string]: (string | AccountId)} | string} network
     * @returns {void}
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setNetwork(network) {
        throw new Error("not implemented");
    }

    /**
     * @returns {{[key: string]: (string | AccountId)}}
     */
    get network() {
        return this._network.network;
    }

    /**
     * @param {string[] | string} mirrorNetwork
     * @returns {void}
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setMirrorNetwork(mirrorNetwork) {
        throw new Error("not implemented");
    }

    /**
     * @returns {string[]}
     */
    get mirrorNetwork() {
        return this._mirrorNetwork.network;
    }

    /**
     * @returns {boolean}
     */
    get signOnDemand() {
        return this._signOnDemand;
    }

    /**
     * @param {boolean} signOnDemand
     */
    setSignOnDemand(signOnDemand) {
        this._signOnDemand = signOnDemand;
    }

    /**
     * @returns {boolean}
     */
    isTransportSecurity() {
        return this._network.isTransportSecurity();
    }

    /**
     * @param {boolean} transportSecurity
     * @returns {this}
     */
    setTransportSecurity(transportSecurity) {
        this._network.setTransportSecurity(transportSecurity);
        return this;
    }

    /**
     * Set the account that will, by default, pay for transactions and queries built with this client.
     *
     * @param {AccountId | string} accountId
     * @param {PrivateKey | string} privateKey
     * @returns {this}
     */
    setOperator(accountId, privateKey) {
        const key =
            typeof privateKey === "string"
                ? PrivateKey.fromString(privateKey)
                : privateKey;

        return this.setOperatorWith(accountId, key.publicKey, (message) =>
            Promise.resolve(key.sign(message))
        );
    }

    /**
     * Sets the account that will, by default, pay for transactions and queries built with
     * this client.
     *
     * @param {AccountId | string} accountId
     * @param {PublicKey | string} publicKey
     * @param {(message: Uint8Array) => Promise<Uint8Array>} transactionSigner
     * @returns {this}
     */
    setOperatorWith(accountId, publicKey, transactionSigner) {
        const accountId_ =
            accountId instanceof AccountId
                ? accountId
                : AccountId.fromString(accountId);

        if (this._network._ledgerId != null) {
            accountId_.validateChecksum(this);
        }

        this._operator = {
            transactionSigner,

            accountId: accountId_,

            publicKey:
                publicKey instanceof PublicKey
                    ? publicKey
                    : PublicKey.fromString(publicKey),
        };

        return this;
    }

    /**
     * @param {boolean} value
     * @returns {this}
     */
    setAutoValidateChecksums(value) {
        this._autoValidateChecksums = value;
        return this;
    }

    /**
     * @returns {boolean}
     */
    isAutoValidateChecksumsEnabled() {
        return this._autoValidateChecksums;
    }

    /**
     * @returns {?AccountId}
     */
    get operatorAccountId() {
        return this._operator != null ? this._operator.accountId : null;
    }

    /**
     * @returns {?PublicKey}
     */
    get operatorPublicKey() {
        return this._operator != null ? this._operator.publicKey : null;
    }

    /**
     * @deprecated - Use `defaultMaxTransactionFee` instead
     * @returns {?Hbar}
     */
    get maxTransactionFee() {
        return this._defaultMaxTransactionFee;
    }

    /**
     * @deprecated - Use `setDefaultMaxTransactionFee()` instead
     * Set the maximum fee to be paid for transactions
     * executed by this client.
     * @param {Hbar} maxTransactionFee
     * @returns {this}
     */
    setMaxTransactionFee(maxTransactionFee) {
        this._defaultMaxTransactionFee = maxTransactionFee;
        return this;
    }

    /**
     * @returns {?Hbar}
     */
    get defaultMaxTransactionFee() {
        return this._defaultMaxTransactionFee;
    }

    /**
     * Set the defaultimum fee to be paid for transactions
     * executed by this client.
     *
     * @param {Hbar} defaultMaxTransactionFee
     * @returns {this}
     */
    setDefaultMaxTransactionFee(defaultMaxTransactionFee) {
        this._defaultMaxTransactionFee = defaultMaxTransactionFee;
        return this;
    }

    /**
     * @returns {boolean}
     */
    get defaultRegenerateTransactionId() {
        return this._defaultRegenerateTransactionId;
    }

    /**
     * Set if a new transaction ID should be generated when a `TRANSACTION_EXPIRED` status
     * is returned.
     *
     * @param {boolean} defaultRegenerateTransactionId
     * @returns {this}
     */
    setDefaultRegenerateTransactionId(defaultRegenerateTransactionId) {
        this._defaultRegenerateTransactionId = defaultRegenerateTransactionId;
        return this;
    }

    /**
     * @returns {Hbar}
     */
    get maxQueryPayment() {
        return this._maxQueryPayment;
    }

    /**
     * Set the maximum payment allowable for queries.
     *
     * @param {Hbar} maxQueryPayment
     * @returns {Client<ChannelT, MirrorChannelT>}
     */
    setMaxQueryPayment(maxQueryPayment) {
        this._maxQueryPayment = maxQueryPayment;
        return this;
    }

    /**
     * @returns {number}
     */
    get maxAttempts() {
        return this._maxAttempts != null ? this._maxAttempts : 10;
    }

    /**
     * @param {number} maxAttempts
     * @returns {this}
     */
    setMaxAttempts(maxAttempts) {
        this._maxAttempts = maxAttempts;
        return this;
    }

    /**
     * @returns {number}
     */
    get maxNodeAttempts() {
        return this._network.maxNodeAttempts;
    }

    /**
     * @param {number} maxNodeAttempts
     * @returns {this}
     */
    setMaxNodeAttempts(maxNodeAttempts) {
        this._network.setMaxNodeAttempts(maxNodeAttempts);
        return this;
    }

    /**
     * @returns {number}
     */
    get nodeWaitTime() {
        return this._network.minBackoff;
    }

    /**
     * @param {number} nodeWaitTime
     * @returns {this}
     */
    setNodeWaitTime(nodeWaitTime) {
        this._network.setMinBackoff(nodeWaitTime);
        return this;
    }

    /**
     * @returns {number}
     */
    get maxNodesPerTransaction() {
        return this._network.maxNodesPerTransaction;
    }

    /**
     * @param {number} maxNodesPerTransaction
     * @returns {this}
     */
    setMaxNodesPerTransaction(maxNodesPerTransaction) {
        this._network.setMaxNodesPerTransaction(maxNodesPerTransaction);
        return this;
    }

    /**
     * @param {?number} minBackoff
     * @returns {this}
     */
    setMinBackoff(minBackoff) {
        if (minBackoff == null) {
            throw new Error("minBackoff cannot be null.");
        }
        if (minBackoff > this._maxBackoff) {
            throw new Error("minBackoff cannot be larger than maxBackoff.");
        }
        this._minBackoff = minBackoff;
        return this;
    }

    /**
     * @returns {number}
     */
    get minBackoff() {
        return this._minBackoff;
    }

    /**
     * @param {?number} maxBackoff
     * @returns {this}
     */
    setMaxBackoff(maxBackoff) {
        if (maxBackoff == null) {
            throw new Error("maxBackoff cannot be null.");
        } else if (maxBackoff < this._minBackoff) {
            throw new Error("maxBackoff cannot be smaller than minBackoff.");
        }
        this._maxBackoff = maxBackoff;
        return this;
    }

    /**
     * @returns {number}
     */
    get maxBackoff() {
        return this._maxBackoff;
    }

    /**
     * @param {number} requestTimeout - Number of milliseconds
     * @returns {this}
     */
    setRequestTimeout(requestTimeout) {
        this._requestTimeout = requestTimeout;
        return this;
    }

    /**
     * @returns {?number}
     */
    get requestTimeout() {
        return this._requestTimeout;
    }

    /**
     * @param {AccountId | string} accountId
     */
    async ping(accountId) {
        try {
            await new AccountBalanceQuery({ accountId })
                .setNodeAccountIds([
                    accountId instanceof AccountId
                        ? accountId
                        : AccountId.fromString(accountId),
                ])
                .execute(this);
        } catch (_) {
            // Do nothing
        }
    }

    async pingAll() {
        for (const nodeAccountId of Object.values(this._network.network)) {
            await this.ping(nodeAccountId);
        }
    }

    /**
     * @returns {void}
     */
    close() {
        this._network.close();
        this._mirrorNetwork.close();
    }

    /**
     * @abstract
     * @returns {(address: string) => ChannelT}
     */
    _createNetworkChannel() {
        throw new Error("not implemented");
    }

    /**
     * @abstract
     * @returns {(address: string) => MirrorChannelT}
     */
    _createMirrorNetworkChannel() {
        throw new Error("not implemented");
    }
}
