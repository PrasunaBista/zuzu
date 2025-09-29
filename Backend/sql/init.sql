CREATE EXTENSION IF NOT EXISTS vector;


-- Chats metadata (for listing / analytics)
CREATE TABLE IF NOT EXISTS chats (
chat_id UUID PRIMARY KEY,
title TEXT,
created_at TIMESTAMPTZ DEFAULT now(),
updated_at TIMESTAMPTZ DEFAULT now()
);


-- Per-message analytics materialization
CREATE TABLE IF NOT EXISTS message_events (
id BIGSERIAL PRIMARY KEY,
chat_id UUID REFERENCES chats(chat_id) ON DELETE CASCADE,
role TEXT CHECK (role IN ('user','assistant')),
category TEXT,
ts TIMESTAMPTZ DEFAULT now()
);