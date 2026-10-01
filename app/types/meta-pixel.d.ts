declare global {
  interface Window {
    fbq?: (
      command: string,
      event: string,
      parameters?: Record<string, unknown>,
      options?: { eventID?: string }
    ) => void;
  }
}

export {};