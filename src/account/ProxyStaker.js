import AccountId from "./AccountId";
import Hbar from "../Hbar";
import proto from "@hashgraph/proto";

/**
 * An account, and the amount that it sends or receives during a cryptocurrency transfer.
 */
export default class ProxyStaker {
    /**
     * @param {object} properties
     * @param {AccountId} properties.accountId
     * @param {Hbar} properties.amount
     */
    constructor(properties) {
        /**
         * The Account ID that sends or receives cryptocurrency.
         *
         * @type {AccountId}
         */
        this.accountId = properties.accountId;

        /**
         * The amount of tinybars that the account sends(negative) or receives(positive).
         *
         * @type {Hbar}
         */
        this.amount = properties.amount;
    }

    /**
     * @param {proto.IProxyStaker} transfer
     * @returns {ProxyStaker}
     */
    static _fromProtobuf(transfer) {
        return new ProxyStaker({
            // @ts-ignore
            accountId: AccountId._fromProtobuf(transfer.accountID),
            amount: Hbar.fromTinybars(transfer.amount ?? 0),
        });
    }

    /**
     * @returns {proto.IAccountAmount}
     */
    _toProtobuf() {
        return {
            accountID: this.accountId._toProtobuf(),
            amount: this.amount._toProtobuf(),
        };
    }
}