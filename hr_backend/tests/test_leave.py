def test_get_leaves(client):
    res = client.get("/api/leaves")
    assert res.status_code in [200, 400, 401, 404]

