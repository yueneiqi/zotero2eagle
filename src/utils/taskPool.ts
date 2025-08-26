import { FileLogger } from "./fileLogger";

export type Task = () => Promise<any>;

export default class TaskPool {
  private tasks: Set<Promise<any>> = new Set();

  add(task: Task, retries = 0) {
    const wrapped = async () => {
      let attempt = 0;
      while (true) {
        try {
          return await task();
        } catch (e) {
          attempt++;
          if (attempt > retries) {
            try {
            await FileLogger.log("ERROR", "TaskPool", String(e));
          } catch {
            /* ignore logging errors */
          }
            throw e;
          }
        }
      }
    };
    const promise = wrapped().finally(() => this.tasks.delete(promise));
    this.tasks.add(promise);
  }

  async drain() {
    await Promise.all(Array.from(this.tasks));
  }
}
