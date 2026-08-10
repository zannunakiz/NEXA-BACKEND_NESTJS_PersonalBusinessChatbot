-- =============================================
-- NEXA CHATBOT SYSTEM - NEONDB POSTGRES SCHEMA
-- Version: 3.1.0
-- Engine: PostgreSQL (NeonDB Compatible)
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing views, tables, and types for idempotent migrations
DROP VIEW IF EXISTS session_details;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS characteristics CASCADE;
DROP TABLE IF EXISTS chatbots CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS characteristic_type CASCADE;
DROP TYPE IF EXISTS member_role CASCADE;

-- =============================================
-- 1. USERS TABLE
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    image_url TEXT NULL,
    otp_code VARCHAR(6) NULL,
    otp_expired_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_otp_code ON users(otp_code);

-- =============================================
-- 2. ORGANIZATIONS TABLE
-- =============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    image_url TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_organization_owner FOREIGN KEY (owner_id) 
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_name ON organizations(name);

-- =============================================
-- 3. MEMBERS TABLE
-- =============================================
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    role member_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_member_organization FOREIGN KEY (organization_id) 
        REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_member_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT unique_member_org_user UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_members_organization_id ON members(organization_id);
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_role ON members(role);
CREATE INDEX idx_members_org_user ON members(organization_id, user_id);

-- =============================================
-- 4. CHATBOTS TABLE
-- =============================================
CREATE TABLE chatbots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    image_url TEXT NULL,
    system_prompt TEXT NULL,
    welcome_message TEXT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_chatbot_organization FOREIGN KEY (organization_id) 
        REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_chatbot_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_chatbot_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_chatbots_organization_id ON chatbots(organization_id);
CREATE INDEX idx_chatbots_created_by ON chatbots(created_by);
CREATE INDEX idx_chatbots_created_at ON chatbots(created_at DESC);

-- =============================================
-- 5. CHARACTERISTICS TABLE
-- =============================================
CREATE TYPE characteristic_type AS ENUM ('data', 'restrict');

CREATE TABLE characteristics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chatbot_id UUID NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    type characteristic_type NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_characteristic_chatbot FOREIGN KEY (chatbot_id) 
        REFERENCES chatbots(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_characteristic_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_characteristic_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_characteristics_chatbot_id ON characteristics(chatbot_id);
CREATE INDEX idx_characteristics_type ON characteristics(type);
CREATE INDEX idx_characteristics_chatbot_type ON characteristics(chatbot_id, type);

-- =============================================
-- 6. SESSIONS TABLE
-- =============================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_email_encrypted BYTEA NOT NULL,
    organization_id UUID NOT NULL,
    chatbot_id UUID NOT NULL,
    start_session_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_session_organization FOREIGN KEY (organization_id) 
        REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_session_chatbot FOREIGN KEY (chatbot_id) 
        REFERENCES chatbots(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_sessions_organization_id ON sessions(organization_id);
CREATE INDEX idx_sessions_chatbot_id ON sessions(chatbot_id);
CREATE INDEX idx_sessions_start_date ON sessions(start_session_date DESC);
CREATE INDEX idx_sessions_org_chatbot ON sessions(organization_id, chatbot_id);

-- =============================================
-- 7. CHATS TABLE
-- =============================================
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    chatbot_id UUID NOT NULL,
    ai_chat TEXT NOT NULL,
    customer_chat TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_chat_session FOREIGN KEY (session_id) 
        REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_chat_chatbot FOREIGN KEY (chatbot_id) 
        REFERENCES chatbots(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_chats_session_id ON chats(session_id);
CREATE INDEX idx_chats_chatbot_id ON chats(chatbot_id);
CREATE INDEX idx_chats_created_at ON chats(created_at DESC);
CREATE INDEX idx_chats_session_created ON chats(session_id, created_at DESC);
CREATE INDEX idx_chats_chatbot_created ON chats(chatbot_id, created_at DESC);

-- =============================================
-- TRIGGER: Auto-update updated_at columns
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chatbots_updated_at BEFORE UPDATE ON chatbots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_characteristics_updated_at BEFORE UPDATE ON characteristics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VIEW: Chat Session Details (for dashboard)
-- =============================================
CREATE VIEW session_details AS
SELECT 
    s.id AS session_id,
    s.start_session_date,
    c.name AS chatbot_name,
    o.name AS organization_name,
    COUNT(ch.id) AS total_messages
FROM sessions s
JOIN chatbots c ON c.id = s.chatbot_id
JOIN organizations o ON o.id = s.organization_id
LEFT JOIN chats ch ON ch.session_id = s.id
GROUP BY s.id, s.start_session_date, c.name, o.name
ORDER BY s.start_session_date DESC;