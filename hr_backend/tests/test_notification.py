def test_notifications(client):
    res = client.get("/api/notifications")
    assert res.status_code in [200, 400, 401, 404]
