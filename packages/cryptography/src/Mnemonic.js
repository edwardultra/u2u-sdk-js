import * as bip39 from "bip39";
import PrivateKey from "./PrivateKey.js";
import MnemonicValidationResult from "./MnemonicValidationResult.js";
import MnemonicValidationStatus from "./MnemonicValidationStatus.js";
import legacyWordList from "./legacyWordList.js";
import Long from "long";
import { HashAlgorithm } from "./primitive/hmac.js";
import * as pbkdf2 from "./primitive/pbkdf2.js";

/** result of `generateMnemonic()` */
export default class Mnemonic {
    /**
     * Recover a mnemonic from a list of 24 words.
     *
     * @param {string[]} words
     */
    constructor(words) {
        if (words.length === 22) {
            this._isLegacy = true;
        }

        /**
         * @type {string[]}
         */
        this.words = words;

        /**
         * @type {boolean}
         */
        this._isLegacy = false;
    }

    /**
     * Lazily generate the key, providing an optional passphrase to protect it with
     *
     * @param {string} passphrase
     * @returns {Promise<PrivateKey>}
     */
    toPrivateKey(passphrase) {
        return PrivateKey.fromMnemonic(this, passphrase);
    }

    /**
     * @returns {Promise<PrivateKey>}
     */
    async _legacyToPrivateKey() {
        const index = -1;

        const entropy = this._toLegacyEntropy();
        const password = new Uint8Array(entropy.length + 8);
        password.set(entropy, 0);

        const view = new DataView(
            password.buffer,
            password.byteOffset + entropy.length,
            8
        );
        view.setInt32(0, index);
        view.setInt32(4, index);

        const salt = Uint8Array.from([0xff]);

        const keyBytes = await pbkdf2.deriveKey(
            HashAlgorithm.Sha512,
            password,
            salt,
            2048,
            32
        );

        return PrivateKey.fromBytes(keyBytes);
    }

    /**
     * Generate a random 24-word mnemonic.
     *
     * If you are happy with the mnemonic produced you can call {@link .toPrivateKey} on the
     * returned object.
     *
     * This mnemonics that are compatible with the Android and iOS mobile wallets.
     *
     * **NOTE:** Mnemonics must be saved separately as they cannot be later recovered from a given
     * key.
     *
     * @returns {Mnemonic}
     */
    static generate() {
        // 256-bit entropy gives us 24 words
        return new Mnemonic(bip39.generateMnemonic(256).split(" "));
    }

    /**
     * Recover a mnemonic phrase from a string, splitting on spaces.
     *
     * @param {string} mnemonic
     * @returns {Mnemonic}
     */
    static fromString(mnemonic) {
        return new Mnemonic(mnemonic.split(" "));
    }

    /**
     * Validate that this is a valid BIP-39 mnemonic as generated by BIP-39's rules.
     * <p>
     * Technically, invalid mnemonics can still be used to generate valid private keys,
     * but if they became invalid due to user error then it will be difficult for the user
     * to tell the difference unless they compare the generated keys.
     * <p>
     * During validation, the following conditions are checked in order:
     * <ol>
     *     <li>{@link this.words.length} == 24</li>
     *     <li>All strings in {@link this.words} exist in the BIP-39 standard English word list (no normalization is done).</li>
     *     <li>The calculated checksum for the mnemonic equals the checksum encoded in the mnemonic.</li>
     * </ol>
     * <p>
     *
     * @returns {MnemonicValidationResult} the result of the validation.
     * @see {@link https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki | Bitcoin Improvement Project proposal 39 (BIP-39) }
     * @see {@link https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt | BIP-39 English word list }
     */
    validate() {
        if (this._isLegacy) {
            return this._validateLegacy();
        }

        if (this.words.length !== 24) {
            return new MnemonicValidationResult(
                MnemonicValidationStatus.BadLength,
                undefined
            );
        }

        const unknownIndices = this.words.reduce(
            (
                /**
                 * @type {number[]}
                 */
                unknowns,
                /**
                 * @type {string}
                 */
                word,
                /**
                 * @type {number}
                 */
                index
            ) =>
                // eslint-disable-next-line implicit-arrow-linebreak
                bip39.wordlists.english.includes(word)
                    ? unknowns
                    : [...unknowns, index],
            []
        );

        if (unknownIndices.length > 0) {
            return new MnemonicValidationResult(
                MnemonicValidationStatus.UnknownWords,
                unknownIndices
            );
        }

        // this would cover length and unknown words but it only gives us a `boolean`
        // we validate those first and then let `bip39` do the non-trivial checksum verification
        if (
            !bip39.validateMnemonic(
                this.words.join(" "),
                bip39.wordlists.english
            )
        ) {
            return new MnemonicValidationResult(
                MnemonicValidationStatus.ChecksumMismatch,
                undefined
            );
        }

        return new MnemonicValidationResult(
            MnemonicValidationStatus.Ok,
            undefined
        );
    }

