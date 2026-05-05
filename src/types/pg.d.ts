declare module "pg" {
  export class Client {
    constructor(config?: any);
    connect(): Promise<void>;
    query(text: string): Promise<any>;
    end(): Promise<void>;
  }
}