import { assert } from "chai";
import TaskPool from "../src/utils/taskPool";

describe("TaskPool", function () {
  it("runs tasks and clears them", async function () {
    const pool = new TaskPool();
    let count = 0;
    pool.add(async () => {
      count++;
    });
    await pool.drain();
    assert.equal(count, 1);
  });

  it("retries failing tasks", async function () {
    const pool = new TaskPool();
    let attempts = 0;
    pool.add(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error("fail");
      }
    }, 1);
    await pool.drain();
    assert.equal(attempts, 2);
  });
});
