import AccountId from "../src/account/AccountId.js";
import Long from "long";

describe("AccountId", function () {
    it("should construct from (shard, realm, num)", function () {
        const accountId = new AccountId(10, 50, 25050);

        expect(accountId.num.toNumber()).to.eql(25050);
        expect(accountId.realm.toNumber()).to.eql(50);
        expect(accountId.shard.toNumber()).to.eql(10);
    });

    it("should construct from (0, 0, 0)", function () {
        const accountId = new AccountId(0, 0, 0);

        expect(accountId.num.toNumber()).to.eql(0);
        expect(accountId.realm.toNumber()).to.eql(0);
        expect(accountId.shard.toNumber()).to.eql(0);
    });

    it("should construct from (num)", function () {
        const accountId = new AccountId(25050);

        expect(accountId.num.toNumber()).to.eql(25050);
        expect(accountId.realm.toNumber()).to.eql(0);
        expect(accountId.shard.toNumber()).to.eql(0);
    });

    it("should parse {shard}.{realm}.{num}", function () {
        const accountId = AccountId.fromString("10.50.25050");

        expect(accountId.num.toNumber()).to.eql(25050);
        expect(accountId.realm.toNumber()).to.eql(50);
        expect(accountId.shard.toNumber()).to.eql(10);
    });

    it("should parse {0.0.123-laujm}", function () {
        const accountId = AccountId.fromString("0.0.123-laujm");

        expect(accountId.num.toNumber()).to.eql(123);
        expect(accountId.realm.toNumber()).to.eql(0);
        expect(accountId.shard.toNumber()).to.eql(0);
    });

    it("should parse 0.0.0", function () {
        const accountId = AccountId.fromString("0.0.0");

        expect(accountId.num.toNumber()).to.eql(0);
        expect(accountId.realm.toNumber()).to.eql(0);
        expect(accountId.shard.toNumber()).to.eql(0);
    });

    it("should parse {num}", function () {
        const accountId = AccountId.fromString("25050");

        expect(accountId.num.toNumber()).to.eql(25050);
        expect(accountId.realm.toNumber()).to.eql(0);
        expect(accountId.shard.toNumber()).to.eql(0);
    });

    it("should stringify to {shard}.{realm}.{num}-{checksum}", function () {
        expect(new AccountId(50, 150, 520).toString()).to.eql("50.150.520-emueg");
    });

    it("should error with invalid string", function () {
        let err = false;

        try {
            AccountId.fromString("asdfasf");
        } catch {
            err = true;
        }

        try {
            AccountId.fromString("0.0.123-laujt");
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error("`AccountId.fromString()` did not error");
        }

        try {
            AccountId.fromString(" .0.1");
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error("`AccountId.fromString()` did not error");
        }

        try {
            AccountId.fromString("");
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error("`AccountId.fromString()` did not error");
        }

        try {
            AccountId.fromString("0.0");
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error("`AccountId.fromString()` did not error");
        }

        try {
            AccountId.fromString("0.0.");
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error("`AccountId.fromString()` did not error");
        }

        try {
            AccountId.fromString("0.0.a");
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error("`AccountId.fromString()` did not error");
        }

        try {
            AccountId.fromString("0.0.-a");
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error("`AccountId.fromString()` did not error");
        }
    });

    it("should error when string negative numbers are directly passed to constructor", function () {
        let err = false;

        try {
            AccountId.fromString("0.0.-1");
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error(
                "`AccountId.constructor` with negative numbers did not error"
            );
        }

        try {
            AccountId.fromString("-1.-1.-1");
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error(
                "`AccountId.constructor` with negative numbers did not error"
            );
        }

        try {
            new AccountId(0, 0, -1);
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error(
                "`AccountId.constructor` with negative numbers did not error"
            );
        }

        try {
            new AccountId(-1, -1, -1);
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error(
                "`AccountId.constructor` with negative numbers did not error"
            );
        }

        try {
            new AccountId(-1);
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error(
                "`AccountId.constructor` with negative numbers did not error"
            );
        }

        try {
            new AccountId(Long.fromValue(-1));
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error(
                "`AccountId.constructor` with negative numbers did not error"
            );
        }

        try {
            new AccountId(
                Long.fromValue(-1),
                Long.fromValue(-1),
                Long.fromValue(-1)
            );
        } catch {
            err = true;
        }

        if (!err) {
            throw new Error(
                "`AccountId.constructor` with negative numbers did not error"
            );
        }
    });
});
