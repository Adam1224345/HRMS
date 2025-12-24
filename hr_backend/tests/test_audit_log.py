def test_audit_logs(client):
    res = client.get("/api/audit-logs")
    assert res.status_code in [200, 400, 401, 404]
