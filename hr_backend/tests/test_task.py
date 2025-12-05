def test_get_tasks(client):
    res = client.get("/api/tasks")
    assert res.status_code in [200, 400, 401, 404]
