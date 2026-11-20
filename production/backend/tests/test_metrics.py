def test_metrics_exposes_prometheus_counters(client) -> None:
    assert client.get("/health").status_code == 200
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "lovelaundry_http_requests_total" in response.text
    assert 'method="GET",status="200"' in response.text
    assert "lovelaundry_uptime_seconds" in response.text
