-- create the users table (the main table for everyone)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('hospital', 'blood_bank', 'doctor', 'admin')),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    contact_person_name VARCHAR(255),
    contact_person_phone VARCHAR(50),
    total_doctors INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create blood_banks table
CREATE TABLE IF NOT EXISTS blood_banks (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    contact_person_name VARCHAR(255),
    contact_person_phone VARCHAR(50),
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create doctors table
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    medical_license_number VARCHAR(100) UNIQUE,
    specialization VARCHAR(100),
    department VARCHAR(100),
    invite_token VARCHAR(255) UNIQUE,
    invited_by UUID REFERENCES users(id),
    invite_expires_at TIMESTAMP,
    is_invite_accepted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create donors table (sensitive - not shown in app)
CREATE TABLE IF NOT EXISTS donors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    date_of_birth DATE NOT NULL,
    blood_type VARCHAR(5) NOT NULL CHECK (
        blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    ),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_available BOOLEAN DEFAULT true,
    last_donation_date DATE,
    next_eligible_date DATE,
    registered_by UUID REFERENCES users(id),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    whatsapp_consent BOOLEAN DEFAULT false,
    whatsapp_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMP
);

-- Create donor_health_info table
CREATE TABLE IF NOT EXISTS donor_health_info (
    donor_id UUID PRIMARY KEY REFERENCES donors(id) ON DELETE CASCADE,
    weight_kg DECIMAL(5,2) CHECK (weight_kg >= 40),
    height_cm INTEGER,
    has_contagious_diseases BOOLEAN DEFAULT false,
    has_chronic_illness BOOLEAN DEFAULT false,
    last_health_check_date DATE,
    health_notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create blood_requests table
CREATE TABLE IF NOT EXISTS blood_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(50) UNIQUE NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id),
    hospital_id UUID REFERENCES hospitals(id),
    patient_name VARCHAR(255),
    patient_age INTEGER,
    patient_gender VARCHAR(10),
    blood_type VARCHAR(5) NOT NULL CHECK (
        blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    ),
    units_needed INTEGER NOT NULL CHECK (units_needed > 0),
    urgency_level VARCHAR(20) DEFAULT 'normal' CHECK (
        urgency_level IN ('low', 'normal', 'high', 'critical')
    ),
    needed_by TIMESTAMP,
    purpose TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'matched', 'fulfilled', 'cancelled', 'expired')
    ),
    ai_agent_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Create donor_matches table (AI agent results)
CREATE TABLE IF NOT EXISTS donor_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blood_request_id UUID NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2),
    distance_km DECIMAL(8,2),
    contacted_via_whatsapp BOOLEAN DEFAULT false,
    whatsapp_message_id VARCHAR(255),
    donor_response VARCHAR(20) CHECK (
        donor_response IN ('pending', 'accepted', 'declined', 'no_response')
    ),
    response_received_at TIMESTAMP,
    is_selected_for_donation BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(blood_request_id, donor_id)
);

-- Create whatsapp_logs table
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
    message_type VARCHAR(50) CHECK (
        message_type IN ('blood_request', 'verification', 'follow_up', 'thank_you')
    ),
    message_sid VARCHAR(255),
    to_number VARCHAR(50) NOT NULL,
    message_body TEXT NOT NULL,
    status VARCHAR(50) CHECK (
        status IN ('sent', 'delivered', 'read', 'failed')
    ),
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP
);

-- Create audit_logs table (for security and tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE INDEX IF NOT EXISTS idx_blood_banks_location ON blood_banks(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_doctors_hospital ON doctors(hospital_id);
CREATE INDEX IF NOT EXISTS idx_donors_blood_location ON donors(blood_type, latitude, longitude, is_available, next_eligible_date);
CREATE INDEX IF NOT EXISTS idx_donors_availability ON donors(is_available, next_eligible_date);
CREATE INDEX IF NOT EXISTS idx_donors_location ON donors(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status, urgency_level, created_at);
CREATE INDEX IF NOT EXISTS idx_blood_requests_type_location ON blood_requests(blood_type, created_at);
CREATE INDEX IF NOT EXISTS idx_donor_matches_request ON donor_matches(blood_request_id);
CREATE INDEX IF NOT EXISTS idx_donor_matches_donor ON donor_matches(donor_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_donor ON whatsapp_logs(donor_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Insert a sample admin user (optional - change password in production!)
INSERT INTO users (email, password_hash, role, is_verified) 
VALUES ('admin@bloodbank.com', '$2b$10$YourHashedPasswordHere', 'admin', true) 
ON CONFLICT (email) DO NOTHING;

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blood_banks_updated_at BEFORE UPDATE ON blood_banks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blood_requests_updated_at BEFORE UPDATE ON blood_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donor_matches_updated_at BEFORE UPDATE ON donor_matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Let's print a success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database tables created successfully!';
    RAISE NOTICE '📊 Total tables created: 10';
    RAISE NOTICE '🔑 Sample admin user created (email: admin@bloodbank.com)';
    RAISE NOTICE '🚀 Database setup complete!';
END $$;