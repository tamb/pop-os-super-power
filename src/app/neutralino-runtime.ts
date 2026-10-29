/// <reference path="./neutralino.d.ts" />

export type ExecResult = {
  exitCode: number;
  stdOut: string;
  stdErr: string;
};

export async function execCommand(command: string): Promise<ExecResult> {
  return Neutralino.os.execCommand(command);
}

export async function getSessionEnv(): Promise<{
  display: string;
  xauthority: string;
}> {
  const [display, xauthority] = await Promise.all([
    Neutralino.os.getEnv("DISPLAY"),
    Neutralino.os.getEnv("XAUTHORITY"),
  ]);
  return { display, xauthority };
}
