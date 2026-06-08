export type ExtHandlers = {
  onClick?: () => void;
  dispose?: () => void;
};

export const extStore = new Map<string, ExtHandlers>();
