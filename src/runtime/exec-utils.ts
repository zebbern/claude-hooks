/**
 * Shape of the error object thrown by `child_process.execSync` on non-zero exit.
 */
export interface ExecSyncError {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Type guard that checks whether an unknown error matches the {@link ExecSyncError} shape.
 *
 * @param err - The caught error value.
 * @returns `true` if `err` has a `status` property (the `execSync` error shape).
 */
export function isExecSyncError(err: unknown): err is ExecSyncError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err
  );
}
