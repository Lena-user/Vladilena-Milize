# Nạp mật khẩu Postgres local vào môi trường mà không in ra.
set -a; . ./.env.postgres-local; set +a
export PG_TEST_URL="postgresql://luong_test:${LOCAL_PG_TEST_PASSWORD}@127.0.0.1:55433/luong_test_control"
export DEV_DATABASE_URL="postgresql://luong_dev:${LOCAL_PG_DEV_PASSWORD}@127.0.0.1:55432/luong_dev"
