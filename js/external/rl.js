var R = {}, // the Recurrent library
    RL = {};
//     _Agent = _Agent || {};

(function (global) {
    "use strict";

    // Utility fun
    function assert(condition, message) {
        // from http://stackoverflow.com/questions/15313418/javascript-assert
        if (!condition) {
            message = message || "Assertion failed";
            if (typeof Error !== "undefined") {
                throw new Error(message);
            }
            throw message; // Fallback
        }
    }

    // Random numbers utils
    var returnV = false,
        vVal = 0.0,
        gaussRandom = function () {
            if (returnV) {
                returnV = false;
                return vVal;
            }
            var u = 2 * Math.random() - 1,
                v = 2 * Math.random() - 1,
                r = u * u + v * v;
            if (r === 0 || r > 1) {
                return gaussRandom();
            }
            var c = Math.sqrt(-2 * Math.log(r) / r);
            vVal = v * c; // cache this
            returnV = true;
            return u * c;
        },
        randf = function (a, b) {
            return Math.random() * (b - a) + a;
        },
        randi = function (a, b) {
            return Math.floor(Math.random() * (b - a) + a);
        },
        randn = function (mu, std) {
            return mu + gaussRandom() * std;
        },
        /**
         * returns a random cauchy random variable with gamma (controls magnitude sort of like stdev in randn)
         * http://en.wikipedia.org/wiki/Cauchy_distribution
         * @param m
         * @param gamma
         * @return {}
         */
        randc = function (m, gamma) {
            return m + gamma * 0.01 * randn(0.0, 1.0) / randn(0.0, 1.0);
        },
        /**
         * helper function returns array of zeros of length n and uses typed arrays if available
         * @param n
         * @return {*}
         */
        zeros = function (n) {
            if (typeof n === 'undefined' || isNaN(n)) {
                return [];
            }
            if (typeof ArrayBuffer === 'undefined') {
                // lacking browser support
                var arr = new Array(n);
                for (let i = 0; i < n; i++) {
                    arr[i] = 0;
                }
                return arr;
            } else {
                return new Float64Array(n);
            }
        };

    /**
     * Mat holds a matrix
     * @param n
     * @param d
     * @name Mat
     * @constructor
     */
    var Mat = function (n, d) {
        this.n = n; // n is number of rows
        this.d = d; // d is number of columns
        this.w = zeros(n * d);
        this.dw = zeros(n * d);
    };

    /**
     *
     * @type {{get: Function, set: Function, setFrom: Function, setColumn: Function, toJSON: Function, fromJSON: Function}}
     */
    Mat.prototype = {
        /**
         * Slow but careful accessor function we want row-major order
         * @param row
         * @param col
         * @return {*}
         */
        get: function (row, col) {
            var ix = (this.d * row) + col;
            assert(ix >= 0 && ix < this.w.length);

            return this.w[ix];
        },
        /**
         * Slow but careful accessor function
         * @param row
         * @param col
         * @param v
         */
        set: function (row, col, v) {
            var ix = (this.d * row) + col;
            assert(ix >= 0 && ix < this.w.length);
            this.w[ix] = v;
        },
        /**
         *
         * @param arr
         */
        setFrom: function (arr) {
            for (var i = 0, n = arr.length; i < n; i++) {
                this.w[i] = arr[i];
            }
        },
        /**
         *
         * @param m
         * @param i
         */
        setColumn: function (m, i) {
            for (var q = 0, n = m.w.length; q < n; q++) {
                this.w[(this.d * q) + i] = m.w[q];
            }
        },
        /**
         *
         * @return {}
         */
        toJSON: function () {
            var json = {};
            json.n = this.n;
            json.d = this.d;
            json.w = this.w;

            return json;
        },
        /**
         *
         * @param json
         */
        fromJSON: function (json) {
            this.n = json.n;
            this.d = json.d;
            this.w = zeros(this.n * this.d);
            this.dw = zeros(this.n * this.d);
            for (var i = 0, n = this.n * this.d; i < n; i++) {
                this.w[i] = json.w[i]; // copy over weights
            }
        }
    };
    R.Mat = Mat;

    /**
     *
     * @param {Object} b
     * @return {Mat}
     */
    var copyMat = function (b) {
            var a = new Mat(b.n, b.d);
            a.setFrom(b.w);
            return a;
        };
    R.copyMat = copyMat;

    /**
     *
     * @param {Net} net
     * @return {Net}
     */
    var copyNet = function (net) {
        // nets are (k,v) pairs with k = string key, v = Mat()
        var newNet = {};
        for (var p in net) {
            if (net.hasOwnProperty(p)) {
                newNet[p] = copyMat(net[p]);
            }
        }
        return newNet;
    };
    R.copyNet = copyNet;

    /**
     *
     * @param m
     * @param alpha
     */
    var updateMat = function (m, alpha) {
        // updates in place
        for (var i = 0, n = m.n * m.d; i < n; i++) {
            if (m.dw[i] !== 0) {
                m.w[i] += -alpha * m.dw[i];
                m.dw[i] = 0;
            }
        }
    };
    R.updateMat = updateMat;

    /**
     *
     * @param net
     * @param alpha
     */
    var updateNet = function (net, alpha) {
        for (var p in net) {
            if (net.hasOwnProperty(p)) {
                updateMat(net[p], alpha);
            }
        }
    };
    R.updateNet = updateNet;

    /**
     *
     * @param net
     * @return {}
     */
    var netToJSON = function (net) {
        var j = {};
        for (var p in net) {
            if (net.hasOwnProperty(p)) {
                j[p] = net[p].toJSON();
            }
        }
        return j;
    };
    R.netToJSON = netToJSON;

    /**
     *
     * @param j
     * @return {}
     */
    var netFromJSON = function (j) {
        var net = {};
        for (var p in j) {
            if (j.hasOwnProperty(p)) {
                net[p] = new Mat(1, 1); // not proud of this
                net[p].fromJSON(j[p]);
            }
        }
        return net;
    };
    R.netFromJSON = netFromJSON;

    /**
     *
     * @param net
     */
    var netZeroGrads = function (net) {
        for (var p in net) {
            if (net.hasOwnProperty(p)) {
                var mat = net[p];
                gradFillConst(mat, 0);
            }
        }
    };
    R.netZeroGrads = netZeroGrads;

    /**
     *
     * @param net
     * @return {Mat}
     */
    var netFlattenGrads = function (net) {
        var n = 0;
        for (var p in net) {
            if (net.hasOwnProperty(p)) {
                var mat = net[p];
                n += mat.dw.length;
            }
        }
        var g = new Mat(n, 1),
            ix = 0;
        for (var p in net) {
            if (net.hasOwnProperty(p)) {
                var mat = net[p];
                for (var i = 0, m = mat.dw.length; i < m; i++) {
                    g.w[ix] = mat.dw[i];
                    ix++;
                }
            }
        }
        return g;
    };
    R.netFlattenGrads = netFlattenGrads;

    /**
     * Return a Mat but filled with random numbers from gaussian
     * @param n
     * @param d
     * @param mu
     * @param std
     * @return {Mat}
     */
    var randMat = function (n, d, mu, std) {
        var m = new Mat(n, d);
        fillRandn(m, mu, std);
        //fillRand(m,-std,std); // kind of :P
        return m;
    };
    R.randMat = randMat;

    /**
     * Fill matrix with random gaussian numbers
     * @param m
     * @param mu
     * @param std
     */
    var fillRandn = function (m, mu, std) {
        for (var i = 0, n = m.w.length; i < n; i++) {
            m.w[i] = randn(mu, std);
        }
    };
    R.fillRandn = fillRandn;

    /**
     *
     * @param m
     * @param lo
     * @param hi
     */
    var fillRand = function (m, lo, hi) {
        for (var i = 0, n = m.w.length; i < n; i++) {
            m.w[i] = randf(lo, hi);
        }
    };
    R.fillRand = fillRand;

    /**
     *
     * @param m
     * @param c
     */
    var gradFillConst = function (m, c) {
            for (var i = 0, n = m.dw.length; i < n; i++) {
                m.dw[i] = c;
            }
        };
    R.gradFillConst = gradFillConst;

    /**
     * Transformer definitions
     * @param needsBackprop
     * @name Graph
     * @constructor
     */
    var Graph = function (needsBackprop) {
        if (typeof needsBackprop === 'undefined') {
            needsBackprop = true;
        }
        this.needsBackprop = needsBackprop;

        // this will store a list of functions that perform backprop,
        // in their forward pass order. So in backprop we will go
        // backwards and evoke each one
        this.backprop = [];
    };

    /**
     *
     * @type {{backward: Function, rowPluck: Function, tanh: Function, sigmoid: Function, relu: Function, mul: Function, add: Function, dot: Function, eltmul: Function}}
     */
    Graph.prototype = {
        /**
         *
         */
        backward: function () {
            for (var i = this.backprop.length - 1; i >= 0; i--) {
                this.backprop[i](); // tick!
            }
        },
        // backward: function () {
        //     var bp = this.backprop;
        //     for (var i = bp.length - 1; i >= 0; ) {
        //         var args = bp[i--];
        //         var func = bp[i--];
        //         func.apply(this, args);
        //
        //         //bp[i](); // tick!
        //     }
        // },
        /**
         * Pluck a row of m with index ix and return it as col vector
         * @param m
         * @param ix
         * @return {Mat}
         */
        rowPluck: function (m, ix) {
            assert(ix >= 0 && ix < m.n);
            var d = m.d,
                out = new Mat(d, 1);
            // copy over the data
            for (var i = 0, n = d; i < n; i++) {
                out.w[i] = m.w[d * ix + i];
            }

            if (this.needsBackprop) {
                var backward = function () {
                    for (var i = 0, n = d; i < n; i++) {
                        m.dw[d * ix + i] += out.dw[i];
                    }
                };
                this.backprop.push(backward);
            }

            return out;
        },
        /**
         * tanh nonlinearity
         * @param m
         * @return {Mat}
         */
        tanh: function (m) {
            var out = new Mat(m.n, m.d),
                n = m.w.length;
            for (var i = 0; i < n; i++) {
                out.w[i] = Math.tanh(m.w[i]);
            }

            if (this.needsBackprop) {
                var backward = function () {
                    for (var i = 0; i < n; i++) {
                        // grad for z = tanh(x) is (1 - z^2)
                        var mwi = out.w[i];
                        m.dw[i] += (1.0 - mwi * mwi) * out.dw[i];
                    }
                };
                this.backprop.push(backward);
            }

            return out;
        },
        /**
         * Sigmoid nonlinearity
         * @param m
         * @return {Mat}
         */
        sigmoid: function (m) {
            var out = new Mat(m.n, m.d),
                n = m.w.length;
            for (var i = 0; i < n; i++) {
                out.w[i] = sig(m.w[i]);
            }

            if (this.needsBackprop) {
                var backward = function () {
                    for (var i = 0; i < n; i++) {
                        // grad for z = tanh(x) is (1 - z^2)
                        var mwi = out.w[i];
                        m.dw[i] += mwi * (1.0 - mwi) * out.dw[i];
                    }
                };
                this.backprop.push(backward);
            }

            return out;
        },
        /**
         *
         * @param m
         * @return {Mat}
         */
        relu: function (m) {
            var out = new Mat(m.n, m.d),
                n = m.w.length;
            for (var i = 0; i < n; i++) {
                out.w[i] = Math.max(0, m.w[i]); // relu
            }
            if (this.needsBackprop) {
                var backward = function () {
                    for (var i = 0; i < n; i++) {
                        m.dw[i] += m.w[i] > 0 ? out.dw[i] : 0.0;
                    }
                };
                this.backprop.push(backward);
            }

            return out;
        },
        /**
         * Multiply matrices m1 * m2
         * @param m1
         * @param m2
         * @return {Mat}
         */
        mul: function (m1, m2) {
            assert(m1.d === m2.n, 'matmul dimensions misaligned');

            var n = m1.n,
                d = m2.d,
                out = new Mat(n, d);
            // loop over rows of m1
            for (var i = 0; i < m1.n; i++) {
                // loop over cols of m2
                for (var j = 0; j < m2.d; j++) {
                    var dot = 0.0;
                    // dot product loop
                    for (var k = 0; k < m1.d; k++) {
                        dot += m1.w[m1.d * i + k] * m2.w[m2.d * k + j];
                    }
                    out.w[d * i + j] = dot;
                }
            }

            if (this.needsBackprop) {
                var backward = function () {
                    // loop over rows of m1
                    for (var i = 0; i < m1.n; i++) {
                        // loop over cols of m2
                        for (var j = 0; j < m2.d; j++) {
                            // dot product loop
                            for (var k = 0; k < m1.d; k++) {
                                var b = out.dw[d * i + j];
                                m1.dw[m1.d * i + k] += m2.w[m2.d * k + j] * b;
                                m2.dw[m2.d * k + j] += m1.w[m1.d * i + k] * b;
                            }
                        }
                    }
                };
                this.backprop.push(backward);
            }

            return out;
        },
        /**
         *
         * @param m1
         * @param m2
         * @return {Mat}
         */
        add: function (m1, m2) {
            assert(m1.w.length === m2.w.length);

            var out = new Mat(m1.n, m1.d);
            for (var i = 0, n = m1.w.length; i < n; i++) {
                out.w[i] = m1.w[i] + m2.w[i];
            }
            if (this.needsBackprop) {
                var backward = function () {
                    for (var i = 0, n = m1.w.length; i < n; i++) {
                        m1.dw[i] += out.dw[i];
                        m2.dw[i] += out.dw[i];
                    }
                };
                this.backprop.push(backward);
            }
            return out;
        },
        /**
         * m1 m2 are both column vectors
         * @param m1
         * @param m2
         * @return {Mat}
         */
        dot: function (m1, m2) {
            assert(m1.w.length === m2.w.length);
            var out = new Mat(1, 1),
                dot = 0.0;
            for (var i = 0, n = m1.w.length; i < n; i++) {
                dot += m1.w[i] * m2.w[i];
            }
            out.w[0] = dot;
            if (this.needsBackprop) {
                var backward = function () {
                    for (var i = 0, n = m1.w.length; i < n; i++) {
                        m1.dw[i] += m2.w[i] * out.dw[0];
                        m2.dw[i] += m1.w[i] * out.dw[0];
                    }
                };
                this.backprop.push(backward);
            }

            return out;
        },
        /**
         *
         * @param m1
         * @param m2
         * @return {Mat}
         */
        eltmul: function (m1, m2) {
            assert(m1.w.length === m2.w.length);

            var out = new Mat(m1.n, m1.d);
            for (var i = 0, n = m1.w.length; i < n; i++) {
                out.w[i] = m1.w[i] * m2.w[i];
            }
            if (this.needsBackprop) {
                var backward = function () {
                    for (var i = 0, n = m1.w.length; i < n; i++) {
                        m1.dw[i] += m2.w[i] * out.dw[i];
                        m2.dw[i] += m1.w[i] * out.dw[i];
                    }
                };
                this.backprop.push(backward);
            }

            return out;
        }
    };
    R.Graph = Graph;

    /**
     *
     * @param m
     * @return {Mat}
     */
    var softMax = function (m) {
        var out = new Mat(m.n, m.d), // probability volume
            maxVal = -999999,
            s = 0.0;
        for (let i = 0, n = m.w.length; i < n; i++) {
            if (m.w[i] > maxVal) {
                maxVal = m.w[i];
            }
        }

        for (let i = 0, n = m.w.length; i < n; i++) {
            out.w[i] = Math.exp(m.w[i] - maxVal);
            s += out.w[i];
        }
        for (let i = 0, n = m.w.length; i < n; i++) {
            out.w[i] /= s;
        }

        // no backward pass here needed
        // since we will use the computed probabilities outside
        // to set gradients directly on m
        return out;
    };
    R.softMax = softMax;

    /**
     * @name Solver
     * @constructor
     */
    var Solver = function () {
        this.decayRate = 0.999;
        this.smoothEps = 1e-8;
        this.stepCache = {};
    };

    /**
     *
     * @type {{step: Function}}
     */
    Solver.prototype = {
        /**
         * perform parameter update
         * @param model
         * @param stepSize
         * @param regc
         * @param clipVal
         * @return {{}}
         */
        step: function (model, stepSize, regc, clipVal) {
            var solverStats = {},
                numClipped = 0,
                numTot = 0;
            for (var k in model) {
                if (model.hasOwnProperty(k)) {
                    var m = model[k]; // mat ref
                    if (!(k in this.stepCache)) {
                        this.stepCache[k] = new Mat(m.n, m.d);
                    }
                    var s = this.stepCache[k];
                    for (var i = 0, n = m.w.length; i < n; i++) {

                        // rmsprop adaptive learning rate
                        var mdwi = m.dw[i];
                        s.w[i] = s.w[i] * this.decayRate + (1.0 - this.decayRate) * mdwi * mdwi;

                        // gradient clip
                        if (mdwi > clipVal) {
                            mdwi = clipVal;
                            numClipped++;
                        }
                        if (mdwi < -clipVal) {
                            mdwi = -clipVal;
                            numClipped++;
                        }
                        numTot++;

                        // update (and regularize)
                        m.w[i] += -stepSize * mdwi / Math.sqrt(s.w[i] + this.smoothEps) - regc * m.w[i];
                        m.dw[i] = 0; // reset gradients for next iteration
                    }
                }
            }
            solverStats.ratioClipped = numClipped * 1.0 / numTot;

            return solverStats;
        }
    };
    R.Solver = Solver;
// END OF RECURRENTJS

    /**
     *
     * @param inputSize
     * @param hiddenSizes
     * @param outputSize
     * @return {}
     */
    var initLSTM = function (inputSize, hiddenSizes, outputSize) {
            // hidden size should be a list
            var model = {};
            for (var d = 0; d < hiddenSizes.length; d++) { // loop over depths
                var prevSize = d === 0 ? inputSize : hiddenSizes[d - 1],
                    hiddenSize = hiddenSizes[d];

                // gates parameters
                model['Wix' + d] = new randMat(hiddenSize, prevSize, 0, 0.08);
                model['Wih' + d] = new randMat(hiddenSize, hiddenSize, 0, 0.08);
                model['bi' + d] = new Mat(hiddenSize, 1);
                model['Wfx' + d] = new randMat(hiddenSize, prevSize, 0, 0.08);
                model['Wfh' + d] = new randMat(hiddenSize, hiddenSize, 0, 0.08);
                model['bf' + d] = new Mat(hiddenSize, 1);
                model['Wox' + d] = new randMat(hiddenSize, prevSize, 0, 0.08);
                model['Woh' + d] = new randMat(hiddenSize, hiddenSize, 0, 0.08);
                model['bo' + d] = new Mat(hiddenSize, 1);
                // cell write params
                model['Wcx' + d] = new randMat(hiddenSize, prevSize, 0, 0.08);
                model['Wch' + d] = new randMat(hiddenSize, hiddenSize, 0, 0.08);
                model['bc' + d] = new Mat(hiddenSize, 1);
            }
            // decoder params
            model.Whd = new randMat(outputSize, hiddenSize, 0, 0.08);
            model.bd = new Mat(outputSize, 1);

            return model;
        };
    RL.initLSTM = initLSTM;
    /**
         * Forward prop for a single tick of LSTM
         * @param {Graph} G is graph to append ops to
         * @param model contains LSTM parameters
         * @param {Array} hiddenSizes
         * @param x is 1D column vector with observation
         * @param {Object} prev is a struct containing hidden and cell from previous iteration
         * @return {}
         */
    var forwardLSTM = function (G, model, hiddenSizes, x, prev) {
            var hiddenPrevs = [],
                cellPrevs = [];
            if (prev === null || prev.h === undefined) {
                for (var d = 0; d < hiddenSizes.length; d++) {
                    hiddenPrevs.push(new Mat(hiddenSizes[d], 1));
                    cellPrevs.push(new Mat(hiddenSizes[d], 1));
                }
            } else {
                hiddenPrevs = prev.h;
                cellPrevs = prev.c;
            }

            var hidden = [],
                cell = [];
            for (var d = 0; d < hiddenSizes.length; d++) {
                var inputVector = d === 0 ? x : hidden[d - 1],
                    hiddenPrev = hiddenPrevs[d],
                    cellPrev = cellPrevs[d],

                // input gate
                    h0 = G.mul(model['Wix' + d], inputVector),
                    h1 = G.mul(model['Wih' + d], hiddenPrev),
                    inputGate = G.sigmoid(G.add(G.add(h0, h1), model['bi' + d])),

                // forget gate
                    h2 = G.mul(model['Wfx' + d], inputVector),
                    h3 = G.mul(model['Wfh' + d], hiddenPrev),
                    forgetGate = G.sigmoid(G.add(G.add(h2, h3), model['bf' + d])),

                // output gate
                    h4 = G.mul(model['Wox' + d], inputVector),
                    h5 = G.mul(model['Woh' + d], hiddenPrev),
                    outputGate = G.sigmoid(G.add(G.add(h4, h5), model['bo' + d])),

                // write operation on cells
                    h6 = G.mul(model['Wcx' + d], inputVector),
                    h7 = G.mul(model['Wch' + d], hiddenPrev),
                    cellWrite = G.tanh(G.add(G.add(h6, h7), model['bc' + d])),

                // compute new cell activation
                    retainCell = G.eltmul(forgetGate, cellPrev), // what do we keep from cell
                    writeCell = G.eltmul(inputGate, cellWrite), // what do we write to cell
                    cellD = G.add(retainCell, writeCell), // new cell contents

                // compute hidden state as gated, saturated cell activations
                    hiddenD = G.eltmul(outputGate, G.tanh(cellD));

                hidden.push(hiddenD);
                cell.push(cellD);
            }

            // one decoder to outputs at end
            var output = G.add(G.mul(model.Whd, hidden[hidden.length - 1]), model.bd);

            // return cell memory, hidden representation and output
            return {
                h: hidden,
                c: cell,
                o: output
            };
        };
    RL.forwardLSTM = forwardLSTM;
    /**
     * helper function for computing sigmoid
     * @param x
     * @return {number}
     */
    var sig = function (x) {
        return 1.0 / (1 + Math.exp(-x));
    };
    RL.sig = sig;
    /**
     * argmax of array w
     * @param w
     * @return {number}
     */
    var maxI = function (w) {
        var maxv = w[0],
            maxix = 0;
        for (var i = 1, n = w.length; i < n; i++) {
            var v = w[i];
            if (v > maxv) {
                maxix = i;
                maxv = v;
            }
        }

        return maxix;
    };
    RL.maxI = maxI;
    /**
     * sample argmax from w, assuming w are probabilities that sum to one
     * @param w
     * @return {number}
     */
    var sampleI = function (w) {
        var r = randf(0, 1),
            x = 0.0,
            i = 0;
        while (true) {
            x += w[i];
            if (x > r) {
                return i;
            }
            i++;
        }

        return w.length - 1; // pretty sure we should never get here?
    };
    RL.sampleI = sampleI;
    /**
     * syntactic sugar function for getting default parameter values
     * @param opt
     * @param field_name
     * @param default_value
     * @return {*}
     */
    var getOpt = function (opt, field_name, default_value) {
                if (typeof opt === 'undefined') {
                    return default_value;
                }
                return (typeof opt[field_name] !== 'undefined') ? opt[field_name] : default_value;
            };
    RL.getOpt = getOpt;
    /*
         *
         * @param arr
         * @param c
         */
    var setConst = function (arr, c) {
            for (var i = 0, n = arr.length; i < n; i++) {
                arr[i] = c;
            }
        };
    RL.setConst = setConst;
    /**
         *
         * @param p
         * @return {number}
         */
    var sampleWeighted = function (p) {
            var r = Math.random();
            var c = 0.0;
            for (var i = 0, n = p.length; i < n; i++) {
                c += p[i];
                if (c >= r) {
                    return i;
                }
            }
            assert(false, 'wtf');
        };
    RL.sampleWeighted = sampleWeighted;

// ------
// REINFORCEJS AGENTS
// ------
    /**
     * DPAgent performs Value Iteration
     * - can also be used for Policy Iteration if you really wanted to
     * - requires model of the environment :(
     * - does not learn from experience :(
     * - assumes finite MDP :(
     * @param env
     * @param opt
     * @name DPAgent
     * @constructor
     */
    var DPAgent = function (env, opt) {
        this.V = null; // state value function
        this.P = null; // policy distribution \pi(s,a)
        this.env = env; // store pointer to environment
        this.gamma = getOpt(opt, 'gamma', 0.75); // future reward discount factor
        this.reset();
    };

    /**
     *
     * @type {{reset: Function, act: Function, learn: Function, evaluatePolicy: Function, updatePolicy: Function}}
     */
    DPAgent.prototype = {
        /**
         * Reset the agent's policy and value function
         */
        reset: function () {
            this.ns = this.env.getNumStates();
            this.na = this.env.getMaxNumActions();
            this.V = zeros(this.ns);
            this.P = zeros(this.ns * this.na);
            // initialize uniform random policy
            for (var s = 0; s < this.ns; s++) {
                var poss = this.env.allowedActions(s);
                for (var i = 0, n = poss.length; i < n; i++) {
                    this.P[poss[i] * this.ns + s] = 1.0 / poss.length;
                }
            }
        },
        /**
         * Behave according to the learned policy
         * @param s
         * @return {*}
         */
        act: function (s) {
            var poss = this.env.allowedActions(s),
                ps = [];
            for (var i = 0, n = poss.length; i < n; i++) {
                var a = poss[i],
                    prob = this.P[a * this.ns + s];
                ps.push(prob);
            }
            var maxI = sampleWeighted(ps);

            return poss[maxI];
        },
        /**
         * Perform a single round of value iteration
         */
        learn: function () {
            self.evaluatePolicy(); // writes this.V
            self.updatePolicy(); // writes this.P
        },
        /**
         * Perform a synchronous update of the value function
         */
        evaluatePolicy: function () {
            var Vnew = zeros(this.ns);
            for (var s = 0; s < this.ns; s++) {
                // integrate over actions in a stochastic policy
                // note that we assume that policy probability mass over allowed actions sums to one
                var v = 0.0,
                    poss = this.env.allowedActions(s);
                for (var i = 0, n = poss.length; i < n; i++) {
                    var a = poss[i],
                        prob = this.P[a * this.ns + s]; // probability of taking action under policy
                    if (prob === 0) {
                        continue;
                    } // no contribution, skip for speed
                    var ns = this.env.nextStateDistribution(s, a),
                        rs = this.env.reward(s, a, ns); // reward for s->a->ns transition
                    v += prob * (rs + this.gamma * this.V[ns]);
                }
                Vnew[s] = v;
            }
            this.V = Vnew; // swap
        },
        /**
         * Update policy to be greedy w.r.t. learned Value function
         */
        updatePolicy: function () {
            for (var s = 0; s < this.ns; s++) {
                var poss = this.env.allowedActions(s),
                // compute value of taking each allowed action
                    vmax, nmax,
                    vs = [];
                for (var i = 0, n = poss.length; i < n; i++) {
                    var a = poss[i],
                        ns = this.env.nextStateDistribution(s, a),
                        rs = this.env.reward(s, a, ns),
                        v = rs + this.gamma * this.V[ns];
                    vs.push(v);
                    if (i === 0 || v > vmax) {
                        vmax = v;
                        nmax = 1;
                    } else if (v === vmax) {
                        nmax += 1;
                    }
                }
                // update policy smoothly across all argmaxy actions
                for (var i = 0, n = poss.length; i < n; i++) {
                    var a = poss[i];
                    this.P[a * this.ns + s] = (vs[i] === vmax) ? 1.0 / nmax : 0.0;
                }
            }
        }
    };
    RL.DPAgent = DPAgent;

    /**
     * QAgent uses TD (Q-Learning, SARSA)
     * - does not require environment model :)
     * - learns from experience :)
     * @param env
     * @param opt
     * @name TDAgent
     * @constructor
     */
    var TDAgent = function (env, opt) {
        this.update = getOpt(opt, 'update', 'qlearn'); // qlearn | sarsa
        this.gamma = getOpt(opt, 'gamma', 0.75); // future reward discount factor
        this.epsilon = getOpt(opt, 'epsilon', 0.1); // for epsilon-greedy policy
        this.alpha = getOpt(opt, 'alpha', 0.01); // value function learning rate

        // class allows non-deterministic policy, and smoothly regressing towards the optimal policy based on Q
        this.smoothPolicyUpdate = getOpt(opt, 'smoothPolicyUpdate', false);
        this.beta = getOpt(opt, 'beta', 0.01); // learning rate for policy, if smooth updates are on

        // eligibility traces
        this.lambda = getOpt(opt, 'lambda', 0); // eligibility trace decay. 0 = no eligibility traces used
        this.replacingTraces = getOpt(opt, 'replacingTraces', true);

        // optional optimistic initial values
        this.qInitVal = getOpt(opt, 'qInitVal', 0);

        this.planN = getOpt(opt, 'planN', 0); // number of planning steps per learning iteration (0 = no planning)

        this.Q = null; // state action value function
        this.P = null; // policy distribution \pi(s,a)
        this.e = null; // eligibility trace
        this.envModelS = null;
        // environment model (s,a) -> (s',r)
        this.envModelR = null;
        // environment model (s,a) -> (s',r)
        this.env = env; // store pointer to environment
        this.reset();
    };

    /**
     *
     * @type {{reset: Function, resetEpisode: Function, act: Function, learn: Function, updateModel: Function, plan: Function, learnFromTuple: Function, updatePriority: Function, updatePolicy: Function}}
     */
    TDAgent.prototype = {
        /**
         * Reset the agent's policy and value function
         */
        reset: function () {
            this.ns = this.env.getNumStates();
            this.na = this.env.getMaxNumActions();
            this.Q = zeros(this.ns * this.na);
            if (this.qInitVal !== 0) {
                setConst(this.Q, this.qInitVal);
            }
            this.P = zeros(this.ns * this.na);
            this.e = zeros(this.ns * this.na);

            // model/planning vars
            this.envModelS = zeros(this.ns * this.na);
            setConst(this.envModelS, -1); // init to -1 so we can test if we saw the state before
            this.envModelR = zeros(this.ns * this.na);
            this.saSeen = [];
            this.pq = zeros(this.ns * this.na);

            // initialize uniform random policy
            for (var s = 0; s < this.ns; s++) {
                var poss = this.env.allowedActions(s);
                for (var i = 0, n = poss.length; i < n; i++) {
                    this.P[poss[i] * this.ns + s] = 1.0 / poss.length;
                }
            }
            // agent memory, needed for streaming updates
            // (s0,a0,r0,s1,a1,r1,...)
            this.r0 = null;
            this.s0 = null;
            this.s1 = null;
            this.a0 = null;
            this.a1 = null;
        },
        /**
         * An episode finished
         */
        resetEpisode: function () {
            // an episode finished
        },
        /**
         * Act according to epsilon greedy policy
         * @param s
         * @return {*}
         */
        act: function (s) {
            var poss = this.env.allowedActions(s),
                probs = [],
                a;
            for (var i = 0, n = poss.length; i < n; i++) {
                probs.push(this.P[poss[i] * this.ns + s]);
            }
            // epsilon greedy policy
            if (Math.random() < this.epsilon) {
                a = poss[randi(0, poss.length)]; // random available action
                this.explored = true;
            } else {
                a = poss[sampleWeighted(probs)];
                this.explored = false;
            }
            // shift state memory
            this.s0 = this.s1;
            this.a0 = this.a1;
            this.s1 = s;
            this.a1 = a;
            return a;
        },
        /**
         * Takes reward for previous action, which came from a call to act()
         * @param r1
         */
        learn: function (r1) {
            if (this.r0 !== null) {
                this.learnFromTuple(this.s0, this.a0, this.r0, this.s1, this.a1, this.lambda);
                if (this.planN > 0) {
                    this.updateModel(this.s0, this.a0, this.r0, this.s1);
                    this.plan();
                }
            }
            this.r0 = r1; // store this for next update
        },
        /**
         * Transition (s0,a0) -> (r0,s1) was observed. Update environment model
         * @param s0
         * @param a0
         * @param r0
         * @param s1
         */
        updateModel: function (s0, a0, r0, s1) {
            var sa = a0 * this.ns + s0;
            if (this.envModelS[sa] === -1) {
                // first time we see this state action
                this.saSeen.push(a0 * this.ns + s0); // add as seen state
            }
            this.envModelS[sa] = s1;
            this.envModelR[sa] = r0;
        },
        /**
         * Order the states based on current priority queue information
         */
        plan: function () {
            var spq = [];
            for (var i = 0, n = this.saSeen.length; i < n; i++) {
                var sa = this.saSeen[i],
                    sap = this.pq[sa];
                if (sap > 1e-5) { // gain a bit of efficiency
                    spq.push({sa: sa, p: sap});
                }
            }
            spq.sort(function (a, b) {
                return a.p < b.p ? 1 : -1
            });

            // perform the updates
            var nSteps = Math.min(this.planN, spq.length);
            for (var k = 0; k < nSteps; k++) {
                // random exploration
                //var i = randi(0, this.saSeen.length); // pick random prev seen state action
                //var s0a0 = this.saSeen[i];
                var s0a0 = spq[k].sa,
                    s0 = s0a0 % this.ns,
                    a0 = Math.floor(s0a0 / this.ns),
                    r0 = this.envModelR[s0a0],
                    s1 = this.envModelS[s0a0],
                    a1 = -1; // not used for Q learning
                // erase priority, since we're backing up this state
                this.pq[s0a0] = 0;

                if (this.update === 'sarsa') {
                    // generate random action?...
                    var poss = this.env.allowedActions(s1),
                        a1 = poss[randi(0, poss.length)];
                }
                // note lambda = 0 - shouldnt use eligibility trace here
                this.learnFromTuple(s0, a0, r0, s1, a1, 0);
            }
        },
        /**
         *
         * @param s0
         * @param a0
         * @param r0
         * @param s1
         * @param a1
         * @param lambda
         */
        learnFromTuple: function (s0, a0, r0, s1, a1, lambda) {
            var sa = a0 * this.ns + s0;

            // calculate the target for Q(s,a)
            if (this.update === 'qlearn') {
                // Q learning target is Q(s0,a0) = r0 + gamma * max_a Q[s1,a]
                var poss = this.env.allowedActions(s1),
                    qMax = 0;
                for (var i = 0, n = poss.length; i < n; i++) {
                    var s1a = poss[i] * this.ns + s1,
                        qVal = this.Q[s1a];
                    if (i === 0 || qVal > qMax) {
                        qMax = qVal;
                    }
                }
                var target = r0 + this.gamma * qMax;
            } else if (this.update === 'sarsa') {
                // SARSA target is Q(s0,a0) = r0 + gamma * Q[s1,a1]
                var s1a1 = a1 * this.ns + s1,
                    target = r0 + this.gamma * this.Q[s1a1];
            }

            if (lambda > 0) {
                // perform an eligibility trace update
                if (this.replacingTraces) {
                    this.e[sa] = 1;
                } else {
                    this.e[sa] += 1;
                }
                var eDecay = lambda * this.gamma,
                    stateUpdate = zeros(this.ns);
                for (var s = 0; s < this.ns; s++) {
                    var poss = this.env.allowedActions(s);
                    for (var i = 0; i < poss.length; i++) {
                        var a = poss[i],
                            saLoop = a * this.ns + s,
                            esa = this.e[saLoop],
                            update = this.alpha * esa * (target - this.Q[saLoop]);
                        this.Q[saLoop] += update;
                        this.updatePriority(s, a, update);
                        this.e[saLoop] *= eDecay;
                        var u = Math.abs(update);
                        if (u > stateUpdate[s]) {
                            stateUpdate[s] = u;
                        }
                    }
                }
                for (var s = 0; s < this.ns; s++) {
                    if (stateUpdate[s] > 1e-5) { // save efficiency here
                        this.updatePolicy(s);
                    }
                }
                if (this.explored && this.update === 'qlearn') {
                    // have to wipe the trace since q learning is off-policy :(
                    this.e = zeros(this.ns * this.na);
                }
            } else {
                // simpler and faster update without eligibility trace
                // update Q[sa] towards it with some step size
                var update = this.alpha * (target - this.Q[sa]);
                this.Q[sa] += update;
                this.updatePriority(s0, a0, update);
                // update the policy to reflect the change (if appropriate)
                this.updatePolicy(s0);
            }
        },
        /**
         * Used in planning. Invoked when Q[sa] += update we should find all states
         * that lead to (s,a) and upgrade their priority of being update in the next planning step
         * @param {number} s
         * @param {number} a
         * @param {number} u
         */
        updatePriority: function (s, a, u) {
            u = Math.abs(u);
            // for efficiency skip small updates
            if (u < 1e-5) {
                return;
            }
            // there is no planning to be done, skip.
            if (this.planN === 0) {
                return;
            }
            // note we are also iterating over impossible actions at all states,
            // but this should be okay because their envModelS should simply be -1
            // as initialized, so they will never be predicted to point to any state
            // because they will never be observed, and hence never be added to the model
            for (let si = 0; si < this.ns; si++) {
                for (let ai = 0; ai < this.na; ai++) {
                    let siai = ai * this.ns + si;
                    if (this.envModelS[siai] === s) {
                        // this state leads to s, add it to priority queue
                        this.pq[siai] += u;
                    }
                }
            }
        },
        /**
         * Set policy at s to be the action that achieves max_a Q(s,a)
         * first find the maxy Q values
         * @param s
         */
        updatePolicy: function (s) {
            var poss = this.env.allowedActions(s),
                qMax = 0.0, nMax = 0.0,
                qs = [],
                pSum = 0.0;
            for (let i = 0, n = poss.length; i < n; i++) {
                let a = poss[i],
                    qVal = this.Q[a * this.ns + s];
                qs.push(qVal);
                if (i === 0 || qVal > qMax) {
                    qMax = qVal;
                    nMax = 1;
                } else if (qVal === qMax) {
                    nMax += 1;
                }
            }
            // now update the policy smoothly towards the argmaxy actions
            for (let i = 0, n = poss.length; i < n; i++) {
                let a = poss[i],
                    target = (qs[i] === qMax) ? 1.0 / nMax : 0.0,
                    ix = a * this.ns + s;
                if (this.smoothPolicyUpdate) {
                    // slightly hacky :p
                    this.P[ix] += this.beta * (target - this.P[ix]);
                    pSum += this.P[ix];
                } else {
                    // set hard target
                    this.P[ix] = target;
                }
            }
            if (this.smoothPolicyUpdate) {
                // renomalize P if we're using smooth policy updates
                for (let i = 0, n = poss.length; i < n; i++) {
                    let a = poss[i];
                    this.P[a * this.ns + s] /= pSum;
                }
            }
        }
    };
    RL.TDAgent = TDAgent;

    /**
     *
     * @param {Object} env
     * @param {Object} opt
     * @return {DQNAgent}
     * @name DQNAgent
     * @constructor
     *
     * @param {Object} opt.spec - The brain options
     * @param {boolean} opt.spec.gamma - Discount factor [0, 1]
     * @param {boolean} opt.spec.epsilon - Initial epsilon for epsilon-greedy policy [0, 1]
     * @param {boolean} opt.spec.alpha - Value function learning rate
     * @param {boolean} opt.spec.experienceAddEvery - Number of time steps before we add another experience to replay memory
     * @param {boolean} opt.spec.experienceSize - Size of experience
     * @param {boolean} opt.spec.learningStepsPerIteration - Number of steps to go through during one tick
     * @param {boolean} opt.spec.tdErrorClamp - For robustness
     * @param {boolean} opt.spec.numHiddenUnits - Number of neurons in hidden layer
     */
    var DQNAgent = function (env, opt) {
        this.gamma = getOpt(opt, 'gamma', 0.75); // future reward discount factor
        this.epsilon = getOpt(opt, 'epsilon', 0.1); // for epsilon-greedy policy
        this.alpha = getOpt(opt, 'alpha', 0.01); // value function learning rate
        this.experienceAddEvery = getOpt(opt, 'experienceAddEvery', 25); // number of time steps before we add another experience to replay memory
        this.experienceSize = getOpt(opt, 'experienceSize', 5000); // size of experience replay
        this.learningStepsPerIteration = getOpt(opt, 'learningStepsPerIteration', 10);
        this.tdErrorClamp = getOpt(opt, 'tdErrorClamp', 1.0);
        this.numHiddenUnits = getOpt(opt, 'numHiddenUnits', 100);

        this.tdError = 0; // for visualization only...
        this.env = env;
        this.reset();

        return this;
    };

    /**
     *
     * @type {{reset: Function, toJSON: Function, fromJSON: Function, forwardQ: Function, act: Function, learn: Function, learnFromTuple: Function}}
     */
    DQNAgent.prototype = {
        reset: function () {
            this.nh = this.numHiddenUnits; // number of hidden units
            this.ns = this.env.getNumStates();
            this.na = this.env.getMaxNumActions();

            // nets are hardcoded for now as key (str) -> Mat
            // not proud of this. better solution is to have a whole Net object
            // on top of Mats, but for now sticking with this
            this.net = {};
            this.net.W1 = new R.randMat(this.nh, this.ns, 0, 0.01);
            this.net.b1 = new R.Mat(this.nh, 1, 0, 0.01);
            this.net.W2 = new R.randMat(this.na, this.nh, 0, 0.01);
            this.net.b2 = new R.Mat(this.na, 1, 0, 0.01);

            this.exp = []; // experience
            this.expi = 0; // where to insert

            this.t = 0;

            this.r0 = null;
            this.s0 = null;
            this.s1 = null;
            this.a0 = null;
            this.a1 = null;

            this.tdError = 0; // for visualization only...
        },
        /**
         *
         * @return {{}}
         */
        toJSON: function () {
            // save function
            var j = {};
            j.exp = this.exp;
            j.expi = this.expi;
            j.nh = this.nh;
            j.ns = this.ns;
            j.na = this.na;
            j.net = R.netToJSON(this.net);
            return j;
        },
        /**
         *
         * @param j
         */
        fromJSON: function (j) {
            // load function
            this.exp = j.exp;
            this.expi = j.expi;
            this.nh = j.nh;
            this.ns = j.ns;
            this.na = j.na;
            this.net = R.netFromJSON(j.net);
        },
        /**
         *
         * @param net
         * @param s
         * @param needsBackprop
         * @return {*}
         */
        forwardQ: function (net, s, needsBackprop) {
            var G = new R.Graph(needsBackprop);
            var a1mat = G.add(G.mul(net.W1, s), net.b1);
            var h1mat = G.tanh(a1mat);
            var a2mat = G.add(G.mul(net.W2, h1mat), net.b2);
            this.lastG = G; // back this up. Kind of hacky isn't it
            return a2mat;
        },
        /**
         *
         * @param {Array} slist
         * @return {Number|number}
         */
        act: function (slist) {
            // convert to a Mat column vector
            var s = new R.Mat(this.ns, 1);
            s.setFrom(slist);

            // epsilon greedy policy
            if(Math.random() < this.epsilon) {
                var a = randi(0, this.na);
            } else {
                // greedy wrt Q function
                var amat = this.forwardQ(this.net, s, false);
                var a = RL.maxI(amat.w); // returns index of argmax action
            }

            // shift state memory
            this.s0 = this.s1;
            this.a0 = this.a1;
            this.s1 = s;
            this.a1 = a;

            return a;
        },
        /**
         * perform an update on Q function
         * @param r1
         */
        learn: function (r1) {
            // perform an update on Q function
            if(this.r0 !== null && this.alpha > 0) {

                // learn from this tuple to get a sense of how "surprising" it is to the agent
                var tderror = this.learnFromTuple(this.s0, this.a0, this.r0, this.s1, this.a1);
                this.tdError = tderror; // a measure of surprise
if (isNaN(tderror)) {
    console.log();
}
                // decide if we should keep this experience in the replay
                if(this.t % this.experienceAddEvery === 0) {
                    this.exp[this.expi] = [this.s0, this.a0, this.r0, this.s1, this.a1];
                    this.expi += 1;
                    if(this.expi > this.experienceSize) { this.expi = 0; } // roll over when we run out
                }
                this.t += 1;

                // sample some additional experience from replay memory and learn from it
                for(var k=0;k<this.learningStepsPerIteration;k++) {
                    var ri = randi(0, this.exp.length); // todo: priority sweeps?
                    var e = this.exp[ri];
                    this.learnFromTuple(e[0], e[1], e[2], e[3], e[4])
                }
            }
            this.r0 = r1; // store for next update
        },
        /**
         *
         * @param s0
         * @param a0
         * @param r0
         * @param s1
         * @param a1
         * @return {number}
         */
        learnFromTuple: function (s0, a0, r0, s1, a1) {
            // want: Q(s,a) = r + gamma * max_a' Q(s',a')

            // compute the target Q value
            var tmat = this.forwardQ(this.net, s1, false);
            var qmax = r0 + this.gamma * tmat.w[RL.maxI(tmat.w)];

            // now predict
            var pred = this.forwardQ(this.net, s0, true);

            var tderror = pred.w[a0] - qmax;
            if (isNaN(qmax) || isNaN(tderror)) {
                console.log();
            }
            var clamp = this.tdErrorClamp;
            if(Math.abs(tderror) > clamp) {  // huber loss to robustify
                if(tderror > clamp) tderror = clamp;
                if(tderror < -clamp) tderror = -clamp;
            }
            pred.dw[a0] = tderror;
            this.lastG.backward(); // compute gradients on net params

            // update net
            R.updateNet(this.net, this.alpha);

            return tderror;
        }
    };
    RL.DQNAgent = DQNAgent;

    /**
     * buggy implementation, doesnt work...
     * @param env
     * @param opt
     * @name SimpleReinforceAgent
     * @constructor
     */
    var SimpleReinforceAgent = function (env, opt) {
        this.gamma = getOpt(opt, 'gamma', 0.5); // future reward discount factor
        this.epsilon = getOpt(opt, 'epsilon', 0.75); // for epsilon-greedy policy
        this.alpha = getOpt(opt, 'alpha', 0.001); // actor net learning rate
        this.beta = getOpt(opt, 'beta', 0.01); // baseline net learning rate
        this.env = env;
        this.reset();
    };

    /**
     *
     * @type {{reset: Function, forwardActor: Function, forwardValue: Function, act: Function, learn: Function}}
     */
    SimpleReinforceAgent.prototype = {
        /**
         *
         */
        reset: function () {
            this.ns = this.env.getNumStates();
            this.na = this.env.getMaxNumActions();
            this.nh = 100; // number of hidden units
            this.nhb = 100; // and also in the baseline lstm

            this.actorNet = {};
            this.actorNet.W1 = new R.randMat(this.nh, this.ns, 0, 0.01);
            this.actorNet.b1 = new R.Mat(this.nh, 1, 0, 0.01);
            this.actorNet.W2 = new R.randMat(this.na, this.nh, 0, 0.1);
            this.actorNet.b2 = new R.Mat(this.na, 1, 0, 0.01);
            this.actorOutputs = [];
            this.actorGraphs = [];
            this.actorActions = []; // sampled ones

            this.rewardHistory = [];

            this.baselineNet = {};
            this.baselineNet.W1 = new R.randMat(this.nhb, this.ns, 0, 0.01);
            this.baselineNet.b1 = new R.Mat(this.nhb, 1, 0, 0.01);
            this.baselineNet.W2 = new R.randMat(this.na, this.nhb, 0, 0.01);
            this.baselineNet.b2 = new R.Mat(this.na, 1, 0, 0.01);
            this.baselineOutputs = [];
            this.baselineGraphs = [];

            this.t = 0;
        },
        /**
         *
         * @param s
         * @param needsBackprop
         * @return {{}}
         */
        forwardActor: function (s, needsBackprop) {
            var net = this.actorNet,
                G = new R.Graph(needsBackprop),
                a1Mat = G.add(G.mul(net.W1, s), net.b1),
                h1Mat = G.tanh(a1Mat),
                a2Mat = G.add(G.mul(net.W2, h1Mat), net.b2);

            return {
                a: a2Mat,
                G: G
            };
        },
        /**
         *
         * @param s
         * @param needsBackprop
         * @return {{}}
         */
        forwardValue: function (s, needsBackprop) {
            var net = this.baselineNet,
                G = new R.Graph(needsBackprop),
                a1Mat = G.add(G.mul(net.W1, s), net.b1),
                h1Mat = G.tanh(a1Mat),
                a2Mat = G.add(G.mul(net.W2, h1Mat), net.b2);

            return {
                a: a2Mat,
                G: G
            };
        },
        /**
         *
         * @param slist
         * @return {Mat}
         */
        act: function (slist) {
            // convert to a Mat column vector
            var s = new R.Mat(this.ns, 1);
            s.setFrom(slist);

            // forward the actor to get action output
            var aNs = this.forwardActor(s, true),
                aMat = aNs.a,
                ag = aNs.G;
            this.actorOutputs.push(aMat);
            this.actorGraphs.push(ag);

            // forward the baseline estimator
            var aNs = this.forwardValue(s, true),
                vMat = aNs.a,
                vg = aNs.G;
            this.baselineOutputs.push(vMat);
            this.baselineGraphs.push(vg);

            // sample action from the stochastic gaussian policy
            var a = R.copyMat(aMat),
                gaussVar = 0.02;
            a.w[0] = randn(0, gaussVar);
            a.w[1] = randn(0, gaussVar);

            this.actorActions.push(a);

            // shift state memory
            this.s0 = this.s1;
            this.a0 = this.a1;
            this.s1 = s;
            this.a1 = a;

            return a;
        },
        /**
         *
         * @param r1
         */
        learn: function (r1) {
            // perform an update on Q function
            this.rewardHistory.push(r1);
            var n = this.rewardHistory.length,
                baselineMSE = 0.0,
                nUp = 100, // what chunk of experience to take
                nUse = 80; // what chunk to update from
            if (n >= nUp) {
                // lets learn and flush
                // first: compute the sample values at all points
                var vs = [];
                for (var t = 0; t < nUse; t++) {
                    var mul = 1,
                    // compute the actual discounted reward for this time step
                        V = 0;
                    for (var t2 = t; t2 < n; t2++) {
                        V += mul * this.rewardHistory[t2];
                        mul *= this.gamma;
                        if (mul < 1e-5) {
                            break;
                        } // efficiency savings
                    }
                    // get the predicted baseline at this time step
                    var b = this.baselineOutputs[t].w[0];
                    for (var i = 0; i < this.na; i++) {
                        // [the action delta] * [the desirebility]
                        var update = -(V - b) * (this.actorActions[t].w[i] - this.actorOutputs[t].w[i]);
                        if (update > 0.1) {
                            update = 0.1;
                        }
                        if (update < -0.1) {
                            update = -0.1;
                        }
                        this.actorOutputs[t].dw[i] += update;
                    }
                    var update = -(V - b);
                    if (update > 0.1) {
                        update = 0.1;
                    }
                    if (update < 0.1) {
                        update = -0.1;
                    }
                    this.baselineOutputs[t].dw[0] += update;
                    baselineMSE += (V - b) * (V - b);
                    vs.push(V);
                }
                baselineMSE /= nUse;
                // backprop all the things
                for (var t = 0; t < nUse; t++) {
                    this.actorGraphs[t].backward();
                    this.baselineGraphs[t].backward();
                }
                R.updateNet(this.actorNet, this.alpha); // update actor network
                R.updateNet(this.baselineNet, this.beta); // update baseline network

                // flush
                this.actorOutputs = [];
                this.rewardHistory = [];
                this.actorActions = [];
                this.baselineOutputs = [];
                this.actorGraphs = [];
                this.baselineGraphs = [];

                this.tdError = baselineMSE;
            }
            this.t += 1;
            this.r0 = r1; // store for next update
        }
    };
    RL.SimpleReinforceAgent = SimpleReinforceAgent;

    /**
     * buggy implementation as well, doesn't work
     * @param env
     * @param opt
     * @name RecurrentReinforceAgent
     * @constructor
     */
    var RecurrentReinforceAgent = function (env, opt) {
        this.gamma = getOpt(opt, 'gamma', 0.5); // future reward discount factor
        this.epsilon = getOpt(opt, 'epsilon', 0.1); // for epsilon-greedy policy
        this.alpha = getOpt(opt, 'alpha', 0.001); // actor net learning rate
        this.beta = getOpt(opt, 'beta', 0.01); // baseline net learning rate
        this.env = env;
        this.reset();
    };

    /**
     *
     * @type {{reset: Function, act: Function, learn: Function}}
     */
    RecurrentReinforceAgent.prototype = {
        /**
         *
         */
        reset: function () {
            this.ns = this.env.getNumStates();
            this.na = this.env.getMaxNumActions();
            this.nh = 40; // number of hidden units
            this.nhb = 40; // and also in the baseline lstm

            this.actorLSTM = R.initLSTM(this.ns, [this.nh], this.na);
            this.actorG = new R.Graph();
            this.actorPrev = null;
            this.actorOutputs = [];
            this.rewardHistory = [];
            this.actorActions = [];

            this.baselineLSTM = R.initLSTM(this.ns, [this.nhb], 1);
            this.baselineG = new R.Graph();
            this.baselinePrev = null;
            this.baselineOutputs = [];

            this.t = 0;

            this.r0 = null;
            this.s0 = null;
            this.s1 = null;
            this.a0 = null;
            this.a1 = null;
        },
        /**
         *
         * @param sList
         * @return {Mat}
         */
        act: function (sList) {
            // convert to a Mat column vector
            var s = new R.Mat(this.ns, 1);
            s.setFrom(sList);

            // forward the LSTM to get action distribution
            var actorNext = R.forwardLSTM(this.actorG, this.actorLSTM, [this.nh], s, this.actorPrev);
            this.actorPrev = actorNext;
            var aMat = actorNext.o;
            this.actorOutputs.push(aMat);

            // forward the baseline LSTM
            var baselineNext = R.forwardLSTM(this.baselineG, this.baselineLSTM, [this.nhb], s, this.baselinePrev);
            this.baselinePrev = baselineNext;
            this.baselineOutputs.push(baselineNext.o);

            // sample action from actor policy
            var gaussVar = 0.05,
                a = R.copyMat(aMat);
            for (var i = 0, n = a.w.length; i < n; i++) {
                a.w[0] += randn(0, gaussVar);
                a.w[1] += randn(0, gaussVar);
            }
            this.actorActions.push(a);

            // shift state memory
            this.s0 = this.s1;
            this.a0 = this.a1;
            this.s1 = s;
            this.a1 = a;
            return a;
        },
        /**
         *
         * @param r1
         */
        learn: function (r1) {
            // perform an update on Q function
            this.rewardHistory.push(r1);
            var n = this.rewardHistory.length,
                baselineMSE = 0.0,
                nUp = 100, // what chunk of experience to take
                nUse = 80; // what chunk to also update
            if (n >= nUp) {
                // lets learn and flush
                // first: compute the sample values at all points
                var vs = [];
                for (var t = 0; t < nUse; t++) {
                    var mul = 1,
                        V = 0;
                    for (var t2 = t; t2 < n; t2++) {
                        V += mul * this.rewardHistory[t2];
                        mul *= this.gamma;
                        if (mul < 1e-5) {
                            break;
                        } // efficiency savings
                    }
                    var b = this.baselineOutputs[t].w[0];
                    // todo: take out the constants etc.
                    for (var i = 0; i < this.na; i++) {
                        // [the action delta] * [the desirability]
                        var update = -(V - b) * (this.actorActions[t].w[i] - this.actorOutputs[t].w[i]);
                        if (update > 0.1) {
                            update = 0.1;
                        }
                        if (update < -0.1) {
                            update = -0.1;
                        }
                        this.actorOutputs[t].dw[i] += update;
                    }
                    var update = -(V - b);
                    if (update > 0.1) {
                        update = 0.1;
                    }
                    if (update < 0.1) {
                        update = -0.1;
                    }
                    this.baselineOutputs[t].dw[0] = (b - V);
                    baselineMSE += (V - b) * (V - b);
                    vs.push(V);
                }
                baselineMSE /= nUse;
                this.actorG.backward(); // update params! woohoo!
                this.baselineG.backward();
                R.updateNet(this.actorLSTM, this.alpha); // update actor network
                R.updateNet(this.baselineLSTM, this.beta); // update baseline network

                // flush
                this.actorG = new R.Graph();
                this.actorPrev = null;
                this.actorOutputs = [];
                this.rewardHistory = [];
                this.actorActions = [];

                this.baselineG = new R.Graph();
                this.baselinePrev = null;
                this.baselineOutputs = [];

                this.tdError = baselineMSE;
            }
            this.t += 1;
            this.r0 = r1; // store for next update
        }
    };
    RL.RecurrentReinforceAgent = RecurrentReinforceAgent;

    /**
     * Buggy implementation as well, doesn't work
     * @param env
     * @param opt
     * @name DeterministPG
     * @constructor
     */
    var DeterministPG = function (env, opt) {
        this.gamma = getOpt(opt, 'gamma', 0.5); // future reward discount factor
        this.epsilon = getOpt(opt, 'epsilon', 0.5); // for epsilon-greedy policy
        this.alpha = getOpt(opt, 'alpha', 0.001); // actor net learning rate
        this.beta = getOpt(opt, 'beta', 0.01); // baseline net learning rate
        this.env = env;
        this.reset();
    };

    /**
     *
     * @type {{reset: Function, forwardActor: Function, act: Function, utilJacobianAt: Function, learn: Function}}
     */
    DeterministPG.prototype = {
        /**
         *
         */
        reset: function () {
            this.ns = this.env.getNumStates();
            this.na = this.env.getMaxNumActions();
            this.nh = 100; // number of hidden units

            // actor
            this.actorNet = {};
            this.actorNet.W1 = new R.randMat(this.nh, this.ns, 0, 0.01);
            this.actorNet.b1 = new R.Mat(this.nh, 1, 0, 0.01);
            this.actorNet.W2 = new R.randMat(this.na, this.ns, 0, 0.1);
            this.actorNet.b2 = new R.Mat(this.na, 1, 0, 0.01);
            this.nTheta = this.na * this.ns + this.na; // number of params in actor

            // critic
            this.criticW = new R.randMat(1, this.nTheta, 0, 0.01); // row vector

            this.r0 = null;
            this.s0 = null;
            this.s1 = null;
            this.a0 = null;
            this.a1 = null;
            this.t = 0;
        },
        /**
         *
         * @param s
         * @param needsBackprop
         * @return {{}}
         */
        forwardActor: function (s, needsBackprop) {
            var net = this.actorNet,
                G = new R.Graph(needsBackprop),
                a1Mat = G.add(G.mul(net.W1, s), net.b1),
                h1Mat = G.tanh(a1Mat),
                a2Mat = G.add(G.mul(net.W2, h1Mat), net.b2);

            return {
                a: a2Mat,
                G: G
            };
        },
        /**
         *
         * @param sList
         * @return {Mat}
         */
        act: function (sList) {
            // convert to a Mat column vector
            var s = new R.Mat(this.ns, 1);
            s.setFrom(sList);

            // forward the actor to get action output
            var aNs = this.forwardActor(s, false),
                aMat = aNs.a,
                ag = aNs.G,

            // sample action from the stochastic gaussian policy
                a = R.copyMat(aMat);
            if (Math.random() < this.epsilon) {
                var gaussVar = 0.02;
                a.w[0] = randn(0, gaussVar);
                a.w[1] = randn(0, gaussVar);
            }
            var clamp = 0.25;
            if (a.w[0] > clamp) {
                a.w[0] = clamp;
            }
            if (a.w[0] < -clamp) {
                a.w[0] = -clamp;
            }
            if (a.w[1] > clamp) {
                a.w[1] = clamp;
            }
            if (a.w[1] < -clamp) {
                a.w[1] = -clamp;
            }

            // shift state memory
            this.s0 = this.s1;
            this.a0 = this.a1;
            this.s1 = s;
            this.a1 = a;

            return a;
        },
        /**
         *
         * @param s
         * @return {Mat}
         */
        utilJacobianAt: function (s) {
            var uJacobian = new R.Mat(this.nTheta, this.na);
            for (var a = 0; a < this.na; a++) {
                R.netZeroGrads(this.actorNet);
                var ag = this.forwardActor(this.s0, true);
                ag.a.dw[a] = 1.0;
                ag.G.backward();
                var gFlat = R.netFlattenGrads(this.actorNet);
                uJacobian.setColumn(gFlat, a);
            }

            return uJacobian;
        },
        /**
         *
         * @param r1
         */
        learn: function (r1) {
            // perform an update on Q function
            //this.rewardHistory.push(r1);
            if (this.r0 !== null) {
                var gTmp = new R.Graph(false),
                // dpg update:
                // first compute the features psi:
                // the jacobian matrix of the actor for s
                    uJacobian0 = this.utilJacobianAt(this.s0),
                // now form the features \psi(s,a)
                    psiSa0 = gTmp.mul(uJacobian0, this.a0), // should be [this.nTheta x 1] "feature" vector
                    qw0 = gTmp.mul(this.criticW, psiSa0), // 1x1
                // now do the same thing because we need \psi(s_{t+1}, \mu\_\theta(s\_t{t+1}))
                    uJacobian1 = this.utilJacobianAt(this.s1),
                    ag = this.forwardActor(this.s1, false),
                    psiSa1 = gTmp.mul(uJacobian1, ag.a),
                    qw1 = gTmp.mul(this.criticW, psiSa1), // 1x1
                // get the td error finally
                    tdError = this.r0 + this.gamma * qw1.w[0] - qw0.w[0]; // lol
                if (tdError > 0.5) {
                    tdError = 0.5; // clamp
                }
                if (tdError < -0.5) {
                    tdError = -0.5;
                }
                this.tdError = tdError;

                // update actor policy with natural gradient
                var net = this.actorNet,
                    ix = 0;
                for (var p in net) {
                    var mat = net[p];
                    if (net.hasOwnProperty(p)) {
                        for (var i = 0, n = mat.w.length; i < n; i++) {
                            mat.w[i] += this.alpha * this.criticW.w[ix]; // natural gradient update
                            ix += 1;
                        }
                    }
                }
                // update the critic parameters too
                for (var i = 0; i < this.nTheta; i++) {
                    var update = this.beta * tdError * psiSa0.w[i];
                    this.criticW.w[i] += update;
                }
            }
            this.r0 = r1; // store for next update
        }
    };
    RL.DeterministPG = DeterministPG;

    /**
     * Chromosome implementation using an array of floats
     * @param floatArray
     * @name Chromosome
     * @constructor
     */
    var Chromosome = function (floatArray) {
        this.fitness = 0; // default value
        this.nTrial = 0; // number of trials subjected to so far.
        this.gene = floatArray;
    };

    Chromosome.prototype = {
        /**
         * Adds a normal random variable of stdev width, zero mean to each gene.
         * @param burstMagnitude
         */
        burstMutate: function (burstMagnitude) {
            var burstMagnitude = burstMagnitude || 0.1,
                N = this.gene.length;

            for (var i = 0; i < N; i++) {
                this.gene[i] += randn(0.0, burstMagnitude);
            }
        },
        /**
         * Resets each gene to a random value with zero mean and stdev
         * @param burstMagnitude
         */
        randomize: function (burstMagnitude) {
            var burstMagnitude = burstMagnitude || 0.1,
                N = this.gene.length;

            for (var i = 0; i < N; i++) {
                this.gene[i] = randn(0.0, burstMagnitude);
            }
        },
        /**
         * Adds random gaussian (0,stdev) to each gene with prob mutation_rate
         * @param mutationRate
         * @param burstMagnitude
         */
        mutate: function (mutationRate, burstMagnitude) {
            var mutationRate = mutationRate || 0.1,
                burstMagnitude = burstMagnitude || 0.1,
                N = this.gene.length;

            for (var i = 0; i < N; i++) {
                if (randf(0, 1) < mutationRate) {
                    this.gene[i] += randn(0.0, burstMagnitude);
                }
            }
        },
        /**
         * Performs one-point crossover with partner to produce 2 kids
         * @param partner
         * @param kid1
         * @param kid2
         */
        crossover: function (partner, kid1, kid2) {
            //assumes all chromosomes are initialised with same array size. pls make sure of this before calling
            var N = this.gene.length,
                l = randi(0, N); // crossover point
            for (var i = 0; i < N; i++) {
                if (i < l) {
                    kid1.gene[i] = this.gene[i];
                    kid2.gene[i] = partner.gene[i];
                } else {
                    kid1.gene[i] = partner.gene[i];
                    kid2.gene[i] = this.gene[i];
                }
            }
        },
        /**
         * Copies c's gene into itself
         * @param c
         */
        copyFrom: function (c) {
            this.copyFromGene(c.gene);
        },
        /**
         * Copy a gene into itself
         * @param gene
         */
        copyFromGene: function (gene) {
            var N = this.gene.length;
            for (var i = 0; i < N; i++) {
                this.gene[i] = gene[i];
            }
        },
        /**
         * Returns an exact copy of itself (into new memory, doesn't return reference)
         * @return {Chromosome}
         */
        clone: function () {
            var newGene = zeros(this.gene.length);
            for (var i = 0; i < this.gene.length; i++) {
                newGene[i] = Math.round(10000 * this.gene[i]) / 10000;
            }
            var c = new Chromosome(newGene);
            c.fitness = this.fitness;

            return c;
        },
        /**
         * Pushes this chromosome to a specified network
         * @param net
         */
        pushToNetwork: function (net) {
            pushGeneToNetwork(net, this.gene);
        }
    };
    RL.Chromosome = Chromosome;

    /**
     * Counts the number of weights and biases in the network
     * @param net
     * @return {number}
     */
    function getNetworkSize(net) {
        var layer = null,
            filter = null,
            bias = null,
            w = null,
            count = 0;

        for (var i = 0; i < net.layers.length; i++) {
            layer = net.layers[i];
            filter = layer.filters;
            if (filter) {
                for (var j = 0; j < filter.length; j++) {
                    w = filter[j].w;
                    count += w.length;
                }
            }
            bias = layer.biases;
            if (bias) {
                w = bias.w;
                count += w.length;
            }
        }
        return count;
    }

    /**
     * Pushes the gene (floatArray) to fill up weights and biases in net
     * @param net
     * @param gene
     */
    function pushGeneToNetwork(net, gene) {
        var count = 0,
            layer = null,
            filter = null,
            bias = null,
            w = null;

        for (var i = 0; i < net.layers.length; i++) {
            layer = net.layers[i];
            filter = layer.filters;
            if (filter) {
                for (var j = 0; j < filter.length; j++) {
                    w = filter[j].w;
                    for (var k = 0; k < w.length; k++) {
                        w[k] = gene[count++];
                    }
                }
            }
            bias = layer.biases;
            if (bias) {
                w = bias.w;
                for (k = 0; k < w.length; k++) {
                    w[k] = gene[count++];
                }
            }
        }
    }

    /**
     * Gets all the weight/biases from network in a floatArray
     * @param net
     * @return {Array}
     */
    function getGeneFromNetwork(net) {
        var gene = [],
            layer = null,
            filter = null,
            bias = null,
            w = null;

        for (var i = 0; i < net.layers.length; i++) {
            layer = net.layers[i];
            filter = layer.filters;
            if (filter) {
                for (var j = 0; j < filter.length; j++) {
                    w = filter[j].w;
                    for (var k = 0; k < w.length; k++) {
                        gene.push(w[k]);
                    }
                }
            }
            bias = layer.biases;
            if (bias) {
                w = bias.w;
                for (k = 0; k < w.length; k++) {
                    gene.push(w[k]);
                }
            }
        }
        return gene;
    }

    /**
     * Randomize neural network with random weights and biases
     * @param net
     */
    var randomizeNetwork = function (net) {
        var netSize = getNetworkSize(net),
            chromosome = new Chromosome(zeros(netSize));
        chromosome.randomize(1.0);
        pushGeneToNetwork(net, chromosome.gene);

        return chromosome;
    };
    RL.randomizeNetwork = randomizeNetwork;

    /**
     * Returns a FloatArray copy of real numbered array x.
     * @param x
     * @return {*}
     */
    function copyFloatArray(x) {
        var N = x.length,
            y = zeros(N);
        for (var i = 0; i < N; i++) {
            y[i] = x[i];
        }
        return y;
    }

    /**
     * Copies a FloatArray copy of real numbered array x into y
     * @param x
     * @param y
     */
    function copyFloatArrayIntoArray(x, y) {
        var N = x.length;
        for (var i = 0; i < N; i++) {
            y[i] = x[i];
        }
    }

    /**
     * Implementation of basic conventional neuroevolution algorithm (CNE)
     * options:
     * - populationSize: positive integer
     * - mutationRate: [0, 1] when mutation happens, chance of each gene getting mutated
     * - elitePercentage: [0, 0.3] only this group mates and produces offsprings
     * - mutationSize: positive floating point stdev of gausian noise added for mutations
     * - targetFitness: after fitness achieved is greater than this float value, learning stops
     * - burstGenerations: positive integer if best fitness doesn't improve after this number of generations
     * then mutate everything!
     * - bestTrial: default 1 save best of bestTrial's results for each chromosome.
     * - initGene: init float array to initialize the chromosomes can be result obtained from pretrained sessions.
     * @param opts
     * @param initGene
     * @name GATrainer
     * @constructor
     */
    var GATrainer = function (net, opts, initGene) {
        this.net = net;
        var layerDefs = getOpt(opts, 'layerDefs', [
            {type: 'input', out_sx: 1, out_sy: 1, out_depth: 1},
            {type: 'fc', num_neurons: 12, activation: 'relu'},
            {type: 'fc', num_neurons: 8, activation: 'sigmoid'},
            {type: 'regression', num_neurons: 1}
        ]);

        this.populationSize = getOpt(opts, 'populationSize', 100);
        // make sure even number
        this.populationSize = Math.floor(this.populationSize / 2) * 2;
        this.mutationRate = getOpt(opts, 'mutationRate', 0.01);
        this.elitePercentage = getOpt(opts, 'elitePercentage', 0.2);
        this.mutationSize = getOpt(opts, 'mutationSize', 0.05);
        this.targetFitness = getOpt(opts, 'targetFitness', 10000000000000000);
        this.burstGenerations = getOpt(opts, 'burstGenerations', 10);
        this.bestTrial = getOpt(opts, 'bestTrial', 1);
        this.numMatch = getOpt(opts, 'numMatch', 1);
        this.chromosomeSize = getNetworkSize(this.net);

        var initChromosome = null;
        if (initGene) {
            initChromosome = new Chromosome(initGene);
        }
        // population
        this.chromosomes = [];
        for (var i = 0; i < this.populationSize; i++) {
            var chromosome = new Chromosome(zeros(this.chromosomeSize));
            // if initial gene supplied, burst mutate param.
            if (initChromosome) {
                chromosome.copyFrom(initChromosome);
                // pushGeneToNetwork(this.net, initChromosome.gene);
                if (i > 0) {
                    // don't mutate the first guy.
                    chromosome.burstMutate(this.mutationSize);
                }
            } else {
                chromosome.randomize(1.0);
            }
            this.chromosomes.push(chromosome);
        }
        pushGeneToNetwork(this.net, this.chromosomes[0].gene); // push first chromosome to neural network. (replaced *1 above)

        this.bestFitness = -10000000000000000;
        this.bestFitnessCount = 0;
    };

    /**
     *
     * @type {{train: Function}}
     */
    GATrainer.prototype = {

        /**
         * Has to pass in fitness function.
         * returns best fitness
         * @param {type} fitFunc
         * @return {number}
         */
        train: function (fitFunc) {
            var bestFitFunc = function (nTrial, net) {
                var bestFitness = -10000000000000000,
                    fitness;
                for (var i = 0; i < nTrial; i++) {
                    fitness = fitFunc(net);
                    if (fitness > bestFitness) {
                        bestFitness = fitness;
                    }
                }

                return bestFitness;
            };

            var i, N,
                fitness,
                c = this.chromosomes,
                bestFitness = -10000000000000000;
            N = this.populationSize;

            // process first net (the best one)
            pushGeneToNetwork(this.net, c[0].gene);
            fitness = bestFitFunc(this.bestTrial, this.net);
            c[0].fitness = fitness;
            bestFitness = fitness;
            if (bestFitness > this.targetFitness) {
                return bestFitness;
            }

            for (i = 1; i < N; i++) {
                pushGeneToNetwork(this.net, c[i].gene);
                fitness = bestFitFunc(this.bestTrial, this.net);
                c[i].fitness = fitness;
                if (fitness > bestFitness) {
                    bestFitness = fitness;
                }
            }

            // sort the chromosomes by fitness
            c = c.sort(function (a, b) {
                if (a.fitness > b.fitness) {
                    return -1;
                }
                if (a.fitness < b.fitness) {
                    return 1;
                }
                return 0;
            });

            var Nelite = Math.floor(Math.floor(this.elitePercentage * N) / 2) * 2; // even number
            for (i = Nelite; i < N; i += 2) {
                var p1 = randi(0, Nelite),
                    p2 = randi(0, Nelite);
                c[p1].crossover(c[p2], c[i], c[i + 1]);
            }

            // keep best guy the same.  don't mutate the best one, so start from 1, not 0.
            for (i = 1; i < N; i++) {
                c[i].mutate(this.mutationRate, this.mutationSize);
            }

            // push best one to network.
            pushGeneToNetwork(this.net, c[0].gene);
            // didn't beat the record this time
            if (bestFitness < this.bestFitness) {
                this.bestFitnessCount++;
                // stagnation, do burst mutate!
                if (this.bestFitnessCount > this.burstGenerations) {
                    for (i = 1; i < N; i++) {
                        c[i].copyFrom(c[0]);
                        c[i].burstMutate(this.mutationSize);
                    }
                }
            } else {
                this.bestFitnessCount = 0; // reset count for burst
                this.bestFitness = bestFitness; // record the best fitness score
            }

            return bestFitness;
        },
        /**
         * Uses arms race to determine best chromosome by playing them against
         * each other this algorithm loops through each chromosome, and for each
         * chromosome, it will play num_match games against other chromosomes.
         * at the same time.  if it wins, the fitness is incremented by 1
         * else it is subtracted by 1.  if the game is tied, the fitness doesn't
         * change. at the end of the algorithm, each fitness is divided by the
         * number of games the chromosome has played the algorithm will then
         * sort the chromosomes by this average fitness
         *
         * @param matchFunc
         */
        matchTrain: function (matchFunc) {
            var i, j, N,
                opponent,
                fitness,
                c = this.chromosomes,
                result = 0;
            N = this.populationSize;

            // zero out all fitness and
            for (i = 0; i < N; i++) {
                c[i].fitness = 0;
                c[i].nTrial = 0;
            }

            // get these guys to fight against each other!
            for (i = 0; i < N; i++) {
                for (j = 0; j < this.numMatch; j++) {
                    opponent = randi(0, N);
                    if (opponent === i) continue;
                    result = matchFunc(c[i], c[opponent]);
                    c[i].nTrial += 1;
                    c[opponent].nTrial += 1;
                    c[i].fitness += (result+1);
                    // if result is -1, it means opponent has won.
                    c[opponent].fitness += ((-result)+1);
                }
            }

            // average out all fitness scores by the number of matches each chromosome has done.
            for (i = 0; i < N; i++) {
                if (c[i].nTrial > 0) {
                    c[i].fitness /= c[i].nTrial;
                }
            }

            // sort the chromosomes by fitness
            c = c.sort(function (a, b) {
                if (a.fitness > b.fitness) { return -1; }
                if (a.fitness < b.fitness) { return 1; }
                return 0;
            });

            var Nelite = Math.floor(Math.floor(this.elitePercentage*N)/2)*2; // even number
            for (i = Nelite; i < N; i+=2) {
                var p1 = randi(0, Nelite);
                var p2 = randi(0, Nelite);
                c[p1].crossover(c[p2], c[i], c[i+1]);
            }

            for (i = 2; i < N; i++) {
                // keep two best guys the same.  don't mutate the best one, so start from 2, not 0.
                c[i].mutate(this.mutationRate, this.mutationSize);
            }

            // push best one to network.
            pushGeneToNetwork(this.net, c[0].gene);
        }
    };
    RL.GATrainer = GATrainer;

    /**
     * A variant of ESP network implemented population of N sub neural nets, each to
     * be co-evolved by ESPTrainer fully recurrent.
     * Outputs of each sub nn is also the input of all other sub nn's and itself.
     * inputs should be order of ~ -10 to +10, and expect output to be similar magnitude.
     * user can grab outputs of the the N sub networks and use them to accomplish some task for training
     * @param {number} nSp Number of sub populations (ie, 4)
     * @param {number} nInput Number of real inputs to the system (ie, 2).  so actual number of input is Niput + nSp
     * @param {number} nHidden Number of hidden neurons in each sub population (ie, 16)
     * @param {Array} genes (optional) array of nSp genes (floatArrays) to initialise the network (pretrained)
     * @return {ESPNet}
     * @name ESPNet
     * @constructor
     */
    var ESPNet = function (nSp, nInput, nHidden, genes) {
        this.net = []; // an array of convnet.js feed forward nn's
        this.nInput = nInput;
        this.nSp = nSp;
        this.nHidden = nHidden;
        this.input = new Vol(1, 1, nSp + nInput); // hold most up to date input vector
        this.output = zeros(nSp);

        // define the architecture of each sub nn:
        var layerDefs = [],
            network;
        layerDefs.push({
            type: 'input',
            outSx: 1,
            outSy: 1,
            outDepth: (nInput + nSp)
        });
        layerDefs.push({
            type: 'fc',
            numNeurons: nHidden,
            activation: 'sigmoid'
        });
        layerDefs.push({
            type: 'regression',
            numNeurons: 1 // one output for each sub nn, gets fed back into inputs.
        });

        for (var i = 0; i < nSp; i++) {
            network = new Net();
            network.makeLayers(layerDefs);
            this.net.push(network);
        }

        // if pretrained network is supplied:
        if (genes) {
            this.pushGenes(genes);
        }
    };

    /**
     *
     * @type {{feedback: Function, setInput: Function, forward: Function, getNetworkSize: Function, getGenes: Function, pushGenes: Function}}
     */
    ESPNet.prototype = {
        /**
         * Feeds output back to last bit of input vector
         * @return {undefined}
         */
        feedback: function () {
            var i,
                nInput = this.nInput,
                nSp = this.nSp;
            for (i = 0; i < nSp; i++) {
                this.input.w[i + nInput] = this.output[i];
            }
        },
        /**
         * Input is a vector of length this.nInput of real numbers this function also
         * grabs the previous most recent output and put it into the internal input vector
         * @param {type} input
         * @return {undefined}
         */
        setInput: function (input) {
            var i,
                nInput = this.nInput,
                nSp = this.nSp;
            for (i = 0; i < nInput; i++) {
                this.input.w[i] = input[i];
            }
            this.feedback();
        },
        /**
         * Returns array of output of each nSp neurons after a forward pass.
         * @return {Array}
         */
        forward: function () {
            var i, j,
                nInput = this.nInput,
                nSp = this.nSp,
                y = zeros(nSp),
                a; // temp variable to old output of forward pass
            for (i = nSp - 1; i >= 0; i--) {
                // for the base network, forward with output of other support networks
                if (i === 0) {
                    this.feedback();
                }
                a = this.net[i].forward(this.input); // forward pass sub nn # i
                y[i] = a.w[0]; // each sub nn only has one output.
                this.output[i] = y[i]; // set internal output to track output
            }

            return y;
        },
        /**
         * Return total number of weights and biases in a single sub nn.
         * @return {number}
         */
        getNetworkSize: function () {
            return getNetworkSize(this.net[0]); // each network has identical architecture.
        },
        /**
         * Return an array of nSp genes (floatArrays of length getNetworkSize())
         * @return {Array}
         */
        getGenes: function () {
            var i,
                nSp = this.nSp,
                result = [];
            for (i = 0; i < nSp; i++) {
                result.push(getGeneFromNetwork(this.net[i]));
            }

            return result;
        },
        /**
         * Genes is an array of nSp genes (floatArrays)
         * @param {type} genes
         * @return {undefined}
         */
        pushGenes: function (genes) {
            var i,
                nSp = this.nSp;
            for (i = 0; i < nSp; i++) {
                pushGeneToNetwork(this.net[i], genes[i]);
            }
        }
    };
    RL.ESPNet = ESPNet;

    /**
     * An implementation of a variation of Enforced Sub Population neuro evolution algorithm
     * options:
     * - populationSize: population size of each subnetwork inside espnet
     * - mutationRate: [0, 1], when mutation happens, chance of each gene getting mutated
     * - elitePercentage: [0, 0.3], only this group mates and produces offsprings
     * - mutationSize: positive floating point.  stdev of gausian noise added for mutations
     * - targetFitness: after fitness achieved is greater than this float value, learning stops
     * - numPasses: number of times each neuron within a sub population is tested
     * on average, each neuron will be tested numPasses * esp.nSp times.
     * - burstGenerations: positive integer.  if best fitness doesn't improve after this number of generations
     * then start killing neurons that don't contribute to the bottom line! (reinit them with randoms)
     * - bestMode: if true, this will assign each neuron to the best fitness trial it has experienced.
     * if false, this will use the average of all trials experienced.
     * - initGenes:  init nSp array of floatarray to initialize the chromosomes.  can be result obtained from pretrained sessions.
     * @param espnet
     * @param opts
     * @param initGenes
     * @name ESPTrainer
     * @constructor
     */
    var ESPTrainer = function (espnet, opts, initGenes) {
        this.espnet = espnet;
        this.nSp = espnet.nSp;
        var nSp = this.nSp;
        this.populationSize = getOpt(opts, 'populationSize', 50);
        this.populationSize = Math.floor(this.populationSize / 2) * 2; // make sure even number
        this.mutationRate = getOpt(opts, 'mutationRate', 0.2);
        this.elitePercentage = getOpt(opts, 'elitePercentage', 0.2);
        this.mutationSize = getOpt(opts, 'mutationSize', 0.02);
        this.targetFitness = getOpt(opts, 'targetFitness', 10000000000000000);
        this.numPasses = getOpt(opts, 'numPasses', 2);
        this.burstGenerations = getOpt(opts, 'burstGenerations', 10);
        this.bestMode = getOpt(opts, 'bestMode', false);
        this.chromosomeSize = this.espnet.getNetworkSize();

        this.initialize(initGenes);
    };

    /**
     *
     * @type {{initialize: Function, train: Function}}
     */
    ESPTrainer.prototype = {

        /**
         *
         * @param initGenes
         */
        initialize: function (initGenes) {
            var i, j, y,
                nSp = this.nSp,
                chromosomes, chromosome;
            // sub populations
            this.sp = [];
            // array of nSp number of genes, records the best combination of genes for the bestFitness achieved so far.
            this.bestGenes = [];
            for (i = 0; i < nSp; i++) {
                // empty list of chromosomes
                chromosomes = [];
                for (j = 0; j < this.populationSize; j++) {
                    chromosome = new Chromosome(zeros(this.chromosomeSize));
                    if (initGenes) {
                        chromosome.copyFromGene(initGenes[i]);
                        // don't mutate first guy (pretrained)
                        if (j > 0) {
                            chromosome.burstMutate(this.mutationSize);
                        }
                        // push random genes to this.bestGenes since it has not been initalized.
                    } else {
                        // create random gene array if no pretrained one is supplied.
                        chromosome.randomize(1.0);
                    }
                    chromosomes.push(chromosome);
                }
                // y should either be random init gene, or pretrained.
                y = copyFloatArray(chromosomes[0].gene);
                this.bestGenes.push(y);
                // push array of chromosomes into each population
                this.sp.push(chromosomes);
            }

            assert(this.bestGenes.length === nSp);
            this.espnet.pushGenes(this.bestGenes); // initial

            this.bestFitness = -10000000000000000;
            this.bestFitnessCount = 0;
        },
        /**
         * Has to pass in fitness function.  returns best fitness
         * @param {type} fitFunc
         * @return {number}
         */
        train: function (fitFunc) {
            var i, j, k, m, N, nSp,
                fitness,
                c = this.sp, // array of arrays that holds every single chromosomes (nSp x N);
                bestFitness = -10000000000000000,
                bestSet, bestGenes,
                cSet,
                genes;
            N = this.populationSize; // number of chromosomes in each sub population
            nSp = this.nSp; // number of sub populations

            /**
             * Return best fitness run nTrial times
             * @param nTrial
             * @param net
             * @return {number}
             */
            var bestFitFunc = function (nTrial, net) {
                var bestFitness = -10000000000000000,
                    fitness;
                for (var i = 0; i < nTrial; i++) {
                    fitness = fitFunc(net);
                    if (fitness > bestFitness) {
                        bestFitness = fitness;
                    }
                }
                return bestFitness;
            };

            /**
             * Create a new array filled with genes from an array of chromosomes
             * returns an array of nSp floatArrays
             * @param s
             * @return {Array}
             */
            function getGenesFromChromosomes(s) {
                var g = [];
                for (var i = 0; i < s.length; i++) {
                    g.push(copyFloatArray(s[i].gene));
                }
                return g;
            }

            /**
             * Makes a copy of an array of gene, helper function
             * @param s
             * @return {Array}
             */
            function makeCopyOfGenes(s) {
                var g = [];
                for (var i = 0; i < s.length; i++) {
                    g.push(copyFloatArray(s[i]));
                }
                return g;
            }

            /**
             * Randomize all of nth sub population of entire chromosome set c
             * @param n
             * @param c
             */
            function randomizeSubPopulation(n, c) {
                for (var i = 0; i < N; i++) {
                    c[n][i].randomize(1.0);
                }
            }

            /**
             * Sort the list of chromosomes according to their fitness
             * @param a
             * @param b
             * @return {number}
             */
            function compareChromosomes(a, b) {
                if ((a.fitness / a.nTrial) > (b.fitness / b.nTrial)) {
                    return -1;
                }
                if ((a.fitness / a.nTrial) < (b.fitness / b.nTrial)) {
                    return 1;
                }
                return 0;
            }

            // Iterate over each gene in each sub population to initialise the nTrial to zero (will be incremented later)
            for (i = 0; i < nSp; i++) { // loop over every sub population
                for (j = 0; j < N; j++) {
                    if (this.bestMode) { // best mode turned on, no averaging, but just recording best score.
                        c[i][j].nTrial = 1;
                        c[i][j].fitness = -10000000000000000;
                    } else {
                        c[i][j].nTrial = 0;
                        c[i][j].fitness = 0;
                    }
                }
            }

            // see if the global best gene has met target.  if so, can end it now.
            assert(this.bestGenes.length === nSp);
            this.espnet.pushGenes(this.bestGenes); // put the random set of networks into the espnet
            fitness = fitFunc(this.espnet); // try out this set, and get the fitness
            if (fitness > this.targetFitness) {
                return fitness;
            }
            bestGenes = makeCopyOfGenes(this.bestGenes);
            bestFitness = fitness;
            //this.bestFitness = fitness;

            // For each chromosome in a sub population, choose random chromosomes from all other
            // sub populations to build a ESPNet.
            // Perform fitFunc on that ESPNet to get the fitness of that combination.
            // Add the fitness to this chromosome, and all participating chromosomes.
            // Increment the nTrial of all participating chromosomes by one, so afterwards they
            // can be sorted by average fitness repeat this process this.numPasses times
            for (k = 0; k < this.numPasses; k++) {
                for (i = 0; i < nSp; i++) {
                    for (j = 0; j < N; j++) {
                        // build an array of chromosomes randomly
                        cSet = [];
                        for (m = 0; m < nSp; m++) {
                            if (m === i) { // push current iterated neuron
                                cSet.push(c[m][j]);
                            } else { // push random neuron in sub population m
                                cSet.push(c[m][randi(0, N)]);
                            }
                        }
                        genes = getGenesFromChromosomes(cSet);
                        assert(genes.length === nSp);
                        this.espnet.pushGenes(genes); // put the random set of networks into the espnet

                        fitness = fitFunc(this.espnet); // try out this set, and get the fitness

                        for (m = 0; m < nSp; m++) { // tally the scores into each participating neuron
                            if (this.bestMode) {
                                if (fitness > cSet[m].fitness) { // record best fitness this neuron participated in.
                                    cSet[m].fitness = fitness;
                                }
                            } else {
                                cSet[m].nTrial += 1; // increase participation count for each participating neuron
                                cSet[m].fitness += fitness;
                            }
                        }
                        if (fitness > bestFitness) {
                            bestFitness = fitness;
                            bestSet = cSet;
                            bestGenes = genes;
                        }
                    }
                }
            }

            // sort the chromosomes by average fitness
            for (i = 0; i < nSp; i++) {
                c[i] = c[i].sort(compareChromosomes);
            }

            var nElite = Math.floor(Math.floor(this.elitePercentage * N) / 2) * 2; // even number
            for (i = 0; i < nSp; i++) {
                for (j = nElite; j < N; j += 2) {
                    var p1 = randi(0, nElite);
                    var p2 = randi(0, nElite);
                    c[i][p1].crossover(c[i][p2], c[i][j], c[i][j + 1]);
                }
            }

            // mutate the population size after 2*Nelite (keep one set of crossovers unmutiliated!)
            for (i = 0; i < nSp; i++) {
                for (j = 2 * nElite; j < N; j++) {
                    c[i][j].mutate(this.mutationRate, this.mutationSize);
                }
            }

            // put global and local best genes in the last element of each gene
            for (i = 0; i < nSp; i++) {
                c[i][N - 1].copyFromGene(this.bestGenes[i]);
                c[i][N - 2].copyFromGene(bestGenes[i]);
            }

            // didn't beat the record this time
            if (bestFitness < this.bestFitness) {
                this.bestFitnessCount++;
                // stagnation, do burst mutate!
                if (this.bestFitnessCount > this.burstGenerations) {
                    // add code here when progress stagnates later.
                    console.log('stagnating. burst mutate based on best solution.');
                    var bestGenesCopy = makeCopyOfGenes(this.bestGenes),
                        bestFitnessCopy = this.bestFitness;
                    this.initialize(bestGenesCopy);

                    this.bestGenes = bestGenesCopy;
                    this.bestFitness = this.bestFitnessCopy;
                }
            } else {
                this.bestFitnessCount = 0; // reset count for burst
                this.bestFitness = bestFitness; // record the best fitness score
                this.bestGenes = bestGenes; // record the set of genes that generated the best fitness
            }

            // push best one (found so far from all of history, not just this time) to network.
            assert(this.bestGenes.length === nSp);
            this.espnet.pushGenes(this.bestGenes);

            return bestFitness;
        }
    };
    RL.ESPTrainer = ESPTrainer;
// END OF REINFORCEJS

    var _Agent;
    self.onmessage = (e) => {
        var data = e.data,
            actionIndex;
        if (data.cmd === 'init') {
            importScripts('../Utility.js');
            var returnV,
                oEnv = JSON.parse(data.input.env, function (key, value) {
                    if (typeof value !== 'string') {
                        returnV = value;
                    }
                    if (value.substring(0, 8) === 'function') {
                        returnV = eval('(' + value + ')');
                    }
                    return returnV;
                }),
                oOpts = JSON.parse(data.input.opts);
        }
        var brain = data.target.split('.');
        switch (brain[0]) {
            // RL
            case 'RL':
                switch (data.cmd) {
                    case 'init':
                        _Agent = new global[brain[0]][brain[1]](oEnv, oOpts);

                        self.postMessage({
                            cmd: 'init',
                            msg: 'complete',
                            input: _Agent.toJSON()
                        });
                        break;
                    case 'act':
                        actionIndex = _Agent.act(data.input);

                        self.postMessage({
                            cmd: 'act',
                            msg: 'complete',
                            input: actionIndex
                        });
                        break;
                    case 'load':
                        if (_Agent.brain.learning === false) {
                            _Agent.epsilon = 0.05;
                            _Agent.alpha = 0;
                        }
                        _Agent.fromJSON(JSON.parse(data.input));

                        self.postMessage({
                            cmd: 'load',
                            msg: 'complete',
                            input: _Agent.toJSON()
                        });
                        break;
                    case 'learn':
                        _Agent.learn(data.input);

                        self.postMessage({
                            cmd: 'learn',
                            msg: 'complete',
                            input: _Agent.toJSON()
                        });
                        break;
                    case 'save':
                        self.postMessage({
                            cmd: 'save',
                            msg: 'complete',
                            input: _Agent.toJSON()
                        });
                        break;
                    case 'stop':
                        self.postMessage({
                            cmd: 'stop',
                            msg: 'complete',
                            input: _Agent.toJSON()
                        });
                        close(); // Terminates the worker.
                        break;
                    default:
                        self.postMessage({
                            cmd: 'error',
                            msg: 'Unknown command: ' + data.cmd
                        });
                }
                break;
        }
    };

// exports
    if (typeof process !== 'undefined') { // Checks for Node.js - http://stackoverflow.com/a/27931000/1541408
        module.exports = {
            R: R,
            RL: RL,
            // various utils
            assert: assert,
            zeros: zeros,
            randi: randi,
            randn: randn,
            randc: randc,
            randf: randf
        };
    } else {
        global.R = R;
        global.RL = RL;
        // various utils
        global.assert = assert;
        global.zeros = zeros;
        global.randi = randi;
        global.randn = randn;
        global.randc = randc;
        global.randf = randf;
    }

})(this);