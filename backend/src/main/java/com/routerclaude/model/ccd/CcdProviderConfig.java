package com.routerclaude.model.ccd;

import java.util.List;

/**
 * CCD {uuid}.json config format.
 *
 * Standard fields (used by CCD): inferenceProvider, inferenceGatewayBaseUrl,
 * inferenceGatewayApiKey, inferenceModels.
 *
 * Custom fields (_ prefix, ignored by CCD): _providerApiUrl, _providerApiKey.
 * These store the actual provider API info so the proxy can forward requests.
 */
public class CcdProviderConfig {
    private String inferenceProvider;
    private String inferenceGatewayBaseUrl;
    private String inferenceGatewayApiKey;
    private List<CcdModel> inferenceModels;

    // Custom fields — CCD ignores unrecognized fields
    private String _providerApiUrl;
    private String _providerApiKey;

    public CcdProviderConfig() {}

    public String getInferenceProvider() { return inferenceProvider; }
    public void setInferenceProvider(String inferenceProvider) { this.inferenceProvider = inferenceProvider; }
    public String getInferenceGatewayBaseUrl() { return inferenceGatewayBaseUrl; }
    public void setInferenceGatewayBaseUrl(String inferenceGatewayBaseUrl) { this.inferenceGatewayBaseUrl = inferenceGatewayBaseUrl; }
    public String getInferenceGatewayApiKey() { return inferenceGatewayApiKey; }
    public void setInferenceGatewayApiKey(String inferenceGatewayApiKey) { this.inferenceGatewayApiKey = inferenceGatewayApiKey; }
    public List<CcdModel> getInferenceModels() { return inferenceModels; }
    public void setInferenceModels(List<CcdModel> inferenceModels) { this.inferenceModels = inferenceModels; }

    public String get_providerApiUrl() { return _providerApiUrl; }
    public void set_providerApiUrl(String _providerApiUrl) { this._providerApiUrl = _providerApiUrl; }
    public String get_providerApiKey() { return _providerApiKey; }
    public void set_providerApiKey(String _providerApiKey) { this._providerApiKey = _providerApiKey; }
}
