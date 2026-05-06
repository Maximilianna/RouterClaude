export interface Model {
  name: string;
  supports1m: boolean;
}

export interface Provider {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  models: Model[];
  enabled: boolean;
}

export interface ProviderConfig {
  name: string;
  apiUrl: string;
  apiKey: string;
  models: Model[];
}
