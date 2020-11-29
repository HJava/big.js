/*
 *  big.js v6.0.1
 *  A small, fast, easy-to-use library for arbitrary-precision decimal arithmetic.
 *  Copyright (c) 2020 Michael Mclaughlin
 *  https://github.com/MikeMcl/big.js/LICENCE.md
 */
; (function (GLOBAL) {
    'use strict';
    var Big,


        /************************************** EDITABLE DEFAULTS *****************************************/


        // The default values below must be integers within the stated ranges.

        /*
         * The maximum number of decimal places (DP) of the results of operations involving division:
         * div and sqrt, and pow with negative exponents.
         */
        DP = 20,            // 0 to MAX_DP

        /*
         * The rounding mode (RM) used when rounding to the above decimal places.
         *
         *  0  Towards zero (i.e. truncate, no rounding).       (ROUND_DOWN)
         *  1  To nearest neighbour. If equidistant, round up.  (ROUND_HALF_UP)
         *  2  To nearest neighbour. If equidistant, to even.   (ROUND_HALF_EVEN)
         *  3  Away from zero.                                  (ROUND_UP)
         */
        RM = 1,             // 0, 1, 2 or 3

        // The maximum value of DP and Big.DP.
        MAX_DP = 1E6,       // 0 to 1000000

        // The maximum magnitude of the exponent argument to the pow method.
        MAX_POWER = 1E6,    // 1 to 1000000

        /*
         * The negative exponent (NE) at and beneath which toString returns exponential notation.
         * (JavaScript numbers: -7)
         * -1000000 is the minimum recommended exponent value of a Big.
         */
        NE = -7,            // 0 to -1000000

        /*
         * The positive exponent (PE) at and above which toString returns exponential notation.
         * (JavaScript numbers: 21)
         * 1000000 is the maximum recommended exponent value of a Big, but this limit is not enforced.
         */
        PE = 21,            // 0 to 1000000

        /*
         * When true, an error will be thrown if a primitive number is passed to the Big constructor,
         * or if valueOf is called, or if toNumber is called on a Big which cannot be converted to a
         * primitive number without a loss of precision.
         */
        STRICT = false,     // true or false


        /**************************************************************************************************/


        // Error messages.
        NAME = '[big.js] ',
        INVALID = NAME + 'Invalid ',
        INVALID_DP = INVALID + 'decimal places',
        INVALID_RM = INVALID + 'rounding mode',
        DIV_BY_ZERO = NAME + 'Division by zero',

        // The shared prototype object.
        P = {},
        UNDEFINED = void 0,
        NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;


    /*
     * Create and return a Big constructor.
     */
    function _Big_() {

        /*
         * The Big constructor and exported function.
         * Create and return a new instance of a Big number object.
         *
         * n {number|string|Big} A numeric value.
         */
        function Big(n) {
            var x = this;

            // 支持函数调用方式进行初始化,可以不使用new操作符
            if (!(x instanceof Big)) return n === UNDEFINED ? _Big_() : new Big(n);

            // 原型链判断,确认传入值是否已经为Big类的实例
            if (n instanceof Big) {
                x.s = n.s;
                x.e = n.e;
                x.c = n.c.slice();
            } else {
                if (typeof n !== 'string') {
                    if (Big.strict === true) {
                        throw TypeError(INVALID + 'number');
                    }

                    // 确定是否为-0,如果不是,转化为字符串.
                    n = n === 0 && 1 / n < 0 ? '-0' : String(n);
                }

                // parse函数只接受字符串参数
                parse(x, n);
            }

            x.constructor = Big;
        }

        Big.prototype = P;
        Big.DP = DP;
        Big.RM = RM;
        Big.NE = NE;
        Big.PE = PE;
        Big.strict = STRICT;

        return Big;
    }


    /*
     * Parse the number or string value passed to a Big constructor.
     *
     * x {Big} A Big number instance.
     * n {number|string} A numeric value.
     */
    function parse(x, n) {
        var e, i, nl;

        if (!NUMERIC.test(n)) {
            throw Error(INVALID + 'number');
        }

        // 判断符号,是正数还是负数
        x.s = n.charAt(0) == '-' ? (n = n.slice(1), -1) : 1;

        // 判断是否有小数点
        if ((e = n.indexOf('.')) > -1) n = n.replace('.', '');

        // 判断是否为科学计数法
        if ((i = n.search(/e/i)) > 0) {

            // 确定指数值
            if (e < 0) e = i;
            e += +n.slice(i + 1);
            n = n.substring(0, i);
        } else if (e < 0) {

            // 是一个正整数
            e = n.length;
        }

        nl = n.length;

        // 确定数字前面有没有0,例如0123这种0
        for (i = 0; i < nl && n.charAt(i) == '0';) ++i;

        if (i == nl) {

            // Zero.
            x.c = [x.e = 0];
        } else {

            // 确定数字后面的0,例如1.230这种0
            for (; nl > 0 && n.charAt(--nl) == '0';);
            x.e = e - i - 1;
            x.c = [];

            // 把字符串转换成数组进行存储,这个时候已经去掉了前面的0和后面的0
            for (e = 0; i <= nl;) x.c[e++] = +n.charAt(i++);
        }

        return x;
    }


    /*
     * Round Big x to a maximum of sd significant digits using rounding mode rm.
     *
     * x {Big} The Big to round.
     * sd {number} Significant digits: integer, 0 to MAX_DP inclusive.
     * rm {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
     * [more] {boolean} Whether the result of division was truncated.
     */
    function round(x, sd, rm, more) {
        var xc = x.c;

        if (rm === UNDEFINED) rm = Big.RM;
        if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) {
            throw Error(INVALID_RM);
        }

        if (sd < 1) {
            // 兜底情况,精度小于1,默认有效值为1
            more =
                rm === 3 && (more || !!xc[0]) || sd === 0 && (
                    rm === 1 && xc[0] >= 5 ||
                    rm === 2 && (xc[0] > 5 || xc[0] === 5 && (more || xc[1] !== UNDEFINED))
                );

            xc.length = 1;

            if (more) {

                // 1, 0.1, 0.01, 0.001, 0.0001 等等
                x.e = x.e - sd + 1;
                xc[0] = 1;
            } else {
                // 定义为0
                xc[0] = x.e = 0;
            }
        } else if (sd < xc.length) {

            // xc数组中,在精度之后的纸会被舍弃取整
            more =
                rm === 1 && xc[sd] >= 5 ||
                rm === 2 && (xc[sd] > 5 || xc[sd] === 5 &&
                    (more || xc[sd + 1] !== UNDEFINED || xc[sd - 1] & 1)) ||
                rm === 3 && (more || !!xc[0]);

            // 删除所需精度后的数组值
            xc.length = sd--;

            // 取整方式判断
            if (more) {

                // 四舍五入可能意味着前一个数字必须四舍五入,所以这个时候需要填0
                for (; ++xc[sd] > 9;) {
                    xc[sd] = 0;
                    if (!sd--) {
                        ++x.e;
                        xc.unshift(1);
                    }
                }
            }

            // 删除小数点后面的0
            for (sd = xc.length; !xc[--sd];) xc.pop();
        }

        return x;
    }


    /*
     * Return a string representing the value of Big x in normal or exponential notation.
     * Handles P.toExponential, P.toFixed, P.toJSON, P.toPrecision, P.toString and P.valueOf.
     */
    function stringify(x, doExponential, isNonzero) {
        var e = x.e,
            s = x.c.join(''),
            n = s.length;

        // Exponential notation?
        if (doExponential) {
            s = s.charAt(0) + (n > 1 ? '.' + s.slice(1) : '') + (e < 0 ? 'e' : 'e+') + e;

            // Normal notation.
        } else if (e < 0) {
            for (; ++e;) s = '0' + s;
            s = '0.' + s;
        } else if (e > 0) {
            if (++e > n) {
                for (e -= n; e--;) s += '0';
            } else if (e < n) {
                s = s.slice(0, e) + '.' + s.slice(e);
            }
        } else if (n > 1) {
            s = s.charAt(0) + '.' + s.slice(1);
        }

        return x.s < 0 && isNonzero ? '-' + s : s;
    }


    // Prototype/instance methods


    /*
     * Return a new Big whose value is the absolute value of this Big.
     */
    P.abs = function () {
        var x = new this.constructor(this);
        x.s = 1;
        return x;
    };


    /*
     * Return 1 if the value of this Big is greater than the value of Big y,
     *       -1 if the value of this Big is less than the value of Big y, or
     *        0 if they have the same value.
     */
    P.cmp = function (y) {
        var isneg,
            x = this,
            xc = x.c,
            yc = (y = new x.constructor(y)).c,
            i = x.s,
            j = y.s,
            k = x.e,
            l = y.e;

        // Either zero?
        if (!xc[0] || !yc[0]) return !xc[0] ? !yc[0] ? 0 : -j : i;

        // Signs differ?
        if (i != j) return i;

        isneg = i < 0;

        // Compare exponents.
        if (k != l) return k > l ^ isneg ? 1 : -1;

        j = (k = xc.length) < (l = yc.length) ? k : l;

        // Compare digit by digit.
        for (i = -1; ++i < j;) {
            if (xc[i] != yc[i]) return xc[i] > yc[i] ^ isneg ? 1 : -1;
        }

        // Compare lengths.
        return k == l ? 0 : k > l ^ isneg ? 1 : -1;
    };


    /*
     * Return a new Big whose value is the value of this Big divided by the value of Big y, rounded,
     * if necessary, to a maximum of Big.DP decimal places using rounding mode Big.RM.
     */
    P.div = function (y) {
        var x = this,
            Big = x.constructor,
            a = x.c,                  // dividend
            b = (y = new Big(y)).c,   // divisor
            k = x.s == y.s ? 1 : -1,
            dp = Big.DP;

        if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throw Error(INVALID_DP);
        }

        // Divisor is zero?
        if (!b[0]) {
            throw Error(DIV_BY_ZERO);
        }

        // Dividend is 0? Return +-0.
        if (!a[0]) return new Big(k * 0);

        var bl, bt, n, cmp, ri,
            bz = b.slice(),
            ai = bl = b.length,
            al = a.length,
            r = a.slice(0, bl),   // remainder
            rl = r.length,
            q = y,                // quotient
            qc = q.c = [],
            qi = 0,
            p = dp + (q.e = x.e - y.e) + 1;    // precision of the result

        q.s = k;
        k = p < 0 ? 0 : p;

        // Create version of divisor with leading zero.
        bz.unshift(0);

        // Add zeros to make remainder as long as divisor.
        for (; rl++ < bl;) r.push(0);

        do {

            // n is how many times the divisor goes into current remainder.
            for (n = 0; n < 10; n++) {

                // Compare divisor and remainder.
                if (bl != (rl = r.length)) {
                    cmp = bl > rl ? 1 : -1;
                } else {
                    for (ri = -1, cmp = 0; ++ri < bl;) {
                        if (b[ri] != r[ri]) {
                            cmp = b[ri] > r[ri] ? 1 : -1;
                            break;
                        }
                    }
                }

                // If divisor < remainder, subtract divisor from remainder.
                if (cmp < 0) {

                    // Remainder can't be more than 1 digit longer than divisor.
                    // Equalise lengths using divisor with extra leading zero?
                    for (bt = rl == bl ? b : bz; rl;) {
                        if (r[--rl] < bt[rl]) {
                            ri = rl;
                            for (; ri && !r[--ri];) r[ri] = 9;
                            --r[ri];
                            r[rl] += 10;
                        }
                        r[rl] -= bt[rl];
                    }

                    for (; !r[0];) r.shift();
                } else {
                    break;
                }
            }

            // Add the digit n to the result array.
            qc[qi++] = cmp ? n : ++n;

            // Update the remainder.
            if (r[0] && cmp) r[rl] = a[ai] || 0;
            else r = [a[ai]];

        } while ((ai++ < al || r[0] !== UNDEFINED) && k--);

        // Leading zero? Do not remove if result is simply zero (qi == 1).
        if (!qc[0] && qi != 1) {

            // There can't be more than one zero.
            qc.shift();
            q.e--;
            p--;
        }

        // Round?
        if (qi > p) round(q, p, Big.RM, r[0] !== UNDEFINED);

        return q;
    };


    /*
     * Return true if the value of this Big is equal to the value of Big y, otherwise return false.
     */
    P.eq = function (y) {
        return this.cmp(y) === 0;
    };


    /*
     * Return true if the value of this Big is greater than the value of Big y, otherwise return
     * false.
     */
    P.gt = function (y) {
        return this.cmp(y) > 0;
    };


    /*
     * Return true if the value of this Big is greater than or equal to the value of Big y, otherwise
     * return false.
     */
    P.gte = function (y) {
        return this.cmp(y) > -1;
    };


    /*
     * Return true if the value of this Big is less than the value of Big y, otherwise return false.
     */
    P.lt = function (y) {
        return this.cmp(y) < 0;
    };


    /*
     * Return true if the value of this Big is less than or equal to the value of Big y, otherwise
     * return false.
     */
    P.lte = function (y) {
        return this.cmp(y) < 1;
    };


    /*
     * Return a new Big whose value is the value of this Big minus the value of Big y.
     */
    P.minus = P.sub = function (y) {
        var i, j, t, xlty,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        // Signs differ?
        if (a != b) {
            y.s = -b;
            return x.plus(y);
        }

        var xc = x.c.slice(),
            xe = x.e,
            yc = y.c,
            ye = y.e;

        // Either zero?
        if (!xc[0] || !yc[0]) {

            // y is non-zero? x is non-zero? Or both are zero.
            return yc[0] ? (y.s = -b, y) : new Big(xc[0] ? x : 0);
        }

        // Determine which is the bigger number. Prepend zeros to equalise exponents.
        if (a = xe - ye) {

            if (xlty = a < 0) {
                a = -a;
                t = xc;
            } else {
                ye = xe;
                t = yc;
            }

            t.reverse();
            for (b = a; b--;) t.push(0);
            t.reverse();
        } else {

            // Exponents equal. Check digit by digit.
            j = ((xlty = xc.length < yc.length) ? xc : yc).length;

            for (a = b = 0; b < j; b++) {
                if (xc[b] != yc[b]) {
                    xlty = xc[b] < yc[b];
                    break;
                }
            }
        }

        // x < y? Point xc to the array of the bigger number.
        if (xlty) {
            t = xc;
            xc = yc;
            yc = t;
            y.s = -y.s;
        }

        /*
         * Append zeros to xc if shorter. No need to add zeros to yc if shorter as subtraction only
         * needs to start at yc.length.
         */
        if ((b = (j = yc.length) - (i = xc.length)) > 0) for (; b--;) xc[i++] = 0;

        // Subtract yc from xc.
        for (b = i; j > a;) {
            if (xc[--j] < yc[j]) {
                for (i = j; i && !xc[--i];) xc[i] = 9;
                --xc[i];
                xc[j] += 10;
            }

            xc[j] -= yc[j];
        }

        // Remove trailing zeros.
        for (; xc[--b] === 0;) xc.pop();

        // Remove leading zeros and adjust exponent accordingly.
        for (; xc[0] === 0;) {
            xc.shift();
            --ye;
        }

        if (!xc[0]) {

            // n - n = +0
            y.s = 1;

            // Result must be zero.
            xc = [ye = 0];
        }

        y.c = xc;
        y.e = ye;

        return y;
    };


    /*
     * Return a new Big whose value is the value of this Big modulo the value of Big y.
     */
    P.mod = function (y) {
        var ygtx,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        if (!y.c[0]) {
            throw Error(DIV_BY_ZERO);
        }

        x.s = y.s = 1;
        ygtx = y.cmp(x) == 1;
        x.s = a;
        y.s = b;

        if (ygtx) return new Big(x);

        a = Big.DP;
        b = Big.RM;
        Big.DP = Big.RM = 0;
        x = x.div(y);
        Big.DP = a;
        Big.RM = b;

        return this.minus(x.times(y));
    };


    /*
     * Return a new Big whose value is the value of this Big plus the value of Big y.
     */
    P.plus = P.add = function (y) {
        var t,
            x = this,
            Big = x.constructor,
            a = x.s,
            // 所有操作均转化为两个Big类的实例进行运算,方便处理
            b = (y = new Big(y)).s;

        // 判断符号是不是不相等,即一个为正,一个为负
        if (a != b) {
            y.s = -b;
            return x.minus(y);
        }

        var xe = x.e,
            xc = x.c,
            ye = y.e,
            yc = y.c;

        // 判断是否某个值是0
        if (!xc[0] || !yc[0]) return yc[0] ? y : new Big(xc[0] ? x : a * 0);

        // 拷贝一份数组,避免影响原实例
        xc = xc.slice();

        // 填0来保证运算时的位数相等
        // 注意,reverse函数比unshift函数快
        if (a = xe - ye) {
            if (a > 0) {
                ye = xe;
                t = yc;
            } else {
                a = -a;
                t = xc;
            }

            t.reverse();
            for (; a--;) t.push(0);
            t.reverse();
        }

        // 把xc放到一个更长的数组中,方便后续循环加法操作
        if (xc.length - yc.length < 0) {
            t = yc;
            yc = xc;
            xc = t;
        }

        a = yc.length;

        // 执行加法操作,将数值保存到xc中
        for (b = 0; a; xc[a] %= 10) b = (xc[--a] = xc[a] + yc[a] + b) / 10 | 0;

        // 不需要检查0,因为 +x + +y != 0 ,同时 -x + -y != 0

        if (b) {
            xc.unshift(b);
            ++ye;
        }

        // 删除结尾的0
        for (a = xc.length; xc[--a] === 0;) xc.pop();

        y.c = xc;
        y.e = ye;

        return y;
    };


    /*
     * Return a Big whose value is the value of this Big raised to the power n.
     * If n is negative, round to a maximum of Big.DP decimal places using rounding
     * mode Big.RM.
     *
     * n {number} Integer, -MAX_POWER to MAX_POWER inclusive.
     */
    P.pow = function (n) {
        var x = this,
            one = new x.constructor(1),
            y = one,
            isneg = n < 0;

        if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) {
            throw Error(INVALID + 'exponent');
        }

        if (isneg) n = -n;

        for (; ;) {
            if (n & 1) y = y.times(x);
            n >>= 1;
            if (!n) break;
            x = x.times(x);
        }

        return isneg ? one.div(y) : y;
    };


    /*
     * Return a new Big whose value is the value of this Big rounded to a maximum precision of sd
     * significant digits using rounding mode rm, or Big.RM if rm is not specified.
     *
     * sd {number} Significant digits: integer, 1 to MAX_DP inclusive.
     * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
     */
    P.prec = function (sd, rm) {
        if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
            throw Error(INVALID + 'precision');
        }
        return round(new this.constructor(this), sd, rm);
    };


    /*
     * Return a new Big whose value is the value of this Big rounded to a maximum of dp decimal places
     * using rounding mode rm, or Big.RM if rm is not specified.
     * If dp is negative, round to an integer which is a multiple of 10**-dp.
     * If dp is not specified, round to 0 decimal places.
     *
     * dp? {number} Integer, -MAX_DP to MAX_DP inclusive.
     * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
     */
    P.round = function (dp, rm) {
        if (dp === UNDEFINED) dp = 0;
        else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) {
            throw Error(INVALID_DP);
        }
        return round(new this.constructor(this), dp + this.e + 1, rm);
    };


    /*
     * Return a new Big whose value is the square root of the value of this Big, rounded, if
     * necessary, to a maximum of Big.DP decimal places using rounding mode Big.RM.
     */
    P.sqrt = function () {
        var r, c, t,
            x = this,
            Big = x.constructor,
            s = x.s,
            e = x.e,
            half = new Big(0.5);

        // Zero?
        if (!x.c[0]) return new Big(x);

        // Negative?
        if (s < 0) {
            throw Error(NAME + 'No square root');
        }

        // Estimate.
        s = Math.sqrt(x + '');

        // Math.sqrt underflow/overflow?
        // Re-estimate: pass x coefficient to Math.sqrt as integer, then adjust the result exponent.
        if (s === 0 || s === 1 / 0) {
            c = x.c.join('');
            if (!(c.length + e & 1)) c += '0';
            s = Math.sqrt(c);
            e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
            r = new Big((s == 1 / 0 ? '5e' : (s = s.toExponential()).slice(0, s.indexOf('e') + 1)) + e);
        } else {
            r = new Big(s);
        }

        e = r.e + (Big.DP += 4);

        // Newton-Raphson iteration.
        do {
            t = r;
            r = half.times(t.plus(x.div(t)));
        } while (t.c.slice(0, e).join('') !== r.c.slice(0, e).join(''));

        return round(r, (Big.DP -= 4) + r.e + 1, Big.RM);
    };


    /*
     * Return a new Big whose value is the value of this Big times the value of Big y.
     */
    P.times = P.mul = function (y) {
        var c,
            x = this,
            Big = x.constructor,
            xc = x.c,
            yc = (y = new Big(y)).c,
            a = xc.length,
            b = yc.length,
            i = x.e,
            j = y.e;

        // 符号比较确定最终的符号是为正还是为负
        y.s = x.s == y.s ? 1 : -1;

        // 如果有一个值是0,那么返回0即可
        if (!xc[0] || !yc[0]) return new Big(y.s * 0);

        // 小数点初始化为x.e+y.e,这是我们在两个小数相乘的时候,小数点的计算规则
        y.e = i + j;

        // 这一步也是保证xc的长度永远不小于yc的长度,因为要遍历xc来进行运算
        if (a < b) {
            c = xc;
            xc = yc;
            yc = c;
            j = a;
            a = b;
            b = j;
        }

        // 用0来初始化结果数组
        for (c = new Array(j = a + b); j--;) c[j] = 0;

        // i初始化为xc的长度
        for (i = b; i--;) {
            b = 0;

            // a是yc的长度
            for (j = a + i; j > i;) {

                // xc的一位乘以yc的一位,得到最终的结果值,保存下来
                b = c[j] + yc[i] * xc[j - i - 1] + b;
                c[j--] = b % 10;

                b = b / 10 | 0;
            }

            c[j] = b;
        }

        // 如果有进位,那么就调整小数点的位数(增加y.e),否则就删除最前面的0
        if (b) ++y.e;
        else c.shift();

        // 删除后面的0
        for (i = c.length; !c[--i];) c.pop();
        y.c = c;

        return y;
    };


    /*
     * Return a string representing the value of this Big in exponential notation rounded to dp fixed
     * decimal places using rounding mode rm, or Big.RM if rm is not specified.
     *
     * dp? {number} Decimal places: integer, 0 to MAX_DP inclusive.
     * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
     */
    P.toExponential = function (dp, rm) {
        var x = this,
            n = x.c[0];

        if (dp !== UNDEFINED) {
            if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
                throw Error(INVALID_DP);
            }
            x = round(new x.constructor(x), ++dp, rm);
            for (; x.c.length < dp;) x.c.push(0);
        }

        return stringify(x, true, !!n);
    };


    /*
     * Return a string representing the value of this Big in normal notation rounded to dp fixed
     * decimal places using rounding mode rm, or Big.RM if rm is not specified.
     *
     * dp? {number} Decimal places: integer, 0 to MAX_DP inclusive.
     * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
     *
     * (-0).toFixed(0) is '0', but (-0.1).toFixed(0) is '-0'.
     * (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
     */
    P.toFixed = function (dp, rm) {
        var x = this,
            n = x.c[0];

        if (dp !== UNDEFINED) {
            if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
                throw Error(INVALID_DP);
            }
            x = round(new x.constructor(x), dp + x.e + 1, rm);

            // x.e may have changed if the value is rounded up.
            for (dp = dp + x.e + 1; x.c.length < dp;) x.c.push(0);
        }

        return stringify(x, false, !!n);
    };


    /*
     * Return a string representing the value of this Big.
     * Return exponential notation if this Big has a positive exponent equal to or greater than
     * Big.PE, or a negative exponent equal to or less than Big.NE.
     * Omit the sign for negative zero.
     */
    P.toJSON = P.toString = function () {
        var x = this,
            Big = x.constructor;
        return stringify(x, x.e <= Big.NE || x.e >= Big.PE, !!x.c[0]);
    };


    /*
     * Return the value of this Big as a primitve number.
     */
    P.toNumber = function () {
        var n = Number(stringify(this, true, true));
        if (this.constructor.strict === true && !this.eq(n.toString())) {
            throw Error(NAME + 'Imprecise conversion');
        }
        return n;
    };


    /*
     * Return a string representing the value of this Big rounded to sd significant digits using
     * rounding mode rm, or Big.RM if rm is not specified.
     * Use exponential notation if sd is less than the number of digits necessary to represent
     * the integer part of the value in normal notation.
     *
     * sd {number} Significant digits: integer, 1 to MAX_DP inclusive.
     * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
     */
    P.toPrecision = function (sd, rm) {
        var x = this,
            Big = x.constructor,
            n = x.c[0];

        if (sd !== UNDEFINED) {
            if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
                throw Error(INVALID + 'precision');
            }
            x = round(new Big(x), sd, rm);
            for (; x.c.length < sd;) x.c.push(0);
        }

        return stringify(x, sd <= x.e || x.e <= Big.NE || x.e >= Big.PE, !!n);
    };


    /*
     * Return a string representing the value of this Big.
     * Return exponential notation if this Big has a positive exponent equal to or greater than
     * Big.PE, or a negative exponent equal to or less than Big.NE.
     * Include the sign for negative zero.
     */
    P.valueOf = function () {
        var x = this,
            Big = x.constructor;
        if (Big.strict === true) {
            throw Error(NAME + 'valueOf disallowed');
        }
        return stringify(x, x.e <= Big.NE || x.e >= Big.PE, true);
    };


    // Export


    Big = _Big_();

    Big['default'] = Big.Big = Big;

    //AMD.
    if (typeof define === 'function' && define.amd) {
        define(function () {return Big;});

        // Node and other CommonJS-like environments that support module.exports.
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = Big;

        //Browser.
    } else {
        GLOBAL.Big = Big;
    }
})(this);
