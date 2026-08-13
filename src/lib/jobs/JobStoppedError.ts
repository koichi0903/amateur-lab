export class JobStoppedError extends Error {
  constructor(jobName: string) {
    super(`${jobName} was stopped by the administrator`);
    this.name = "JobStoppedError";
  }
}
