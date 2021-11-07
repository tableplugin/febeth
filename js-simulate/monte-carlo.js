const {BinPool} = require("./model/bin-pool");
var assert = require('assert');
var expect = require('chai').expect;

const pool = new BinPool();

const mcConfig = {
  p: 50n * pool.ONE_PERCENT,
  initialPoolValue: BigInt(100e9),
  numMCRuns: 1000,
  betsPerMCRun: 500000,
  evalStepSize: 50000,
};

describe("Monte Carlo Simulation", function() {
  this.timeout(60 * 60 * 1000);
  it("500k bets", () => {
    const allCheckpoints = runMC();
    const {means, stddeviations, yieldBounds} = evaluateMC(allCheckpoints);

    const printYields = [];
    for (let i = 0; i < yieldBounds.length; i++) {
      const yieldBound = yieldBounds[i];
      printYields.push("| "
          + (mcConfig.evalStepSize * i)
          + " bets | "
          + yieldBound.meanYield.toFixed(2)
          + "% | Min: " + yieldBound.lowerYield.toFixed(2)
          + "% Max: " + yieldBound.upperYield.toFixed(2) + "% |");
    }

    console.log("Means", means);
    console.log("Standard deviations", stddeviations);
    console.log("Expected Yield within 3 Standard Deviations (99.7% probability)\n", printYields.join("\n"));
    console.log("MC simulation finished with config", mcConfig);

    expect(yieldBounds[0]).to.eql({lowerYield: 0, meanYield: 0, upperYield: 0});

    const midYield = yieldBounds[4];
    expect(midYield.lowerYield).to.above(0).below(10);
    expect(midYield.meanYield).to.above(15).below(30);
    expect(midYield.upperYield).to.above(35).below(50);

    const lastYield = yieldBounds[yieldBounds.length - 1];
    expect(lastYield.lowerYield).to.above(15).below(30);
    expect(lastYield.meanYield).to.above(55).below(75);
    expect(lastYield.upperYield).to.above(95).below(130);
  });
});

function runMC() {
  const allCheckpoints = [];
  for (let run = 0; run < mcConfig.numMCRuns; run++) {
    if (run % (mcConfig.numMCRuns / 100) === 0) {
      console.log("(" + run + "/" + mcConfig.numMCRuns + ") MC runs...");
    }
    const checkPoints = doSingleMCRun();
    allCheckpoints.push(checkPoints);
  }
  return allCheckpoints;
}

function doSingleMCRun() {
  const pool = new BinPool();
  pool._ethBalance = mcConfig.initialPoolValue;
  pool._totalSupply = mcConfig.initialPoolValue;
  const checkPoints = [];
  for (let betIdx = 0; betIdx <= mcConfig.betsPerMCRun; betIdx++) {
    const poolValue = pool._ethBalance;
    if (betIdx % mcConfig.evalStepSize === 0) {
      checkPoints.push(Number(poolValue));
    }
    const wager = ((poolValue * mcConfig.p) / (pool.HUNDRED_PERCENT - pool.houseEdge)) / pool.poolDivider;
    pool.bet(mcConfig.p, {value: wager, from: 0xB});
  }
  return checkPoints;
}

function evaluateMC(allCheckpoints) {
  const means = [];
  const stddeviations = [];
  const evalLen = allCheckpoints[0].length;
  for (let evalStep = 0; evalStep < evalLen; evalStep++) {
    means.push(0);
    stddeviations.push(0);
  }
  for (let run = 0; run < mcConfig.numMCRuns; run++) {
    const singleRunCheckpoints = allCheckpoints[run];
    assert(singleRunCheckpoints.length === evalLen);
    for (let evalStep = 0; evalStep < evalLen; evalStep++) {
      means[evalStep] += singleRunCheckpoints[evalStep];
    }
  }
  for (let evalStep = 0; evalStep < evalLen; evalStep++) {
    means[evalStep] /= mcConfig.numMCRuns;
  }
  for (let run = 0; run < allCheckpoints.length; run++) {
    const singleRunCheckpoints = allCheckpoints[run];
    for (let evalStep = 0; evalStep < evalLen; evalStep++) {
      stddeviations[evalStep] += Math.pow(singleRunCheckpoints[evalStep] - means[evalStep], 2) / mcConfig.numMCRuns;
    }
  }
  for (let evalStep = 0; evalStep < evalLen; evalStep++) {
    stddeviations[evalStep] = Math.sqrt(stddeviations[evalStep]);
  }
  const yieldBounds = [];
  for (let evalStep = 0; evalStep < evalLen; evalStep++) {
    const stddev = stddeviations[evalStep];
    const lowerValue = means[evalStep] - 3 * stddev;
    const upperValue = means[evalStep] + 3 * stddev;
    const initValue = Number(mcConfig.initialPoolValue);
    const lowerYield = 100 * (lowerValue - initValue) / initValue;
    const meanYield = 100 * (means[evalStep] - initValue) / initValue;
    const upperYield = 100 * (upperValue - initValue) / initValue;
    yieldBounds.push({lowerYield, meanYield, upperYield});
  }
  return {means, stddeviations, yieldBounds};
}
