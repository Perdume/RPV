interface Window {
  fs: {
    readFile(path: string, options: { encoding: string }): Promise<string>;
    writeFile(path: string, data: string, options: { encoding: string }): Promise<void>;
  };
} 