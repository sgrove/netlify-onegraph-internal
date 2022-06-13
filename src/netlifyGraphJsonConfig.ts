export type JsonConfig = {
  editor?: string;
  codegen?: {
    override: {
      [key: string]: {
        tsType?: string;
      };
    };
  };
};
