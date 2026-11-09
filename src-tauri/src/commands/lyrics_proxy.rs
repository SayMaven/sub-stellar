use std::collections::HashMap;
use serde::{Deserialize, Serialize};

const ALLOWED_DOMAINS: &[&str] = &[
    "lrclib.net",
    "music.163.com",
    "y.qq.com",
    "c.y.qq.com",
    "kugou.com",
    "service-56839352-1300947703.gz.apigw.tencentcs.com",
];

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: String,
}

#[tauri::command]
pub async fn lyrics_http_get(
    url: String,
    headers: Option<HashMap<String, String>>,
) -> Result<String, String> {
    // Domain allowlist verification (Security standard)
    let parsed_url = reqwest::Url::parse(&url)
        .map_err(|e| format!("Invalid URL: {e}"))?;

    let host = parsed_url
        .host_str()
        .ok_or_else(|| "URL missing host".to_string())?;

    let is_allowed = ALLOWED_DOMAINS.iter().any(|domain| host == *domain || host.ends_with(&format!(".{domain}")));
    if !is_allowed {
        return Err(format!("Domain '{}' is not in the allowed lyrics provider list", host));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let mut req = client.get(&url);

    // Default browser-like User-Agent (crucial for NetEase & QQ music endpoints)
    req = req.header(
        reqwest::header::USER_AGENT,
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    );

    if let Some(custom_headers) = headers {
        for (k, v) in custom_headers {
            req = req.header(k, v);
        }
    }

    let res = req.send().await.map_err(|e| format!("HTTP request failed: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("HTTP request returned error status: {}", res.status()));
    }

    let body = res.text().await.map_err(|e| format!("Failed to read response body: {e}"))?;
    Ok(body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allowed_domains_check() {
        assert!(ALLOWED_DOMAINS.contains(&"lrclib.net"));
        assert!(ALLOWED_DOMAINS.contains(&"music.163.com"));
    }
}

