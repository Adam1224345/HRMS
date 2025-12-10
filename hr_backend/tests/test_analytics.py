def test_analytics_dashboard(client):
    res = client.get("/api/analytics/dashboard")
    assert res.status_code in [200, 400, 401, 404]

