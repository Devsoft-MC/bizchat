-- Run once while connected to the VPS PostgreSQL "postgres" database
-- as the postgres administrator. Keep DBeaver auto-commit enabled.
-- DBeaver will prompt for bizchat_db_password.

CREATE ROLE bizchat_app
  LOGIN
  PASSWORD '${bizchat_db_password}'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;

CREATE DATABASE bizchatdb
  WITH
  OWNER = bizchat_app
  ENCODING = 'UTF8'
  TEMPLATE = template0;