    /**
     * Validate that this is a valid legacy mnemonic as generated by the Android and iOS wallets.
     * <p>
     * Technically, invalid mnemonics can still be used to generate valid private keys,
     * but if they became invalid due to user error then it will be difficult for the user
     * to tell the difference unless they compare the generated keys.
     * <p>
     * During validation, the following conditions are checked in order:
     * <ol>
     *     <li>{@link this.words.length} == 22</li>
     *     <li>All strings in {@link this.words} exist in the legacy word list (no normalization is done).</li>
     *     <li>The calculated checksum for the mnemonic equals the checksum encoded in the mnemonic.</li>
     * </ol>
     * <p>
     *
     * @returns {MnemonicValidationResult} the result of the validation.
     */
    _validateLegacy() {
        if (!this._isLegacy) {
            throw new Error(
                "`validateLegacy` cannot be called on non-legacy mnemonics"
            );
        }

        const unknownIndices = this.words.reduce(
            (
                /**
                 * @type {number[]}
                 */
                unknowns,
                /**
                 * @type {string}
                 */
                word,
                /**
                 * @type {number}
                 */
                index
            ) =>
                // eslint-disable-next-line implicit-arrow-linebreak
                legacyWordList.includes(word) ? unknowns : [...unknowns, index],
            []
        );

        if (unknownIndices.length > 0) {
            return new MnemonicValidationResult(
                MnemonicValidationStatus.UnknownLegacyWords,
                unknownIndices
            );
        }

        // Checksum validation
        // We already made sure all the words are valid so if this is null we know it was due to the checksum
        try {
            this._toLegacyEntropy();
        } catch (_) {
            return new MnemonicValidationResult(
                MnemonicValidationStatus.ChecksumMismatch,
                undefined
            );
        }

        return new MnemonicValidationResult(
            MnemonicValidationStatus.Ok,
            undefined
        );
    }

    /**
     * @returns {Uint8Array}
     */
    _toLegacyEntropy() {
        if (!this._isLegacy) {
            throw new Error("this mnemonic is not a legacy mnemonic");
        }

        const len256Bits = Math.ceil(
            (256 + 8) / Math.log2(legacyWordList.length)
        );
        const numWords = this.words.length;

        if (numWords !== len256Bits) {
            throw new Error(
                `there should be ${len256Bits} words, not ${numWords}`
            );
        }

        const indicies = this.words.map((word) =>
            legacyWordList.indexOf(word.toLowerCase())
        );
        const data = _convertRadix(indicies, legacyWordList.length, 256, 33);
        const crc = data[data.length - 1];
        const result = new Uint8Array(data.length - 1);
        for (let i = 0; i < data.length - 1; i += 1) {
            result[i] = data[i] ^ crc;
        }

        const crc2 = _crc8(result);
        if (crc !== crc2) {
            throw new Error(
                "Invalid legacy mnemonic: fails the cyclic redundency check"
            );
        }

        return result;
    }

    /**
     * @returns {string}
     */
    toString() {
        return this.words.join(" ");
    }
}

/**
 * @param {Uint8Array} data
 * @returns {number}
 */
function _crc8(data) {
    let crc = 0xff;

    for (let i = 0; i < data.length - 1; i += 1) {
        crc ^= data[i];
        for (let j = 0; j < 8; j += 1) {
            crc = (crc >>> 1) ^ ((crc & 1) === 0 ? 0 : 0xb2);
        }
    }

    return crc ^ 0xff;
}

/**
 * @param {number[]} nums
 * @param {number} fromRadix
 * @param {number} toRadix
 * @param {number} toLength
 * @returns {Uint8Array}
 */
function _convertRadix(nums, fromRadix, toRadix, toLength) {
    let num = Long.fromValue(0);
    for (const element of nums) {
        num = num.mul(fromRadix);
        num = num.add(element);
    }
    const result = new Uint8Array(toLength);
    for (let i = toLength - 1; i >= 0; i -= 1) {
        const tem = num.divide(toRadix);
        const rem = num.modulo(toRadix);
        num = tem;
        result[i] = rem.toNumber();
    }
    return result;
}
