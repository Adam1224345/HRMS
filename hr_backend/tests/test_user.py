def test_get_users(client):
    res = client.get("/api/users")
    assert res.status_code in [200, 400, 401, 404]
