export type Now = () => number;

export const systemNow: Now = () => Date.now();
